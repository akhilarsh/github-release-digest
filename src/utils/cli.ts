/**
 * CLI utilities for GitHub Release Summary Service
 */

import { logger } from './logger';

export interface CliConfig {
  timeframe?: {
    type: 'hours' | 'days' | 'date';
    value: number | Date;
  };
  repositories?: string[]; // Optional: specific repositories to filter
  includeDescriptions?: boolean; // If true, include detailed descriptions
  showHelp?: boolean;
}

/**
 * Display help information for CLI usage
 */
export function displayHelp(): void {
  logger.info(`
GitHub Release Summary CLI

Usage:
  npm start                                # Use .env configuration (default: 24 hours)
  npm start -- --hours 6                   # Last 6 hours of releases
  npm start -- --days 7                    # Last 7 days of releases (maximum)
  npm start -- --date 2025-07-14          # Releases for specific date
  npm start -- --date today               # Releases for today
  npm start -- --date yesterday           # Releases for yesterday
  npm start -- --repo repo-name           # Single repository
  npm start -- --repos repo1,repo2,repo3  # Multiple repositories (comma-separated)
  npm start -- --include-descriptions     # Include detailed descriptions (default behavior)
  npm start -- --help                     # Show this help

Examples:
  npm start -- --hours 48                 # Last 48 hours of releases
  npm start -- --days 7                   # Last 7 days of releases (maximum)
  npm start -- --date 2025-07-10          # Releases for July 10th
  npm start -- --date yesterday           # Yesterday's releases
  npm start -- --repo repo1 # Single repository
  npm start -- --repos repo1,repo2,repo3  # Multiple repositories
  npm start -- --hours 24 --repo repo1    # Last 24 hours for specific repo
  npm start -- --days 1                   # Last day releases, summary table only

Timeframe Limits:
  • Hours: Maximum 168 hours (7 days)
  • Days: Maximum 7 days
  • Date: Cannot be more than 7 days ago or in the future

Development:
  npm run dev-build -- --hours 1          # Build and run with latest code
`);
}

/**
 * Parse command line arguments for timeframe override
 */
export function parseCliArguments(): CliConfig {
  const args = process.argv.slice(2);
  const cliConfig: CliConfig = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    if (arg === '--help' || arg === '-h') {
      cliConfig.showHelp = true;
      return cliConfig;
    }

    // Hours argument
    if (arg === '--hours' && nextArg) {
      const hours = parseHoursArgument(nextArg);
      cliConfig.timeframe = { type: 'hours', value: hours };
      i++; // Skip the next argument
    }

    // Days argument
    else if (arg === '--days' && nextArg) {
      const days = parseDaysArgument(nextArg);
      cliConfig.timeframe = { type: 'days', value: days };
      i++; // Skip the next argument
    }

    // Date argument
    else if (arg === '--date' && nextArg) {
      const date = parseDateArgument(nextArg);
      cliConfig.timeframe = { type: 'date', value: new Date(date) };
      i++; // Skip the next argument
    }

    // Single repository argument
    else if (arg === '--repo' && nextArg) {
      cliConfig.repositories = [nextArg.trim()];
      i++; // Skip the next argument
    }

    // Multiple repositories argument
    else if (arg === '--repos' && nextArg) {
      cliConfig.repositories = nextArg.split(',').map(repo => repo.trim()).filter(repo => repo.length > 0);
      i++; // Skip the next argument
    }

    // Include descriptions argument
    else if (arg === '--include-descriptions') {
      cliConfig.includeDescriptions = true;
    }

    // Unknown argument
    else {
      throw new Error(`Unknown argument: ${arg}. Use --help for usage information.`);
    }
  }

  return cliConfig;
}

/**
 * Parse and validate a date argument
 */
