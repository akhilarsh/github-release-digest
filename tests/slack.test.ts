import { test } from 'uvu';
import * as assert from 'uvu/assert';
import { postToSlack } from '../src/core/slack';
import { ReleaseInfo, SlackMessage } from '../src/types';

// Mock the logger
const mockLogger = {
  info: (msg: string) => {},
  error: (msg: string) => {},
  warn: (msg: string) => {},
  debug: (msg: string) => {},
  updateContext: (context: any) => {}
};

// Mock the summary module
const mockFormatReleaseMessage = (releases: ReleaseInfo[], config: any, format: string) => {
  return `Formatted ${format} message for ${releases.length} releases`;
};

const mockValidateReleases = (releases: ReleaseInfo[]) => {
  if (!Array.isArray(releases)) {
    throw new Error('Releases must be an array');
  }
  releases.forEach((release, index) => {
    if (!release.repository || !release.name || !release.publishedAt) {
      throw new Error(`Invalid release data at index ${index}: missing required fields`);
    }
  });
};

// Mock SlackClient
class MockSlackClient {
  constructor(public webhookUrl: string) {}

  async postMessage(message: SlackMessage): Promise<void> {
    if (this.webhookUrl === 'http://fail.example.com') {
      throw new Error('Network error');
    }
    // Simulate successful posting
  }
}

// Set up mocks before tests
const originalSlackClient = require('../src/clients/slack-client').SlackClient;
const originalLogger = require('../src/utils/logger').logger;
const originalFormatReleaseMessage = require('../src/core/summary').formatReleaseMessage;
const originalValidateReleases = require('../src/core/summary').validateReleases;

// Apply mocks
require('../src/clients/slack-client').SlackClient = MockSlackClient;
require('../src/utils/logger').logger = mockLogger;
require('../src/core/summary').formatReleaseMessage = mockFormatReleaseMessage;
require('../src/core/summary').validateReleases = mockValidateReleases;

// Sample data
const sampleReleases: ReleaseInfo[] = [
  {
    repository: 'test/repo1',
    tagName: 'v1.0.0',
    name: 'Release 1.0.0',
    publishedAt: '2024-01-01T10:00:00Z',
    description: 'First release',
    url: 'https://github.com/test/repo1/releases/tag/v1.0.0',
    author: 'testuser',
    isPrerelease: false
  },
  {
    repository: 'test/repo2',
    tagName: 'v2.0.0-beta',
    name: 'Release 2.0.0 Beta',
    publishedAt: '2024-01-01T11:00:00Z',
    description: 'Beta release',
    url: 'https://github.com/test/repo2/releases/tag/v2.0.0-beta',
    author: 'testuser2',
    isPrerelease: true
  }
];

// Test validateSlackConfig function indirectly through postToSlack

test('postToSlack - should successfully post to Slack with valid recent config', async () => {
  const config = {
    releaseMode: 'recent' as const,
    hoursBack: 24
  };

  await postToSlack(sampleReleases, 'https://hooks.slack.com/test', config, 'tabular');
  // If no error is thrown, the test passes
  assert.ok(true);
});

test('postToSlack - should successfully post to Slack with valid daily config', async () => {
  const config = {
    releaseMode: 'daily' as const,
    targetDate: new Date('2024-01-01')
  };

  await postToSlack(sampleReleases, 'https://hooks.slack.com/test', config, 'detailed');
  // If no error is thrown, the test passes
  assert.ok(true);
});

test('postToSlack - should throw error for invalid webhook URL (null)', async () => {
  const config = {
    releaseMode: 'recent' as const,
    hoursBack: 24
  };

  try {
    await postToSlack(sampleReleases, null as any, config);
    assert.unreachable('Should have thrown an error');
  } catch (error) {
    assert.instance(error, Error);
    assert.match((error as Error).message, /Slack posting failed.*Valid Slack webhook URL is required/);
  }
});

test('postToSlack - should throw error for invalid webhook URL (empty string)', async () => {
  const config = {
    releaseMode: 'recent' as const,
    hoursBack: 24
  };

  try {
    await postToSlack(sampleReleases, '', config);
    assert.unreachable('Should have thrown an error');
  } catch (error) {
    assert.instance(error, Error);
    assert.match((error as Error).message, /Slack posting failed.*Valid Slack webhook URL is required/);
  }
});

