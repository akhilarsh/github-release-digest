import { config as dotenvConfig } from 'dotenv';
import { test } from 'uvu';
import * as assert from 'uvu/assert';
import { fetchReleasesFromSnowflake } from '../src/core/snowflake-releases';
import SnowflakeClient from '../src/clients/snowflake-client';
import { getConfig } from '../src/utils/config';
import type { ReleaseInfo, ISnowflakeConnectionConfig } from '../src/types';

// Load .env file
dotenvConfig();

// Store original environment variables
let originalEnv: NodeJS.ProcessEnv;

test.before.each(() => {
  originalEnv = { ...process.env };
});

test.after.each(() => {
  process.env = originalEnv;
});

test('fetchReleasesFromSnowflake › should execute query and return valid release data', async () => {
  // Set minimal required env vars for getConfig()
  process.env.TOKEN_GITHUB = 'dummy-token';
  process.env.SLACK_WEBHOOK_URL = 'dummy-webhook-url';
  process.env.ORG_NAME = 'test-org';

  // Skip test if no Snowflake config in .env
  const config = getConfig();
  if (!config.snowflake) {
    console.log('⏭️  Skipping Snowflake query test - no config found');
    return;
  }

  const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
  const endDate = new Date();
  const testConfig = { snowflake: config.snowflake, repositories: config.repositories };
  const releases = await fetchReleasesFromSnowflake(testConfig, startDate, endDate);

  // Validate array response
  assert.ok(Array.isArray(releases), 'Should return an array');

  if (releases.length > 0) {
    const firstRelease = releases[0];

    // Validate required fields exist
    assert.ok(firstRelease.repository, 'Release should have repository');
    assert.ok(firstRelease.name, 'Release should have name');
    assert.ok(firstRelease.tagName, 'Release should have tagName');
    assert.ok(firstRelease.publishedAt, 'Release should have publishedAt');
    assert.ok(firstRelease.url, 'Release should have url');
    assert.ok(firstRelease.author, 'Release should have author');
    assert.ok(typeof firstRelease.isPrerelease === 'boolean', 'isPrerelease should be boolean');

    // Validate publishedAt is valid date string
    const publishedDate = new Date(firstRelease.publishedAt);
    assert.ok(!isNaN(publishedDate.getTime()), 'publishedAt should be valid date');

    // Validate URL format
    assert.ok(firstRelease.url.startsWith('http'), 'URL should start with http');

    console.log(`✅ Found ${releases.length} releases`);
    console.log(`📊 Sample: ${firstRelease.repository}/${firstRelease.name}`);

    // Show repository breakdown
    const repoCount = new Map<string, number>();
    releases.forEach(r => {
      repoCount.set(r.repository, (repoCount.get(r.repository) || 0) + 1);
    });

    console.log(`📈 Repositories: ${repoCount.size} unique repos`);
  } else {
    console.log('📭 No releases found in last 7 days');
  }
});

test('fetchReleasesFromSnowflake › should handle custom table and timeframe', async () => {
  // Set minimal required env vars for getConfig()
  process.env.TOKEN_GITHUB = 'dummy-token';
  process.env.SLACK_WEBHOOK_URL = 'dummy-webhook-url';
  process.env.ORG_NAME = 'test-org';

  const config = getConfig();
  if (!config.snowflake) {
    console.log('⏭️  Skipping custom table test - no config found');
    return;
  }

  // Test with longer timeframe (30 days)
  const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
  const endDate = new Date();
  const testConfig = { snowflake: config.snowflake, repositories: config.repositories };
  const releases = await fetchReleasesFromSnowflake(testConfig, startDate, endDate);

  assert.ok(Array.isArray(releases), 'Should return an array');

  if (releases.length > 0) {
    // Verify date range (should be within last 30 days)
    releases.forEach(release => {
      const releaseDate = new Date(release.publishedAt);
      assert.ok(releaseDate >= startDate, `Release ${release.name} should be within date range`);
      assert.ok(releaseDate <= endDate, `Release ${release.name} should be within date range`);
    });

    console.log(`✅ Found ${releases.length} releases in last 30 days`);
  } else {
    console.log('📭 No releases found in last 30 days');
  }
});

