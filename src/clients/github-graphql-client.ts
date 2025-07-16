import { graphql } from '@octokit/graphql';
import { OrganizationResponse, RepositoryQueryVariables } from '../types';

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
   * Optimized: fetches only 1 release per repository (latest)
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
            releases(first: 1, orderBy: {field: CREATED_AT, direction: DESC}) {
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
   * Execute a single GraphQL query to fetch repositories page
   * @param variables - Query variables (orgName, first, after)
   * @returns Promise<OrganizationResponse>
   */
  async fetchRepositoriesPage(variables: RepositoryQueryVariables): Promise<OrganizationResponse> {
    return this.graphqlClient(this.REPOSITORIES_QUERY, variables) as Promise<OrganizationResponse>;
  }

  /**
   * Get the GraphQL query string (useful for debugging)
   */
  getQuery(): string {
    return this.REPOSITORIES_QUERY;
  }
}
