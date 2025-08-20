import { test } from 'uvu';
import * as assert from 'uvu/assert';
import { getConfig, Config } from '../src/utils/config';

// Store original environment variables
let originalEnv: NodeJS.ProcessEnv;

test.before.each(() => {
  // Store original environment
  originalEnv = { ...process.env };

  // Clear all relevant environment variables
  delete process.env.TOKEN_GITHUB;
  delete process.env.SLACK_WEBHOOK_URL;
  delete process.env.ORG_NAME;
  delete process.env.NODE_ENV;
  delete process.env.LOG_LEVEL;
  delete process.env.RELEASE_WINDOW;
  delete process.env.HOURS_BACK;
  delete process.env.TARGET_DATE;
});

test.after.each(() => {
  // Restore original environment
  process.env = originalEnv;
});

test('getConfig › should throw error when TOKEN_GITHUB is missing', () => {
  process.env.SLACK_WEBHOOK_URL = 'dummy-webhook-url';
  process.env.ORG_NAME = 'test-org';

  try {
    getConfig();
    assert.unreachable('should have thrown an error');
  } catch (error: any) {
    assert.instance(error, Error);
    assert.ok(error.message.includes('Missing required environment variables: TOKEN_GITHUB'));
  }
});

test('getConfig › should throw error when SLACK_WEBHOOK_URL is missing', () => {
  process.env.TOKEN_GITHUB = 'github_pat_test123';
  process.env.ORG_NAME = 'test-org';

  try {
    getConfig();
    assert.unreachable('should have thrown an error');
  } catch (error: any) {
    assert.instance(error, Error);
    assert.ok(error.message.includes('Missing required environment variables: SLACK_WEBHOOK_URL'));
  }
});

test('getConfig › should throw error when ORG_NAME is missing', () => {
  process.env.TOKEN_GITHUB = 'github_pat_test123';
  process.env.SLACK_WEBHOOK_URL = 'dummy-webhook-url';

  try {
    getConfig();
    assert.unreachable('should have thrown an error');
  } catch (error: any) {
    assert.instance(error, Error);
    assert.ok(error.message.includes('Missing required environment variables: ORG_NAME'));
  }
});

test('getConfig › should throw error when multiple required variables are missing', () => {
  try {
    getConfig();
    assert.unreachable('should have thrown an error');
  } catch (error: any) {
    assert.instance(error, Error);
    assert.ok(error.message.includes('Missing required environment variables:'));
    assert.ok(error.message.includes('TOKEN_GITHUB'));
    assert.ok(error.message.includes('SLACK_WEBHOOK_URL'));
    assert.ok(error.message.includes('ORG_NAME'));
  }
});

test('getConfig › should return valid config with all required variables', () => {
  process.env.TOKEN_GITHUB = 'github_pat_test123';
  process.env.SLACK_WEBHOOK_URL = 'dummy-webhook-url';
  process.env.ORG_NAME = 'test-org';

  const config = getConfig();

  assert.equal(config.githubToken, 'github_pat_test123');
  assert.equal(config.slackWebhookUrl, 'dummy-webhook-url');
  assert.equal(config.orgName, 'test-org');
  assert.equal(config.nodeEnv, 'production'); // default
  assert.equal(config.logLevel, 'info'); // default
  assert.equal(config.timeframe.type, 'hours'); // default
  assert.equal(config.timeframe.value, 24); // default hours
});

test('getConfig › should use custom optional environment variables', () => {
  process.env.TOKEN_GITHUB = 'github_pat_test123';
  process.env.SLACK_WEBHOOK_URL = 'dummy-webhook-url';
  process.env.ORG_NAME = 'test-org';
  process.env.NODE_ENV = 'development';
  process.env.LOG_LEVEL = 'debug';
  process.env.TARGET_DATE = '2024-01-01';

  const config = getConfig();

  assert.equal(config.nodeEnv, 'development');
  assert.equal(config.logLevel, 'debug');
  assert.equal(config.timeframe.type, 'date');
  assert.ok(config.timeframe.value instanceof Date);
});

test('getConfig › should throw error for invalid Slack webhook URL - wrong domain', () => {
  process.env.TOKEN_GITHUB = 'github_pat_test123';
  process.env.SLACK_WEBHOOK_URL = 'https://example.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX';
  process.env.ORG_NAME = 'test-org';

  try {
    getConfig();
    assert.unreachable('should have thrown an error');
  } catch (error: any) {
    assert.instance(error, Error);
    assert.ok(error.message.includes('Slack webhook URL must be from hooks.slack.com domain'));
  }
});