// ============================================================================
// buildReleasesSql Tests - Comprehensive testing of SQL generation
// ============================================================================

// Mock Snowflake connection config for SQL testing (no actual connection needed)
const mockSnowflakeConfig: ISnowflakeConnectionConfig = {
  account: 'TEST123',
  username: 'test-user',
  password: 'test-pass',
  database: 'TEST_DB',
  schema: 'TEST_SCHEMA',
  warehouse: 'TEST_WH'
};

test('buildReleasesSql › should generate basic SQL with default table name', () => {
  const client = new SnowflakeClient(mockSnowflakeConfig);
  const startDate = new Date('2025-01-01T00:00:00.000Z');
  const endDate = new Date('2025-01-07T23:59:59.999Z');

  const sql = client.buildReleasesSql(startDate, endDate);

  // Should include database.schema.table
  assert.match(sql, /FROM TEST_DB\.TEST_SCHEMA\.release/);

  // Should have action filter
  assert.match(sql, /WHERE action = 'released'/);

  // Should have date range filters with ISO strings
  assert.match(sql, /release_published_at >= '2025-01-01T00:00:00\.000Z'/);
  assert.match(sql, /release_published_at <= '2025-01-07T23:59:59\.999Z'/);

  // Should have all required columns
  assert.match(sql, /repository_name AS REPOSITORY/);
  assert.match(sql, /release_tag_name AS TAG_NAME/);
  assert.match(sql, /COALESCE\(release_name, release_tag_name\) AS RELEASE_NAME/);
  assert.match(sql, /release_published_at AS RELEASE_PUBLISHED_AT/);
  assert.match(sql, /release_body AS RELEASE_DESCRIPTION/);
  assert.match(sql, /release_html_url AS RELEASE_URL/);
  assert.match(sql, /release_author_login AS RELEASE_AUTHOR/);
  assert.match(sql, /release_prerelease AS RELEASE_IS_PRERELEASE/);

  // Should order by date
  assert.match(sql, /ORDER BY release_published_at DESC/);

  // Should NOT have repository filter when none provided
  assert.not.match(sql, /repository_name IN/);
});

test('buildReleasesSql › should handle custom table name', () => {
  const client = new SnowflakeClient(mockSnowflakeConfig);
  const startDate = new Date('2025-01-01T00:00:00.000Z');
  const endDate = new Date('2025-01-01T23:59:59.999Z');

  const sql = client.buildReleasesSql(startDate, endDate, undefined, 'custom_releases');

  assert.match(sql, /FROM TEST_DB\.TEST_SCHEMA\.custom_releases/);
  assert.match(sql, /WHERE action = 'released'/);
});

test('buildReleasesSql › should handle single repository filter', () => {
  const client = new SnowflakeClient(mockSnowflakeConfig);
  const startDate = new Date('2025-01-01T00:00:00.000Z');
  const endDate = new Date('2025-01-01T23:59:59.999Z');
  const repositories = ['repo-server'];

  const sql = client.buildReleasesSql(startDate, endDate, repositories);

  assert.match(sql, /WHERE action = 'released'/);
  assert.match(sql, /AND repository_name IN \('repo-server'\)/);
});

test('buildReleasesSql › should handle multiple repository filters', () => {
  const client = new SnowflakeClient(mockSnowflakeConfig);
  const startDate = new Date('2025-01-01T00:00:00.000Z');
  const endDate = new Date('2025-01-01T23:59:59.999Z');
  const repositories = ['repo-server', 'repo-transformer', 'repo-config'];

  const sql = client.buildReleasesSql(startDate, endDate, repositories);

  assert.match(sql, /WHERE action = 'released'/);
  assert.match(sql, /AND repository_name IN \('repo-server', 'repo-transformer', 'repo-config'\)/);
});

test('buildReleasesSql › should handle empty repository array', () => {
  const client = new SnowflakeClient(mockSnowflakeConfig);
  const startDate = new Date('2025-01-01T00:00:00.000Z');
  const endDate = new Date('2025-01-01T23:59:59.999Z');
  const repositories: string[] = [];

  const sql = client.buildReleasesSql(startDate, endDate, repositories);

  assert.match(sql, /WHERE action = 'released'/);
  assert.not.match(sql, /repository_name IN/);
});

