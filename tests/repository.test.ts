import { test } from 'uvu';
import * as assert from 'uvu/assert';
import { Repository } from '../src/core/repository';
import { GitHubGraphQLClient } from '../src/clients/github-graphql-client';
import {
  GitHubRepository,
  OrganizationResponse,
  ReleaseFetchParams,
  RepositoryQueryVariables,
  PaginationStats
} from '../src/types';

// Mock the logger
const loggerMock = {
  info: () => {},
  error: () => {},
  warn: () => {},
  debug: () => {}
};

// Mock the GitHubGraphQLClient class
class MockGitHubGraphQLClient {
  private mockResponses: OrganizationResponse[] = [];
  private currentResponseIndex = 0;
  private shouldThrowError = false;
  private errorToThrow: Error | null = null;

  constructor(token: string) {
    // Store token for verification if needed
  }

  setMockResponses(responses: OrganizationResponse[]) {
    this.mockResponses = responses;
    this.currentResponseIndex = 0;
  }

  setShouldThrowError(error: Error) {
    this.shouldThrowError = true;
    this.errorToThrow = error;
  }

  async fetchRepositoriesPage(variables: RepositoryQueryVariables): Promise<OrganizationResponse> {
    if (this.shouldThrowError && this.errorToThrow) {
      throw this.errorToThrow;
    }

    if (this.currentResponseIndex < this.mockResponses.length) {
      const response = this.mockResponses[this.currentResponseIndex];
      this.currentResponseIndex++;
      return response;
    }

    // Default empty response
    return {
      organization: {
        repositories: {
          pageInfo: { hasNextPage: false, endCursor: null },
          nodes: []
        }
      }
    };
  }
}

// Helper function to create mock repository data
function createMockRepository(overrides: Partial<GitHubRepository> = {}): GitHubRepository {
  return {
    name: 'test-repo',
    updatedAt: '2024-01-15T12:00:00Z',
    releases: { nodes: [] },
    ...overrides
  };
}

// Helper function to create mock organization response
function createMockOrganizationResponse(
  repositories: GitHubRepository[],
  hasNextPage = false,
  endCursor: string | null = null
): OrganizationResponse {
  return {
    organization: {
      repositories: {
        pageInfo: { hasNextPage, endCursor },
        nodes: repositories
      }
    }
  };
}

// Setup and teardown
let originalGitHubGraphQLClient: typeof GitHubGraphQLClient;
let originalLogger: any;

test.before(() => {
  // Mock GitHubGraphQLClient class
  originalGitHubGraphQLClient = GitHubGraphQLClient;
  (GitHubGraphQLClient as any) = MockGitHubGraphQLClient;

  // Mock logger
  originalLogger = require('../src/utils/logger').logger;
  require('../src/utils/logger').logger = loggerMock;
});

test.after(() => {
  // Restore original classes
  (GitHubGraphQLClient as any) = originalGitHubGraphQLClient;
  require('../src/utils/logger').logger = originalLogger;
});

// Test Repository constructor
test('Repository constructor should create instance with token', () => {
  const repository = new Repository('test-token');
  assert.instance(repository, Repository);
});

// Test fetchAllRepositories with single page
test('fetchAllRepositories should fetch single page of repositories', async () => {
  const repository = new Repository('test-token');
  const mockClient = (repository as any).graphqlClient as MockGitHubGraphQLClient;

  const mockRepos = [
    createMockRepository({ name: 'repo1', updatedAt: '2024-01-15T12:00:00Z' }),
    createMockRepository({ name: 'repo2', updatedAt: '2024-01-15T11:00:00Z' })
  ];

  const mockResponse = createMockOrganizationResponse(mockRepos, false);
  mockClient.setMockResponses([mockResponse]);

  const params: ReleaseFetchParams = {
    orgName: 'test-org',
    startDate: new Date('2024-01-15T00:00:00Z')
  };

  const repositories = await repository.fetchAllRepositories(params);

  assert.is(repositories.length, 2);
  assert.is(repositories[0].name, 'repo1');
  assert.is(repositories[1].name, 'repo2');
});

// Test fetchAllRepositories with multiple pages
test('fetchAllRepositories should handle pagination correctly', async () => {
  const repository = new Repository('test-token');
  const mockClient = (repository as any).graphqlClient as MockGitHubGraphQLClient;

  const page1Repos = [
    createMockRepository({ name: 'repo1' }),
    createMockRepository({ name: 'repo2' })
  ];

  const page2Repos = [
    createMockRepository({ name: 'repo3' }),
    createMockRepository({ name: 'repo4' })
  ];

  const mockResponses = [
    createMockOrganizationResponse(page1Repos, true, 'cursor-1'),
    createMockOrganizationResponse(page2Repos, false, null)
  ];

  mockClient.setMockResponses(mockResponses);

  const params: ReleaseFetchParams = {
    orgName: 'test-org',
    startDate: new Date('2024-01-15T00:00:00Z')
  };

  const repositories = await repository.fetchAllRepositories(params);

  assert.is(repositories.length, 4);
  assert.is(repositories[0].name, 'repo1');
  assert.is(repositories[3].name, 'repo4');
});

