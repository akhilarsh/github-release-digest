import { test } from 'uvu';
import * as assert from 'uvu/assert';
import { GitHubGraphQLClient } from '../src/clients/github-graphql-client';
import { OrganizationResponse, RepositoryQueryVariables } from '../src/types';

test('GitHubGraphQLClient › constructor › should initialize with token and default graphql client', () => {
  const client = new GitHubGraphQLClient('test-token');

  assert.type(client.getQuery(), 'string');
});

test('GitHubGraphQLClient › constructor › should accept custom graphql function', () => {
  const mockGraphql = async () => ({ test: 'response' });
  const client = new GitHubGraphQLClient('test-token', mockGraphql);

  assert.type(client.getQuery(), 'string');
});

test('GitHubGraphQLClient › getQuery › should return the GraphQL query string', () => {
  const client = new GitHubGraphQLClient('test-token');
  const query = client.getQuery();

  assert.type(query, 'string');
  assert.ok(query.includes('organization(login: $orgName)'));
  assert.ok(query.includes('repositories(first: $first, after: $after'));
  assert.ok(query.includes('releases(first: 10'));
  assert.ok(query.includes('pageInfo'));
  assert.ok(query.includes('hasNextPage'));
  assert.ok(query.includes('endCursor'));
});

test('GitHubGraphQLClient › fetchRepositoriesPage › should call graphql with correct query and variables', async () => {
  let calledWith = {};
  const mockGraphql = async (query: string, variables: any) => {
    calledWith = { query, variables };
    return {
      organization: {
        repositories: {
          pageInfo: {
            hasNextPage: false,
            endCursor: null
          },
          nodes: []
        }
      }
    };
  };

  const client = new GitHubGraphQLClient('test-token', mockGraphql);
  const variables: RepositoryQueryVariables = {
    orgName: 'test-org',
    first: 10,
    after: 'cursor123'
  };

  await client.fetchRepositoriesPage(variables);

  assert.equal((calledWith as any).variables, variables);
  assert.type((calledWith as any).query, 'string');
  assert.ok((calledWith as any).query.includes('organization(login: $orgName)'));
});

test('GitHubGraphQLClient › fetchRepositoriesPage › should return correct response structure', async () => {
  const mockResponse: OrganizationResponse = {
    organization: {
      repositories: {
        pageInfo: {
          hasNextPage: false,
          endCursor: null
        },
        nodes: [
          {
            name: 'test-repo',
            updatedAt: '2023-01-01T00:00:00Z',
            releases: {
              nodes: [
                {
                  tagName: 'v1.0.0',
                  name: 'Release 1.0.0',
                  publishedAt: '2023-01-01T00:00:00Z',
                  description: 'Test release',
                  url: 'https://github.com/test/test-repo/releases/tag/v1.0.0',
                  author: {
                    login: 'testuser'
                  },
                  isPrerelease: false
                }
              ]
            }
          }
        ]
      }
    }
  };

  const mockGraphql = async () => mockResponse;
  const client = new GitHubGraphQLClient('test-token', mockGraphql);

  const result = await client.fetchRepositoriesPage({
    orgName: 'test-org',
    first: 10
  });

  assert.equal(result, mockResponse);
  assert.equal(result.organization.repositories.nodes.length, 1);
  assert.equal(result.organization.repositories.nodes[0].name, 'test-repo');
  assert.equal(result.organization.repositories.nodes[0].releases.nodes[0].tagName, 'v1.0.0');
});

test('GitHubGraphQLClient › fetchRepositoriesPage › should handle variables without after cursor', async () => {
  let receivedVariables = {};
  const mockGraphql = async (query: string, variables: any) => {
    receivedVariables = variables;
    return {
      organization: {
        repositories: {
          pageInfo: {
            hasNextPage: true,
            endCursor: 'new-cursor'
          },
          nodes: []
        }
      }
    };
  };

  const client = new GitHubGraphQLClient('test-token', mockGraphql);
  const variables: RepositoryQueryVariables = {
    orgName: 'test-org',
    first: 5
  };

  await client.fetchRepositoriesPage(variables);

  assert.equal(receivedVariables, variables);
  assert.equal((receivedVariables as any).after, undefined);
});

test('GitHubGraphQLClient › fetchRepositoriesPage › should handle repositories with no releases', async () => {
  const mockResponse: OrganizationResponse = {
    organization: {
      repositories: {
        pageInfo: {
          hasNextPage: false,
          endCursor: null
        },
        nodes: [
          {
            name: 'no-releases-repo',
            updatedAt: '2023-01-01T00:00:00Z',
            releases: {
              nodes: []
            }
          }
        ]
      }
    }
  };

  const mockGraphql = async () => mockResponse;
  const client = new GitHubGraphQLClient('test-token', mockGraphql);

  const result = await client.fetchRepositoriesPage({
    orgName: 'test-org',
    first: 10
  });

  assert.equal(result.organization.repositories.nodes.length, 1);
  assert.equal(result.organization.repositories.nodes[0].releases.nodes.length, 0);
});

test('GitHubGraphQLClient › fetchRepositoriesPage › should handle pagination correctly', async () => {
  const mockResponse: OrganizationResponse = {
    organization: {
      repositories: {
        pageInfo: {
          hasNextPage: true,
          endCursor: 'next-page-cursor'
        },
        nodes: [
          {
            name: 'repo1',
            updatedAt: '2023-01-01T00:00:00Z',
            releases: {
              nodes: [
                {
                  tagName: 'v1.0.0',
                  name: 'Release 1.0.0',
                  publishedAt: '2023-01-01T00:00:00Z',
                  description: 'Test release',
                  url: 'https://github.com/test/repo1/releases/tag/v1.0.0',
                  author: {
                    login: 'testuser'
                  },
                  isPrerelease: false
                }
              ]
            }
          }
        ]
      }
    }
  };

  const mockGraphql = async () => mockResponse;
  const client = new GitHubGraphQLClient('test-token', mockGraphql);

  const result = await client.fetchRepositoriesPage({
    orgName: 'test-org',
    first: 10
  });

  assert.equal(result.organization.repositories.pageInfo.hasNextPage, true);
  assert.equal(result.organization.repositories.pageInfo.endCursor, 'next-page-cursor');
});

test('GitHubGraphQLClient › fetchRepositoriesPage › should propagate GraphQL errors', async () => {
  const mockGraphql = async () => {
    throw new Error('GraphQL API Error: Bad credentials');
  };

  const client = new GitHubGraphQLClient('test-token', mockGraphql);

  try {
    await client.fetchRepositoriesPage({
      orgName: 'test-org',
      first: 10
    });
    assert.unreachable('should have thrown an error');
  } catch (error: any) {
    assert.instance(error, Error);
    assert.ok(error.message.includes('GraphQL API Error: Bad credentials'));
  }
});

test.run();