test('buildReleasesSql › should handle config without database/schema', () => {
  const simpleConfig: ISnowflakeConnectionConfig = {
    account: 'TEST123',
    username: 'test-user',
    password: 'test-pass',
    warehouse: 'TEST_WH'
  };
  const client = new SnowflakeClient(simpleConfig);
  const startDate = new Date('2025-01-01T00:00:00.000Z');
  const endDate = new Date('2025-01-01T23:59:59.999Z');

  const sql = client.buildReleasesSql(startDate, endDate);

  // Should use just table name when no database/schema
  assert.match(sql, /FROM release/);
  assert.not.match(sql, /\..*\.release/);
});

// ============================================================================
// Timeframe-based SQL Generation Tests
// ============================================================================

test('buildReleasesSql › should handle hour-based timeframe (last 24 hours)', () => {
  const client = new SnowflakeClient(mockSnowflakeConfig);
  const now = new Date('2025-08-19T12:00:00.000Z');
  const startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago
  const endDate = now;

  const sql = client.buildReleasesSql(startDate, endDate);

  assert.match(sql, /release_published_at >= '2025-08-18T12:00:00\.000Z'/);
  assert.match(sql, /release_published_at <= '2025-08-19T12:00:00\.000Z'/);
});

test('buildReleasesSql › should handle hour-based timeframe (last 6 hours)', () => {
  const client = new SnowflakeClient(mockSnowflakeConfig);
  const now = new Date('2025-08-19T18:30:45.123Z');
  const startDate = new Date(now.getTime() - 6 * 60 * 60 * 1000); // 6 hours ago
  const endDate = now;

  const sql = client.buildReleasesSql(startDate, endDate);

  assert.match(sql, /release_published_at >= '2025-08-19T12:30:45\.123Z'/);
  assert.match(sql, /release_published_at <= '2025-08-19T18:30:45\.123Z'/);
});

test('buildReleasesSql › should handle day-based timeframe (last 3 days)', () => {
  const client = new SnowflakeClient(mockSnowflakeConfig);
  // Simulate day-based calculation: last 3 days ending at end of today
  const endDate = new Date('2025-08-19T23:59:59.999Z');
  const startDate = new Date('2025-08-17T00:00:00.000Z'); // 3 days back

  const sql = client.buildReleasesSql(startDate, endDate);

  assert.match(sql, /release_published_at >= '2025-08-17T00:00:00\.000Z'/);
  assert.match(sql, /release_published_at <= '2025-08-19T23:59:59\.999Z'/);
});

test('buildReleasesSql › should handle day-based timeframe (last 7 days)', () => {
  const client = new SnowflakeClient(mockSnowflakeConfig);
  // Simulate day-based calculation: last 7 days ending at end of today
  const endDate = new Date('2025-08-19T23:59:59.999Z');
  const startDate = new Date('2025-08-13T00:00:00.000Z'); // 7 days back

  const sql = client.buildReleasesSql(startDate, endDate);

  assert.match(sql, /release_published_at >= '2025-08-13T00:00:00\.000Z'/);
  assert.match(sql, /release_published_at <= '2025-08-19T23:59:59\.999Z'/);
});

test('buildReleasesSql › should handle specific date range (single day)', () => {
  const client = new SnowflakeClient(mockSnowflakeConfig);
  // Simulate specific date: 2025-08-15 (start of day to end of day)
  const startDate = new Date('2025-08-15T00:00:00.000Z');
  const endDate = new Date('2025-08-15T23:59:59.999Z');

  const sql = client.buildReleasesSql(startDate, endDate);

  assert.match(sql, /release_published_at >= '2025-08-15T00:00:00\.000Z'/);
  assert.match(sql, /release_published_at <= '2025-08-15T23:59:59\.999Z'/);
});

