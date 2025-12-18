import { describe, it, expect } from 'vitest';
import {
  toSlackMention,
  chunkText,
  stableSort,
  isWipOrDraft,
  pickChannelIdFromLabels,
  extractLabels,
} from '../src/utils.js';
import type { LabelChannelMap, PR } from '../src/types.js';

describe('toSlackMention', () => {
  it('should return Slack mention when user is mapped', () => {
    const slackUserMap = { octocat: 'U12345' };
    expect(toSlackMention('octocat', slackUserMap)).toBe('<@U12345>');
  });

  it('should return GitHub-style mention when user is not mapped', () => {
    const slackUserMap = {};
    expect(toSlackMention('octocat', slackUserMap)).toBe('@octocat');
  });

  it('should handle empty slack user map', () => {
    expect(toSlackMention('anyuser', {})).toBe('@anyuser');
  });
});

describe('chunkText', () => {
  it('should return single chunk for short text', () => {
    const text = 'Hello, world!';
    expect(chunkText(text)).toEqual(['Hello, world!']);
  });

  it('should split text at line boundaries', () => {
    const longLine = 'a'.repeat(100);
    const text = `${longLine}\n${longLine}\n${longLine}`;
    const chunks = chunkText(text, 250);
    expect(chunks.length).toBe(2);
    expect(chunks[0]).toBe(`${longLine}\n${longLine}`);
    expect(chunks[1]).toBe(longLine);
  });

  it('should handle empty text', () => {
    expect(chunkText('')).toEqual([]);
  });

  it('should handle single long line', () => {
    const longLine = 'a'.repeat(100);
    const chunks = chunkText(longLine, 50);
    // Single line exceeding max still returns as one chunk
    expect(chunks).toEqual([longLine]);
  });

  it('should respect default max of 3500', () => {
    const lines = Array(100).fill('a'.repeat(50)).join('\n');
    const chunks = chunkText(lines);
    chunks.forEach((chunk) => {
      expect(chunk.length).toBeLessThanOrEqual(3500);
    });
  });
});

describe('stableSort', () => {
  it('should sort array by key function', () => {
    const items = [{ n: 3 }, { n: 1 }, { n: 2 }];
    const sorted = stableSort(items, (x) => x.n);
    expect(sorted).toEqual([{ n: 1 }, { n: 2 }, { n: 3 }]);
  });

  it('should not mutate original array', () => {
    const items = [{ n: 3 }, { n: 1 }, { n: 2 }];
    const original = [...items];
    stableSort(items, (x) => x.n);
    expect(items).toEqual(original);
  });

  it('should handle string keys', () => {
    const items = [{ name: 'charlie' }, { name: 'alice' }, { name: 'bob' }];
    const sorted = stableSort(items, (x) => x.name);
    expect(sorted.map((x) => x.name)).toEqual(['alice', 'bob', 'charlie']);
  });

  it('should handle empty array', () => {
    expect(stableSort([], (x) => x)).toEqual([]);
  });
});

describe('isWipOrDraft', () => {
  it('should return true for draft PR', () => {
    const pr: PR = {
      number: 1,
      title: 'Feature',
      html_url: 'https://github.com/test/repo/pull/1',
      draft: true,
    };
    expect(isWipOrDraft(pr)).toBe(true);
  });

  it('should return true for [WIP] in title', () => {
    const pr: PR = {
      number: 1,
      title: '[WIP] Feature',
      html_url: 'https://github.com/test/repo/pull/1',
    };
    expect(isWipOrDraft(pr)).toBe(true);
  });

  it('should return true for [wip] in title (case insensitive)', () => {
    const pr: PR = {
      number: 1,
      title: 'Some [wip] feature',
      html_url: 'https://github.com/test/repo/pull/1',
    };
    expect(isWipOrDraft(pr)).toBe(true);
  });

  it('should return true for WIP: prefix', () => {
    const pr: PR = {
      number: 1,
      title: 'WIP: Feature',
      html_url: 'https://github.com/test/repo/pull/1',
    };
    expect(isWipOrDraft(pr)).toBe(true);
  });

  it('should return true for wip: prefix (case insensitive)', () => {
    const pr: PR = {
      number: 1,
      title: 'wip: Feature',
      html_url: 'https://github.com/test/repo/pull/1',
    };
    expect(isWipOrDraft(pr)).toBe(true);
  });

  it('should return false for normal PR', () => {
    const pr: PR = {
      number: 1,
      title: 'Add new feature',
      html_url: 'https://github.com/test/repo/pull/1',
      draft: false,
    };
    expect(isWipOrDraft(pr)).toBe(false);
  });

  it('should handle PR without title', () => {
    const pr = {
      number: 1,
      html_url: 'https://github.com/test/repo/pull/1',
    } as PR;
    expect(isWipOrDraft(pr)).toBe(false);
  });
});

