import {
  GitHubRepository,
  RetryConfig,
  ReleaseFetchParams,
  RepositoryQueryVariables,
  PaginationStats,
  EarlyStopConfig
} from '../types';
import { logger } from '../utils/logger';
import { GitHubGraphQLClient } from '../clients/github-graphql-client';

/**
 * Repository service handling GitHub repository fetching operations
 * Manages pagination, retry logic, and early stopping optimizations
 */
export class Repository {
  private readonly graphqlClient: GitHubGraphQLClient;

  private readonly retryConfig: RetryConfig = {
    maxRetries: 5, // Increased from 3 to 5 for better resilience
    baseDelay: 2000, // Increased from 1000ms to 2000ms for 502 errors
    maxDelay: 30000, // Increased from 10000ms to 30000ms
  };

  private readonly earlyStopConfig: EarlyStopConfig = {
    cutoffDays: 7, // 1 week - for both early stopping and release filtering
    enabled: true,
  };

  // Circuit breaker for 502 errors
  private circuitBreaker = {
    failureCount: 0,
    lastFailureTime: 0,
    isOpen: false,
    threshold: 3, // Open circuit after 3 consecutive 502 errors
    timeout: 60000, // Close circuit after 60 seconds
  };

  constructor(token: string) {
    this.graphqlClient = new GitHubGraphQLClient(token);
  }

  /**
   * Fetch specific repositories efficiently using single repository queries
   * @param orgName - Organization name
   * @param repositoryNames - Array of repository names to fetch
   * @returns Promise<GitHubRepository[]> - Array of repositories
   */
  async fetchSpecificRepositories(orgName: string, repositoryNames: string[]): Promise<GitHubRepository[]> {
    const repositories: GitHubRepository[] = [];

    logger.info(`🎯 Fetching ${repositoryNames.length} specific repositories...`);

    for (const repoName of repositoryNames) {
      try {
        logger.info(`📦 Fetching repository: ${repoName}`);
        const repository = await this.executeWithRetry(
          () => this.graphqlClient.fetchSingleRepository(orgName, repoName),
          `fetch repository ${repoName}`
        );

        if (repository) {
          repositories.push(repository);
          logger.info(`✅ Successfully fetched repository: ${repoName}`);
        } else {
          logger.warn(`⚠️  Repository not found: ${repoName}`);
        }
      } catch (error) {
        logger.error(`❌ Failed to fetch repository ${repoName}: ${error}`);
        // Continue with other repositories even if one fails
      }
    }

    logger.info(`📊 Specific repository fetching complete. Found ${repositories.length} out of ${repositoryNames.length} requested repositories.`);
    return repositories;
  }

  /**
   * Fetch all repositories for an organization with pagination
   * Includes early stopping optimization based on repository updatedAt
   */
  async fetchAllRepositories(params: ReleaseFetchParams): Promise<GitHubRepository[]> {
    const { orgName, startDate } = params;
    const repositories: GitHubRepository[] = [];
    let hasNextPage = true;
    let cursor: string | null = null;

    const stats: PaginationStats = {
      totalRepositories: 0,
      totalReleases: 0,
      filteredReleases: 0,
      pageCount: 0,
      earlyStopEnabled: this.earlyStopConfig.enabled,
      repositoriesScanned: 0
    };

    // Calculate cutoff date for early stopping optimization
    const cutoffDate = new Date(startDate);
    // cutoffDate.setDate(cutoffDate.getDate() - this.earlyStopConfig.cutoffDays);

    try {
      while (hasNextPage) {
        stats.pageCount++;
        logger.info(`📄 Fetching page ${stats.pageCount} of repositories...`);

        const variables: RepositoryQueryVariables = {
          orgName,
          first: 100, // Fetch 100 repositories per page
        };

        if (cursor) {
          variables.after = cursor;
        }

        const response = await this.executeWithRetry(
          () => this.graphqlClient.fetchRepositoriesPage(variables),
          `fetch repositories page ${stats.pageCount}`
        );

        // Add debugging and error handling for response structure
        if (!response) {
          throw new Error(`GraphQL response is null or undefined for page ${stats.pageCount}`);
        }

        if (!response.organization) {
          logger.error(`GraphQL response structure: ${JSON.stringify(response, null, 2)}`);
          throw new Error(`GraphQL response missing 'organization' field. Response keys: ${Object.keys(response).join(', ')}`);
        }

        const { repositories: repoPage } = response.organization;
        const repos = repoPage.nodes;
        stats.totalRepositories += repos.length;

        // Check for early stopping and collect repositories
        const { shouldStop, processedRepos } = this.processRepositoryPage(
          repos,
          cutoffDate,
          stats
        );

        repositories.push(...processedRepos);
        stats.repositoriesScanned += processedRepos.length;

        if (shouldStop) {
          logger.info(`⏹️  Early stopping activated. Processed ${stats.repositoriesScanned} repositories.`);
          hasNextPage = false;
        } else {
          hasNextPage = repoPage.pageInfo.hasNextPage;
          cursor = repoPage.pageInfo.endCursor;
        }

        // Rate limiting
        if (hasNextPage) {
          await this.sleep(200); // Increased from 100ms to 200ms delay between pages
        }
      }

      logger.info(`\n📊 Repository fetching Results:`);
      return repositories;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      logger.error(`Repository fetching failed: ${errorMessage}`);
      if (errorStack) {
        logger.error(`Repository fetching stack trace: ${errorStack}`);
      }

      // Log additional context for debugging
      logger.error(`Repository fetching context - Organization: ${orgName}, Cutoff Date: ${cutoffDate.toISOString()}`);

      throw error;
    }
  }

