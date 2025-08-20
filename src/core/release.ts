import {
  ReleaseInfo,
  GitHubRepository,
  ReleaseFetchParams,
} from '../types';
import { logger } from '../utils/logger';
import { Repository } from './repository';

import { fetchReleasesFromSnowflake } from './snowflake-releases';

// Type definitions for date range calculations
type DateRangeResult = {
  startDate: Date;
  endDate: Date;
  description: string;
};

type Timeframe = {
  type: 'hours' | 'days' | 'date';
  value: number | Date;
  startDate?: Date;
  endDate?: Date;
};

/**
 * Release service handling release-related operations
 * Processes release data, filters by date, and provides business logic
 */
export class Release {
  private readonly repository: Repository;

  constructor(token: string) {
    this.repository = new Repository(token);
  }

  /**
   * Fetches releases based on configuration
   * @param config - Application configuration containing orgName, timeframe, repositories, snowflake config, etc.
   * @returns Promise<ReleaseInfo[]> - Array of release information
   */
  async getReleases(config: any): Promise<ReleaseInfo[]> {
    const { orgName, timeframe, repositories, snowflake: snowflakeConfig } = config;
    const { startDate, endDate } = this.calculateDateRange(timeframe);
    let releases: ReleaseInfo[] = [];

    this.validateDateRange(startDate, endDate);

    logger.info(`Fetching releases for organization: ${orgName}`);
    logger.info(`Timeframe: ${timeframe.type} = ${timeframe.value}`);
    logger.info(`Time range: ${startDate.toISOString()} to ${endDate.toISOString()}`);

    if (repositories && repositories.length > 0) {
      logger.info(`Repository filter: ${repositories.join(', ')}`);
    }

    try {
      if (!snowflakeConfig) {
        throw new Error('No Snowflake configuration found');
      }
      logger.info('Using Snowflake to fetch releases...');
      releases = await fetchReleasesFromSnowflake(config, startDate, endDate);
    } catch (error) {
      logger.error('Snowflake fetch failed, falling back to GitHub API:', error);

      // Fallback to GitHub API
      // releases = await this.fetchReleases({
      //   orgName,
      //   startDate,
      //   endDate,
      //   repositories
      // });
    }
    return releases;
  }

  /**
 * Fetch and process releases from repositories
 */
  private async fetchReleases(params: ReleaseFetchParams): Promise<ReleaseInfo[]> {
    const { orgName, startDate, endDate, repositories } = params;

    try {
      let repositoriesToProcess: GitHubRepository[];

      // Use efficient single repository fetching if specific repositories are requested
      if (repositories && repositories.length > 0) {
        logger.info(`🎯 Using efficient single repository fetching for: ${repositories.join(', ')}`);
        repositoriesToProcess = await this.repository.fetchSpecificRepositories(orgName, repositories);
      } else {
        // Fetch all repositories using pagination (existing behavior)
        logger.info(`📄 Fetching all repositories with pagination...`);
        repositoriesToProcess = await this.repository.fetchAllRepositories(params);
      }

      // Process releases from the repositories
      const releases = this.processRepositories(
        repositoriesToProcess,
        { startDate, endDate }
      );
      return releases;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      logger.error(`Release fetching failed: ${errorMessage}`);
      if (errorStack) {
        logger.error(`Release fetching stack trace: ${errorStack}`);
      }

      // Log additional context for debugging
      logger.error(`Release fetching context - Organization: ${orgName}, Date Range: ${startDate.toISOString()} to ${endDate.toISOString()}`);
      if (repositories && repositories.length > 0) {
        logger.error(`Release fetching context - Requested repositories: ${repositories.join(', ')}`);
      }

      throw error;
    }
  }

  /**
   * Process repositories to extract and filter releases
   */
  private processRepositories(
    repositories: GitHubRepository[],
    dateRange: { startDate: Date; endDate?: Date }
  ): ReleaseInfo[] {
    const releases: ReleaseInfo[] = [];
    let totalReleases = 0;

    for (const repo of repositories) {
      // Process releases for this repository
      for (const release of repo.releases.nodes) {
        totalReleases++;

        if (this.isReleaseInDateRange(release.publishedAt, dateRange)) {
          releases.push({
            repository: repo.name,
            tagName: release.tagName,
            name: release.name || release.tagName,
            publishedAt: release.publishedAt,
            description: release.description || '',
            url: release.url,
            author: release.author.login,
            isPrerelease: release.isPrerelease
          });
        }
      }
    }

    logger.info(`📦 Processed ${repositories.length} repositories`);
    return releases;
  }

