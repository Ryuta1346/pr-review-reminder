import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ghRequest, listAllOpenPRs } from '../src/github.js';

describe('ghRequest', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should make authenticated request with correct headers', async () => {
    const mockResponse = { id: 1, name: 'test' };
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    } as Response);

    const result = await ghRequest('https://api.github.com/test', 'test-token');

    expect(fetch).toHaveBeenCalledWith('https://api.github.com/test', {
      headers: {
        Authorization: 'Bearer test-token',
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    expect(result).toEqual(mockResponse);
  });

  it('should throw error on non-ok response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: () => Promise.resolve('Not found'),
    } as Response);

    await expect(
      ghRequest('https://api.github.com/test', 'test-token')
    ).rejects.toThrow('GitHub API error 404: Not found');
  });

  it('should handle error response without body', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: () => Promise.reject(new Error('Failed to read')),
    } as Response);

    await expect(
      ghRequest('https://api.github.com/test', 'test-token')
    ).rejects.toThrow('GitHub API error 500: ');
  });
});

describe('listAllOpenPRs', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should fetch all open PRs in single page', async () => {
    const mockPRs = [
      { number: 1, title: 'PR 1', html_url: 'https://github.com/test/repo/pull/1' },
      { number: 2, title: 'PR 2', html_url: 'https://github.com/test/repo/pull/2' },
    ];

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockPRs),
    } as Response);

    const result = await listAllOpenPRs('owner', 'repo', 'test-token');

    expect(result).toEqual(mockPRs);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      'https://api.github.com/repos/owner/repo/pulls?state=open&per_page=100&page=1',
      expect.any(Object)
    );
  });

  it('should handle pagination when there are 100+ PRs', async () => {
    const page1PRs = Array.from({ length: 100 }, (_, i) => ({
      number: i + 1,
      title: `PR ${i + 1}`,
      html_url: `https://github.com/test/repo/pull/${i + 1}`,
    }));
    const page2PRs = [
      { number: 101, title: 'PR 101', html_url: 'https://github.com/test/repo/pull/101' },
    ];

    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(page1PRs),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(page2PRs),
      } as Response);

    const result = await listAllOpenPRs('owner', 'repo', 'test-token');

    expect(result).toHaveLength(101);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      'https://api.github.com/repos/owner/repo/pulls?state=open&per_page=100&page=1',
      expect.any(Object)
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      'https://api.github.com/repos/owner/repo/pulls?state=open&per_page=100&page=2',
      expect.any(Object)
    );
  });

  it('should return empty array when no PRs exist', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([]),
    } as Response);

    const result = await listAllOpenPRs('owner', 'repo', 'test-token');

    expect(result).toEqual([]);
  });
});