  /**
   * Process a page of repositories and apply early stopping logic
   * Also filters releases to only include those within the cutoff timeframe
   */
  private processRepositoryPage(
    repos: GitHubRepository[],
    cutoffDate: Date,
    stats: PaginationStats
  ): { shouldStop: boolean; processedRepos: GitHubRepository[] } {
    const processedRepos: GitHubRepository[] = [];
    let shouldStop = false;

    for (const repo of repos) {
      const repoUpdatedAt = new Date(repo.updatedAt);

      // Early stopping check
      if (this.earlyStopConfig.enabled && repoUpdatedAt < cutoffDate) {
        shouldStop = true;
        break;
      }

      // Filter releases to only include those within the cutoff timeframe
      const filteredReleases = repo.releases.nodes.filter(release => {
        const releaseDate = new Date(release.publishedAt);
        return releaseDate >= cutoffDate;
      });

      // Create a new repository object with filtered releases
      const filteredRepo: GitHubRepository = {
        ...repo,
        releases: {
          nodes: filteredReleases
        }
      };

      processedRepos.push(filteredRepo);
    }

    return { shouldStop, processedRepos };
  }

  /**
   * Execute operation with exponential backoff retry
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    let lastError: Error;

    // Check circuit breaker
    if (this.circuitBreaker.isOpen) {
      const timeSinceLastFailure = Date.now() - this.circuitBreaker.lastFailureTime;
      if (timeSinceLastFailure < this.circuitBreaker.timeout) {
        const remainingTime = this.circuitBreaker.timeout - timeSinceLastFailure;
        logger.warn(`🚫 Circuit breaker is open. Waiting ${Math.ceil(remainingTime / 1000)}s before retrying...`);
        await this.sleep(remainingTime);
      } else {
        logger.info(`🔄 Circuit breaker timeout reached, attempting operation...`);
        this.circuitBreaker.isOpen = false;
        this.circuitBreaker.failureCount = 0;
      }
    }

    for (let attempt = 1; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        const result = await operation();

        // Reset circuit breaker on success
        if (this.circuitBreaker.failureCount > 0) {
          logger.info(`✅ Operation succeeded, resetting circuit breaker`);
          this.circuitBreaker.failureCount = 0;
          this.circuitBreaker.isOpen = false;
        }

        return result;
      } catch (error) {
        lastError = error as Error;
        const errorMessage = lastError.message.toLowerCase();

        // Special handling for 502 Bad Gateway errors
        const is502Error = errorMessage.includes('502') || errorMessage.includes('bad gateway');

        if (is502Error) {
          this.circuitBreaker.failureCount++;
          this.circuitBreaker.lastFailureTime = Date.now();

          // Open circuit breaker if threshold reached
          if (this.circuitBreaker.failureCount >= this.circuitBreaker.threshold) {
            this.circuitBreaker.isOpen = true;
            logger.error(`🚫 Circuit breaker opened due to ${this.circuitBreaker.failureCount} consecutive 502 errors`);
          }
        }

        // Check if error is retryable
        const isRetryable = this.isRetryableError(lastError);

        if (!isRetryable) {
          logger.error(`❌ ${operationName} failed with non-retryable error: ${lastError.message}`);
          throw lastError;
        }

        if (attempt === this.retryConfig.maxRetries) {
          logger.error(`❌ ${operationName} failed after ${this.retryConfig.maxRetries} attempts: ${lastError.message}`);
          throw lastError;
        }

        // Use longer delays for 502 errors
        let delay: number;
        if (is502Error) {
          // For 502 errors, use longer delays: 5s, 10s, 20s, 30s, 30s
          delay = Math.min(5000 * (2 ** (attempt - 1)), this.retryConfig.maxDelay);
          logger.warn(`🌐 ${operationName} failed with 502 Bad Gateway (attempt ${attempt}/${this.retryConfig.maxRetries}): ${lastError.message}`);
        } else {
          // For other errors, use standard exponential backoff
          delay = Math.min(
            this.retryConfig.baseDelay * 2 ** (attempt - 1),
            this.retryConfig.maxDelay
          );
          logger.warn(`⚠️  ${operationName} failed (attempt ${attempt}/${this.retryConfig.maxRetries}): ${lastError.message}`);
        }

        logger.info(`🔄 Retrying in ${delay}ms...`);

        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  /**
   * Sleep utility for rate limiting
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => {
      setTimeout(resolve, ms);
    });
  }

  private isRetryableError(error: Error): boolean {
    // Check for GraphQL Response Error with status
    if (error.name === 'GraphqlResponseError' || 'response' in error) {
      const graphqlError = error as any;
      const status = graphqlError.headers?.status || graphqlError.response?.status;

      if (status) {
        const statusCode = parseInt(status.toString(), 10);

        // 4xx Client errors - NOT retryable
        if (statusCode >= 400 && statusCode < 500) {
          return false;
        }

        // 5xx Server errors - Retryable
        if (statusCode >= 500 && statusCode < 600) {
          return true;
        }
      }

      // GraphQL validation errors (no HTTP status) - NOT retryable
      if (graphqlError.errors && Array.isArray(graphqlError.errors)) {
        return false;
      }
    }

    // Check for Node.js error codes
    const nodeError = error as any;
    if (nodeError.code) {
      switch (nodeError.code) {
        // Network errors - retryable
        case 'ECONNRESET':
        case 'ECONNREFUSED':
        case 'ETIMEDOUT':
        case 'ENOTFOUND':
        case 'EAI_AGAIN':
          return true;

        // File system errors - NOT retryable
        case 'ENOENT':
        case 'EACCES':
        case 'EPERM':
          return false;

        // Unknown error codes - NOT retryable (fail fast)
        default:
          return false;
      }
    }

    // Default to NON-retryable for unknown errors (fail fast)
    return false;
  }
}
