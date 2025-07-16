import { logger } from './logger';

/**
 * Configuration interface for the release summary service
 */
export interface Config {
  githubToken: string;
  slackWebhookUrl: string;
  orgName: string;
  nodeEnv: string;
  logLevel: string;
  releaseMode: 'recent' | 'daily';
  hoursBack?: number;
  targetDate?: Date;
}

/**
 * Environment variable validation schema
 */
const REQUIRED_ENV_VARS = [
  'GITHUB_TOKEN',
  'SLACK_WEBHOOK_URL',
  'ORG_NAME'
] as const;

const OPTIONAL_ENV_VARS = {
  NODE_ENV: 'production',
  LOG_LEVEL: 'info',
  RELEASE_MODE: 'recent',
  HOURS_BACK: '24',
  TARGET_DATE: ''
} as const;

/**
 * Validates and returns the application configuration
 * @returns {Config} Validated configuration object
 * @throws {Error} If required environment variables are missing
 */
/**
 * Validates Slack webhook URL format
 * @param url - Slack webhook URL to validate
 * @throws {Error} If URL format is invalid
 */
function validateSlackWebhookUrl(url: string): void {
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.hostname !== 'hooks.slack.com') {
      throw new Error('Slack webhook URL must be from hooks.slack.com domain');
    }
    if (!parsedUrl.pathname.startsWith('/services/')) {
      throw new Error('Invalid Slack webhook URL format');
    }
  } catch (error) {
    logger.error(`Invalid Slack webhook URL: ${error}`);
    throw new Error(`Invalid Slack webhook URL: ${error}`);
  }
}

/**
 * Validates GitHub organization name
 * @param orgName - Organization name to validate
 * @throws {Error} If organization name is invalid
 */
function validateOrgName(orgName: string): void {
  // GitHub org names can contain alphanumeric characters and hyphens
  // but cannot start or end with hyphens
  const orgNameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/;

  if (!orgNameRegex.test(orgName)) {
    const errorMsg = 'Organization name must contain only alphanumeric characters and hyphens, and cannot start or end with hyphens';
    logger.error(errorMsg);
    throw new Error(errorMsg);
  }

  if (orgName.length > 39) {
    const errorMsg = 'Organization name cannot exceed 39 characters';
    logger.error(errorMsg);
    throw new Error(errorMsg);
  }
}

export function getConfig(): Config {

  const missingVars: string[] = [];
  const config: Partial<Config> = {};

  // Validate required environment variables
  for (const envVar of REQUIRED_ENV_VARS) {
    const value = process.env[envVar];
    if (!value?.trim()) {
      missingVars.push(envVar);
    } else {
      // Map environment variable names to config property names
      switch (envVar) {
        case 'GITHUB_TOKEN':
          config.githubToken = value.trim();
          break;
        case 'SLACK_WEBHOOK_URL':
          config.slackWebhookUrl = value.trim();
          validateSlackWebhookUrl(value.trim());
          break;
        case 'ORG_NAME':
          config.orgName = value.trim();
          validateOrgName(value.trim());
          break;
      }
    }
  }

  // Add optional environment variables with defaults
  config.nodeEnv = process.env['NODE_ENV']?.trim() || OPTIONAL_ENV_VARS.NODE_ENV;
  config.logLevel = process.env['LOG_LEVEL']?.trim() || OPTIONAL_ENV_VARS.LOG_LEVEL;

  // Parse release mode configuration
  const releaseMode = process.env['RELEASE_MODE']?.trim() || OPTIONAL_ENV_VARS.RELEASE_MODE;
  if (releaseMode !== 'recent' && releaseMode !== 'daily') {
    throw new Error(`Invalid RELEASE_MODE: ${releaseMode}. Must be 'recent' or 'daily'`);
  }
  config.releaseMode = releaseMode as 'recent' | 'daily';

  // Parse hours back for recent mode
  if (process.env['HOURS_BACK']) {
    const hoursBack = parseInt(process.env['HOURS_BACK'], 10);
    if (isNaN(hoursBack) || hoursBack <= 0) {
      throw new Error(`Invalid HOURS_BACK: ${process.env['HOURS_BACK']}. Must be a positive number`);
    }
    config.hoursBack = hoursBack;
  } else if (releaseMode === 'recent') {
    config.hoursBack = parseInt(OPTIONAL_ENV_VARS.HOURS_BACK, 10);
  }

  // Parse target date for daily mode
  if (process.env['TARGET_DATE']) {
    const targetDate = new Date(process.env['TARGET_DATE']);
    if (isNaN(targetDate.getTime())) {
      throw new Error(`Invalid TARGET_DATE: ${process.env['TARGET_DATE']}. Must be in YYYY-MM-DD format`);
    }
    config.targetDate = targetDate;
  }

  // Check for missing required variables
  if (missingVars.length > 0) {
    const errorMsg = `Missing required environment variables: ${missingVars.join(', ')}`;
    logger.error(errorMsg);
    throw new Error(errorMsg);
  }

  logger.info(`Configuration loaded successfully for organization: ${config.orgName}`);
  logger.info(`Release mode: ${config.releaseMode}${config.hoursBack ? ` (${config.hoursBack} hours)` : ''}${config.targetDate ? ` (${config.targetDate.toISOString().split('T')[0]})` : ''}`);

  return config as Config;
}
