/**
 * GitHub GraphQL API response structure for organization queries
 */
export interface OrganizationResponse {
  organization: {
    repositories: {
      pageInfo: {
        hasNextPage: boolean;
        endCursor: string | null;
      };
      nodes: GitHubRepository[];
    };
  };
}

/**
 * GitHub GraphQL API response structure for single repository queries
 */
export interface SingleRepositoryResponse {
  organization: {
    repository: GitHubRepository | null;
  };
}

/**
 * GitHub repository structure from GraphQL API
 */
export interface GitHubRepository {
  name: string;
  updatedAt: string;
  releases: {
    nodes: GitHubRelease[];
  };
}

/**
 * GitHub release structure from GraphQL API
 */
export interface GitHubRelease {
  tagName: string;
  name: string | null;
  publishedAt: string;
  description: string | null;
  url: string;
  author: {
    login: string;
  };
  isPrerelease: boolean;
}

/**
 * Configuration for GitHub API retry mechanism
 */
export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
}

/**
 * Parameters for fetching releases by date range
 */
export interface ReleaseFetchParams {
  orgName: string;
  startDate: Date;
  endDate?: Date;
  dateDescription?: string;
  repositories?: string[]; // Optional: specific repositories to filter
}

/**
 * GraphQL query variables for repository fetching
 */
export interface RepositoryQueryVariables {
  orgName: string;
  first: number;
  after?: string;
  [key: string]: any; // Allow additional properties for GraphQL client compatibility
}

/**
 * Pagination statistics for tracking optimization
 */
export interface PaginationStats {
  totalRepositories: number;
  totalReleases: number;
  filteredReleases: number;
  pageCount: number;
  earlyStopEnabled: boolean;
  repositoriesScanned: number;
}

/**
 * Early stopping configuration
 */
export interface EarlyStopConfig {
  cutoffDays: number;
  enabled: boolean;
}