test('getConfig › should throw error for invalid Slack webhook URL - wrong path', () => {
  process.env.TOKEN_GITHUB = 'github_pat_test123';
  process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/invalid/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX';
  process.env.ORG_NAME = 'test-org';

  try {
    getConfig();
    assert.unreachable('should have thrown an error');
  } catch (error: any) {
    assert.instance(error, Error);
    assert.ok(error.message.includes('Invalid Slack webhook URL format'));
  }
});

test('getConfig › should throw error for invalid Slack webhook URL - malformed URL', () => {
  process.env.TOKEN_GITHUB = 'github_pat_test123';
  process.env.SLACK_WEBHOOK_URL = 'not-a-valid-url';
  process.env.ORG_NAME = 'test-org';

  try {
    getConfig();
    assert.unreachable('should have thrown an error');
  } catch (error: any) {
    assert.instance(error, Error);
    assert.ok(error.message.includes('Invalid Slack webhook URL'));
  }
});

test('getConfig › should throw error for invalid organization name - starts with hyphen', () => {
  process.env.TOKEN_GITHUB = 'github_pat_test123';
  process.env.SLACK_WEBHOOK_URL = 'dummy-webhook-url';
  process.env.ORG_NAME = '-invalid-org';

  try {
    getConfig();
    assert.unreachable('should have thrown an error');
  } catch (error: any) {
    assert.instance(error, Error);
    assert.ok(error.message.includes('Organization name must contain only alphanumeric characters and hyphens'));
  }
});

test('getConfig › should throw error for invalid organization name - ends with hyphen', () => {
  process.env.TOKEN_GITHUB = 'github_pat_test123';
  process.env.SLACK_WEBHOOK_URL = 'dummy-webhook-url';
  process.env.ORG_NAME = 'invalid-org-';

  try {
    getConfig();
    assert.unreachable('should have thrown an error');
  } catch (error: any) {
    assert.instance(error, Error);
    assert.ok(error.message.includes('Organization name must contain only alphanumeric characters and hyphens'));
  }
});

test('getConfig › should throw error for invalid organization name - special characters', () => {
  process.env.TOKEN_GITHUB = 'github_pat_test123';
  process.env.SLACK_WEBHOOK_URL = 'dummy-webhook-url';
  process.env.ORG_NAME = 'invalid@org';

  try {
    getConfig();
    assert.unreachable('should have thrown an error');
  } catch (error: any) {
    assert.instance(error, Error);
    assert.ok(error.message.includes('Organization name must contain only alphanumeric characters and hyphens'));
  }
});

test('getConfig › should throw error for organization name too long', () => {
  process.env.TOKEN_GITHUB = 'github_pat_test123';
  process.env.SLACK_WEBHOOK_URL = 'dummy-webhook-url';
  process.env.ORG_NAME = 'a'.repeat(40); // 40 characters, exceeds limit of 39

  try {
    getConfig();
    assert.unreachable('should have thrown an error');
  } catch (error: any) {
    assert.instance(error, Error);
    assert.ok(error.message.includes('Organization name cannot exceed 39 characters'));
  }
});

test('getConfig › should accept valid organization name with hyphens', () => {
  process.env.TOKEN_GITHUB = 'github_pat_test123';
  process.env.SLACK_WEBHOOK_URL = 'dummy-webhook-url';
  process.env.ORG_NAME = 'valid-org-name';

  const config = getConfig();
  assert.equal(config.orgName, 'valid-org-name');
});

test('getConfig › should accept maximum length organization name', () => {
  process.env.TOKEN_GITHUB = 'github_pat_test123';
  process.env.SLACK_WEBHOOK_URL = 'dummy-webhook-url';
  process.env.ORG_NAME = 'a'.repeat(39); // 39 characters, at the limit

  const config = getConfig();
  assert.equal(config.orgName, 'a'.repeat(39));
});

test('getConfig › should throw error for invalid days back - non-numeric', () => {
  process.env.TOKEN_GITHUB = 'github_pat_test123';
  process.env.SLACK_WEBHOOK_URL = 'dummy-webhook-url';
  process.env.ORG_NAME = 'test-org';
  process.env.DAYS_BACK = 'abc';

  try {
    getConfig();
    assert.unreachable('should have thrown an error');
  } catch (error: any) {
    assert.instance(error, Error);
    assert.ok(error.message.includes('Invalid DAYS_BACK: abc. Must be a positive number'));
  }
});

test('getConfig › should parse valid hours back', () => {
  process.env.TOKEN_GITHUB = 'github_pat_test123';
  process.env.SLACK_WEBHOOK_URL = 'dummy-webhook-url';
  process.env.ORG_NAME = 'test-org';
  process.env.HOURS_BACK = '48';

  const config = getConfig();
  assert.equal(config.timeframe.type, 'hours');
  assert.equal(config.timeframe.value, 48);
});

