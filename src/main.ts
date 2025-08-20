import { config as dotenvConfig } from 'dotenv';
import { setFailed } from '@actions/core';
import { Release } from './core/release';
import { postToSlack } from './core/slack';
import { formatReleaseMessage, generateTimeframeText } from './core/format';
import { logger } from './utils/logger';
import { getConfig } from './utils/config';
import { setupProcessHandlers } from './utils/process-handlers';
import { processCli } from './utils/cli';

// Load environment variables from .env file
dotenvConfig();
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

    // Validate critical configuration
    if (!config.githubToken || !config.slackWebhookUrl || !config.orgName) {
      throw new Error('Missing required configuration: githubToken, slackWebhookUrl, or orgName');
    }

    // Set log file name using timeframe as prefix
    const timeframeText = generateTimeframeText(config.timeframe);
    logger.updateContext(timeframeText);

    // Step 1: Get all release data
    const release = new Release(config.githubToken);
    const releases = await release.getReleases(config);

    // Step 2: Format releases into separate Slack messages
    const slackMessages = await formatReleaseMessage(releases, {
      timeframe: config.timeframe,
      includeDescriptions: config.includeDescriptions
    }, config.repositories);

    // Step 3: Send each formatted message to Slack
    for (const message of slackMessages) {
      await postToSlack(message, config.slackWebhookUrl);
    }

    logger.info('Release summary service completed successfully');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    logger.error(`Release summary service failed: ${errorMessage}`);
    if (errorStack) {
      logger.error(`Stack trace: ${errorStack}`);
    }
    setFailed(`Release summary service failed: ${errorMessage}`);
  }
}

if (require.main === module) {
  main().catch((error) => {
    logger.error(`Fatal error in main: ${error}`);
    process.exit(1);
  });

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    logger.info('Received SIGINT, shutting down gracefully...');
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    logger.info('Received SIGTERM, shutting down gracefully...');
    process.exit(0);
  });
}

export { main };
