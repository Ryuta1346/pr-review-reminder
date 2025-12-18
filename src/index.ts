import * as core from '@actions/core';
import type { ActionConfig, PRSummary } from './types.js';
import { listAllOpenPRs } from './github.js';
import { slackPostMessage } from './slack.js';
import {
  chunkText,
  extractLabels,
  isWipOrDraft,
  pickChannelIdFromLabels,
  stableSort,
  toSlackMention,
} from './utils.js';

/**
 * Load configuration from action inputs and environment
 */
function loadConfig(): ActionConfig {
  const labelChannelMapJson = core.getInput('label_channel_map', {
    required: true,
  });
  const slackUserMapJson = core.getInput('slack_user_map') || '{}';
  const slackBotToken = core.getInput('slack_bot_token', { required: true });
  const dryRunInput = core.getInput('dry_run') || 'false';

  const githubToken = process.env.GITHUB_TOKEN;
  if (!githubToken) {
    throw new Error('GITHUB_TOKEN environment variable is required');
  }

  const repository = process.env.GITHUB_REPOSITORY;
  if (!repository) {
    throw new Error('GITHUB_REPOSITORY environment variable is required');
  }

  return {
    labelChannelMap: JSON.parse(labelChannelMapJson),
    slackUserMap: JSON.parse(slackUserMapJson),
    slackBotToken,
    githubToken,
    repository,
    dryRun: dryRunInput.trim() === 'true',
  };
}

/**
 * Main action logic
 */
async function run(): Promise<void> {
  try {
    const config = loadConfig();
    const [owner, repo] = config.repository.split('/');

    core.info(`Fetching open PRs for ${owner}/${repo}...`);
    const prs = await listAllOpenPRs(owner, repo, config.githubToken);
    core.info(`Found ${prs.length} open PRs`);

    // channel -> reviewer -> PRs
    const byChannel = new Map<string, Map<string, PRSummary[]>>();

    // PRs without reviewers
    const noReviewerPRs: PRSummary[] = [];

    for (const pr of prs) {
      // Skip WIP/Draft PRs
      if (isWipOrDraft(pr)) {
        core.debug(`Skipping WIP/Draft PR #${pr.number}: ${pr.title}`);
        continue;
      }

      // Only process individual requested reviewers
      const reviewers = (pr.requested_reviewers || [])
        .map((u) => u.login)
        .filter(Boolean);

      const prSummary: PRSummary = {
        number: pr.number,
        title: pr.title,
        url: pr.html_url,
        author: pr.user?.login || 'unknown',
        labels: extractLabels(pr),
      };

      if (reviewers.length === 0) {
        // Collect PRs without reviewers (only if default_channel_id exists)
        if (config.labelChannelMap.default_channel_id) {
          noReviewerPRs.push(prSummary);
        }
        continue;
      }

      const channelId = pickChannelIdFromLabels(
        pr.labels || [],
        config.labelChannelMap
      );
      if (!channelId) continue;

      if (!byChannel.has(channelId)) {
        byChannel.set(channelId, new Map());
      }
      const byReviewer = byChannel.get(channelId)!;

      for (const login of reviewers) {
        if (!byReviewer.has(login)) {
          byReviewer.set(login, []);
        }
        byReviewer.get(login)!.push(prSummary);
      }
    }

    if (byChannel.size === 0 && noReviewerPRs.length === 0) {
      core.info('No open PRs to notify.');
      return;
    }

    // Send notifications grouped by channel and reviewer
    for (const [channelId, byReviewer] of byChannel.entries()) {
      const lines: string[] = [];
      lines.push(
        `*PRレビュー依頼（open PR / requested reviewers）*  \`${owner}/${repo}\``
      );
      lines.push('');

      const reviewersSorted = Array.from(byReviewer.keys()).sort((a, b) =>
        a.localeCompare(b)
      );

      for (const login of reviewersSorted) {
        lines.push(`*${toSlackMention(login, config.slackUserMap)}*`);
        const prsForReviewer = stableSort(
          byReviewer.get(login)!,
          (x) => x.number
        );

        for (const prData of prsForReviewer) {
          const labelText =
            prData.labels.length > 0 ? ` [${prData.labels.join(', ')}]` : '';
          lines.push(
            `• <${prData.url}|#${prData.number} ${prData.title}> (author: ${prData.author})${labelText}`
          );
        }
        lines.push('');
      }

      const message = lines.join('\n').trim();
      for (const chunk of chunkText(message)) {
        await slackPostMessage(
          channelId,
          chunk,
          config.slackBotToken,
          config.dryRun
        );
      }
    }

    // Send notification for PRs without reviewers
    if (noReviewerPRs.length > 0) {
      const lines: string[] = [];
      lines.push(`*レビュワー未アサインのPR*  \`${owner}/${repo}\``);
      lines.push('');

      const sortedPRs = stableSort(noReviewerPRs, (x) => x.number);
      for (const prData of sortedPRs) {
        const labelText =
          prData.labels.length > 0 ? ` [${prData.labels.join(', ')}]` : '';
        lines.push(
          `• <${prData.url}|#${prData.number} ${prData.title}> (author: ${prData.author})${labelText}`
        );
      }

      const message = lines.join('\n').trim();
      for (const chunk of chunkText(message)) {
        await slackPostMessage(
          config.labelChannelMap.default_channel_id!,
          chunk,
          config.slackBotToken,
          config.dryRun
        );
      }
    }

    core.info('PR review reminders sent successfully!');
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed('An unexpected error occurred');
    }
  }
}

run();
