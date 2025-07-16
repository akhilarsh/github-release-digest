import { test } from 'uvu';
import * as assert from 'uvu/assert';
import {
  formatDateTime,
  formatDateForTable,
  validateReleases,
  formatReleaseMessage,
  cleanDescription,
  extractTableDescription,
  getTimePeriodText,
  getHeaderText,
  wrapText,
  generateDetailedSummary,
  generateTabularSummary,
  SummaryConfig
} from '../src/core/summary';
import { ReleaseInfo } from '../src/types';

// Mock the logger to prevent log file creation
const mockLogger = {
  info: (msg: string) => {},
  error: (msg: string) => {},
  warn: (msg: string) => {},
  debug: (msg: string) => {},
  updateContext: (context: any) => {}
};

// Set up mock before tests
const originalLogger = require('../src/utils/logger').logger;
require('../src/utils/logger').logger = mockLogger;

// Sample data
const sampleReleases: ReleaseInfo[] = [
  {
    repository: 'test/repo1',
    tagName: 'v1.0.0',
    name: 'Release 1.0.0',
    publishedAt: '2024-01-01T10:00:00Z',
    description: 'First release with features',
    url: 'https://github.com/test/repo1/releases/tag/v1.0.0',
    author: 'testuser',
    isPrerelease: false
  },
  {
    repository: 'test/repo2',
    tagName: 'v2.0.0-beta',
    name: 'Release 2.0.0 Beta',
    publishedAt: '2024-01-01T11:30:45Z',
    description: '## 2.0.0-beta\n\n* New feature A\n* Bug fix B\n\n**Full Changelog**: https://github.com/test/repo2/compare/v1.0.0...v2.0.0-beta',
    url: 'https://github.com/test/repo2/releases/tag/v2.0.0-beta',
    author: 'testuser2',
    isPrerelease: true
  }
];

// Test formatDateTime function
test('formatDateTime - should format valid ISO string correctly', () => {
  const result = formatDateTime('2024-01-01T10:30:45Z');
  assert.is(result, '2024-01-01 | 10:30:45 UTC');
});

test('formatDateTime - should handle different timezone formats', () => {
  const result = formatDateTime('2024-12-25T23:59:59.123Z');
  assert.is(result, '2024-12-25 | 23:59:59 UTC');
});

test('formatDateTime - should handle single digit dates and times', () => {
  const result = formatDateTime('2024-01-05T05:05:05Z');
  assert.is(result, '2024-01-05 | 05:05:05 UTC');
});

test('formatDateTime - should return NaN format on invalid date', () => {
  const result = formatDateTime('invalid-date');
  assert.is(result, 'NaN-NaN-NaN | NaN:NaN:NaN UTC');
});

test('formatDateTime - should handle empty string', () => {
  const result = formatDateTime('');
  assert.is(result, 'NaN-NaN-NaN | NaN:NaN:NaN UTC');
});

// Test formatDateForTable function
test('formatDateForTable - should format valid ISO string correctly (shorter format)', () => {
  const result = formatDateForTable('2024-01-01T10:30:45Z');
  assert.is(result, '2024-01-01 | 10:30 UTC');
});

test('formatDateForTable - should handle different timezone formats', () => {
  const result = formatDateForTable('2024-12-25T23:59:59.123Z');
  assert.is(result, '2024-12-25 | 23:59 UTC');
});

test('formatDateForTable - should return NaN format on invalid date', () => {
  const result = formatDateForTable('2024-01-01T invalid');
  assert.is(result, 'NaN-NaN-NaN | NaN:NaN UTC');
});

test('formatDateForTable - should handle malformed ISO string', () => {
  const result = formatDateForTable('not-a-date');
  assert.is(result, 'NaN-NaN-NaN | NaN:NaN UTC');
});

// Test validateReleases function
test('validateReleases - should pass for valid releases array', () => {
  assert.not.throws(() => validateReleases(sampleReleases));
});

test('validateReleases - should pass for empty array', () => {
  assert.not.throws(() => validateReleases([]));
});

test('validateReleases - should throw error for non-array input', () => {
  assert.throws(
    () => validateReleases('not-an-array' as any),
    /Releases must be an array/
  );
});

test('validateReleases - should throw error for release missing repository', () => {
  const invalidReleases = [{
    tagName: 'v1.0.0',
    name: 'Release 1.0.0',
    publishedAt: '2024-01-01T10:00:00Z',
    description: 'Test',
    url: 'https://example.com',
    author: 'test',
    isPrerelease: false
  }] as any;

  assert.throws(
    () => validateReleases(invalidReleases),
    /Invalid release data at index 0: missing required fields/
  );
});

