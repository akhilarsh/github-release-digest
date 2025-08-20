import { graphql } from '@octokit/graphql';
import { OrganizationResponse, RepositoryQueryVariables, GitHubRepository, SingleRepositoryResponse } from '../types';

type GraphQLFunction = (query: string, variables?: any) => Promise<any>;

/**
 * Pure GraphQL client for GitHub API communication
 * Handles only the raw data fetching, no business logic
 */
export class GitHubGraphQLClient {
  private readonly graphqlClient: GraphQLFunction;

  constructor(token: string, graphqlFn?: GraphQLFunction) {
    if (graphqlFn) {
      this.graphqlClient = graphqlFn;
    } else {
      this.graphqlClient = graphql.defaults({
        headers: {
          authorization: `token ${token}`,
        },
      });
    }
  }

  /**
   * GraphQL query for fetching repositories with releases
   * Fetches up to 10 releases per repository - filtering by date happens in application layer
   * Ordered by updatedAt DESC for early stopping optimization
   */
  private readonly REPOSITORIES_QUERY = `
    query($orgName: String!, $first: Int!, $after: String) {
      organization(login: $orgName) {
        repositories(first: $first, after: $after, orderBy: {field: UPDATED_AT, direction: DESC}) {
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            name
            updatedAt
            releases(first: 10, orderBy: {field: CREATED_AT, direction: DESC}) {
              nodes {
                tagName
                name
                publishedAt
                description
                url
                author {
                  login
                }
                isPrerelease
              }
            }
          }
        }
      }
    }
  `;

  /**
   * GraphQL query for fetching a single repository with releases
   * More efficient for single repository requests
   */
  private readonly SINGLE_REPOSITORY_QUERY = `
    query($orgName: String!, $repoName: String!) {
      organization(login: $orgName) {
        repository(name: $repoName) {
          name
          updatedAt
          releases(first: 10, orderBy: {field: CREATED_AT, direction: DESC}) {
            nodes {
              tagName
              name
              publishedAt
              description
              url
              author {
                login
              }
              isPrerelease
            }
          }
        }
      }
    }
  `;

  /**
   * Execute a single GraphQL query to fetch repositories page
   * @param variables - Query variables (orgName, first, after)
   * @returns Promise<OrganizationResponse>
   */
  async fetchRepositoriesPage(variables: RepositoryQueryVariables): Promise<OrganizationResponse> {
    try {
      const response = await this.graphqlClient(this.REPOSITORIES_QUERY, variables);

      if (!response) {
        throw new Error('GraphQL response is null or undefined');
      }

      const responseKeys = Object.keys(response);
      if (responseKeys.length === 0) {
        throw new Error('GraphQL response is empty object');
      }

      if (response && response.errors && response.errors.length > 0) {
        const errorMessages = response.errors.map((error: any) => error.message).join(', ');
        throw new Error(`GraphQL errors: ${errorMessages}`);
      }

      if (response && response.message && response.message.includes('Bad credentials')) {
        throw new Error('GitHub authentication failed. Please check your TOKEN_GITHUB environment variable.');
      }

      if (response && response.message && response.message.includes('Could not resolve to an Organization')) {
        throw new Error(`Organization '${variables.orgName}' not found or access denied. Please check the ORG_NAME environment variable and your GitHub token permissions.`);
      }

      if (!response.organization) {
        const availableKeys = Object.keys(response);
        throw new Error(`GraphQL response missing 'organization' field. Available keys: ${availableKeys.join(', ')}. This might indicate an authentication or permission issue.`);
      }

      return response as OrganizationResponse;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`GraphQL query failed: ${error}`);
    }
  }

  /**
   * Execute a GraphQL query to fetch a single repository
   * @param orgName - Organization name
   * @param repoName - Repository name
   * @returns Promise<GitHubRepository | null>
   */
  async fetchSingleRepository(orgName: string, repoName: string): Promise<GitHubRepository | null> {
    try {
      const response = await this.graphqlClient(this.SINGLE_REPOSITORY_QUERY, { orgName, repoName });

      if (response && response.errors && response.errors.length > 0) {
        const errorMessages = response.errors.map((error: any) => error.message).join(', ');
        throw new Error(`GraphQL errors: ${errorMessages}`);
      }

      if (response && response.message && response.message.includes('Bad credentials')) {
        throw new Error('GitHub authentication failed. Please check your TOKEN_GITHUB environment variable.');
      }

      if (response && response.message && response.message.includes('Could not resolve to an Organization')) {
        throw new Error(`Organization '${orgName}' not found or access denied. Please check the ORG_NAME environment variable and your GitHub token permissions.`);
      }

      const result = response as SingleRepositoryResponse;
      return result.organization.repository;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`GraphQL query failed: ${error}`);
    }
  }

  /**
   * Get the GraphQL query string (useful for debugging)
   */
  getQuery(): string {
    return this.REPOSITORIES_QUERY;
  }
}
