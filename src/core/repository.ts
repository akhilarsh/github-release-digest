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
    maxRetries: 3,
    baseDelay: 1000, // 1 second
    maxDelay: 10000, // 10 seconds
  };
  private readonly earlyStopConfig: EarlyStopConfig = {
    cutoffDays: 7, // 1 week
    enabled: true,
  };

  constructor(token: string) {
    this.graphqlClient = new GitHubGraphQLClient(token);
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
    cutoffDate.setDate(cutoffDate.getDate() - this.earlyStopConfig.cutoffDays);

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
          await this.sleep(100); // 100ms delay between pages
        }
      }

      this.logResults(stats, 'Repository fetching');
      return repositories;

    } catch (error) {
      logger.error(`Repository fetching failed: ${error}`);
      throw error;
    }
  }

  /**
   * Process a page of repositories and apply early stopping logic
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

      processedRepos.push(repo);
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

    for (let attempt = 1; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        if (attempt === this.retryConfig.maxRetries) {
          logger.error(`❌ ${operationName} failed after ${this.retryConfig.maxRetries} attempts: ${lastError.message}`);
          throw lastError;
        }

        const delay = Math.min(
          this.retryConfig.baseDelay * Math.pow(2, attempt - 1),
          this.retryConfig.maxDelay
        );

        logger.warn(`⚠️  ${operationName} failed (attempt ${attempt}/${this.retryConfig.maxRetries}): ${lastError.message}`);
        logger.info(`🔄 Retrying in ${delay}ms...`);

        await this.sleep(delay);
      }
    }

    throw lastError!;
  }

  /**
   * Log repository fetching statistics
   */
  private logResults(stats: PaginationStats, description: string): void {
    logger.info(`\n📊 ${description} Results:`);
  }

  /**
   * Sleep utility for rate limiting
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
