/**
 * Information about a GitHub release
 */
export interface ReleaseInfo {
  repository: string;        // Added during processing
  tagName: string;          // From GraphQL
  name: string;             // From GraphQL (name || tagName)
  publishedAt: string;      // From GraphQL
  description: string;      // From GraphQL (description || '')
  url: string;              // From GraphQL
  author: string;           // From GraphQL (author.login)
  isPrerelease: boolean;    // From GraphQL
}

/**
 * Configuration for release summary formatting
 */
export interface SummaryConfig {
  timeframe: {
    type: 'hours' | 'days' | 'date';
    value: number | Date;
    startDate?: Date;
    endDate?: Date;
  };
  includeDescriptions?: boolean; // If true, include detailed descriptions; if false or undefined, show only summary table
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
