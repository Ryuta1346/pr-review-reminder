import * as core from '@actions/core';

interface SlackResponse {
  ok: boolean;
  error?: string;
}

/**
 * Post a message to a Slack channel
 * @param channel - Slack channel ID
 * @param text - Message text
 * @param token - Slack Bot OAuth token
 * @param dryRun - If true, log instead of posting
 */
export async function slackPostMessage(
  channel: string,
  text: string,
  token: string,
  dryRun: boolean
): Promise<void> {
  if (dryRun) {
    core.info(`[DRY_RUN] Would post to ${channel}:\n${text}\n---`);
    return;
  }

  const res = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({
      channel,
      text,
      unfurl_links: false,
      unfurl_media: false,
    }),
  });

  const data = (await res.json()) as SlackResponse;

  if (!data.ok) {
    throw new Error(`Slack chat.postMessage failed: ${JSON.stringify(data)}`);
  }
}