test('getConfig › should throw error for invalid hours back - non-numeric', () => {
  process.env.TOKEN_GITHUB = 'github_pat_test123';
  process.env.SLACK_WEBHOOK_URL = 'dummy-webhook-url';
  process.env.ORG_NAME = 'test-org';
  process.env.HOURS_BACK = 'abc';

  try {
    getConfig();
    assert.unreachable('should have thrown an error');
  } catch (error: any) {
    assert.instance(error, Error);
    assert.ok(error.message.includes('Invalid HOURS_BACK: abc. Must be a positive number'));
  }
});

test('getConfig › should throw error for invalid hours back - negative', () => {
  process.env.TOKEN_GITHUB = 'github_pat_test123';
  process.env.SLACK_WEBHOOK_URL = 'dummy-webhook-url';
  process.env.ORG_NAME = 'test-org';
  process.env.HOURS_BACK = '-5';

  try {
    getConfig();
    assert.unreachable('should have thrown an error');
  } catch (error: any) {
    assert.instance(error, Error);
    assert.ok(error.message.includes('Invalid HOURS_BACK: -5. Must be a positive number'));
  }
});

test('getConfig › should throw error for invalid hours back - zero', () => {
  process.env.TOKEN_GITHUB = 'github_pat_test123';
  process.env.SLACK_WEBHOOK_URL = 'dummy-webhook-url';
  process.env.ORG_NAME = 'test-org';
  process.env.HOURS_BACK = '0';

  try {
    getConfig();
    assert.unreachable('should have thrown an error');
  } catch (error: any) {
    assert.instance(error, Error);
    assert.ok(error.message.includes('Invalid HOURS_BACK: 0. Must be a positive number'));
  }
});

test('getConfig › should parse valid target date', () => {
  process.env.TOKEN_GITHUB = 'github_pat_test123';
  process.env.SLACK_WEBHOOK_URL = 'dummy-webhook-url';
  process.env.ORG_NAME = 'test-org';
  process.env.TARGET_DATE = '2023-07-14';

  const config = getConfig();
  assert.equal(config.timeframe.type, 'date');
  assert.ok(config.timeframe.value instanceof Date);
  assert.equal((config.timeframe.value as Date).toISOString().split('T')[0], '2023-07-14');
});

test('getConfig › should throw error for invalid target date', () => {
  process.env.TOKEN_GITHUB = 'github_pat_test123';
  process.env.SLACK_WEBHOOK_URL = 'dummy-webhook-url';
  process.env.ORG_NAME = 'test-org';
  process.env.TARGET_DATE = 'invalid-date';

  try {
    getConfig();
    assert.unreachable('should have thrown an error');
  } catch (error: any) {
    assert.instance(error, Error);
    assert.ok(error.message.includes('Invalid TARGET_DATE: invalid-date. Must be in YYYY-MM-DD format'));
  }
});

test('getConfig › should trim whitespace from environment variables', () => {
  process.env.TOKEN_GITHUB = '  github_pat_test123  ';
  process.env.SLACK_WEBHOOK_URL = '  dummy-webhook-url  ';
  process.env.ORG_NAME = '  test-org  ';
  process.env.NODE_ENV = '  development  ';

  const config = getConfig();
  assert.equal(config.githubToken, 'github_pat_test123');
  assert.equal(config.slackWebhookUrl, 'dummy-webhook-url');
  assert.equal(config.orgName, 'test-org');
  assert.equal(config.nodeEnv, 'development');
});

test('getConfig › should treat empty strings as missing required variables', () => {
  process.env.TOKEN_GITHUB = '';
  process.env.SLACK_WEBHOOK_URL = 'dummy-webhook-url';
  process.env.ORG_NAME = 'test-org';

  try {
    getConfig();
    assert.unreachable('should have thrown an error');
  } catch (error: any) {
    assert.instance(error, Error);
    assert.ok(error.message.includes('Missing required environment variables: TOKEN_GITHUB'));
  }
});

test('getConfig › should treat whitespace-only strings as missing required variables', () => {
  process.env.TOKEN_GITHUB = '   ';
  process.env.SLACK_WEBHOOK_URL = 'dummy-webhook-url';
  process.env.ORG_NAME = 'test-org';

  try {
    getConfig();
    assert.unreachable('should have thrown an error');
  } catch (error: any) {
    assert.instance(error, Error);
    assert.ok(error.message.includes('Missing required environment variables: TOKEN_GITHUB'));
  }
});

test.run();