test('postToSlack - should throw error for invalid webhook URL (non-string)', async () => {
  const config = {
    releaseMode: 'recent' as const,
    hoursBack: 24
  };

  try {
    await postToSlack(sampleReleases, 123 as any, config);
    assert.unreachable('Should have thrown an error');
  } catch (error) {
    assert.instance(error, Error);
    assert.match((error as Error).message, /Slack posting failed.*Valid Slack webhook URL is required/);
  }
});

test('postToSlack - should throw error for missing config', async () => {
  try {
    await postToSlack(sampleReleases, 'https://hooks.slack.com/test', null as any);
    assert.unreachable('Should have thrown an error');
  } catch (error) {
    assert.instance(error, Error);
    assert.match((error as Error).message, /Slack posting failed.*Slack configuration is required/);
  }
});

test('postToSlack - should throw error for invalid release mode', async () => {
  const config = {
    releaseMode: 'invalid' as any,
    hoursBack: 24
  };

  try {
    await postToSlack(sampleReleases, 'https://hooks.slack.com/test', config);
    assert.unreachable('Should have thrown an error');
  } catch (error) {
    assert.instance(error, Error);
    assert.match((error as Error).message, /Slack posting failed.*Invalid release mode: invalid/);
  }
});

test('postToSlack - should throw error for daily mode without target date', async () => {
  const config = {
    releaseMode: 'daily' as const
  };

  try {
    await postToSlack(sampleReleases, 'https://hooks.slack.com/test', config);
    assert.unreachable('Should have thrown an error');
  } catch (error) {
    assert.instance(error, Error);
    assert.match((error as Error).message, /Slack posting failed.*Target date is required for daily mode/);
  }
});

test('postToSlack - should throw error for recent mode without hoursBack', async () => {
  const config = {
    releaseMode: 'recent' as const
  };

  try {
    await postToSlack(sampleReleases, 'https://hooks.slack.com/test', config);
    assert.unreachable('Should have thrown an error');
  } catch (error) {
    assert.instance(error, Error);
    assert.match((error as Error).message, /Slack posting failed.*Valid hoursBack is required for recent mode/);
  }
});

test('postToSlack - should throw error for recent mode with invalid hoursBack (zero)', async () => {
  const config = {
    releaseMode: 'recent' as const,
    hoursBack: 0
  };

  try {
    await postToSlack(sampleReleases, 'https://hooks.slack.com/test', config);
    assert.unreachable('Should have thrown an error');
  } catch (error) {
    assert.instance(error, Error);
    assert.match((error as Error).message, /Slack posting failed.*Valid hoursBack is required for recent mode/);
  }
});

test('postToSlack - should throw error for recent mode with invalid hoursBack (negative)', async () => {
  const config = {
    releaseMode: 'recent' as const,
    hoursBack: -5
  };

  try {
    await postToSlack(sampleReleases, 'https://hooks.slack.com/test', config);
    assert.unreachable('Should have thrown an error');
  } catch (error) {
    assert.instance(error, Error);
    assert.match((error as Error).message, /Slack posting failed.*Valid hoursBack is required for recent mode/);
  }
});

test('postToSlack - should throw error for invalid releases (non-array)', async () => {
  const config = {
    releaseMode: 'recent' as const,
    hoursBack: 24
  };

  try {
    await postToSlack('invalid' as any, 'https://hooks.slack.com/test', config);
    assert.unreachable('Should have thrown an error');
  } catch (error) {
    assert.instance(error, Error);
    assert.match((error as Error).message, /Slack posting failed.*Releases must be an array/);
  }
});

test('postToSlack - should throw error for invalid release data', async () => {
  const invalidReleases = [
    {
      repository: 'test/repo1',
      tagName: 'v1.0.0',
      // Missing required fields: name, publishedAt
      description: 'First release',
      url: 'https://github.com/test/repo1/releases/tag/v1.0.0',
      author: 'testuser',
      isPrerelease: false
    }
  ] as any;

  const config = {
    releaseMode: 'recent' as const,
    hoursBack: 24
  };

  try {
    await postToSlack(invalidReleases, 'https://hooks.slack.com/test', config);
    assert.unreachable('Should have thrown an error');
  } catch (error) {
    assert.instance(error, Error);
    assert.match((error as Error).message, /Slack posting failed.*Invalid release data at index 0: missing required fields/);
  }
});

