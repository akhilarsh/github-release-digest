import { setFailed } from '@actions/core';
import { config as dotenvConfig } from 'dotenv';
import { Release } from './core/release';
import { postToSlack } from './core/slack';
import { ReleaseInfo } from './types';
import { logger } from './utils/logger';
import { getConfig, Config } from './utils/config';
import { setupProcessHandlers } from './utils/process-handlers';
import { processCli } from './utils/cli';

dotenvConfig({ debug: false });
setupProcessHandlers();

/**
 * Main entry point for the GitHub Release Summary Service
 */
async function main(): Promise<void> {
  try {
    // Process CLI arguments - exit early if help was shown
    if (!processCli()) {
      return;
    }

    const config = getConfig();

    // Set log file name using release mode as prefix
    logger.updateContext(config.releaseMode);
    const releases = await runReleaseSummary(config);

    // Prepare Slack configuration
    const slackConfig = {
      releaseMode: config.releaseMode,
      hoursBack: config.hoursBack,
      targetDate: config.targetDate
    };

    await postToSlack(releases, config.slackWebhookUrl, slackConfig, 'tabular');

    logger.info('Release summary service completed successfully');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Release summary service failed: ${errorMessage}`);
    setFailed(`Release summary service failed: ${errorMessage}`);
  }
}

/**
 * Fetch releases from GitHub based on configuration mode
 */
async function runReleaseSummary(config: Config): Promise<ReleaseInfo[]> {
  try {
    const release = new Release(config.githubToken);
    let releases: ReleaseInfo[];

    if (config.releaseMode === 'daily') {
      releases = await release.getDailyReleases(config.orgName, config.targetDate);
    } else {
      releases = await release.getRecentReleases(config.orgName, config.hoursBack);
    }
    logger.info(`Release Summary: ${JSON.stringify(releases, null, 2)}`);
    return releases;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to fetch releases: ${errorMessage}`);
    setFailed(`Failed to fetch releases: ${errorMessage}`);
    throw error;
  }
}

if (require.main === module) {
  main().catch((error) => {
    logger.error(`Fatal error in main: ${error}`);
    process.exit(1);
  });
}

export { main };
