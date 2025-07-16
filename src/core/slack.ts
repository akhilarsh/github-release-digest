import { SlackClient } from '../clients/slack-client';
import { ReleaseInfo, SlackMessage } from '../types';
import { logger } from '../utils/logger';
import { formatReleaseMessage, validateReleases, SummaryConfig } from './summary';

interface SlackConfig {
  releaseMode: 'recent' | 'daily';
  hoursBack?: number;
  targetDate?: Date;
}

/**
 * Validate Slack configuration
 */
function validateSlackConfig(config: SlackConfig): void {
  if (!config) {
    throw new Error('Slack configuration is required');
  }

  if (!['recent', 'daily'].includes(config.releaseMode)) {
    throw new Error(`Invalid release mode: ${config.releaseMode}`);
  }

  if (config.releaseMode === 'daily' && !config.targetDate) {
    throw new Error('Target date is required for daily mode');
  }

  if (config.releaseMode === 'recent' && (!config.hoursBack || config.hoursBack <= 0)) {
    throw new Error('Valid hoursBack is required for recent mode');
  }
}



/**
 * Post release summary to Slack with comprehensive error handling
 */
export async function postToSlack(
  releases: ReleaseInfo[],
  slackWebhookUrl: string,
  config: SlackConfig,
  format: 'detailed' | 'tabular' = 'tabular'
): Promise<void> {
  try {
    if (!slackWebhookUrl || typeof slackWebhookUrl !== 'string') {
      throw new Error('Valid Slack webhook URL is required');
    }

    validateReleases(releases);
    validateSlackConfig(config);

    logger.info(`Formatting message for Slack in ${format} format...`);

    // Convert SlackConfig to SummaryConfig
    const summaryConfig: SummaryConfig = {
      releaseMode: config.releaseMode,
      hoursBack: config.hoursBack,
      targetDate: config.targetDate
    };

    // Format the release message (this also logs the formatted summary to console)
    const formattedMessage = formatReleaseMessage(releases, summaryConfig, format);

    // Create Slack message object
    const slackMessage: SlackMessage = { text: formattedMessage };

    // Post to Slack
    const slackClient = new SlackClient(slackWebhookUrl);
    await slackClient.postMessage(slackMessage);

    logger.info('Slack message processing completed successfully');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to post to Slack: ${errorMessage}`);
    throw new Error(`Slack posting failed: ${errorMessage}`);
  }
}
