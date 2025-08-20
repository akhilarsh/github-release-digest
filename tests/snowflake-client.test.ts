import { test } from 'uvu';
import * as assert from 'uvu/assert';
import SnowflakeClient from '../src/clients/snowflake-client';
import { fetchReleasesFromSnowflake } from '../src/core/snowflake-releases';
import { getConfig } from '../src/utils/config';
import type { ISnowflakeConnectionConfig } from '../src/types';

// Store original environment variables
let originalEnv: NodeJS.ProcessEnv;

test.before.each(() => {
  originalEnv = { ...process.env };

  // Clear Snowflake-related environment variables
  delete process.env.SNOWFLAKE_ACCOUNT;
  delete process.env.SNOWFLAKE_USERNAME;
  delete process.env.SNOWFLAKE_PASSWORD;
  delete process.env.SNOWFLAKE_PRIVATE_KEY;
  delete process.env.SNOWFLAKE_DATABASE;
  delete process.env.SNOWFLAKE_SCHEMA;
  delete process.env.SNOWFLAKE_WAREHOUSE;
  delete process.env.SNOWFLAKE_ROLE;
  delete process.env.SNOWFLAKE_AUTHENTICATOR;
  delete process.env.SNOWFLAKE_CONFIG;
});

test.after.each(() => {
  process.env = originalEnv;
});

test('SnowflakeClient › buildReleasesSql › should generate SQL with database.schema.table', () => {
  const config: ISnowflakeConnectionConfig = {
    account: 'test-account',
    username: 'test-user',
    password: 'test-pass',
    database: 'TEST_DB',
    schema: 'TEST_SCHEMA',
    warehouse: 'TEST_WH'
  };

  const client = new SnowflakeClient(config);
  const startDate = new Date('2025-01-01T00:00:00Z');
  const endDate = new Date('2025-01-08T00:00:00Z');
  const sql = client.buildReleasesSql(startDate, endDate, undefined, 'releases');

  assert.ok(sql.includes('FROM TEST_DB.TEST_SCHEMA.releases'));
  assert.ok(sql.includes('WHERE action = \'released\''));
  assert.ok(sql.includes('AND release_published_at >= \'2025-01-01T00:00:00.000Z\''));
  assert.ok(sql.includes('AND release_published_at <= \'2025-01-08T00:00:00.000Z\''));
  assert.ok(sql.includes('ORDER BY release_published_at DESC'));
});

test('SnowflakeClient › buildReleasesSql › should use table name only when database/schema missing', () => {
  const config: ISnowflakeConnectionConfig = {
    account: 'test-account',
    username: 'test-user',
    password: 'test-pass'
  };

  const client = new SnowflakeClient(config);
  const startDate = new Date('2025-01-01T00:00:00Z');
  const endDate = new Date('2025-01-15T00:00:00Z');
  const sql = client.buildReleasesSql(startDate, endDate, undefined, 'my_releases');

  assert.ok(sql.includes('FROM my_releases'));
  assert.ok(sql.includes('WHERE action = \'released\''));
  assert.ok(sql.includes('AND release_published_at >= \'2025-01-01T00:00:00.000Z\''));
  assert.ok(sql.includes('AND release_published_at <= \'2025-01-15T00:00:00.000Z\''));
});

test('SnowflakeClient › buildReleasesSql › should use correct column aliases', () => {
  const config: ISnowflakeConnectionConfig = {
    account: 'test-account',
    username: 'test-user',
    password: 'test-pass',
    database: 'DB',
    schema: 'SCHEMA'
  };

  const client = new SnowflakeClient(config);
  const startDate = new Date('2025-01-01T00:00:00Z');
  const endDate = new Date('2025-01-08T00:00:00Z');
  const sql = client.buildReleasesSql(startDate, endDate);

  const expectedColumns = [
    'repository_name AS REPOSITORY',
    'release_tag_name AS TAG_NAME',
    'COALESCE(release_name, release_tag_name) AS RELEASE_NAME',
    'release_published_at AS RELEASE_PUBLISHED_AT',
    'release_body AS RELEASE_DESCRIPTION',
    'release_html_url AS RELEASE_URL',
    'release_author_login AS RELEASE_AUTHOR',
    'release_prerelease AS RELEASE_IS_PRERELEASE'
  ];

  expectedColumns.forEach(column => {
    assert.ok(sql.includes(column), `SQL should contain: ${column}`);
  });
});

