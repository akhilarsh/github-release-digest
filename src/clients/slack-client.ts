import fetch, { RequestInit, Response } from 'node-fetch';
import { SlackMessage } from '../types';
import { logger } from '../utils/logger';

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

export class SlackClient {
  private webhookUrl: string;

  private fetch: Fetch;

  constructor(webhookUrl: string, fetchFn: Fetch = fetch) {
    this.webhookUrl = webhookUrl;
    this.fetch = fetchFn;
    if (!this.webhookUrl) {
      throw new Error('Slack webhook URL not found in environment variables');
    }
  }

  /**
   * Posts a message to Slack using webhook
   */
  async postMessage(message: SlackMessage): Promise<void> {
    try {
      logger.info('Posting summary to Slack...');

      const response = await this.fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        const responseBody = await response.text();
        logger.error(`Slack API error: ${response.status} ${response.statusText} - ${responseBody}`);
        throw new Error(`Slack API error: ${response.status} ${response.statusText}`);
      }

      logger.info('Successfully posted to Slack');
    } catch (error) {
      logger.error(`Failed to post to Slack: ${error}`);
      throw new Error(`Failed to post to Slack: ${error}`);
    }
  }
}
