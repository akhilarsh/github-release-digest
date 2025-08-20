import { ReleaseInfo, SummaryConfig } from '../types';
import { logger } from '../utils/logger';
import { summarizeText } from '../AI/open-router';

/**
 * Format release information into separate messages for each repository
 * Main entry point for formatting releases (refactored version)
 */
export async function formatReleaseMessage(
  releases: ReleaseInfo[],
  config: SummaryConfig,
  requestedRepositories?: string[]
): Promise<string[]> {
  try {
    validateReleases(releases);
    logger.info(`Formatting separate messages for ${releases.length} releases`);

    const messages: string[] = [];

    const header = createSummaryHeader(releases, config, requestedRepositories);
    messages.push(header);

    const summaryTable = createSummaryTable(releases);
    messages.push(summaryTable);

    if (config.includeDescriptions) {
      const details = await createSummaryDetails(releases, config);
      messages.push(...details);
    }

    messages.forEach((message, index) => {
      logger.info(`Message ${index + 1}:`);
      const lines = message.split('\n');
      lines.forEach(line => {
        if (line.trim()) {
          logger.info(line);
        }
      });
    });

    return messages;
  } catch (error) {
    logger.error(`Error formatting combined release message: ${error}`);
    throw new Error(`Failed to format combined release message: ${error}`);
  }
}

/**
 * Create summary header with stats
 */
function createSummaryHeader(
  releases: ReleaseInfo[],
  config: SummaryConfig,
  requestedRepositories?: string[]
): string {
  const dateRange = getDateRangeText(config);

  if (releases.length === 0) {
    return `:bar_chart: RELEASE SUMMARY: No releases found for ${dateRange}`;
  }

  const stableCount = releases.filter(r => !r.isPrerelease).length;
  const preReleaseCount = releases.filter(r => r.isPrerelease).length;
  const repoCount = new Set(releases.map(r => r.repository)).size;

  let summaryMessage = `:bar_chart: RELEASE SUMMARY - ${dateRange}`;

  if (requestedRepositories && requestedRepositories.length > 0) {
    const repoList = requestedRepositories.join(', ');
    summaryMessage += ` - ${repoList}`;
  }

  summaryMessage += `\n\nSummary: ${releases.length} releases • ${stableCount} stable • ${preReleaseCount} pre-release • ${repoCount} repositories`;

  return summaryMessage;
}

/**
 * Create detailed repository descriptions
 */
async function createSummaryDetails(
  releases: ReleaseInfo[],
  config: SummaryConfig
): Promise<string[]> {
  const messages: string[] = [];

  const releasesByRepo = new Map<string, ReleaseInfo[]>();
  releases.forEach(release => {
    if (!releasesByRepo.has(release.repository)) {
      releasesByRepo.set(release.repository, []);
    }
    releasesByRepo.get(release.repository)!.push(release);
  });

  for (const [repoName, repoReleases] of releasesByRepo) {
    let repoMessage = '';

    repoMessage += '```\n';

    repoMessage += `${repoName}:\n\n`;

    for (const release of repoReleases) {
      const dateStr = formatDateForTable(release.publishedAt);
      const versionText = extractVersionFromName(release.name);
      repoMessage += `                  | *${versionText} | ${dateStr} | ${release.url}*\n`;
    }

    // Generate combined summary for all releases in this repository
    const allDescriptions = repoReleases.map(release => {
      const rawDescription = release.description || 'No description available';
      return rawDescription;
    }).filter(desc => desc !== 'No description' && desc.length > 0);

    if (allDescriptions.length > 0) {
      const combinedDescription = allDescriptions.join(' ');

      // Only perform AI summarization if includeDescriptions is true
      if (config.includeDescriptions) {
        try {
          const summarizedDescription = await summarizeText(combinedDescription);
          repoMessage += `                  | *Summary:*\n`;

          // Wrap the summary text to fit the column width
          const detailsColWidth = 110;
          const wrappedSummary = wrapText(summarizedDescription, detailsColWidth);
          wrappedSummary.forEach(line => {
            if (line.trim() !== '') {
              repoMessage += `                  | ${line}\n`;
            }
          });

          logger.info(`AI summarized combined description for ${repoName}`);
        } catch (error) {
          logger.warn(`Failed to summarize combined description for ${repoName}, using original: ${error}`);
          // Use a simple fallback summary
          const releaseCount = repoReleases.length;
          const latestVersion = repoReleases[0].name;
          repoMessage += `                  | *Summary:*\n`;
          repoMessage += `                  | ${releaseCount} release${releaseCount > 1 ? 's' : ''} including ${latestVersion} with technical improvements and bug fixes.\n`;
        }
      } else {
        // Skip AI summarization when includeDescriptions is false
        logger.info(`Skipping AI summarization for ${repoName} (includeDescriptions: false)`);
      }
    } else {
      repoMessage += `                  | *Summary:*\n`;
      repoMessage += `                  | ${repoReleases.length} release${repoReleases.length > 1 ? 's' : ''} with technical updates.\n`;
    }

    // Close code block
    repoMessage += '```\n';

    messages.push(repoMessage);
  }

  return messages;
}

