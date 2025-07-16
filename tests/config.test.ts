import { test } from 'uvu';
import * as assert from 'uvu/assert';
import { getConfig, Config } from '../src/utils/config';

// Store original environment variables
let originalEnv: NodeJS.ProcessEnv;

test.before.each(() => {
  // Store original environment
  originalEnv = { ...process.env };

  // Clear all relevant environment variables
  delete process.env.GITHUB_TOKEN;
  delete process.env.SLACK_WEBHOOK_URL;
  delete process.env.ORG_NAME;
  delete process.env.NODE_ENV;
  delete process.env.LOG_LEVEL;
  delete process.env.RELEASE_MODE;
  delete process.env.HOURS_BACK;
  delete process.env.TARGET_DATE;
});

test.after.each(() => {
  // Restore original environment
  process.env = originalEnv;
});

test('getConfig › should throw error when GITHUB_TOKEN is missing', () => {
  process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX';
  process.env.ORG_NAME = 'test-org';

  try {
    getConfig();
    assert.unreachable('should have thrown an error');
  } catch (error: any) {
    assert.instance(error, Error);
    assert.match(error.message, 'Missing required environment variables: GITHUB_TOKEN');
  }
});

test('getConfig › should throw error when SLACK_WEBHOOK_URL is missing', () => {
  process.env.GITHUB_TOKEN = 'github_pat_test123';
  process.env.ORG_NAME = 'test-org';

  try {
    getConfig();
    assert.unreachable('should have thrown an error');
  } catch (error: any) {
    assert.instance(error, Error);
    assert.match(error.message, 'Missing required environment variables: SLACK_WEBHOOK_URL');
  }
});

test('getConfig › should throw error when ORG_NAME is missing', () => {
  process.env.GITHUB_TOKEN = 'github_pat_test123';
  process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX';

  try {
    getConfig();
    assert.unreachable('should have thrown an error');
  } catch (error: any) {
    assert.instance(error, Error);
    assert.match(error.message, 'Missing required environment variables: ORG_NAME');
  }
});

test('getConfig › should throw error when multiple required variables are missing', () => {
  try {
    getConfig();
    assert.unreachable('should have thrown an error');
  } catch (error: any) {
    assert.instance(error, Error);
    assert.match(error.message, 'Missing required environment variables:');
    assert.match(error.message, 'GITHUB_TOKEN');
    assert.match(error.message, 'SLACK_WEBHOOK_URL');
    assert.match(error.message, 'ORG_NAME');
  }
});

