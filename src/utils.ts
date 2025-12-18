import type { LabelChannelMap, PR, SlackUserMap } from './types.js';

/**
 * Convert a GitHub login to a Slack mention
 * @param githubLogin - GitHub username
 * @param slackUserMap - Mapping from GitHub login to Slack user ID
 * @returns Slack mention string (e.g., "<@U12345>" or "@octocat")
 */
export function toSlackMention(
  githubLogin: string,
  slackUserMap: SlackUserMap
): string {
  const uid = slackUserMap[githubLogin];
  return uid ? `<@${uid}>` : `@${githubLogin}`;
}

/**
 * Split text into chunks that don't exceed the maximum size
 * @param text - Text to split
 * @param max - Maximum chunk size (default: 3500 for Slack)
 * @returns Array of text chunks
 */
export function chunkText(text: string, max = 3500): string[] {
  const chunks: string[] = [];
  let cur = '';

  for (const line of text.split('\n')) {
    if ((cur + '\n' + line).length > max) {
      if (cur) chunks.push(cur);
      cur = line;
    } else {
      cur = cur ? cur + '\n' + line : line;
    }
  }

  if (cur) chunks.push(cur);
  return chunks;
}

/**
 * Stable sort an array by a key function
 * @param arr - Array to sort
 * @param keyFn - Function to extract sort key
 * @returns Sorted array (new array, does not mutate input)
 */
export function stableSort<T>(arr: T[], keyFn: (item: T) => unknown): T[] {
  return [...arr].sort((a, b) =>
    String(keyFn(a)).localeCompare(String(keyFn(b)))
  );
}

/**
 * Check if a PR is a work-in-progress or draft
 * @param pr - Pull request object
 * @returns true if PR is WIP or draft
 */
export function isWipOrDraft(pr: PR): boolean {
  // GitHub Draft status
  if (pr.draft === true) return true;

  // Title-based WIP check (case-insensitive)
  const title = (pr.title || '').toLowerCase();
  if (title.includes('[wip]')) return true;
  if (title.startsWith('wip:')) return true;

  return false;
}

/**
 * Pick a channel ID based on PR labels
 * @param prLabels - Array of label objects from the PR
 * @param labelMap - Label to channel mapping configuration
 * @returns Channel ID or undefined if no match
 */
export function pickChannelIdFromLabels(
  prLabels: Array<{ name?: string }>,
  labelMap: LabelChannelMap
): string | undefined {
  const names = new Set(prLabels.map((l) => l?.name).filter(Boolean));

  for (const rule of labelMap.rules || []) {
    const ruleLabels = (rule.labels_any || []).map(String);
    if (ruleLabels.some((x) => names.has(x))) {
      return rule.channel_id;
    }
  }

  return labelMap.default_channel_id;
}

/**
 * Extract label names from a PR
 * @param pr - Pull request object
 * @returns Array of label names
 */
export function extractLabels(pr: PR): string[] {
  return (pr.labels || []).map((l) => l?.name).filter((n): n is string => !!n);
}
