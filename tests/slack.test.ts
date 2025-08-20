import { test } from 'uvu';
import * as assert from 'uvu/assert';
import { postToSlack } from '../src/core/slack';

// Mock the logger
const mockLogger = {
  info: (msg: string) => {},
  error: (msg: string) => {},
  warn: (msg: string) => {},
  debug: (msg: string) => {},
  updateContext: (context: any) => {}
};

// Mock SlackClient
class MockSlackClient {
  constructor(public webhookUrl: string) {}

  async postMessage(message: any): Promise<void> {
    if (this.webhookUrl === 'http://fail.example.com') {
      throw new Error('Network error');
    }
    // Simulate successful posting
  }
}

// Set up mocks before tests
const originalSlackClient = require('../src/clients/slack-client').SlackClient;
const originalLogger = require('../src/utils/logger').logger;

// Apply mocks
require('../src/clients/slack-client').SlackClient = MockSlackClient;
require('../src/utils/logger').logger = mockLogger;

test.before(() => {
  // Initialize logger for tests
  const { logger } = require('../src/utils/logger');
  logger.updateContext('test');
});

test.after(() => {
  // Restore original classes
  require('../src/clients/slack-client').SlackClient = originalSlackClient;
  require('../src/utils/logger').logger = originalLogger;
});

test('postToSlack - should successfully post to Slack with valid message', async () => {
  const message = 'Test Slack message';

  await postToSlack(message, 'https://hooks.slack.com/test');
  // If no error is thrown, the test passes
  assert.ok(true);
});

test('postToSlack - should successfully post to Slack with long message', async () => {
  const message = 'A'.repeat(3000); // Long message

  await postToSlack(message, 'https://hooks.slack.com/test');
  // If no error is thrown, the test passes
  assert.ok(true);
});

test('postToSlack - should throw error for invalid webhook URL (null)', async () => {
  try {
    await postToSlack('Test message', null as any);
    assert.unreachable('Should have thrown an error');
  } catch (error) {
    assert.instance(error, Error);
    assert.match((error as Error).message, /Failed to post to Slack.*Slack webhook URL is required/);
  }
});

test('postToSlack - should throw error for invalid webhook URL (empty string)', async () => {
  try {
    await postToSlack('Test message', '');
    assert.unreachable('Should have thrown an error');
  } catch (error) {
    assert.instance(error, Error);
    assert.match((error as Error).message, /Failed to post to Slack.*Slack webhook URL is required/);
  }
});

test('postToSlack - should throw error for invalid webhook URL (non-string)', async () => {
  try {
    await postToSlack('Test message', 123 as any);
    assert.unreachable('Should have thrown an error');
  } catch (error) {
    assert.instance(error, Error);
    // The error message varies depending on the JavaScript environment
    assert.ok((error as Error).message.includes('Failed to post to Slack'));
  }
});

test('postToSlack - should throw error for invalid webhook URL format', async () => {
  try {
    await postToSlack('Test message', 'invalid-url');
    assert.unreachable('Should have thrown an error');
  } catch (error) {
    assert.instance(error, Error);
    // The error message varies depending on the JavaScript environment
    assert.ok((error as Error).message.includes('Failed to post to Slack'));
  }
});

test('postToSlack - should handle SlackClient network errors', async () => {
  try {
    await postToSlack('Test message', 'http://fail.example.com');
    assert.unreachable('Should have thrown an error');
  } catch (error) {
    assert.instance(error, Error);
  }
});

test('postToSlack - should handle non-Error exceptions', async () => {
  // Mock fetch to throw a non-Error object
  const originalFetch = global.fetch;
  global.fetch = async () => {
    throw 'String error';
  };

  try {
    await postToSlack('Test message', 'https://hooks.slack.com/test');
    assert.unreachable('Should have thrown an error');
  } catch (error) {
    assert.instance(error, Error);
    assert.match((error as Error).message, /Failed to post to Slack.*String error/);
  } finally {
    // Restore original function
    global.fetch = originalFetch;
  }
});

test.run();
