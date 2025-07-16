/**
 * Slack message structure for webhook posting
 */
export interface SlackMessage {
  text: string;
  blocks?: SlackBlock[];
  attachments?: SlackAttachment[];
}

/**
 * Slack block element for rich message formatting
 */
export interface SlackBlockElement {
  type: string;
  text?: string;
  url?: string;
  value?: string;
  action_id?: string;
}

/**
 * Slack block structure for rich message formatting
 */
export interface SlackBlock {
  type: string;
  text?: {
    type: string;
    text: string;
  };
  elements?: SlackBlockElement[];
}

/**
 * Slack attachment structure for additional content
 */
export interface SlackAttachment {
  color?: string;
  fields?: Array<{
    title: string;
    value: string;
    short?: boolean;
  }>;
  footer?: string;
  ts?: number;
}
