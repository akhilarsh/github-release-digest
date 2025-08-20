import { test } from 'uvu';
import * as assert from 'uvu/assert';
import { Release } from '../src/core/release';
import { Repository } from '../src/core/repository';
import { ReleaseInfo, GitHubRepository, GitHubRelease } from '../src/types';

// Mock the logger
const loggerMock = {
  info: () => {},
  error: () => {},
  warn: () => {},
  debug: () => {}
};

// Mock the Repository class
class MockRepository {
  private mockRepositories: GitHubRepository[] = [];

  constructor(token: string) {
    // Store token for verification if needed
  }

  setMockRepositories(repositories: GitHubRepository[]) {
    this.mockRepositories = repositories;
  }

  async fetchAllRepositories(params: any): Promise<GitHubRepository[]> {
    return this.mockRepositories;
  }
}

function createMockRelease(overrides: Partial<GitHubRelease> = {}): GitHubRelease {
  return {
    tagName: 'v1.0.0',
    name: 'Release v1.0.0',
    publishedAt: '2024-01-15T10:00:00Z',
    description: 'Test release description',
    url: 'https://github.com/org/repo/releases/tag/v1.0.0',
    author: { login: 'testuser' },
    isPrerelease: false,
    ...overrides
  };
}

function createMockRepository(overrides: Partial<GitHubRepository> = {}): GitHubRepository {
  return {
    name: 'test-repo',
    updatedAt: '2024-01-15T12:00:00Z',
    releases: { nodes: [] },
    ...overrides
  };
}

let originalRepository: typeof Repository;
let originalLogger: any;

test.before(() => {
  originalRepository = Repository;
  (Repository as any) = MockRepository;

  originalLogger = require('../src/utils/logger').logger;
  require('../src/utils/logger').logger = loggerMock;
});

test.after(() => {
  (Repository as any) = originalRepository;
  require('../src/utils/logger').logger = originalLogger;
});

test('Release constructor should create instance with token', () => {
  const release = new Release('test-token');
  assert.instance(release, Release);
});

test('getReleases should fetch releases for today when date timeframe provided', async () => {
  const release = new Release('test-token');
  const mockRepo = (release as any).repository as MockRepository;

  const todayRelease = createMockRelease({
    publishedAt: new Date().toISOString(),
    tagName: 'v2.0.0'
  });

  const mockRepoData = createMockRepository({
    name: 'today-repo',
    releases: { nodes: [todayRelease] }
  });

  mockRepo.setMockRepositories([mockRepoData]);

  const releases = await release.getReleases('test-org', { type: 'date', value: new Date() });

  assert.is(releases.length, 1);
  assert.is(releases[0].repository, 'today-repo');
  assert.is(releases[0].tagName, 'v2.0.0');
});

test('getDailyReleases should fetch releases for specific date', async () => {
  const release = new Release('test-token');
  const mockRepo = (release as any).repository as MockRepository;

  const targetDate = new Date('2024-01-15');
  const releaseOnDate = createMockRelease({
    publishedAt: '2024-01-15T14:30:00Z',
    tagName: 'v1.5.0'
  });

  const releaseOutsideDate = createMockRelease({
    publishedAt: '2024-01-16T10:00:00Z',
    tagName: 'v1.6.0'
  });

  const mockRepoData = createMockRepository({
    name: 'date-repo',
    releases: { nodes: [releaseOnDate, releaseOutsideDate] }
  });

  mockRepo.setMockRepositories([mockRepoData]);

  const releases = await release.getReleases('test-org', { type: 'date', value: targetDate });

  assert.is(releases.length, 1);
  assert.is(releases[0].tagName, 'v1.5.0');
});

test('getReleases should return empty array when no releases found', async () => {
  const release = new Release('test-token');
  const mockRepo = (release as any).repository as MockRepository;

  const mockRepoData = createMockRepository({
    name: 'empty-repo',
    releases: { nodes: [] }
  });

  mockRepo.setMockRepositories([mockRepoData]);

  const releases = await release.getReleases('test-org', { type: 'date', value: new Date() });

  assert.is(releases.length, 0);
});