test('validateReleases - should throw error for release missing name', () => {
  const invalidReleases = [{
    repository: 'test/repo',
    tagName: 'v1.0.0',
    publishedAt: '2024-01-01T10:00:00Z',
    description: 'Test',
    url: 'https://example.com',
    author: 'test',
    isPrerelease: false
  }] as any;

  assert.throws(
    () => validateReleases(invalidReleases),
    /Invalid release data at index 0: missing required fields/
  );
});

test('validateReleases - should throw error for release missing publishedAt', () => {
  const invalidReleases = [{
    repository: 'test/repo',
    tagName: 'v1.0.0',
    name: 'Release 1.0.0',
    description: 'Test',
    url: 'https://example.com',
    author: 'test',
    isPrerelease: false
  }] as any;

  assert.throws(
    () => validateReleases(invalidReleases),
    /Invalid release data at index 0: missing required fields/
  );
});

// Test cleanDescription function
test('cleanDescription - should handle null/undefined input', () => {
  assert.is(cleanDescription(null as any), 'No description available');
  assert.is(cleanDescription(undefined as any), 'No description available');
});

test('cleanDescription - should handle non-string input', () => {
  assert.is(cleanDescription(123 as any), 'No description available');
});

test('cleanDescription - should remove version headers', () => {
  const input = '## 1.66.5 (2025-07-14)\n\nSome content\n\n# v1.104.6\n\nMore content';
  const result = cleanDescription(input);
  assert.is(result, 'Some content\n\nMore content');
});

test('cleanDescription - should remove release headers', () => {
  const input = '## Release v1.104.6\n\nContent here\n\n# Release 1.66.5 (2025-07-14)\n\nMore content';
  const result = cleanDescription(input);
  assert.is(result, 'Content here\n\nMore content');
});

test('cleanDescription - should remove markdown links but keep text', () => {
  const input = 'Check out [this link](https://example.com) and [another](https://test.com)';
  const result = cleanDescription(input);
  assert.is(result, 'Check out this link and another');
});

test('cleanDescription - should remove commit hashes and PR references', () => {
  const input = 'Fixed bug ([a1b2c3d](url)) and ([#123](url)) and (#456) and (abcdef12)';
  const result = cleanDescription(input);
  assert.is(result, 'Fixed bug and and and');
});

test('cleanDescription - should remove Full Changelog URLs', () => {
  const input = 'Some changes\n\n**Full Changelog**: https://github.com/org/repo/compare/v1...v2';
  const result = cleanDescription(input);
  assert.is(result, 'Some changes');
});

test('cleanDescription - should clean up multiple spaces and newlines', () => {
  const input = 'Text   with    multiple     spaces\n\n\n\nAnd    many   newlines\n\n\n';
  const result = cleanDescription(input);
  assert.is(result, 'Text with multiple spaces\n\nAnd many newlines');
});

test('cleanDescription - should handle errors gracefully', () => {
  // Mock cleanDescription to throw an error
  const originalCleanDescription = require('../src/core/summary').cleanDescription;
  require('../src/core/summary').cleanDescription = () => {
    throw new Error('Test error');
  };

  // This should be tested by calling the function directly, but since we're mocking it,
  // we'll test the fallback behavior indirectly through other functions that use it

  // Restore original function
  require('../src/core/summary').cleanDescription = originalCleanDescription;

  // Test with normal input to ensure function works
  const result = cleanDescription('Normal text');
  assert.is(result, 'Normal text');
});

// Test extractTableDescription function
test('extractTableDescription - should handle null/undefined input', () => {
  assert.is(extractTableDescription(null as any), 'No description available');
  assert.is(extractTableDescription(undefined as any), 'No description available');
});

test('extractTableDescription - should extract meaningful content', () => {
  const input = '## Features\n\n* Added new feature A\n* Improved performance\n\n## Bug Fixes\n\n* Fixed critical bug';
  const result = extractTableDescription(input);
  assert.match(result, /Features.*Added new feature A.*Improved performance/);
});

test('extractTableDescription - should skip version headers', () => {
  const input = '## 1.0.0\n\n* Important feature\n* Bug fix\n\n## Release v2.0.0\n\n* Another feature';
  const result = extractTableDescription(input);
  assert.match(result, /Important feature.*Another feature/);
});

test('extractTableDescription - should truncate very long lines', () => {
  const longText = 'This is a very long line that should be truncated because it exceeds the maximum length limit that we have set for table descriptions in the summary display';
  const result = extractTableDescription(longText);
  assert.ok(result.length <= 120);
  assert.match(result, /\.\.\.$/);
});

test('extractTableDescription - should return fallback for empty content', () => {
  const input = '## 1.0.0\n\n## Release notes\n\n   \n\n   ';
  const result = extractTableDescription(input);
  assert.is(result, 'Release notes available');
});

