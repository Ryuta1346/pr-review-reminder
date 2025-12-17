# PR Review Reminder to Slack (label → channel)

[日本語版 README](README.ja.md)

A GitHub Actions reusable workflow that periodically checks open PRs and sends review reminders to Slack channels based on PR labels.

- **Target PRs**: Only `state=open` PRs
- **Target users**: Only `requested_reviewers` (individual reviewers)
- **Channel routing**: PR labels → Slack channel IDs (configurable rules)
- **Platform**: GitHub Actions (cron schedule)

---

## Usage (Reusable Workflow)

Call this workflow from your repository.

### 1) Create a workflow in your repository

Create `.github/workflows/pr-review-reminder.yml`:

```yaml
name: PR Review Reminder

on:
  schedule:
    # Cron is in UTC. For JST 09:00/13:00/17:00/21:00, use UTC 00:00/04:00/08:00/12:00
    - cron: "0 0,4,8,12 * * *"
  workflow_dispatch:

jobs:
  remind:
    uses: ryuta/pr-review-reminder/.github/workflows/reusable-pr-review-reminder.yml@main
    with:
      label_channel_map: |
        {
          "default_channel_id": "C012DEFAULT",
          "rules": [
            { "labels_any": ["frontend", "ui"], "channel_id": "C111FRONT" },
            { "labels_any": ["backend", "api"], "channel_id": "C222BACK" },
            { "labels_any": ["infra", "terraform"], "channel_id": "C333INFRA" }
          ]
        }
      slack_user_map: |
        {
          "octocat": "U012ABCDEF",
          "your-github-login": "U034GHIJKL"
        }
      dry_run: false
    secrets:
      SLACK_BOT_TOKEN: ${{ secrets.SLACK_BOT_TOKEN }}
```

### 2) Inputs

| Name | Required | Description |
|------|----------|-------------|
| `label_channel_map` | Yes | JSON: Label to Slack channel mapping |
| `slack_user_map` | No | JSON: GitHub username to Slack user ID mapping (default: `{}`) |
| `dry_run` | No | If `true`, only logs without posting to Slack (default: `false`) |

### 3) Secrets

| Name | Required | Description |
|------|----------|-------------|
| `SLACK_BOT_TOKEN` | Yes | Slack Bot OAuth Token (`xoxb-...`) |

---

## Configuration Details

### label_channel_map (Required)

Defines rules for routing PRs to Slack channels based on labels.

```json
{
  "default_channel_id": "C012DEFAULT",
  "rules": [
    { "labels_any": ["frontend", "ui"], "channel_id": "C111FRONT" },
    { "labels_any": ["backend", "api"], "channel_id": "C222BACK" }
  ]
}
```

**Behavior:**

- If PR has ANY label matching `labels_any` → post to that `channel_id`
- Multiple rule matches → first matching rule wins (order matters)
- No matches → post to `default_channel_id`

### slack_user_map (Optional)

Maps GitHub usernames to Slack user IDs for proper mentions.

```json
{
  "octocat": "U012ABCDEF",
  "your-github-login": "U034GHIJKL"
}
```

**Behavior:**

- Mapped reviewers: `<@Uxxxx>` (proper Slack mention)
- Unmapped reviewers: `@github-login` (plain text, not a mention)

---

## Slack App Setup

### 1) Create a Slack App

1. Go to [Slack Developer Portal](https://api.slack.com/apps) → **Create New App** → **From scratch**
2. Enter app name (e.g., PR Review Reminder)
3. Select the workspace to install

### 2) Add Bot Permissions

1. App settings → **OAuth & Permissions**
2. Add `chat:write` to **Bot Token Scopes**

### 3) Get the Token

1. Click **Install to Workspace**
2. Copy the **Bot User OAuth Token** (`xoxb-...`)

### 4) Invite Bot to Channels

In each target channel:

```
/invite @<Your Bot Name>
```

### 5) Get Channel IDs

Open Slack in browser and get `C...` from the URL

Example: `.../client/TXXXXXXX/C12345678` → `C12345678`

### 6) Configure GitHub Secrets

In your calling repository:

1. **Settings** → **Secrets and variables** → **Actions**
2. Add `SLACK_BOT_TOKEN`

---

## Message Format

Posts a grouped list of PRs per reviewer in each channel.

```
*PR Review Request (open PR / requested reviewers)*  `owner/repo`

*<@reviewer>*
• #123 PR Title (author: xxx) [label1, label2]
• #456 Another PR (author: yyy) [label3]
```

---

## Troubleshooting

### Cannot post to Slack (not_in_channel / channel_not_found)

Invite the bot to the target channel: `/invite @Bot`

### PR not appearing in expected channel

Check `label_channel_map`:

- Label names match exactly
- Rule order (evaluated top to bottom)
- `default_channel_id` setting

### No notifications

PRs without `requested_reviewers` are not included

---

## Limitations

- **Team reviewers (`requested_teams`) are not supported**
- **Posts same content on each run** (no deduplication)

---

## Security

- Always store Slack token in **GitHub Secrets**
- Workflow only triggers on `schedule` / `workflow_dispatch` (secrets are not exposed to external PRs)

---

## License

MIT
