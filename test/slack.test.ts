import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { slackPostMessage } from '../src/slack.js';
import * as core from '@actions/core';

vi.mock('@actions/core', () => ({
  info: vi.fn(),
  debug: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
  setFailed: vi.fn(),
  getInput: vi.fn(),
}));

describe('slackPostMessage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should post message to Slack channel', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      json: () => Promise.resolve({ ok: true }),
    } as Response);

    await slackPostMessage('C12345', 'Hello, world!', 'xoxb-token', false);

    expect(fetch).toHaveBeenCalledWith('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer xoxb-token',
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({
        channel: 'C12345',
        text: 'Hello, world!',
        unfurl_links: false,
        unfurl_media: false,
      }),
    });
  });

  it('should not post when dry run is enabled', async () => {
    await slackPostMessage('C12345', 'Hello, world!', 'xoxb-token', true);

    expect(fetch).not.toHaveBeenCalled();
    expect(core.info).toHaveBeenCalledWith(
      expect.stringContaining('[DRY_RUN] Would post to C12345')
    );
  });

  it('should throw error on Slack API failure', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      json: () => Promise.resolve({ ok: false, error: 'channel_not_found' }),
    } as Response);

    await expect(
      slackPostMessage('C_INVALID', 'Hello!', 'xoxb-token', false)
    ).rejects.toThrow('Slack chat.postMessage failed');
  });

  it('should include message text in dry run log', async () => {
    const message = 'Test message with *formatting*';
    await slackPostMessage('C12345', message, 'xoxb-token', true);

    expect(core.info).toHaveBeenCalledWith(
      expect.stringContaining(message)
    );
  });
});
