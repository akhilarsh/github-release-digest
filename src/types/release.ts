/**
 * Information about a GitHub release
 */
export interface ReleaseInfo {
  repository: string;
  tagName: string;
  name: string;
  publishedAt: string;
  description: string;
  url: string;
  author: string;
  isPrerelease: boolean;
}

/**
 * Release summary statistics
 */
export interface ReleaseSummaryStats {
  totalReleases: number;
  prereleases: number;
  stableReleases: number;
  repositoriesWithReleases: number;
  totalRepositoriesChecked: number;
  timeRange: {
    from: string;
    to: string;
    hours: number;
  };
}

/**
 * Service health check response
 */
export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  checks: {
    github: boolean;
    slack: boolean;
    config: boolean;
  };
}

/**
 * Error response structure
 */
export interface ErrorResponse {
  error: string;
  message: string;
  timestamp: string;
  details?: unknown;
}