test('buildReleasesSql › should handle custom date range (start to end)', () => {
  const client = new SnowflakeClient(mockSnowflakeConfig);
  // Simulate custom range: 2025-08-10 to 2025-08-15
  const startDate = new Date('2025-08-10T00:00:00.000Z');
  const endDate = new Date('2025-08-15T23:59:59.999Z');

  const sql = client.buildReleasesSql(startDate, endDate);

  assert.match(sql, /release_published_at >= '2025-08-10T00:00:00\.000Z'/);
  assert.match(sql, /release_published_at <= '2025-08-15T23:59:59\.999Z'/);
});

// ============================================================================
// Edge Cases and Complex Scenarios
// ============================================================================

test('buildReleasesSql › should handle repository names with special characters', () => {
  const client = new SnowflakeClient(mockSnowflakeConfig);
  const startDate = new Date('2025-01-01T00:00:00.000Z');
  const endDate = new Date('2025-01-01T23:59:59.999Z');
  const repositories = ['repo-server', 'config-gen-v2', 'test_repo', 'repo-with-dashes'];

  const sql = client.buildReleasesSql(startDate, endDate, repositories);

  assert.match(sql, /AND repository_name IN \('repo-server', 'config-gen-v2', 'test_repo', 'repo-with-dashes'\)/);
});

test('buildReleasesSql › should handle microsecond precision in dates', () => {
  const client = new SnowflakeClient(mockSnowflakeConfig);
  const startDate = new Date('2025-08-19T14:30:45.123456Z');
  const endDate = new Date('2025-08-19T18:45:30.987654Z');

  const sql = client.buildReleasesSql(startDate, endDate);

  // Note: JavaScript Date only supports millisecond precision, so microseconds are truncated
  assert.match(sql, /release_published_at >= '2025-08-19T14:30:45\.123Z'/);
  assert.match(sql, /release_published_at <= '2025-08-19T18:45:30\.987Z'/);
});

test('buildReleasesSql › should generate consistent SQL structure regardless of parameters', () => {
  const client = new SnowflakeClient(mockSnowflakeConfig);
  const startDate = new Date('2025-01-01T00:00:00.000Z');
  const endDate = new Date('2025-01-01T23:59:59.999Z');

  // Test different parameter combinations
  const sql1 = client.buildReleasesSql(startDate, endDate);
  const sql2 = client.buildReleasesSql(startDate, endDate, undefined, 'release');
  const sql3 = client.buildReleasesSql(startDate, endDate, [], 'release');

  // All should have the same basic structure (no repo filter)
  const basePattern = /SELECT[\s\S]*FROM TEST_DB\.TEST_SCHEMA\.release[\s\S]*WHERE action = 'released'[\s\S]*ORDER BY release_published_at DESC/;

  assert.match(sql1, basePattern);
  assert.match(sql2, basePattern);
  assert.match(sql3, basePattern);

  // None should have repository filter
  assert.not.match(sql1, /repository_name IN/);
  assert.not.match(sql2, /repository_name IN/);
  assert.not.match(sql3, /repository_name IN/);
});

test('buildReleasesSql › should validate SQL structure and keywords', () => {
  const client = new SnowflakeClient(mockSnowflakeConfig);
  const startDate = new Date('2025-08-19T00:00:00.000Z');
  const endDate = new Date('2025-08-19T23:59:59.999Z');
  const repositories = ['repo1', 'repo2'];

  const sql = client.buildReleasesSql(startDate, endDate, repositories, 'custom_table');

  // Validate SQL structure
  assert.match(sql, /^SELECT/); // Starts with SELECT
  assert.match(sql, /FROM TEST_DB\.TEST_SCHEMA\.custom_table/); // Has FROM clause
  assert.match(sql, /WHERE action = 'released'/); // Has WHERE clause
  assert.match(sql, /ORDER BY release_published_at DESC$/); // Ends with ORDER BY

  // Validate no SQL injection vulnerabilities (basic check)
  assert.not.match(sql, /;/); // No semicolons
  assert.not.match(sql, /--/); // No SQL comments
  assert.not.match(sql, /\/\*/); // No block comments

  // Validate proper quoting
  assert.match(sql, /'released'/); // Action value quoted
  assert.match(sql, /'repo1'/); // Repository names quoted
  assert.match(sql, /'repo2'/);
  assert.match(sql, /'2025-08-19T00:00:00\.000Z'/); // Dates quoted
});

test.run();