test('getConfig › should return valid config with all required variables', () => {
  process.env.GITHUB_TOKEN = 'github_pat_test123';
  process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX';
  process.env.ORG_NAME = 'test-org';

  const config = getConfig();

  assert.equal(config.githubToken, 'github_pat_test123');
  assert.equal(config.slackWebhookUrl, 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX');
  assert.equal(config.orgName, 'test-org');
  assert.equal(config.nodeEnv, 'production'); // default
  assert.equal(config.logLevel, 'info'); // default
  assert.equal(config.releaseMode, 'recent'); // default
  assert.equal(config.hoursBack, 24); // default for recent mode
});

test('getConfig › should use custom optional environment variables', () => {
  process.env.GITHUB_TOKEN = 'github_pat_test123';
  process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX';
  process.env.ORG_NAME = 'test-org';
  process.env.NODE_ENV = 'development';
  process.env.LOG_LEVEL = 'debug';
  process.env.RELEASE_MODE = 'daily';

  const config = getConfig();

  assert.equal(config.nodeEnv, 'development');
  assert.equal(config.logLevel, 'debug');
  assert.equal(config.releaseMode, 'daily');
  assert.equal(config.hoursBack, undefined); // not set for daily mode
});

test('getConfig › should throw error for invalid Slack webhook URL - wrong domain', () => {
  process.env.GITHUB_TOKEN = 'github_pat_test123';
  process.env.SLACK_WEBHOOK_URL = 'https://example.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX';
  process.env.ORG_NAME = 'test-org';

  try {
    getConfig();
    assert.unreachable('should have thrown an error');
  } catch (error: any) {
    assert.instance(error, Error);
    assert.match(error.message, 'Slack webhook URL must be from hooks.slack.com domain');
  }
});

test('getConfig › should throw error for invalid Slack webhook URL - wrong path', () => {
  process.env.GITHUB_TOKEN = 'github_pat_test123';
  process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/invalid/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX';
  process.env.ORG_NAME = 'test-org';

  try {
    getConfig();
    assert.unreachable('should have thrown an error');
  } catch (error: any) {
    assert.instance(error, Error);
    assert.match(error.message, 'Invalid Slack webhook URL format');
  }
});

test('getConfig › should throw error for invalid Slack webhook URL - malformed URL', () => {
  process.env.GITHUB_TOKEN = 'github_pat_test123';
  process.env.SLACK_WEBHOOK_URL = 'not-a-valid-url';
  process.env.ORG_NAME = 'test-org';

  try {
    getConfig();
    assert.unreachable('should have thrown an error');
  } catch (error: any) {
    assert.instance(error, Error);
    assert.match(error.message, 'Invalid Slack webhook URL');
  }
});

test('getConfig › should throw error for invalid organization name - starts with hyphen', () => {
  process.env.GITHUB_TOKEN = 'github_pat_test123';
  process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX';
  process.env.ORG_NAME = '-invalid-org';

  try {
    getConfig();
    assert.unreachable('should have thrown an error');
  } catch (error: any) {
    assert.instance(error, Error);
    assert.match(error.message, 'Organization name must contain only alphanumeric characters and hyphens');
  }
});

test('getConfig › should throw error for invalid organization name - ends with hyphen', () => {
  process.env.GITHUB_TOKEN = 'github_pat_test123';
  process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX';
  process.env.ORG_NAME = 'invalid-org-';

  try {
    getConfig();
    assert.unreachable('should have thrown an error');
  } catch (error: any) {
    assert.instance(error, Error);
    assert.match(error.message, 'Organization name must contain only alphanumeric characters and hyphens');
  }
});

test('getConfig › should throw error for invalid organization name - special characters', () => {
  process.env.GITHUB_TOKEN = 'github_pat_test123';
  process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX';
  process.env.ORG_NAME = 'invalid@org';

  try {
    getConfig();
    assert.unreachable('should have thrown an error');
  } catch (error: any) {
    assert.instance(error, Error);
    assert.match(error.message, 'Organization name must contain only alphanumeric characters and hyphens');
  }
});

test('getConfig › should throw error for organization name too long', () => {
  process.env.GITHUB_TOKEN = 'github_pat_test123';
  process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX';
  process.env.ORG_NAME = 'a'.repeat(40); // 40 characters, exceeds limit of 39

  try {
    getConfig();
    assert.unreachable('should have thrown an error');
  } catch (error: any) {
    assert.instance(error, Error);
    assert.match(error.message, 'Organization name cannot exceed 39 characters');
  }
});

test('getConfig › should accept valid organization name with hyphens', () => {
  process.env.GITHUB_TOKEN = 'github_pat_test123';
  process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX';
  process.env.ORG_NAME = 'valid-org-name';

  const config = getConfig();
  assert.equal(config.orgName, 'valid-org-name');
});

test('getConfig › should accept maximum length organization name', () => {
  process.env.GITHUB_TOKEN = 'github_pat_test123';
  process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX';
  process.env.ORG_NAME = 'a'.repeat(39); // 39 characters, at the limit

  const config = getConfig();
  assert.equal(config.orgName, 'a'.repeat(39));
});

test('getConfig › should throw error for invalid release mode', () => {
  process.env.GITHUB_TOKEN = 'github_pat_test123';
  process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX';
  process.env.ORG_NAME = 'test-org';
  process.env.RELEASE_MODE = 'invalid';

  try {
    getConfig();
    assert.unreachable('should have thrown an error');
  } catch (error: any) {
    assert.instance(error, Error);
    assert.match(error.message, 'Invalid RELEASE_MODE: invalid. Must be \'recent\' or \'daily\'');
  }
});

test('getConfig › should parse valid hours back for recent mode', () => {
  process.env.GITHUB_TOKEN = 'github_pat_test123';
  process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX';
  process.env.ORG_NAME = 'test-org';
  process.env.RELEASE_MODE = 'recent';
  process.env.HOURS_BACK = '48';

  const config = getConfig();
  assert.equal(config.releaseMode, 'recent');
  assert.equal(config.hoursBack, 48);
});

test('getConfig › should throw error for invalid hours back - non-numeric', () => {
  process.env.GITHUB_TOKEN = 'github_pat_test123';
  process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX';
  process.env.ORG_NAME = 'test-org';
  process.env.HOURS_BACK = 'abc';

  try {
    getConfig();
    assert.unreachable('should have thrown an error');
  } catch (error: any) {
    assert.instance(error, Error);
    assert.match(error.message, 'Invalid HOURS_BACK: abc. Must be a positive number');
  }
});

test('getConfig › should throw error for invalid hours back - negative', () => {
  process.env.GITHUB_TOKEN = 'github_pat_test123';
  process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX';
  process.env.ORG_NAME = 'test-org';
  process.env.HOURS_BACK = '-5';

  try {
    getConfig();
    assert.unreachable('should have thrown an error');
  } catch (error: any) {
    assert.instance(error, Error);
    assert.match(error.message, 'Invalid HOURS_BACK: -5. Must be a positive number');
  }
});

test('getConfig › should throw error for invalid hours back - zero', () => {
  process.env.GITHUB_TOKEN = 'github_pat_test123';
  process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX';
  process.env.ORG_NAME = 'test-org';
  process.env.HOURS_BACK = '0';

  try {
    getConfig();
    assert.unreachable('should have thrown an error');
  } catch (error: any) {
    assert.instance(error, Error);
    assert.match(error.message, 'Invalid HOURS_BACK: 0. Must be a positive number');
  }
});

test('getConfig › should parse valid target date for daily mode', () => {
  process.env.GITHUB_TOKEN = 'github_pat_test123';
  process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX';
  process.env.ORG_NAME = 'test-org';
  process.env.RELEASE_MODE = 'daily';
  process.env.TARGET_DATE = '2023-07-14';

  const config = getConfig();
  assert.equal(config.releaseMode, 'daily');
  assert.instance(config.targetDate, Date);
  assert.equal(config.targetDate!.toISOString().split('T')[0], '2023-07-14');
});

test('getConfig › should throw error for invalid target date', () => {
  process.env.GITHUB_TOKEN = 'github_pat_test123';
  process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX';
  process.env.ORG_NAME = 'test-org';
  process.env.TARGET_DATE = 'invalid-date';

  try {
    getConfig();
    assert.unreachable('should have thrown an error');
  } catch (error: any) {
    assert.instance(error, Error);
    assert.match(error.message, 'Invalid TARGET_DATE: invalid-date. Must be in YYYY-MM-DD format');
  }
});

test('getConfig › should trim whitespace from environment variables', () => {
  process.env.GITHUB_TOKEN = '  github_pat_test123  ';
  process.env.SLACK_WEBHOOK_URL = '  https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX  ';
  process.env.ORG_NAME = '  test-org  ';
  process.env.NODE_ENV = '  development  ';

  const config = getConfig();
  assert.equal(config.githubToken, 'github_pat_test123');
  assert.equal(config.slackWebhookUrl, 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX');
  assert.equal(config.orgName, 'test-org');
  assert.equal(config.nodeEnv, 'development');
});

test('getConfig › should treat empty strings as missing required variables', () => {
  process.env.GITHUB_TOKEN = '';
  process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX';
  process.env.ORG_NAME = 'test-org';

  try {
    getConfig();
    assert.unreachable('should have thrown an error');
  } catch (error: any) {
    assert.instance(error, Error);
    assert.match(error.message, 'Missing required environment variables: GITHUB_TOKEN');
  }
});

test('getConfig › should treat whitespace-only strings as missing required variables', () => {
  process.env.GITHUB_TOKEN = '   ';
  process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX';
  process.env.ORG_NAME = 'test-org';

  try {
    getConfig();
    assert.unreachable('should have thrown an error');
  } catch (error: any) {
    assert.instance(error, Error);
    assert.match(error.message, 'Missing required environment variables: GITHUB_TOKEN');
  }
});

test.run();