// Test fetchAllRepositories with early stopping
test('fetchAllRepositories should stop early when cutoff date reached', async () => {
  const repository = new Repository('test-token');
  const mockClient = (repository as any).graphqlClient as MockGitHubGraphQLClient;

  const startDate = new Date('2024-01-15T00:00:00Z');
  const cutoffDate = new Date(startDate);
  cutoffDate.setDate(cutoffDate.getDate() - 14); // 14 days earlier (matches default)

  const recentRepo = createMockRepository({
    name: 'recent-repo',
    updatedAt: '2024-01-10T12:00:00Z' // Within cutoff (5 days before start date)
  });

  const oldRepo = createMockRepository({
    name: 'old-repo',
    updatedAt: '2023-12-31T12:00:00Z' // Before cutoff (more than 14 days earlier)
  });

  const mockResponse = createMockOrganizationResponse([recentRepo, oldRepo], false);
  mockClient.setMockResponses([mockResponse]);

  const params: ReleaseFetchParams = {
    orgName: 'test-org',
    startDate: startDate
  };

  const repositories = await repository.fetchAllRepositories(params);

  // Should only include the recent repo, early stop before old repo
  assert.is(repositories.length, 1);
  assert.is(repositories[0].name, 'recent-repo');
});

// Test fetchAllRepositories with no repositories
test('fetchAllRepositories should handle empty response', async () => {
  const repository = new Repository('test-token');
  const mockClient = (repository as any).graphqlClient as MockGitHubGraphQLClient;

  const mockResponse = createMockOrganizationResponse([], false);
  mockClient.setMockResponses([mockResponse]);

  const params: ReleaseFetchParams = {
    orgName: 'test-org',
    startDate: new Date('2024-01-15T00:00:00Z')
  };

  const repositories = await repository.fetchAllRepositories(params);

  assert.is(repositories.length, 0);
});

// Test processRepositoryPage method
test('processRepositoryPage should process repositories correctly', () => {
  const repository = new Repository('test-token');

  const cutoffDate = new Date('2024-01-10T00:00:00Z');
  const stats: PaginationStats = {
    totalRepositories: 0,
    totalReleases: 0,
    filteredReleases: 0,
    pageCount: 0,
    earlyStopEnabled: true,
    repositoriesScanned: 0
  };

  const repos = [
    createMockRepository({ name: 'repo1', updatedAt: '2024-01-15T12:00:00Z' }), // After cutoff
    createMockRepository({ name: 'repo2', updatedAt: '2024-01-12T12:00:00Z' }), // After cutoff
    createMockRepository({ name: 'repo3', updatedAt: '2024-01-08T12:00:00Z' })  // Before cutoff
  ];

  const result = (repository as any).processRepositoryPage(repos, cutoffDate, stats);

  assert.is(result.shouldStop, true);
  assert.is(result.processedRepos.length, 2);
  assert.is(result.processedRepos[0].name, 'repo1');
  assert.is(result.processedRepos[1].name, 'repo2');
});

// Test processRepositoryPage without early stopping
test('processRepositoryPage should process all repos when early stopping disabled', () => {
  const repository = new Repository('test-token');

  // Disable early stopping by setting earlyStopConfig
  (repository as any).earlyStopConfig.enabled = false;

  const cutoffDate = new Date('2024-01-10T00:00:00Z');
  const stats: PaginationStats = {
    totalRepositories: 0,
    totalReleases: 0,
    filteredReleases: 0,
    pageCount: 0,
    earlyStopEnabled: false,
    repositoriesScanned: 0
  };

  const repos = [
    createMockRepository({ name: 'repo1', updatedAt: '2024-01-15T12:00:00Z' }),
    createMockRepository({ name: 'repo2', updatedAt: '2024-01-08T12:00:00Z' }) // Before cutoff but should still be processed
  ];

  const result = (repository as any).processRepositoryPage(repos, cutoffDate, stats);

  assert.is(result.shouldStop, false);
  assert.is(result.processedRepos.length, 2);

  // Re-enable early stopping for other tests
  (repository as any).earlyStopConfig.enabled = true;
});

// Test executeWithRetry success on first attempt
test('executeWithRetry should succeed on first attempt', async () => {
  const repository = new Repository('test-token');

  const mockOperation = async () => 'success';

  const result = await (repository as any).executeWithRetry(mockOperation, 'test operation');

  assert.is(result, 'success');
});