/**
 * Create a summary table of all releases
 */
export function createSummaryTable(releases: ReleaseInfo[]): string {
  if (releases.length === 0) {
    return '```\nNo releases found\n```';
  }

  let tableMessage = '```\n';

  // Group releases by repository
  const releasesByRepo = new Map<string, ReleaseInfo[]>();
  releases.forEach(release => {
    if (!releasesByRepo.has(release.repository)) {
      releasesByRepo.set(release.repository, []);
    }
    releasesByRepo.get(release.repository)!.push(release);
  });

  // Log releasesByRepo with full details
  logger.info('📋 Releases grouped by repository:');
  const releasesByRepoObj = Object.fromEntries(releasesByRepo);
  logger.info(JSON.stringify(releasesByRepoObj, null, 2));

  // Calculate column widths
  const repoColWidth = Math.max(
    'Repository'.length,
    ...Array.from(releasesByRepo.keys()).map(repo => repo.length)
  );
  const versionColWidth = 15;
  const dateColWidth = 20; // Fixed width for date format
  const urlColWidth = 60; // Fixed width for URL display

  // Create header
  const header = `Repository${' '.repeat(repoColWidth - 'Repository'.length)} | Version${' '.repeat(versionColWidth - 'Version'.length)} | Published At${' '.repeat(dateColWidth - 'Published At'.length)} | URL${' '.repeat(urlColWidth - 'URL'.length)}`;
  tableMessage += `${header}\n`;

  // Create separator
  const separator = `${'-'.repeat(repoColWidth)}-+-${'-'.repeat(versionColWidth)}-+-${'-'.repeat(dateColWidth)}-+-${'-'.repeat(urlColWidth)}`;
  tableMessage += `${separator}\n`;

  // Add rows for each repository
  for (const [repoName, repoReleases] of releasesByRepo) {
    for (const release of repoReleases) {
      const dateStr = formatDateForTable(release.publishedAt);
      const shortUrl = release.url.length > urlColWidth ? `${release.url.substring(0, urlColWidth - 3)}...` : release.url;

      // Show repo name in every row for simplicity
      const repoPadded = repoName.padEnd(repoColWidth);
      const versionText = extractVersionFromName(release.name);
      const versionPadded = versionText.padEnd(versionColWidth);
      const datePadded = dateStr.padEnd(dateColWidth);
      const urlPadded = shortUrl.padEnd(urlColWidth);

      tableMessage += `${repoPadded} | ${versionPadded} | ${datePadded} | ${urlPadded}\n`;
    }
  }

  tableMessage += '```\n';
  return tableMessage;
}

/**
 * Validate releases array
 */
export function validateReleases(releases: ReleaseInfo[]): void {
  if (!Array.isArray(releases)) {
    throw new Error('Releases must be an array');
  }

  releases.forEach((release, index) => {
    if (!release.repository || !release.name || !release.publishedAt) {
      throw new Error(`Invalid release data at index ${index}: missing required fields`);
    }
  });
}

/**
 * Generate date range text for the header
 */
export function getDateRangeText(config: SummaryConfig): string {
  try {
    const now = new Date();

    if (config.timeframe.type === 'date') {
      const targetDate = config.timeframe.value instanceof Date ? config.timeframe.value : new Date(config.timeframe.value);
      return `${targetDate.toISOString().split('T')[0]}`;
    } if (config.timeframe.type === 'days') {
      const days = typeof config.timeframe.value === 'number' ? config.timeframe.value : 0;

      // Prefer explicit start/end if provided by upstream calculation
      if (config.timeframe.startDate && config.timeframe.endDate) {
        const startStr = config.timeframe.startDate.toISOString().split('T')[0];
        const endStr = config.timeframe.endDate.toISOString().split('T')[0];
        const dayText = days === 1 ? '1 day' : `${days} days`;
        return `${dayText} (${startStr} to ${endStr})`;
      }

      // Fallback: compute based on now (kept for robustness)
      const endDate = new Date(now);
      const startDate = new Date(now);
      startDate.setDate(now.getDate() - (days - 1));

      const startStr = startDate.toISOString().split('T')[0];
      const endStr = endDate.toISOString().split('T')[0];
      const dayText = days === 1 ? '1 day' : `${days} days`;
      return `${dayText} (${startStr} to ${endStr})`;
    } if (config.timeframe.type === 'hours') {
      const endDate = new Date(now);
      const startDate = new Date(now);
      const hours = typeof config.timeframe.value === 'number' ? config.timeframe.value : 0;
      startDate.setHours(now.getHours() - hours);

      // For hours, show the actual time range
      const startStr = `${startDate.toISOString().split('T')[1].split('.')[0]} UTC`;
      const endStr = `${endDate.toISOString().split('T')[1].split('.')[0]} UTC`;
      const dateStr = startDate.toISOString().split('T')[0];

      const hourText = hours === 1 ? '1 hour' : `${hours} hours`;
      return `${hourText} (${dateStr} ${startStr} to ${endStr})`;
    }
    return '';
  } catch (error) {
    logger.error(`Error generating date range text: ${error}`);
    return '';
  }
}