describe('pickChannelIdFromLabels', () => {
  const labelMap: LabelChannelMap = {
    default_channel_id: 'C_DEFAULT',
    rules: [
      { labels_any: ['frontend', 'ui'], channel_id: 'C_FRONTEND' },
      { labels_any: ['backend', 'api'], channel_id: 'C_BACKEND' },
    ],
  };

  it('should return matching channel for first matching rule', () => {
    const labels = [{ name: 'frontend' }, { name: 'feature' }];
    expect(pickChannelIdFromLabels(labels, labelMap)).toBe('C_FRONTEND');
  });

  it('should return default channel when no rules match', () => {
    const labels = [{ name: 'docs' }];
    expect(pickChannelIdFromLabels(labels, labelMap)).toBe('C_DEFAULT');
  });

  it('should return undefined when no default and no rules match', () => {
    const noDefaultMap: LabelChannelMap = {
      rules: [{ labels_any: ['special'], channel_id: 'C_SPECIAL' }],
    };
    const labels = [{ name: 'docs' }];
    expect(pickChannelIdFromLabels(labels, noDefaultMap)).toBeUndefined();
  });

  it('should handle empty labels', () => {
    expect(pickChannelIdFromLabels([], labelMap)).toBe('C_DEFAULT');
  });

  it('should handle labels with undefined names', () => {
    const labels = [{ name: undefined }, { name: 'backend' }];
    expect(pickChannelIdFromLabels(labels, labelMap)).toBe('C_BACKEND');
  });

  it('should match any label in labels_any', () => {
    const labels = [{ name: 'api' }];
    expect(pickChannelIdFromLabels(labels, labelMap)).toBe('C_BACKEND');
  });

  it('should return first matching rule (order matters)', () => {
    const labels = [{ name: 'frontend' }, { name: 'backend' }];
    expect(pickChannelIdFromLabels(labels, labelMap)).toBe('C_FRONTEND');
  });
});

describe('extractLabels', () => {
  it('should extract label names from PR', () => {
    const pr: PR = {
      number: 1,
      title: 'Test',
      html_url: 'https://github.com/test/repo/pull/1',
      labels: [{ name: 'bug' }, { name: 'urgent' }],
    };
    expect(extractLabels(pr)).toEqual(['bug', 'urgent']);
  });

  it('should filter out undefined label names', () => {
    const pr: PR = {
      number: 1,
      title: 'Test',
      html_url: 'https://github.com/test/repo/pull/1',
      labels: [{ name: 'bug' }, { name: undefined }, { name: 'feature' }],
    };
    expect(extractLabels(pr)).toEqual(['bug', 'feature']);
  });

  it('should handle PR without labels', () => {
    const pr: PR = {
      number: 1,
      title: 'Test',
      html_url: 'https://github.com/test/repo/pull/1',
    };
    expect(extractLabels(pr)).toEqual([]);
  });

  it('should handle empty labels array', () => {
    const pr: PR = {
      number: 1,
      title: 'Test',
      html_url: 'https://github.com/test/repo/pull/1',
      labels: [],
    };
    expect(extractLabels(pr)).toEqual([]);
  });
});