test('fetchReleasesFromSnowflake › should throw error when no Snowflake config', async () => {
  // Set minimal required env for getConfig() but no Snowflake
  process.env.TOKEN_GITHUB = 'test-token';
  process.env.SLACK_WEBHOOK_URL = 'dummy-webhook-url';
  process.env.ORG_NAME = 'test-org';

  try {
    const startDate = new Date('2025-01-01T00:00:00Z');
    const endDate = new Date('2025-01-08T00:00:00Z');
    const testConfig = { snowflakeConfig: null, repositories: [] };
    await fetchReleasesFromSnowflake(testConfig, startDate, endDate);
    assert.unreachable('Should have thrown an error');
  } catch (error) {
    assert.instance(error, Error);
    assert.match((error as Error).message, /Snowflake configuration is missing/);
  }
});

test('getConfig › should parse Snowflake config from discrete env vars', () => {
  process.env.TOKEN_GITHUB = 'test-token';
  process.env.SLACK_WEBHOOK_URL = 'dummy-webhook-url';
  process.env.ORG_NAME = 'test-org';

  process.env.SNOWFLAKE_ACCOUNT = 'test-account';
  process.env.SNOWFLAKE_USERNAME = 'test-user';
  process.env.SNOWFLAKE_PASSWORD = 'test-pass';
  process.env.SNOWFLAKE_DATABASE = 'TEST_DB';
  process.env.SNOWFLAKE_SCHEMA = 'TEST_SCHEMA';
  process.env.SNOWFLAKE_WAREHOUSE = 'TEST_WH';

  const config = getConfig();

  assert.ok(config.snowflake);
  assert.is(config.snowflake.account, 'test-account');
  assert.is(config.snowflake.username, 'test-user');
  assert.is(config.snowflake.password, 'test-pass');
  assert.is(config.snowflake.database, 'TEST_DB');
  assert.is(config.snowflake.schema, 'TEST_SCHEMA');
  assert.is(config.snowflake.warehouse, 'TEST_WH');
});

test('getConfig › should parse Snowflake config from JSON env var', () => {
  process.env.TOKEN_GITHUB = 'test-token';
  process.env.SLACK_WEBHOOK_URL = 'dummy-webhook-url';
  process.env.ORG_NAME = 'test-org';

  const snowflakeJson = JSON.stringify({
    account: 'json-account',
    username: 'json-user',
    password: 'json-pass',
    database: 'JSON_DB',
    schema: 'JSON_SCHEMA',
    warehouse: 'JSON_WH'
  });

  process.env.SNOWFLAKE_CONFIG = snowflakeJson;

  const config = getConfig();

  assert.ok(config.snowflake);
  assert.is(config.snowflake.account, 'json-account');
  assert.is(config.snowflake.username, 'json-user');
  assert.is(config.snowflake.password, 'json-pass');
  assert.is(config.snowflake.database, 'JSON_DB');
  assert.is(config.snowflake.schema, 'JSON_SCHEMA');
  assert.is(config.snowflake.warehouse, 'JSON_WH');
});

test('getConfig › should prefer discrete env vars over JSON config', () => {
  process.env.TOKEN_GITHUB = 'test-token';
  process.env.SLACK_WEBHOOK_URL = 'dummy-webhook-url';
  process.env.ORG_NAME = 'test-org';

  const snowflakeJson = JSON.stringify({
    account: 'json-account',
    username: 'json-user'
  });

  process.env.SNOWFLAKE_CONFIG = snowflakeJson;
  process.env.SNOWFLAKE_ACCOUNT = 'discrete-account';
  process.env.SNOWFLAKE_USERNAME = 'discrete-user';

  const config = getConfig();

  assert.ok(config.snowflake);
  assert.is(config.snowflake.account, 'discrete-account');
  assert.is(config.snowflake.username, 'discrete-user');
});

test('getConfig › should not include snowflake config when no values provided', () => {
  process.env.TOKEN_GITHUB = 'test-token';
  process.env.SLACK_WEBHOOK_URL = 'dummy-webhook-url';
  process.env.ORG_NAME = 'test-org';

  const config = getConfig();

  assert.is(config.snowflake, undefined);
});

test.run();
