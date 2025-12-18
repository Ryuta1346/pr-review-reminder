import type { PR } from './types.js';

/**
 * Make an authenticated request to the GitHub API
 * @param url - Full GitHub API URL
 * @param token - GitHub token for authentication
 * @returns Parsed JSON response
 */
export async function ghRequest<T>(url: string, token: string): Promise<T> {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`GitHub API error ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

/**
 * List all open PRs for a repository (handles pagination)
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param token - GitHub token
 * @returns Array of all open PRs
 */
export async function listAllOpenPRs(
  owner: string,
  repo: string,
  token: string
): Promise<PR[]> {
  const prs: PR[] = [];
  let page = 1;

  while (true) {
    const batch = await ghRequest<PR[]>(
      `https://api.github.com/repos/${owner}/${repo}/pulls?state=open&per_page=100&page=${page}`,
      token
    );

    prs.push(...batch);

    if (batch.length < 100) break;
    page += 1;
  }

  return prs;
}
