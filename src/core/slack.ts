import { SlackMessage } from '../types';
import { logger } from '../utils/logger';

/**
 * Slack integration module for posting GitHub release summaries
 *
 * This module handles:
 * - Configuration validation
 * - Message formatting and posting
 * - Error handling and logging
 */



/**
 * Posts a pre-formatted message to Slack
 *
 * @param message - Pre-formatted message to send
 * @param webhookUrl - Slack webhook URL for posting
 * @throws {Error} When validation fails or Slack API returns an error
 */
export async function postToSlack(
  message: string,
  webhookUrl: string
): Promise<void> {
  try {
    logger.info('Posting summary to Slack...');

    // Validate inputs
    if (!message || message.trim() === '') {
      throw new Error('Message is required');
    }

    if (!webhookUrl || webhookUrl.trim() === '') {
      throw new Error('Slack webhook URL is required');
    }

    const formattedMessage = message;

    // Create Slack message payload
    const slackMessage: SlackMessage = {
      text: formattedMessage
    };

    // Log the exact payload being sent
    logger.info(`Slack payload length: ${JSON.stringify(slackMessage).length} characters`);
    logger.info(`Message starts with: ${formattedMessage.substring(0, 100)}...`);
    logger.info(`Message ends with: ...${formattedMessage.substring(formattedMessage.length - 100)}`);

    // Send to Slack
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(slackMessage),
    });

    // Log the full Slack response for debugging
    logger.info(`📄 Full Slack Response:`);
    logger.info(`Status: ${response.status} ${response.statusText}`);
    const responseText = await response.text();
    logger.info(`Body: ${responseText}`);

    if (!response.ok) {
      logger.error(`Slack API response: ${response.status} ${response.statusText}`);
      logger.error(`Slack API error body: ${responseText}`);
      throw new Error(`Slack API error (${response.status}): ${responseText}`);
    }

    logger.info('Successfully posted to Slack');
  } catch (error) {
    logger.error(`Error posting to Slack: ${error}`);
    throw new Error(`Failed to post to Slack: ${error}`);
  }
}
