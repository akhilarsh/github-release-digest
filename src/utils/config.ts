import { logger } from './logger';
import type { ISnowflakeConnectionConfig } from '../types';

/**
 * Configuration interface for the release summary service
 */
export interface Config {
  githubToken: string;
  slackWebhookUrl: string;
  orgName: string;
  anthropicApiKey?: string; // Optional: Anthropic API key for AI summarization (primary)
  openRouterApiKey?: string; // Optional: OpenRouter API key for AI summarization (fallback)
  aiModel?: string; // Optional: AI model to use for summarization (OpenRouter)
  anthropicModel?: string; // Optional: Anthropic AI model to use for summarization
  nodeEnv: string;
  logLevel: string;
  timeframe: {
    type: 'hours' | 'days' | 'date';
    value: number | Date;
    startDate?: Date;
    endDate?: Date;
  };
  repositories?: string[]; // Optional: specific repositories to filter
  includeDescriptions?: boolean; // If true, include detailed descriptions
  snowflake?: ISnowflakeConnectionConfig; // Optional: Snowflake connection settings
}

/**
 * Environment variable validation schema
 */
const REQUIRED_ENV_VARS = [
  'TOKEN_GITHUB',
  'SLACK_WEBHOOK_URL',
  'ORG_NAME'
] as const;

