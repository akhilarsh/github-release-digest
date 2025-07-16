import {
  ReleaseInfo,
  GitHubRepository,
  ReleaseFetchParams,
  PaginationStats
} from '../types';
import { logger } from '../utils/logger';
import { Repository } from './repository';

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
   * Fetches releases from a specific day
   * @param orgName - GitHub organization name
   * @param targetDate - Target date (defaults to today)
   * @returns Promise<ReleaseInfo[]> - Array of release information
   */
  async getDailyReleases(orgName: string, targetDate?: Date): Promise<ReleaseInfo[]> {
    // Use provided date or default to today
    const date = targetDate || new Date();

    // Calculate start and end of the target day (UTC)
    const startOfDay = new Date(date);
    startOfDay.setUTCHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD format

    logger.info(`Fetching daily releases for organization: ${orgName}`);
    logger.info(`Target date: ${dateStr} (UTC)`);
    logger.info(`Date range: ${startOfDay.toISOString()} to ${endOfDay.toISOString()}`);

    return this.fetchReleases({
      orgName,
      startDate: startOfDay,
      endDate: endOfDay,
      dateDescription: `on ${dateStr}`
    });
  }

  /**
   * Fetches releases from the last N hours
   * @param orgName - GitHub organization name
   * @param hoursBack - Number of hours to look back (default: 24)
   * @returns Promise<ReleaseInfo[]> - Array of release information
   */
  async getRecentReleases(orgName: string, hoursBack: number = 24): Promise<ReleaseInfo[]> {
    const now = new Date();
    const startTime = new Date(now.getTime() - hoursBack * 60 * 60 * 1000);

    logger.info(`Fetching releases from the last ${hoursBack} hours for organization: ${orgName}`);
    logger.info(`Time range: ${startTime.toISOString()} to ${now.toISOString()}`);

    return this.fetchReleases({
      orgName,
      startDate: startTime,
      endDate: now,
      dateDescription: `in the last ${hoursBack} hours`
    });
  }

  /**
   * Fetch and process releases from repositories
   */
  private async fetchReleases(params: ReleaseFetchParams): Promise<ReleaseInfo[]> {
    const { startDate, endDate, dateDescription } = params;

    try {
      // Fetch repositories using Repository service
      const repositories = await this.repository.fetchAllRepositories(params);

      // Process releases from the repositories
      const releases = this.processRepositories(
        repositories,
        { startDate, endDate }
      );

      this.logReleaseResults(releases, dateDescription || 'specified time range');
      return releases;

    } catch (error) {
      logger.error(`Release fetching failed: ${error}`);
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

  /**
   * Log release processing results
   */
  private logReleaseResults(releases: ReleaseInfo[], description: string): void {
    logger.info(`🎯 Release Processing Results:`);

    if (releases.length > 0) {
      const prereleases = releases.filter(r => r.isPrerelease).length;
      const stableReleases = releases.length - prereleases;
      const uniqueRepos = new Set(releases.map(r => r.repository)).size;

      logger.info(`   • Stable releases: ${stableReleases}`);
      logger.info(`   • Pre-releases: ${prereleases}`);
      logger.info(`   • Repositories with releases: ${uniqueRepos}`);
    }
  }
}