/**
 * Generate timeframe text for logging and display purposes
 */
export function generateTimeframeText(timeframe: { type: 'hours' | 'days' | 'date'; value: number | Date }): string {
  switch (timeframe.type) {
    case 'hours':
      return `${timeframe.value}h`;
    case 'days':
      return `${timeframe.value}d`;
    case 'date':
      return `date-${(timeframe.value as Date).toISOString().split('T')[0]}`;
    default:
      return 'unknown';
  }
}

/**
 * Format date for tabular display (shorter format)
 */
export function formatDateForTable(isoString: string): string {
  try {
    const date = new Date(isoString);

    // Format: YYYY-MM-DD HH:MM UTC
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes} UTC`;
  } catch (error) {
    logger.error(`Error formatting table date ${isoString}: ${error}`);
    return isoString.split('T')[0]; // fallback to date only
  }
}

/**
 * Clean description by removing PR links, issue links, and commit hashes
 * Returns 'No description' if the cleaned description is empty
 */
export function cleanDescription(description: string): string {
  if (!description) return 'No description';

  let cleaned = description;

  // Remove PR links: #123 or #1234
  cleaned = cleaned.replace(/#\d+/g, '');

  // Remove issue links: #123 or #1234
  cleaned = cleaned.replace(/#\d+/g, '');

  // Remove commit hashes: 8-character hex strings
  cleaned = cleaned.replace(/\b[a-fA-F0-9]{8,}\b/g, '');

  // Remove URLs
  cleaned = cleaned.replace(/https?:\/\/[^\s]+/g, '');

  // Remove GitHub-specific patterns
  // Remove markdown links: ([]( ([c4ec7c7]( etc.
  cleaned = cleaned.replace(/\(\[[^\]]*\]\([^)]*\)/g, '');
  cleaned = cleaned.replace(/\(\[[^\]]*\]\(/g, '');
  cleaned = cleaned.replace(/\(\[[^\]]*\]/g, '');

  // Remove GitHub issue/PR references: #123, #1234
  cleaned = cleaned.replace(/#\d+/g, '');

  // Remove GitHub commit references: [commit-hash](url)
  cleaned = cleaned.replace(/\[[a-fA-F0-9]{7,}\]\([^)]*\)/g, '');

  // Remove GitHub user mentions: @username
  cleaned = cleaned.replace(/@[a-zA-Z0-9_-]+/g, '');

  // Remove GitHub release tags: v1.0.0, v2.1.3-beta
  cleaned = cleaned.replace(/v\d+\.\d+\.\d+[a-zA-Z0-9.-]*/g, '');

  // Remove GitHub compare URLs: compare/v1.0.0...v1.1.0
  cleaned = cleaned.replace(/compare\/[^)]+/g, '');

  // Remove GitHub commit URLs: commit/abc123
  cleaned = cleaned.replace(/commit\/[a-fA-F0-9]+/g, '');

  // Remove extra whitespace and normalize line breaks
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  // Remove empty lines
  cleaned = cleaned.replace(/\n\s*\n/g, '\n');

  return cleaned || 'No description';
}

/**
 * Wrap text to fit within specified width, preserving line breaks
 */
export function wrapText(text: string, width: number): string[] {
  if (!text || width <= 0) return [''];

  const lines: string[] = [];

  // Split by existing line breaks first
  const paragraphs = text.split('\n');

  paragraphs.forEach(paragraph => {
    if (paragraph.trim() === '') {
      return; // Skip empty paragraphs instead of adding empty lines
    }

    // Wrap long lines
    let currentLine = '';
    const words = paragraph.split(' ');

    words.forEach(word => {
      // If adding this word would exceed width, start new line
      if (currentLine.length + word.length + 1 > width && currentLine.length > 0) {
        lines.push(currentLine.trim());
        currentLine = word;
      } else {
        currentLine += (currentLine.length > 0 ? ' ' : '') + word;
      }
    });

    // Add the last line if there's content
    if (currentLine.trim().length > 0) {
      lines.push(currentLine.trim());
    }
  });

  return lines.length > 0 ? lines : [''];
}

/**
 * Extract version number from release name
 * Handles cases like:
 * - "xyz-sdk-js@2.52.0" -> "2.52.0"
 * - "@xyz/analytics-js@3.22.0" -> "3.22.0"
 * - "v1.2.3" -> "v1.2.3"
 * - "Version 1.2.3" -> "Version 1.2.3"
 */
export function extractVersionFromName(name: string): string {
  if (!name) return name;

  // Pattern to match package names with @version at the end
  // Matches: package-name@version, @scope/package@version
  const packageVersionPattern = /@([^@]+)$/;
  const match = name.match(packageVersionPattern);

  if (match) {
    // Extract just the version part after the last @
    return match[1];
  }

  // If no @ pattern found, return the original name
  return name;
}