function parseDateArgument(dateArg: string): string {
  if (dateArg === 'today') {
    return new Date().toISOString().split('T')[0];
  } if (dateArg === 'yesterday') {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
  } if (/^\d{4}-\d{2}-\d{2}$/.test(dateArg)) {
    // Validate date format
    const testDate = new Date(dateArg);
    if (Number.isNaN(testDate.getTime())) {
      throw new Error(`Invalid date format: ${dateArg}. Use YYYY-MM-DD format.`);
    }

    // Check if date is within 7 days from today
    const today = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(today.getDate() - 7);

    if (testDate < sevenDaysAgo) {
      throw new Error(`Date cannot be more than 7 days ago: ${dateArg}. Maximum allowed date: ${sevenDaysAgo.toISOString().split('T')[0]}`);
    }

    if (testDate > today) {
      throw new Error(`Date cannot be in the future: ${dateArg}`);
    }

    return dateArg;
  }
  throw new Error(`Invalid date argument: ${dateArg}. Use 'today', 'yesterday', or YYYY-MM-DD format.`);

}

/**
 * Parse and validate an hours argument
 */
function parseHoursArgument(hoursArg: string): number {
  const hours = parseInt(hoursArg, 10);
  if (Number.isNaN(hours) || hours <= 0) {
    throw new Error(`Hours must be a positive number, got: ${hoursArg}`);
  }

  // Maximum 7 days (168 hours)
  const maxHours = 7 * 24; // 168 hours
  if (hours > maxHours) {
    throw new Error(`Hours cannot exceed ${maxHours} (7 days), got: ${hours}`);
  }

  return hours;
}

/**
 * Parse and validate a days argument
 */
function parseDaysArgument(daysArg: string): number {
  const days = parseInt(daysArg, 10);
  if (Number.isNaN(days) || days <= 0) {
    throw new Error(`Days must be a positive number, got: ${daysArg}`);
  }

  // Maximum 7 days
  const maxDays = 7;
  if (days > maxDays) {
    throw new Error(`Days cannot exceed ${maxDays}, got: ${days}`);
  }

  return days;
}

/**
 * Apply CLI overrides to environment variables
 */
export function applyCliOverrides(cliConfig: CliConfig): void {
  if (cliConfig.timeframe) {
    // Clear any existing timeframe variables (including old RELEASE_WINDOW)
    delete process.env.HOURS_BACK;
    delete process.env.DAYS_BACK;
    delete process.env.TARGET_DATE;
    delete process.env.RELEASE_WINDOW; // Clear old variable

    // Set the appropriate environment variable based on timeframe type
    switch (cliConfig.timeframe.type) {
      case 'hours':
        process.env.HOURS_BACK = cliConfig.timeframe.value.toString();
        logger.info(`CLI override: Hours set to '${cliConfig.timeframe.value}'`);
        break;
      case 'days':
        process.env.DAYS_BACK = cliConfig.timeframe.value.toString();
        logger.info(`CLI override: Days set to '${cliConfig.timeframe.value}'`);
        break;
      case 'date': {
        const dateStr = (cliConfig.timeframe.value as Date).toISOString().split('T')[0];
        process.env.TARGET_DATE = dateStr;
        logger.info(`CLI override: Date set to '${dateStr}'`);
        break;
      }
      default:
        throw new Error(`Invalid timeframe type: ${cliConfig.timeframe.type}`);
    }
  }

  if (cliConfig.repositories) {
    // Set repositories environment variable
    process.env.REPOSITORIES = cliConfig.repositories.join(',');
    logger.info(`CLI override: Repositories set to '${cliConfig.repositories.join(', ')}'`);
  }

  if (cliConfig.includeDescriptions !== undefined) {
    // Set include descriptions environment variable
    process.env.INCLUDE_DESCRIPTIONS = cliConfig.includeDescriptions.toString();
    logger.info(`CLI override: Include descriptions set to '${cliConfig.includeDescriptions}'`);
  }
}

/**
 * Process CLI arguments and apply configuration overrides
 * @returns true if the application should continue, false if it should exit (e.g., help was shown)
 */
export function processCli(): boolean {
  try {
    const cliConfig = parseCliArguments();

    // Show help if requested
    if (cliConfig.showHelp) {
      displayHelp();
      return false;
    }

    applyCliOverrides(cliConfig);
    return true;
  } catch (error) {
    logger.error(`CLI Error: ${error instanceof Error ? error.message : String(error)}`);
    logger.info('Use --help for usage information.');
    process.exit(1);
    return false; // This line will never be reached due to process.exit(1), but satisfies ESLint
  }
}