test('postToSlack - should handle SlackClient network errors', async () => {
  const config = {
    releaseMode: 'recent' as const,
    hoursBack: 24
  };

  try {
    await postToSlack(sampleReleases, 'http://fail.example.com', config);
    assert.unreachable('Should have thrown an error');
  } catch (error) {
    assert.instance(error, Error);
    assert.match((error as Error).message, /Slack posting failed.*Network error/);
  }
});

test('postToSlack - should handle non-Error exceptions', async () => {
  // Mock validateReleases to throw a non-Error object
  const originalValidateReleasesBackup = require('../src/core/summary').validateReleases;
  require('../src/core/summary').validateReleases = () => {
    throw 'String error';
  };

  const config = {
    releaseMode: 'recent' as const,
    hoursBack: 24
  };

  try {
    await postToSlack(sampleReleases, 'https://hooks.slack.com/test', config);
    assert.unreachable('Should have thrown an error');
  } catch (error) {
    assert.instance(error, Error);
    assert.match((error as Error).message, /Slack posting failed.*String error/);
  } finally {
    // Restore original function
    require('../src/core/summary').validateReleases = originalValidateReleasesBackup;
  }
});

test('postToSlack - should use default tabular format when format not specified', async () => {
  const config = {
    releaseMode: 'recent' as const,
    hoursBack: 24
  };

  // Mock formatReleaseMessage to capture the format parameter
  let capturedFormat = '';
  require('../src/core/summary').formatReleaseMessage = (releases: ReleaseInfo[], config: any, format: string) => {
    capturedFormat = format;
    return `Formatted ${format} message for ${releases.length} releases`;
  };

  await postToSlack(sampleReleases, 'https://hooks.slack.com/test', config);

  assert.is(capturedFormat, 'tabular');

  // Restore original mock
  require('../src/core/summary').formatReleaseMessage = mockFormatReleaseMessage;
});

test('postToSlack - should pass correct SummaryConfig to formatReleaseMessage', async () => {
  const config = {
    releaseMode: 'daily' as const,
    targetDate: new Date('2024-01-01'),
    hoursBack: 12 // This should be included even for daily mode
  };

  // Mock formatReleaseMessage to capture the config parameter
  let capturedConfig: any = null;
  require('../src/core/summary').formatReleaseMessage = (releases: ReleaseInfo[], summaryConfig: any, format: string) => {
    capturedConfig = summaryConfig;
    return `Formatted ${format} message for ${releases.length} releases`;
  };

  await postToSlack(sampleReleases, 'https://hooks.slack.com/test', config);

  assert.is(capturedConfig.releaseMode, 'daily');
  assert.equal(capturedConfig.targetDate, new Date('2024-01-01'));
  assert.is(capturedConfig.hoursBack, 12);

  // Restore original mock
  require('../src/core/summary').formatReleaseMessage = mockFormatReleaseMessage;
});

test('postToSlack - should create correct SlackMessage object', async () => {
  const config = {
    releaseMode: 'recent' as const,
    hoursBack: 24
  };

  // Mock SlackClient to capture the message
  let capturedMessage: SlackMessage | null = null;
  class CaptureSlackClient {
    constructor(public webhookUrl: string) {}

    async postMessage(message: SlackMessage): Promise<void> {
      capturedMessage = message;
    }
  }

  require('../src/clients/slack-client').SlackClient = CaptureSlackClient;

  await postToSlack(sampleReleases, 'https://hooks.slack.com/test', config);

  assert.ok(capturedMessage);

  // Restore original mock
  require('../src/clients/slack-client').SlackClient = MockSlackClient;
});

test.run();

// Restore original implementations after all tests
require('../src/clients/slack-client').SlackClient = originalSlackClient;
require('../src/utils/logger').logger = originalLogger;
require('../src/core/summary').formatReleaseMessage = originalFormatReleaseMessage;
require('../src/core/summary').validateReleases = originalValidateReleases;

test.run();