  /**
   * Check if a release falls within the specified date range
   * @param publishedAt - Release publish date string
   * @param dateRange - Date range to check against
   * @returns boolean
   */
  private isReleaseInDateRange(
    publishedAt: string,
    dateRange: { startDate: Date; endDate?: Date }
  ): boolean {
    const publishedDate = new Date(publishedAt);
    const { startDate, endDate } = dateRange;

    if (publishedDate < startDate) {
      return false;
    }

    if (endDate && publishedDate > endDate) {
      return false;
    }

    return true;
  }

  private validateDateRange(startDate: Date, endDate: Date): void {
    if (startDate > endDate) {
      throw new Error('Start date cannot be after end date');
    }

    if (startDate > new Date()) {
      throw new Error('Start date cannot be in the future');
    }

    // Guard against windows exceeding 7 days inclusive
    const msInDay = 24 * 60 * 60 * 1000;
    const startMidnight = new Date(startDate);
    startMidnight.setUTCHours(0, 0, 0, 0);
    const endMidnight = new Date(endDate);
    endMidnight.setUTCHours(0, 0, 0, 0);
    const inclusiveDays = Math.floor((endMidnight.getTime() - startMidnight.getTime()) / msInDay) + 1;
    if (inclusiveDays > 7) {
      throw new Error(`Date range exceeds 7 days: ${inclusiveDays} days`);
    }
  }

  private calculateDateRange(timeframe: Timeframe): DateRangeResult {
    const now = new Date();

    // If explicit start and end dates are provided, use them
    if (timeframe.startDate && timeframe.endDate) {
      return this.calculateDateRangeFromStartEnd(timeframe.startDate, timeframe.endDate);
    }

    switch (timeframe.type) {
      case 'date':
        return this.calculateDateRangeForDate(timeframe.value as Date);
      case 'days': {
        const endAnchor = timeframe.endDate ?? now;
        return this.calculateDateRangeForDays(timeframe.value as number, endAnchor);
      }
      case 'hours':
        return this.calculateDateRangeForHours(timeframe.value as number, now);
      default:
        throw new Error(`Unknown timeframe type: ${timeframe.type}`);
    }
  }

  private calculateDateRangeForDate(targetDate: Date): DateRangeResult {
    const startDate = new Date(targetDate);
    startDate.setUTCHours(0, 0, 0, 0);

    const endDate = new Date(targetDate);
    endDate.setUTCHours(23, 59, 59, 999);

    const dateStr = targetDate.toISOString().split('T')[0];
    return { startDate, endDate, description: `on ${dateStr}` };
  }

  private calculateDateRangeForDays(daysBack: number, endAt: Date): DateRangeResult {
    const endDate = new Date(endAt);
    endDate.setUTCHours(23, 59, 59, 999);
    const startDate = new Date(endDate);
    startDate.setUTCDate(endDate.getUTCDate() - (daysBack - 1));
    startDate.setUTCHours(0, 0, 0, 0);
    return { startDate, endDate, description: `in the last ${daysBack} days` };
  }

  private calculateDateRangeForHours(hoursBack: number, now: Date): DateRangeResult {
    const startDate = new Date(now.getTime() - hoursBack * 60 * 60 * 1000);
    const endDate = new Date(now);
    return { startDate, endDate, description: `in the last ${hoursBack} hours` };
  }

  private calculateDateRangeFromStartEnd(start: Date, end: Date): DateRangeResult {
    const startDate = new Date(start);
    startDate.setUTCHours(0, 0, 0, 0);

    const endDate = new Date(end);
    endDate.setUTCHours(23, 59, 59, 999);

    const msInDay = 24 * 60 * 60 * 1000;
    const startMidnight = new Date(startDate);
    const endMidnight = new Date(endDate);
    const inclusiveDays = Math.floor((endMidnight.getTime() - startMidnight.getTime()) / msInDay) + 1;
    if (inclusiveDays > 7) {
      throw new Error(`Date range too large: ${inclusiveDays} days. Maximum allowed is 7 days.`);
    }

    const description = `from ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`;
    return { startDate, endDate, description };
  }
}