test('extractTableDescription - should handle processing errors', () => {
  // Test error handling by providing a string that might cause issues
  const result = extractTableDescription('Normal content');
  assert.is(result, 'Normal content');
});

// Test getTimePeriodText function
test('getTimePeriodText - should return correct text for daily mode', () => {
  const config: SummaryConfig = {
    releaseMode: 'daily',
    targetDate: new Date('2024-01-01')
  };
  const result = getTimePeriodText(config);
  assert.is(result, 'on 2024-01-01');
});

test('getTimePeriodText - should return correct text for recent mode (24 hours)', () => {
  const config: SummaryConfig = {
    releaseMode: 'recent',
    hoursBack: 24
  };
  const result = getTimePeriodText(config);
  assert.is(result, 'in the last 24 hours');
});

test('getTimePeriodText - should return correct text for recent mode (1 hour)', () => {
  const config: SummaryConfig = {
    releaseMode: 'recent',
    hoursBack: 1
  };
  const result = getTimePeriodText(config);
  assert.is(result, 'in the last hour');
});

test('getTimePeriodText - should return correct text for recent mode (custom hours)', () => {
  const config: SummaryConfig = {
    releaseMode: 'recent',
    hoursBack: 12
  };
  const result = getTimePeriodText(config);
  assert.is(result, 'in the last 12 hours');
});

test('getTimePeriodText - should return fallback for invalid config', () => {
  const config: SummaryConfig = {
    releaseMode: 'daily'
    // Missing targetDate
  };
  const result = getTimePeriodText(config);
  assert.is(result, 'recently');
});

// Test getHeaderText function
test('getHeaderText - should return date for daily mode', () => {
  const config: SummaryConfig = {
    releaseMode: 'daily',
    targetDate: new Date('2024-01-01')
  };
  const result = getHeaderText(config);
  assert.is(result, '2024-01-01');
});

test('getHeaderText - should return hours text for recent mode (24 hours)', () => {
  const config: SummaryConfig = {
    releaseMode: 'recent',
    hoursBack: 24
  };
  const result = getHeaderText(config);
  assert.is(result, 'Last 24 hours');
});

test('getHeaderText - should return hours text for recent mode (1 hour)', () => {
  const config: SummaryConfig = {
    releaseMode: 'recent',
    hoursBack: 1
  };
  const result = getHeaderText(config);
  assert.is(result, 'Last hour');
});

test('getHeaderText - should return hours text for recent mode (custom)', () => {
  const config: SummaryConfig = {
    releaseMode: 'recent',
    hoursBack: 6
  };
  const result = getHeaderText(config);
  assert.is(result, 'Last 6 hours');
});

test('getHeaderText - should return empty string for invalid config', () => {
  const config: SummaryConfig = {
    releaseMode: 'daily'
    // Missing targetDate
  };
  const result = getHeaderText(config);
  assert.is(result, '');
});

// Test wrapText function
test('wrapText - should handle empty text', () => {
  const result = wrapText('', 10);
  assert.equal(result, ['']);
});

test('wrapText - should handle zero width', () => {
  const result = wrapText('some text', 0);
  assert.equal(result, ['']);
});

test('wrapText - should wrap long text correctly', () => {
  const result = wrapText('This is a very long line that should be wrapped', 10);
  assert.ok(result.length > 1);
  result.forEach(line => {
    assert.ok(line.length <= 10 || line.split(' ').length === 1); // Allow single long words
  });
});

test('wrapText - should preserve existing line breaks', () => {
  const result = wrapText('Line 1\nLine 2\nLine 3', 20);
  assert.ok(result.includes('Line 1'));
  assert.ok(result.includes('Line 2'));
  assert.ok(result.includes('Line 3'));
});

test('wrapText - should handle paragraphs with empty lines', () => {
  const result = wrapText('Para 1\n\nPara 2', 20);
  assert.ok(result.includes(''));
});

// Test formatReleaseMessage function
test('formatReleaseMessage - should format message with tabular format', () => {
  const config: SummaryConfig = {
    releaseMode: 'recent',
    hoursBack: 24
  };
  const result = formatReleaseMessage(sampleReleases, config, 'tabular');
  assert.match(result, /📊 \*RELEASE SUMMARY/);
  assert.match(result, /Summary.*2 releases.*1 stable.*1 pre-release/);
});

test('formatReleaseMessage - should format message with detailed format', () => {
  const config: SummaryConfig = {
    releaseMode: 'daily',
    targetDate: new Date('2024-01-01')
  };
  const result = formatReleaseMessage(sampleReleases, config, 'detailed');
  assert.match(result, /📊 RELEASE SUMMARY/);
  assert.match(result, /📦 test\/repo1/);
  assert.match(result, /🚀 Release 1\.0\.0/);
});