test('getReleases should fetch releases from last 24 hours by default', async () => {
  const release = new Release('test-token');
  const mockRepo = (release as any).repository as MockRepository;

  const now = new Date();
  const recentRelease = createMockRelease({
    publishedAt: new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString(), // 12 hours ago
    tagName: 'v3.0.0'
  });

  const oldRelease = createMockRelease({
    publishedAt: new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString(), // 48 hours ago
    tagName: 'v2.9.0'
  });

  const mockRepoData = createMockRepository({
    name: 'recent-repo',
    releases: { nodes: [recentRelease, oldRelease] }
  });

  mockRepo.setMockRepositories([mockRepoData]);

  const releases = await release.getReleases('test-org', { type: 'hours', value: 24 });

  assert.is(releases.length, 1);
  assert.is(releases[0].tagName, 'v3.0.0');
});

test('getReleases should fetch releases from custom hours back', async () => {
  const release = new Release('test-token');
  const mockRepo = (release as any).repository as MockRepository;

  const now = new Date();
  const release6HoursAgo = createMockRelease({
    publishedAt: new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString(),
    tagName: 'v1.1.0'
  });

  const release18HoursAgo = createMockRelease({
    publishedAt: new Date(now.getTime() - 18 * 60 * 60 * 1000).toISOString(),
    tagName: 'v1.0.0'
  });

  const mockRepoData = createMockRepository({
    name: 'custom-hours-repo',
    releases: { nodes: [release6HoursAgo, release18HoursAgo] }
  });

  mockRepo.setMockRepositories([mockRepoData]);

  const releases = await release.getReleases('test-org', { type: 'hours', value: 12 });

  assert.is(releases.length, 1);
  assert.is(releases[0].tagName, 'v1.1.0');
});

test('processRepositories should process multiple repositories correctly', async () => {
  const release = new Release('test-token');

  const dateRange = {
    startDate: new Date('2024-01-15T00:00:00Z'),
    endDate: new Date('2024-01-15T23:59:59Z')
  };

  const repo1Release = createMockRelease({
    tagName: 'v1.0.0',
    publishedAt: '2024-01-15T10:00:00Z'
  });

  const repo2Release = createMockRelease({
    tagName: 'v2.0.0',
    publishedAt: '2024-01-15T15:00:00Z'
  });

  const repositories = [
    createMockRepository({
      name: 'repo1',
      releases: { nodes: [repo1Release] }
    }),
    createMockRepository({
      name: 'repo2',
      releases: { nodes: [repo2Release] }
    })
  ];

  const releases = (release as any).processRepositories(repositories, dateRange);

  assert.is(releases.length, 2);
  assert.is(releases[0].repository, 'repo1');
  assert.is(releases[1].repository, 'repo2');
});

test('isReleaseInDateRange should correctly filter releases by date range', () => {
  const release = new Release('test-token');

  const dateRange = {
    startDate: new Date('2024-01-15T00:00:00Z'),
    endDate: new Date('2024-01-15T23:59:59Z')
  };

  const inRange = (release as any).isReleaseInDateRange(
    '2024-01-15T12:00:00Z',
    dateRange
  );
  assert.is(inRange, true);

  const beforeRange = (release as any).isReleaseInDateRange(
    '2024-01-14T12:00:00Z',
    dateRange
  );
  assert.is(beforeRange, false);

  const afterRange = (release as any).isReleaseInDateRange(
    '2024-01-16T12:00:00Z',
    dateRange
  );
  assert.is(afterRange, false);
});

test('isReleaseInDateRange should work without endDate', () => {
  const release = new Release('test-token');

  const dateRange = {
    startDate: new Date('2024-01-15T00:00:00Z')
  };

  const afterStart = (release as any).isReleaseInDateRange(
    '2024-01-16T12:00:00Z',
    dateRange
  );
  assert.is(afterStart, true);

  const beforeStart = (release as any).isReleaseInDateRange(
    '2024-01-14T12:00:00Z',
    dateRange
  );
  assert.is(beforeStart, false);
});

