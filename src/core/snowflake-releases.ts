import SnowflakeClient from '../clients/snowflake-client';
import { ReleaseInfo } from '../types';
import { logger } from '../utils/logger';
import { getConfig } from '../utils/config';

function coalesce<T = unknown>(...values: T[]): T | undefined {
  for (const v of values) {
    if (v !== undefined && v !== null && String(v).length > 0) return v;
  }
  return undefined;
}

function normalizeBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    return v === 'true' || v === '1' || v === 'yes' || v === 'y';
  }
  return false;
}

function toIsoString(value: unknown): string {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString();
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

function mapRowToRelease(row: any): ReleaseInfo {
  const repository = coalesce(row.REPOSITORY, row.repository_name, row.repository, row.repo) as string;
  const tagName = coalesce(row.TAG_NAME, row.release_tag_name, row.tagName, row.tag, row.version) as string;
  const name = coalesce(row.RELEASE_NAME, row.release_name, row.name, tagName) as string;
  const publishedAt = toIsoString(coalesce(row.RELEASE_PUBLISHED_AT, row.release_published_at, row.publishedAt, row.released_at));
  const description = (coalesce(row.RELEASE_DESCRIPTION, row.release_body, row.description) as string) || '';
  const url = (coalesce(row.RELEASE_URL, row.release_html_url, row.url, row.link) as string) || '';
  const author = (coalesce(row.RELEASE_AUTHOR, row.release_author, row.author, row.author_login) as string) || '';
  const isPrerelease = normalizeBoolean(coalesce(row.RELEASE_IS_PRERELEASE, row.release_prerelease, row.isPrerelease));

  return {
    repository,
    tagName,
    name,
    publishedAt,
    description,
    url,
    author,
    isPrerelease,
  };
}

export async function fetchReleasesFromSnowflake(config: any, startDate: Date, endDate: Date): Promise<ReleaseInfo[]> {
  const { snowflake: snowflakeConfig, repositories } = config;
  const tableName = snowflakeConfig?.tableName || 'release';

  if (!snowflakeConfig) {
    throw new Error('Snowflake configuration is missing. Ensure SNOWFLAKE_* env vars or SNOWFLAKE_CONFIG JSON are provided.');
  }

  logger.info(`Time range: ${startDate.toISOString()} to ${endDate.toISOString()}`);
  if (repositories && repositories.length > 0) {
    logger.info(`Repository filter: ${repositories.join(', ')}`);
  }

  const client = new SnowflakeClient(snowflakeConfig);

  try {
    await client.connect();
    logger.info('Connected to Snowflake. Executing release query...');

    const sql = client.buildReleasesSql(startDate, endDate, repositories, tableName);

    const rows = await client.executeQuery(sql);
    logger.info(`Snowflake returned ${rows?.length ?? 0} rows`);

    if (!Array.isArray(rows) || rows.length === 0) return [];
    return rows.map(mapRowToRelease).filter((r: ReleaseInfo) => !!r.repository && !!r.publishedAt && !!r.name);
  } finally {
    try {
      await client.disconnect();
    } catch (e) {
      logger.warn(`Snowflake disconnect warning: ${e}`);
    }
  }
}


