import { ReleaseInfo } from '../types';
import { logger } from '../utils/logger';

export interface SummaryConfig {
  releaseMode: 'recent' | 'daily';
  hoursBack?: number;
  targetDate?: Date;
}

/**
 * Format date from ISO string to readable format with time and timezone
 */
export function formatDateTime(isoString: string): string {
  try {
    const date = new Date(isoString);

    // Format: YYYY-MM-DD | HH:MM:SS UTC
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    const seconds = String(date.getUTCSeconds()).padStart(2, '0');

    return `${year}-${month}-${day} | ${hours}:${minutes}:${seconds} UTC`;
  } catch (error) {
    logger.error(`Error formatting date ${isoString}: ${error}`);
    return isoString; // fallback to original
  }
}

/**
 * Format date for tabular display (shorter format)
 */
export function formatDateForTable(isoString: string): string {
  try {
    const date = new Date(isoString);

    // Format: YYYY-MM-DD | HH:MM UTC
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');

    return `${year}-${month}-${day} | ${hours}:${minutes} UTC`;
  } catch (error) {
    logger.error(`Error formatting table date ${isoString}: ${error}`);
    return isoString.split('T')[0]; // fallback to date only
  }
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
 * Format release information into a message string using either detailed or tabular format
 */
export function formatReleaseMessage(
  releases: ReleaseInfo[],
  config: SummaryConfig,
  format: 'detailed' | 'tabular' = 'tabular'
): string {
  try {
    validateReleases(releases);

    logger.info(`Formatting message for ${releases.length} releases in ${format} format`);

    let formattedMessage: string;

    if (format === 'tabular') {
      // Use the tabular format
      formattedMessage = generateTabularSummary(releases, config);
    } else {
      // Use the detailed format
      formattedMessage = generateDetailedSummary(releases, config);
    }

    return formattedMessage;
  } catch (error) {
    logger.error(`Error formatting release message: ${error}`);
    throw new Error(`Failed to format release message: ${error}`);
  }
  }

  /**
 * Clean description by removing PR links, issue links, and commit hashes
 */
export function cleanDescription(description: string): string {
  if (!description || typeof description !== 'string') {
    return 'No description available';
  }

  try {
    return description
      // Remove version headers like "## 1.66.5 (2025-07-14)" or "# v1.104.6"
      .replace(/^#+\s*v?\d+\.\d+(\.\d+)*(\s*\(\d{4}-\d{2}-\d{2}\))?.*$/gm, '')
      // Remove release headers like "## Release v1.104.6" or "# Release 1.66.5 (2025-07-14)"
      .replace(/^#+\s*Release\s*v?\d+\.\d+(\.\d+)*(\s*\(\d{4}-\d{2}-\d{2}\))?.*$/gmi, '')
      // Remove markdown links like [text](url) but keep the text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Remove commit hashes in parentheses like ([a1b2c3d])
      .replace(/\s*\(\[[a-f0-9]{7,40}\]\([^)]+\)\)/g, '')
      // Remove issue/PR references like ([#123](url))
      .replace(/\s*\(\[#\d+\]\([^)]+\)\)/g, '')
      // Remove simple PR references like (#123)
      .replace(/\s*\(#\d+\)/g, '')
      // Remove standalone commit hashes like (a1b2c3d)
      .replace(/\s*\([a-f0-9]{7,40}\)/g, '')
      // Remove changelog URLs
      .replace(/\*\*Full Changelog\*\*:\s*https?:\/\/[^\s\n]+/g, '')
      // Clean up multiple spaces but preserve line structure
      .replace(/ +/g, ' ')
      // Clean up multiple empty lines
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      // Remove leading/trailing empty lines
      .replace(/^\s*\n+/, '')
      .replace(/\n+\s*$/, '')
      .trim();
  } catch (error) {
    logger.error(`Error cleaning description: ${error}`);
    return 'Description processing error';
  }
}

/**
 * Extract meaningful description content for table display
 */
export function extractTableDescription(description: string): string {
  if (!description || typeof description !== 'string') {
    return 'No description available';
  }

  try {
    const cleaned = cleanDescription(description);
    const lines = cleaned.split('\n').map(line => line.trim()).filter(line => line.length > 0);

    const meaningfulLines: string[] = [];
    let currentSection = '';

    // Process lines to extract meaningful content
    for (const line of lines) {
      // Skip version headers like "## 1.66.5 (2025-07-14)" or "# Release v1.104.6"
      if (line.match(/^#+\s*(v?\d+\.\d+(\.\d+)*(\s*\(\d{4}-\d{2}-\d{2}\))?|Release\s*v?\d+)/i)) {
        continue;
      }

      // Capture section headers for context
      if (line.match(/^#+\s*(Features|Bug Fixes?|Miscellaneous|Other Changes|Chore)/i)) {
        const sectionMatch = line.match(/^#+\s*(Features|Bug Fixes?|Miscellaneous|Other Changes|Chore)/i);
        if (sectionMatch) {
          currentSection = sectionMatch[1];
        }
        continue;
      }

      // Look for meaningful content lines
      if (line.length > 10 && !line.match(/^#+\s/)) {
        // Clean bullet points and format nicely
        let cleanedLine = line;

        // Remove bullet markers but keep content
        cleanedLine = cleanedLine.replace(/^\s*[\*\-\+]\s*/, '');

        // Add section context if available
        if (currentSection && meaningfulLines.length === 0) {
          cleanedLine = `${currentSection}: ${cleanedLine}`;
          currentSection = ''; // Only add context once
        }

        // Truncate very long lines but allow more space
        if (cleanedLine.length > 120) {
          cleanedLine = cleanedLine.substring(0, 115) + '...';
        }

        meaningfulLines.push(cleanedLine);

        // Collect up to 2-3 meaningful lines
        if (meaningfulLines.length >= 2) {
          break;
        }
      }
    }

    // Return the collected meaningful content
    if (meaningfulLines.length > 0) {
      return meaningfulLines.join(' • ');
    }

    // Fallback: if no meaningful content found, use first non-header line
    const nonHeaderLine = lines.find(line => !line.match(/^#+\s/) && line.length > 5);
    if (nonHeaderLine) {
      let fallback = nonHeaderLine.replace(/^\s*[\*\-\+]\s*/, '');
      return fallback.length > 120 ? fallback.substring(0, 115) + '...' : fallback;
    }

    return 'Release notes available';
  } catch (error) {
    logger.error(`Error extracting table description: ${error}`);
    return 'Description processing error';
  }
}

/**
 * Generate dynamic time period text based on release mode
 */
export function getTimePeriodText(config: SummaryConfig): string {
  try {
    if (config.releaseMode === 'daily' && config.targetDate) {
      const dateStr = config.targetDate.toISOString().split('T')[0];
      return `on ${dateStr}`;
    } else if (config.releaseMode === 'recent' && config.hoursBack) {
      const hours = config.hoursBack;
      if (hours === 24) {
        return 'in the last 24 hours';
      } else if (hours === 1) {
        return 'in the last hour';
      } else {
        return `in the last ${hours} hours`;
      }
    }

    // Fallback
    return 'recently';
    } catch (error) {
    logger.error(`Error generating time period text: ${error}`);
    return 'recently';
  }
}

/**
 * Generate header text for summaries
 */
export function getHeaderText(config: SummaryConfig): string {
  try {
    if (config.releaseMode === 'daily' && config.targetDate) {
      return config.targetDate.toISOString().split('T')[0];
    } else if (config.releaseMode === 'recent' && config.hoursBack) {
      const hours = config.hoursBack;
      return hours === 24 ? 'Last 24 hours' : hours === 1 ? 'Last hour' : `Last ${hours} hours`;
    }
    return '';
  } catch (error) {
    logger.error(`Error generating header text: ${error}`);
    return '';
  }
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
      lines.push('');
      return;
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
 * Generate formatted release summary message and log it (detailed format)
 */
export function generateDetailedSummary(releases: ReleaseInfo[], config: SummaryConfig): string {
  try {
    const timePeriod = getTimePeriodText(config);

    if (releases.length === 0) {
      const message = `📊 RELEASE SUMMARY: No releases found ${timePeriod}`;
      logger.info(message);
      return message;
    }

        // Build the formatted message with dynamic header
    const headerText = getHeaderText(config);
    const headerSuffix = headerText ? ` - ${headerText}` : '';

    let message = `${'='.repeat(80)}\n📊 RELEASE SUMMARY${headerSuffix}\n${'='.repeat(80)}\n`;

    releases.forEach((release, index) => {
      try {
        // Create clickable version link for Slack and add more spacing
        const versionLink = `<${release.url}|🚀 ${release.name}>`;
        const formattedDate = formatDateTime(release.publishedAt);
        message += `${index + 1}. 📦 ${release.repository}   ${versionLink}   ⏰ ${formattedDate}\n`;

        // Format description with first line on same line as icon
        const rawDescription = release.description || 'No description available';
        const cleanedDescription = cleanDescription(rawDescription);
        const lines = cleanedDescription.split('\n').filter(line => line.trim());

        if (lines.length > 0) {
          // First line on same line as icon
          message += `    ℹ️ ${lines[0].trim()}\n`;

          // Remaining lines with indentation
          lines.slice(1).forEach(line => {
            if (line.trim()) {
              message += `      ${line.trim()}\n`;
            }
          });
        } else {
          message += `    ℹ️ No description available\n`;
        }

        if (index < releases.length - 1) {
          message += '-'.repeat(100) + '\n';
        }
      } catch (error) {
        logger.error(`Error formatting release ${release.repository}: ${error}`);
        message += `${index + 1}. 📦 ${release.repository} - Error processing release details\n`;
      }
    });

    message += '='.repeat(80);

    // Log the formatted message to console
    const lines = message.split('\n');
    lines.forEach(line => {
      logger.info(line);
    });

    // Return the same message for Slack
    return message;
  } catch (error) {
    logger.error(`Error generating detailed summary: ${error}`);
    const errorMessage = `📊 RELEASE SUMMARY: Error generating summary - ${error}`;
    logger.info(errorMessage);
    return errorMessage;
    }
  }

  /**
 * Generate tabular release summary message and log it (Slack-friendly format)
 */
export function generateTabularSummary(releases: ReleaseInfo[], config: SummaryConfig): string {
  try {
    const timePeriod = getTimePeriodText(config);

    if (releases.length === 0) {
      const message = `📊 RELEASE SUMMARY: No releases found ${timePeriod}`;
      logger.info(message);
      return message;
    }

    // Build the header with dynamic content
    const headerText = getHeaderText(config);
    const headerSuffix = headerText ? ` - ${headerText}` : '';

    let message = `📊 *RELEASE SUMMARY${headerSuffix}*\n\n`;

    // Add summary stats before the table
    const stableCount = releases.filter(r => !r.isPrerelease).length;
    const preReleaseCount = releases.filter(r => r.isPrerelease).length;
    const repoCount = new Set(releases.map(r => r.repository)).size;

        message += `*Summary:* ${releases.length} releases • ${stableCount} stable • ${preReleaseCount} pre-release • ${repoCount} repositories\n\n`;

    // Calculate optimal column widths based on content
    let maxRepoWidth = 'Repository'.length;
    let maxVersionWidth = 'Version'.length;

    releases.forEach(release => {
      maxRepoWidth = Math.max(maxRepoWidth, release.repository.length);
      maxVersionWidth = Math.max(maxVersionWidth, release.name.length);
    });

    // Set reasonable limits with more space for descriptions
    const repoWidth = Math.min(maxRepoWidth + 2, 25);
    const versionWidth = Math.min(maxVersionWidth + 2, 12);
    const dateWidth = 23; // "2025-07-14 | 14:43 UTC" format

    // Start code block for monospace alignment
    message += '```\n';

    // Table header
    const repoHeader = 'Repository'.padEnd(repoWidth);
    const versionHeader = 'Version'.padEnd(versionWidth);
    const dateHeader = 'Published'.padEnd(dateWidth);
    const descHeader = 'Description';

    message += `${repoHeader} ${versionHeader} ${dateHeader} ${descHeader}\n`;
    message += `${'-'.repeat(repoWidth)} ${'-'.repeat(versionWidth)} ${'-'.repeat(dateWidth)} ${'-'.repeat(40)}\n`;

    // Table rows with multi-line description support
    releases.forEach((release, index) => {
      try {
        // Format published date with time and timezone
        const dateStr = formatDateForTable(release.publishedAt);

        // Extract meaningful description content
        const rawDescription = release.description || 'No description available';
        const descriptionText = extractTableDescription(rawDescription);

        // Prepare column data with proper truncation for repo and version only
        const repoText = release.repository.length > repoWidth - 2
          ? release.repository.substring(0, repoWidth - 5) + '...'
          : release.repository;

        // Create clickable version link for Slack
        const versionDisplayText = release.name.length > versionWidth - 2
          ? release.name.substring(0, versionWidth - 5) + '...'
          : release.name;
        const versionText = `<${release.url}|🚀${versionDisplayText}>`;

        // Split description into lines for better display
        const descLines = wrapText(descriptionText, 80);
        const numLines = Math.max(1, descLines.length);

        // Create multi-line row
        for (let lineIndex = 0; lineIndex < numLines; lineIndex++) {
          const repoCol = lineIndex === 0 ? repoText.padEnd(repoWidth) : ' '.repeat(repoWidth);
          // For version column, pad based on display text length plus rocket emoji, not full link length
          const versionCol = lineIndex === 0
            ? versionText + ' '.repeat(Math.max(0, versionWidth - versionDisplayText.length - 1))
            : ' '.repeat(versionWidth);
          const dateCol = lineIndex === 0 ? dateStr.padEnd(dateWidth) : ' '.repeat(dateWidth);
          const descCol = descLines[lineIndex] || '';

          message += `${repoCol} ${versionCol} ${dateCol} ${descCol}\n`;
        }

        // Add separator line between releases (except for the last one)
        if (index < releases.length - 1) {
          message += `${'-'.repeat(repoWidth)} ${'-'.repeat(versionWidth)} ${'-'.repeat(dateWidth)} ${'-'.repeat(40)}\n`;
        }

      } catch (error) {
        logger.error(`Error formatting release ${release.repository}: ${error}`);
        const repoCol = release.repository.substring(0, repoWidth - 2).padEnd(repoWidth);
        const versionCol = 'Error'.padEnd(versionWidth);
        const dateCol = 'Error'.padEnd(dateWidth);
        message += `${repoCol} ${versionCol} ${dateCol} Error processing release\n`;
      }
    });

    // Close code block
    message += '```';

    // Log the formatted message to console
    const lines = message.split('\n');
    lines.forEach(line => {
      logger.info(line);
    });

    return message;
  } catch (error) {
    logger.error(`Error generating tabular summary: ${error}`);
    const errorMessage = `📊 RELEASE SUMMARY: Error generating summary - ${error}`;
    logger.info(errorMessage);
    return errorMessage;
  }
}