test('should process both stable releases and prereleases', async () => {
  const release = new Release('test-token');
  const mockRepo = (release as any).repository as MockRepository;

  const stableRelease = createMockRelease({
    tagName: 'v1.0.0',
    isPrerelease: false,
    publishedAt: new Date().toISOString()
  });

  const prerelease = createMockRelease({
    tagName: 'v1.1.0-beta.1',
    isPrerelease: true,
    publishedAt: new Date().toISOString()
  });

  const mockRepoData = createMockRepository({
    name: 'mixed-releases-repo',
    releases: { nodes: [stableRelease, prerelease] }
  });

  mockRepo.setMockRepositories([mockRepoData]);

  const releases = await release.getReleases('test-org', { type: 'date', value: new Date() });

  assert.is(releases.length, 2);
  assert.is(releases.find(r => r.tagName === 'v1.0.0')?.isPrerelease, false);
  assert.is(releases.find(r => r.tagName === 'v1.1.0-beta.1')?.isPrerelease, true);
});

test('should create correct ReleaseInfo structure', async () => {
  const release = new Release('test-token');
  const mockRepo = (release as any).repository as MockRepository;

  const today = new Date();
  const releaseTime = new Date(today);
  releaseTime.setUTCHours(10, 30, 0, 0);

  const mockRelease = createMockRelease({
    tagName: 'v1.2.3',
    name: 'Version 1.2.3',
    publishedAt: releaseTime.toISOString(),
    description: 'Bug fixes and improvements',
    url: 'https://github.com/org/repo/releases/tag/v1.2.3',
    author: { login: 'developer' },
    isPrerelease: false
  });

  const mockRepoData = createMockRepository({
    name: 'test-repo',
    releases: { nodes: [mockRelease] }
  });

  mockRepo.setMockRepositories([mockRepoData]);

  const releases = await release.getReleases('test-org', { type: 'date', value: new Date() });

  assert.is(releases.length, 1);
  const releaseInfo = releases[0];

  assert.is(releaseInfo.repository, 'test-repo');
  assert.is(releaseInfo.tagName, 'v1.2.3');
  assert.is(releaseInfo.name, 'Version 1.2.3');
  assert.is(releaseInfo.publishedAt, releaseTime.toISOString());
  assert.is(releaseInfo.description, 'Bug fixes and improvements');
  assert.is(releaseInfo.url, 'https://github.com/org/repo/releases/tag/v1.2.3');
  assert.is(releaseInfo.author, 'developer');
  assert.is(releaseInfo.isPrerelease, false);
});

test('should use tagName when release name is null', async () => {
  const release = new Release('test-token');
  const mockRepo = (release as any).repository as MockRepository;

  const mockRelease = createMockRelease({
    tagName: 'v1.0.0',
    name: null,
    publishedAt: new Date().toISOString()
  });

  const mockRepoData = createMockRepository({
    name: 'no-name-repo',
    releases: { nodes: [mockRelease] }
  });

  mockRepo.setMockRepositories([mockRepoData]);

  const releases = await release.getReleases('test-org', { type: 'date', value: new Date() });

  assert.is(releases.length, 1);
  assert.is(releases[0].name, 'v1.0.0'); // Should fallback to tagName
});

test('should use empty string when release description is null', async () => {
  const release = new Release('test-token');
  const mockRepo = (release as any).repository as MockRepository;

  const mockRelease = createMockRelease({
    tagName: 'v1.0.0',
    description: null,
    publishedAt: new Date().toISOString()
  });

  const mockRepoData = createMockRepository({
    name: 'no-desc-repo',
    releases: { nodes: [mockRelease] }
  });

  mockRepo.setMockRepositories([mockRepoData]);

  const releases = await release.getReleases('test-org', { type: 'date', value: new Date() });

  assert.is(releases.length, 1);
  assert.is(releases[0].description, ''); // Should fallback to empty string
});

test('should throw error when repository fetching fails', async () => {
  const release = new Release('test-token');
  const mockRepo = (release as any).repository as MockRepository;

  mockRepo.fetchAllRepositories = async () => {
    throw new Error('GitHub API error');
  };

  try {
    await release.getReleases('test-org', { type: 'date', value: new Date() });
    assert.unreachable('Should have thrown error');
  } catch (error) {
    assert.instance(error, Error);
    assert.match((error as Error).message, 'GitHub API error');
  }
});

test('should handle empty releases array', async () => {
  const release = new Release('test-token');
  const mockRepo = (release as any).repository as MockRepository;

  const mockRepoData = createMockRepository({
    name: 'empty-repo',
    releases: { nodes: [] }
  });

  mockRepo.setMockRepositories([mockRepoData]);

  const releases = await release.getReleases('test-org', { type: 'date', value: new Date() });

  assert.is(releases.length, 0);
});

test.run();
