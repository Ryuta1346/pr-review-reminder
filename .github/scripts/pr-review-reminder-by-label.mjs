import process from "node:process";

const GH_TOKEN = process.env.GITHUB_TOKEN;
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const DRY_RUN = (process.env.DRY_RUN || "").trim() === "1";

if (!GH_TOKEN) throw new Error("GITHUB_TOKEN is required");
if (!SLACK_BOT_TOKEN) throw new Error("SLACK_BOT_TOKEN is required");

const repoFull = process.env.GITHUB_REPOSITORY; // "owner/repo"
if (!repoFull) throw new Error("GITHUB_REPOSITORY is missing");
const [owner, repo] = repoFull.split("/");

// Configuration from environment variables
if (!process.env.LABEL_CHANNEL_MAP_JSON) {
  throw new Error("LABEL_CHANNEL_MAP_JSON environment variable is required");
}
const labelMap = JSON.parse(process.env.LABEL_CHANNEL_MAP_JSON);
const slackUserMap = JSON.parse(process.env.SLACK_USER_MAP_JSON || "{}");

function toSlackMention(githubLogin) {
  const uid = slackUserMap[githubLogin];
  return uid ? `<@${uid}>` : `@${githubLogin}`;
}

async function ghRequest(url) {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${GH_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`GitHub API error ${res.status}: ${text}`);
  }
  return res.json();
}

async function slackPostMessage(channel, text) {
  if (DRY_RUN) {
    console.log(`[DRY_RUN] Would post to ${channel}:\n${text}\n---`);
    return;
  }
  const res = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      channel,
      text,
      unfurl_links: false,
      unfurl_media: false,
    }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`Slack chat.postMessage failed: ${JSON.stringify(data)}`);
}

function chunkText(text, max = 3500) {
  const chunks = [];
  let cur = "";
  for (const line of text.split("\n")) {
    if ((cur + "\n" + line).length > max) {
      chunks.push(cur);
      cur = line;
    } else {
      cur = cur ? cur + "\n" + line : line;
    }
  }
  if (cur) chunks.push(cur);
  return chunks;
}

async function listAllOpenPRs() {
  const prs = [];
  let page = 1;
  while (true) {
    const batch = await ghRequest(
      `https://api.github.com/repos/${owner}/${repo}/pulls?state=open&per_page=100&page=${page}`
    );
    prs.push(...batch);
    if (batch.length < 100) break;
    page += 1;
  }
  return prs;
}

function pickChannelIdFromLabels(prLabels) {
  const names = new Set(prLabels.map((l) => l?.name).filter(Boolean));
  for (const rule of (labelMap.rules || [])) {
    const ruleLabels = (rule.labels_any || []).map(String);
    if (ruleLabels.some((x) => names.has(x))) return rule.channel_id;
  }
  return labelMap.default_channel_id;
}

function stableSort(arr, keyFn) {
  return [...arr].sort((a, b) => String(keyFn(a)).localeCompare(String(keyFn(b))));
}

async function main() {
  const prs = await listAllOpenPRs();

  // channel -> reviewer -> PRs
  /** @type {Map<string, Map<string, Array<any>>>} */
  const byChannel = new Map();

  for (const pr of prs) {
    // requested reviewers（個人）だけ対象
    const reviewers = (pr.requested_reviewers || []).map((u) => u.login).filter(Boolean);
    if (reviewers.length === 0) continue;

    const channelId = pickChannelIdFromLabels(pr.labels || []);
    if (!channelId) continue;

    if (!byChannel.has(channelId)) byChannel.set(channelId, new Map());
    const byReviewer = byChannel.get(channelId);

    for (const login of reviewers) {
      if (!byReviewer.has(login)) byReviewer.set(login, []);
      byReviewer.get(login).push({
        number: pr.number,
        title: pr.title,
        url: pr.html_url,
        author: pr.user?.login || "unknown",
        labels: (pr.labels || []).map((l) => l?.name).filter(Boolean),
      });
    }
  }

  if (byChannel.size === 0) {
    console.log("No open PRs with requested reviewers.");
    return;
  }

  for (const [channelId, byReviewer] of byChannel.entries()) {
    const lines = [];
    lines.push(`*PRレビュー依頼（open PR / requested reviewers）*  \`${owner}/${repo}\``);
    lines.push("");

    const reviewersSorted = Array.from(byReviewer.keys()).sort((a, b) => a.localeCompare(b));
    for (const login of reviewersSorted) {
      lines.push(`*${toSlackMention(login)}*`);
      const prsForReviewer = stableSort(byReviewer.get(login), (x) => x.number);
      for (const pr of prsForReviewer) {
        const labelText = pr.labels.length ? ` [${pr.labels.join(", ")}]` : "";
        lines.push(`• <${pr.url}|#${pr.number} ${pr.title}> (author: ${pr.author})${labelText}`);
      }
      lines.push("");
    }

    const message = lines.join("\n").trim();
    for (const chunk of chunkText(message)) {
      await slackPostMessage(channelId, chunk);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
