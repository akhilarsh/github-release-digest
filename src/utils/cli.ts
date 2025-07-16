/**
 * CLI utilities for GitHub Release Summary Service
 */

import { logger } from './logger';

export interface CliConfig {
  releaseMode?: 'recent' | 'daily';
  targetDate?: string;
  hoursBack?: number;
  showHelp?: boolean;
}

/**
 * Display help information for CLI usage
 */
export function displayHelp(): void {
  console.log(`
GitHub Release Summary CLI

Usage:
  npm run dev                              # Use .env configuration
  npm run dev -- --date 2025-07-14        # Daily releases for specific date
  npm run dev -- --date today             # Daily releases for today
  npm run dev -- --date yesterday         # Daily releases for yesterday
  npm run dev -- --hours 48               # Recent releases (48 hours back)
  npm run dev -- --help                   # Show this help

Examples:
  npm run dev -- --date 2025-07-10        # Daily releases for July 10th
  npm run dev -- --hours 6                # Last 6 hours of releases
  npm run dev -- --date yesterday         # Yesterday's releases
`);
}

/**
 * Parse command line arguments for release mode override
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

    // Date argument automatically sets daily mode
    else if (arg === '--date' && nextArg) {
      cliConfig.releaseMode = 'daily';
      cliConfig.targetDate = parseDateArgument(nextArg);
      i++; // Skip the next argument
    }

    // Hours argument automatically sets recent mode
    else if (arg === '--hours' && nextArg) {
      cliConfig.releaseMode = 'recent';
      cliConfig.hoursBack = parseHoursArgument(nextArg);
      i++; // Skip the next argument
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
  } else if (dateArg === 'yesterday') {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(dateArg)) {
    // Validate date format
    const testDate = new Date(dateArg);
    if (isNaN(testDate.getTime())) {
      throw new Error(`Invalid date format: ${dateArg}. Use YYYY-MM-DD format.`);
    }
    return dateArg;
  } else {
    throw new Error(`Invalid date argument: ${dateArg}. Use 'today', 'yesterday', or YYYY-MM-DD format.`);
  }
}

/**
 * Parse and validate an hours argument
 */
function parseHoursArgument(hoursArg: string): number {
  const hours = parseInt(hoursArg, 10);
  if (isNaN(hours) || hours <= 0) {
    throw new Error(`Hours back must be a positive number, got: ${hoursArg}`);
  }
  return hours;
}

/**
 * Apply CLI overrides to environment variables
 */
export function applyCliOverrides(cliConfig: CliConfig): void {
  if (cliConfig.releaseMode) {
    process.env['RELEASE_MODE'] = cliConfig.releaseMode;
    logger.info(`CLI override: Release mode set to '${cliConfig.releaseMode}'`);
  }

  if (cliConfig.targetDate) {
    process.env['TARGET_DATE'] = cliConfig.targetDate;
    logger.info(`CLI override: Target date set to '${cliConfig.targetDate}'`);
  }

  if (cliConfig.hoursBack) {
    process.env['HOURS_BACK'] = cliConfig.hoursBack.toString();
    logger.info(`CLI override: Hours back set to '${cliConfig.hoursBack}'`);
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
    console.error(`CLI Error: ${error instanceof Error ? error.message : String(error)}`);
    console.log('Use --help for usage information.');
    process.exit(1);
  }
}