const OPTIONAL_ENV_VARS = {
  NODE_ENV: 'production',
  LOG_LEVEL: 'info',
  HOURS_BACK: '24',
  ANTHROPIC_API_KEY: undefined, // Optional: Anthropic API key for AI summarization (primary)
  OPENROUTER_API_KEY: undefined, // Optional: OpenRouter API key for AI summarization (fallback)
  AI_MODEL: 'claude-3-5-sonnet-20241022', // Optional: AI model for summarization (OpenRouter)
  ANTHROPIC_MODEL: 'claude-3-5-sonnet-20241022' // Optional: Anthropic AI model for summarization
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
        case 'TOKEN_GITHUB':
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
        default:
          // This should never happen since we only process known env vars
          logger.warn(`Unexpected environment variable: ${envVar}`);
          break;
      }
    }
  }

  // Add optional environment variables with defaults
  config.nodeEnv = process.env.NODE_ENV?.trim() || OPTIONAL_ENV_VARS.NODE_ENV;
  config.logLevel = process.env.LOG_LEVEL?.trim() || OPTIONAL_ENV_VARS.LOG_LEVEL;

  // Handle Anthropic API key (optional - primary AI provider)
  if (process.env.ANTHROPIC_API_KEY?.trim()) {
    config.anthropicApiKey = process.env.ANTHROPIC_API_KEY.trim();
    logger.info('Anthropic API key configured for AI summarization (primary)');
  }

  // Handle OpenRouter API key (optional - fallback AI provider)
  if (process.env.OPENROUTER_API_KEY?.trim()) {
    config.openRouterApiKey = process.env.OPENROUTER_API_KEY.trim();
    logger.info('OpenRouter API key configured for AI summarization (fallback)');
  }

  // Log AI provider status
  if (!config.anthropicApiKey && !config.openRouterApiKey) {
    logger.warn('No AI API keys provided - AI summarization will be disabled');
  }

  // Handle AI model configuration (optional - for OpenRouter)
  if (process.env.AI_MODEL?.trim()) {
    config.aiModel = process.env.AI_MODEL.trim();
    logger.info(`OpenRouter AI model configured: ${config.aiModel}`);
  } else {
    config.aiModel = OPTIONAL_ENV_VARS.AI_MODEL;
    logger.info(`Using default OpenRouter AI model: ${config.aiModel}`);
  }

  // Handle Anthropic model configuration (optional)
  if (process.env.ANTHROPIC_MODEL?.trim()) {
    config.anthropicModel = process.env.ANTHROPIC_MODEL.trim();
    logger.info(`Anthropic model configured: ${config.anthropicModel}`);
  } else {
    config.anthropicModel = OPTIONAL_ENV_VARS.ANTHROPIC_MODEL;
    logger.info(`Using default Anthropic model: ${config.anthropicModel}`);
  }

  // Parse timeframe configuration
  let timeframe: Config['timeframe'];

  // Optional explicit start/end date overrides (YYYY-MM-DD)
  const startDateEnv = process.env.START_DATE?.trim();
  const endDateEnv = process.env.END_DATE?.trim();

  const parseISODate = (dateStr: string): Date => {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) {
      throw new Error(`Invalid date: ${dateStr}. Must be in YYYY-MM-DD format`);
    }
    return d;
  };

  // If both explicit dates are provided use them (Release class also validates window <= 7 days)
  if (startDateEnv && endDateEnv) {
    const start = parseISODate(startDateEnv);
    const end = parseISODate(endDateEnv);
    timeframe = { type: 'days', value: 1, startDate: start, endDate: end };
  }
  // Check for hours back
  else if (process.env.HOURS_BACK) {
    const hoursBack = parseInt(process.env.HOURS_BACK, 10);
    if (Number.isNaN(hoursBack) || hoursBack <= 0) {
      throw new Error(`Invalid HOURS_BACK: ${process.env.HOURS_BACK}. Must be a positive number`);
    }
    timeframe = { type: 'hours', value: hoursBack };
  }
  // Check for days back
  else if (process.env.DAYS_BACK) {
    const daysBack = parseInt(process.env.DAYS_BACK, 10);
    if (Number.isNaN(daysBack) || daysBack <= 0) {
      throw new Error(`Invalid DAYS_BACK: ${process.env.DAYS_BACK}. Must be a positive number`);
    }
    // Allow an optional END_DATE override for the anchor day (defaults to today)
    if (endDateEnv) {
      const end = parseISODate(endDateEnv);
      timeframe = { type: 'days', value: daysBack, endDate: end };
    } else {
      timeframe = { type: 'days', value: daysBack };
    }
  }
  // Check for target date
  else if (process.env.TARGET_DATE) {
    const targetDate = new Date(process.env.TARGET_DATE);
    if (Number.isNaN(targetDate.getTime())) {
      throw new Error(`Invalid TARGET_DATE: ${process.env.TARGET_DATE}. Must be in YYYY-MM-DD format`);
    }
    timeframe = { type: 'date', value: targetDate };
  }
  // Default to hours back
  else {
    const hoursBack = parseInt(OPTIONAL_ENV_VARS.HOURS_BACK, 10);
    timeframe = { type: 'hours', value: hoursBack };
  }

  config.timeframe = timeframe;

  // Parse repositories configuration (optional)
  if (process.env.REPOSITORIES) {
    config.repositories = process.env.REPOSITORIES
      .split(',')
      .map(repo => repo.trim())
      .filter(repo => repo.length > 0);

    if (config.repositories.length > 0) {
      logger.info(`Repository filter: ${config.repositories.join(', ')}`);
    }
  }

  // Parse include descriptions configuration (optional)
  if (process.env.INCLUDE_DESCRIPTIONS) {
    config.includeDescriptions = process.env.INCLUDE_DESCRIPTIONS.toLowerCase() === 'true';
    logger.info(`Include descriptions: ${config.includeDescriptions}`);
  }

  // Check for missing required variables
  if (missingVars.length > 0) {
    const errorMsg = `Missing required environment variables: ${missingVars.join(', ')}`;
    logger.error(errorMsg);
    throw new Error(errorMsg);
  }

  logger.info(`Configuration loaded successfully for organization: ${config.orgName}`);

  // Log timeframe configuration
  let timeframeText: string;
  if (timeframe.type === 'hours') {
    timeframeText = `${timeframe.value} hours`;
  } else if (timeframe.type === 'days') {
    timeframeText = `${timeframe.value} days`;
  } else {
    timeframeText = `date ${(timeframe.value as Date).toISOString().split('T')[0]}`;
  }
  logger.info(`Timeframe: ${timeframeText}`);
  // Snowflake configuration (optional)
  const coalesce = (...values: Array<string | undefined | null>) => {
    for (const v of values) {
      if (v !== undefined && v !== null && String(v).trim().length > 0) return String(v).trim();
    }
    return undefined;
  };

  // Support single JSON variable (e.g., in GitHub Actions) or discrete env vars
  const rawJson = process.env.SNOWFLAKE_CONFIG?.trim() || process.env.SF_CONFIG?.trim();
  let jsonCfg: Partial<ISnowflakeConnectionConfig> = {};
  if (rawJson) {
    try {
      jsonCfg = JSON.parse(rawJson);
    } catch (e) {
      logger.warn(`Invalid SNOWFLAKE_CONFIG JSON. Falling back to discrete vars. Error: ${e}`);
    }
  }

  // Priority: Individual env vars > JSON config
  // This allows local development with individual vars and GitHub Actions with JSON
  const snowflakeCfg: ISnowflakeConnectionConfig = {
    account: coalesce(process.env.SNOWFLAKE_ACCOUNT, jsonCfg.account),
    username: coalesce(process.env.SNOWFLAKE_USERNAME, jsonCfg.username),
    password: coalesce(process.env.SNOWFLAKE_PASSWORD, jsonCfg.password),
    privateKey: coalesce(process.env.SNOWFLAKE_PRIVATE_KEY, jsonCfg.privateKey),
    database: coalesce(process.env.SNOWFLAKE_DATABASE, jsonCfg.database),
    schema: coalesce(process.env.SNOWFLAKE_SCHEMA, jsonCfg.schema),
    warehouse: coalesce(process.env.SNOWFLAKE_WAREHOUSE, jsonCfg.warehouse),
    role: coalesce(process.env.SNOWFLAKE_ROLE, jsonCfg.role),
    authenticator: coalesce(process.env.SNOWFLAKE_AUTHENTICATOR, jsonCfg.authenticator)
  };

  // Attach only if any Snowflake-related value is present
  const hasAnySnowflake = Object.values(snowflakeCfg).some(v => v !== undefined && String(v).length > 0);
  if (hasAnySnowflake) {
    (config as Config).snowflake = snowflakeCfg;
  }

  return config as Config;
}