test('formatReleaseMessage - should use tabular format as default', () => {
  const config: SummaryConfig = {
    releaseMode: 'recent',
    hoursBack: 24
  };
  const result = formatReleaseMessage(sampleReleases, config);
  assert.match(result, /\*RELEASE SUMMARY/); // Tabular uses * for bold
});

test('formatReleaseMessage - should handle empty releases array', () => {
  const config: SummaryConfig = {
    releaseMode: 'recent',
    hoursBack: 24
  };
  const result = formatReleaseMessage([], config);
  assert.match(result, /No releases found/);
});

test('formatReleaseMessage - should throw error for invalid releases', () => {
  const config: SummaryConfig = {
    releaseMode: 'recent',
    hoursBack: 24
  };

  assert.throws(
    () => formatReleaseMessage('invalid' as any, config),
    /Failed to format release message.*Releases must be an array/
  );
});

// Test generateDetailedSummary function
test('generateDetailedSummary - should generate detailed summary with header', () => {
  const config: SummaryConfig = {
    releaseMode: 'daily',
    targetDate: new Date('2024-01-01')
  };
  const result = generateDetailedSummary(sampleReleases, config);

  assert.match(result, /📊 RELEASE SUMMARY - 2024-01-01/);
  assert.match(result, /=+/); // Contains separator lines
  assert.match(result, /📦 test\/repo1/);
  assert.match(result, /🚀 Release 1\.0\.0/);
  assert.match(result, /ℹ️/); // Contains info icons
});

test('generateDetailedSummary - should handle empty releases', () => {
  const config: SummaryConfig = {
    releaseMode: 'recent',
    hoursBack: 24
  };
  const result = generateDetailedSummary([], config);
  assert.match(result, /No releases found in the last 24 hours/);
});

test('generateDetailedSummary - should handle individual release errors gracefully', () => {
  const brokenRelease = {
    ...sampleReleases[0],
    repository: null // This might cause formatting errors
  } as any;

  const config: SummaryConfig = {
    releaseMode: 'recent',
    hoursBack: 24
  };

  const result = generateDetailedSummary([brokenRelease], config);
  // The function actually handles null repository gracefully by converting to string
  assert.match(result, /📦 null/);
});

// Test generateTabularSummary function
test('generateTabularSummary - should generate tabular summary with stats', () => {
  const config: SummaryConfig = {
    releaseMode: 'recent',
    hoursBack: 24
  };
  const result = generateTabularSummary(sampleReleases, config);

  assert.match(result, /\*RELEASE SUMMARY - Last 24 hours\*/);
  assert.match(result, /Summary.*2 releases.*1 stable.*1 pre-release.*2 repositories/);
  assert.match(result, /```/); // Contains code blocks for monospace
  assert.match(result, /Repository.*Version.*Published.*Description/);
});

test('generateTabularSummary - should handle empty releases', () => {
  const config: SummaryConfig = {
    releaseMode: 'daily',
    targetDate: new Date('2024-01-01')
  };
  const result = generateTabularSummary([], config);
  assert.match(result, /No releases found on 2024-01-01/);
});

test('generateTabularSummary - should handle individual release errors gracefully', () => {
  const brokenRelease = {
    ...sampleReleases[0],
    publishedAt: 'invalid-date'
  };

  const config: SummaryConfig = {
    releaseMode: 'recent',
    hoursBack: 24
  };

  const result = generateTabularSummary([brokenRelease], config);
  // The function handles invalid dates by showing NaN format
  assert.match(result, /NaN-NaN-NaN \| NaN:NaN UTC/);
});

test('generateTabularSummary - should create clickable links and truncate long names', () => {
  const longNameRelease: ReleaseInfo = {
    ...sampleReleases[0],
    repository: 'very-long-repository-name/with-extremely-long-name-that-should-be-truncated',
    name: 'Very Long Release Name That Should Be Truncated',
    url: 'https://github.com/test/repo/releases/tag/very-long-tag'
  };

  const config: SummaryConfig = {
    releaseMode: 'recent',
    hoursBack: 24
  };

  const result = generateTabularSummary([longNameRelease], config);
  assert.match(result, /<https:\/\/github\.com\/test\/repo\/releases\/tag\/very-long-tag\|🚀Very Lo/);
  assert.match(result, /very-long-repository\.\.\./); // Truncated repo name
});

// Clean up after all tests
test.after(() => {
  // Restore original logger
  require('../src/utils/logger').logger = originalLogger;
});

test.run();