// Test executeWithRetry with retries
test('executeWithRetry should retry on failure then succeed', async () => {
  const repository = new Repository('test-token');

  let attemptCount = 0;
  const mockOperation = async () => {
    attemptCount++;
    if (attemptCount < 3) {
      throw new Error('Temporary failure');
    }
    return 'success';
  };

  const result = await (repository as any).executeWithRetry(mockOperation, 'test operation');

  assert.is(result, 'success');
  assert.is(attemptCount, 3);
});

// Test executeWithRetry exhausts all retries
test('executeWithRetry should throw error after max retries', async () => {
  const repository = new Repository('test-token');

  const mockOperation = async () => {
    throw new Error('Persistent failure');
  };

  try {
    await (repository as any).executeWithRetry(mockOperation, 'test operation');
    assert.unreachable('Should have thrown error');
  } catch (error) {
    assert.instance(error, Error);
    assert.ok((error as Error).message.includes('Persistent failure'));
  }
});

// Test sleep method
test('sleep should resolve after specified delay', async () => {
  const repository = new Repository('test-token');

  const startTime = Date.now();
  await (repository as any).sleep(50); // 50ms
  const endTime = Date.now();

  const elapsed = endTime - startTime;
  assert.ok(elapsed >= 45); // Allow some tolerance for timing
  assert.ok(elapsed < 100); // Should not take too long
});

// Test error handling in fetchAllRepositories
test('fetchAllRepositories should handle GraphQL client errors', async () => {
  const repository = new Repository('test-token');
  const mockClient = (repository as any).graphqlClient as MockGitHubGraphQLClient;

  mockClient.setShouldThrowError(new Error('GraphQL API error'));

  const params: ReleaseFetchParams = {
    orgName: 'test-org',
    startDate: new Date('2024-01-15T00:00:00Z')
  };

  try {
    await repository.fetchAllRepositories(params);
    assert.unreachable('Should have thrown error');
  } catch (error) {
    assert.instance(error, Error);
    assert.ok((error as Error).message.includes('GraphQL API error'));
  }
});



// Test retry configuration
test('Repository should have correct default retry configuration', () => {
  const repository = new Repository('test-token');

  const retryConfig = (repository as any).retryConfig;

  assert.is(retryConfig.maxRetries, 3);
  assert.is(retryConfig.baseDelay, 1000);
  assert.is(retryConfig.maxDelay, 10000);
});

// Test early stop configuration
test('Repository should have correct default early stop configuration', () => {
  const repository = new Repository('test-token');

  const earlyStopConfig = (repository as any).earlyStopConfig;

  assert.is(earlyStopConfig.cutoffDays, 14);
  assert.is(earlyStopConfig.enabled, true);
});

// Test pagination with rate limiting
test('fetchAllRepositories should include rate limiting between pages', async () => {
  const repository = new Repository('test-token');
  const mockClient = (repository as any).graphqlClient as MockGitHubGraphQLClient;

  // Mock sleep to track if it's called
  let sleepCalled = false;
  const originalSleep = (repository as any).sleep;
  (repository as any).sleep = async (ms: number) => {
    sleepCalled = true;
    assert.is(ms, 100); // Should be 100ms delay
    return Promise.resolve();
  };

  const page1Repos = [createMockRepository({ name: 'repo1' })];
  const page2Repos = [createMockRepository({ name: 'repo2' })];

  const mockResponses = [
    createMockOrganizationResponse(page1Repos, true, 'cursor-1'),
    createMockOrganizationResponse(page2Repos, false, null)
  ];

  mockClient.setMockResponses(mockResponses);

  const params: ReleaseFetchParams = {
    orgName: 'test-org',
    startDate: new Date('2024-01-15T00:00:00Z')
  };

  await repository.fetchAllRepositories(params);

  assert.ok(sleepCalled, 'Sleep should be called for rate limiting');

  // Restore original sleep method
  (repository as any).sleep = originalSleep;
});

// Test exponential backoff calculation
test('executeWithRetry should use exponential backoff delays', async () => {
  const repository = new Repository('test-token');

  const delays: number[] = [];
  const originalSleep = (repository as any).sleep;
  (repository as any).sleep = async (ms: number) => {
    delays.push(ms);
    return Promise.resolve();
  };

  let attemptCount = 0;
  const mockOperation = async () => {
    attemptCount++;
    if (attemptCount <= 2) { // Fail first 2 attempts
      throw new Error('Test failure');
    }
    return 'success';
  };

  await (repository as any).executeWithRetry(mockOperation, 'test operation');

  // Should have 2 delays (for first 2 failed attempts)
  assert.is(delays.length, 2);
  assert.is(delays[0], 1000); // Base delay for first retry
  assert.is(delays[1], 2000); // 2x base delay for second retry

  // Restore original sleep method
  (repository as any).sleep = originalSleep;
});

test.run();
