# PR Review Reminder to Slack（label → channel）

[English README](README.md)

GitHub Actions（schedule）で オープン中のPR を定期チェックし、PRの Requested
reviewers（レビュワー） を対象に、PRラベルに応じて
Slackの投稿チャンネルを分岐して通知します。

- **対象PR**: `state=open` のPRのみ
- **対象者**: `requested_reviewers`（個人レビュワー）だけ
- **チャンネル分岐**: PRラベル → SlackチャンネルID（ルール表で制御）
- **実行基盤**: GitHub Actions（cron）

---

## 使用方法（Reusable Workflow）

他のリポジトリから呼び出して使用します。

### 1) 呼び出し側リポジトリにワークフローを作成

`.github/workflows/pr-review-reminder.yml` を作成：

```yaml
name: PR Review Reminder

on:
  schedule:
    # cronはUTC。例：JST 09:00/13:00/17:00/21:00 に実行したい場合（UTC 00/04/08/12）
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

| 名前 | 必須 | 説明 |
|------|------|------|
| `label_channel_map` | Yes | JSON: ラベル→Slackチャンネルのマッピング |
| `slack_user_map` | No | JSON: GitHubユーザー→Slack IDのマッピング（デフォルト: `{}`） |
| `dry_run` | No | `true`の場合、Slackに投稿せずログ出力のみ（デフォルト: `false`） |

### 3) Secrets

| 名前 | 必須 | 説明 |
|------|------|------|
| `SLACK_BOT_TOKEN` | Yes | Slack Bot OAuth Token (`xoxb-...`) |

---

## 設定の詳細

### label_channel_map（必須）

PRラベルに応じてSlackチャンネルを振り分けるルールを定義します。

```json
{
  "default_channel_id": "C012DEFAULT",
  "rules": [
    { "labels_any": ["frontend", "ui"], "channel_id": "C111FRONT" },
    { "labels_any": ["backend", "api"], "channel_id": "C222BACK" }
  ]
}
```

**挙動：**

- PRのラベルが `labels_any` のいずれか1つでも一致 → その `channel_id` に投稿
- 複数ルールに一致 → 上から順で最初に一致したルールが勝ち
- 一致なし → `default_channel_id` に投稿

### slack_user_map（任意）

GitHubユーザー名をSlackユーザーIDにマッピングします。

```json
{
  "octocat": "U012ABCDEF",
  "your-github-login": "U034GHIJKL"
}
```

**挙動：**

- マップがあるレビュワー：`<@Uxxxx>` でメンション
- マップがないレビュワー：`@github-login` の文字列（Slackメンションではない）

---

## Slack App のセットアップ

### 1) Slack App を作成

1. [Slack Developer Portal](https://api.slack.com/apps) → **Create New App** → **From scratch**
2. App名を入力（例：PR Review Reminder）
3. インストール先のワークスペースを選択

### 2) Bot権限を付与

1. App設定 → **OAuth & Permissions**
2. **Bot Token Scopes** に `chat:write` を追加

### 3) トークンを取得

1. **Install to Workspace** を実行
2. **Bot User OAuth Token**（`xoxb-…`）を控える

### 4) Bot をチャンネルへ招待

通知したい各チャンネルで：

```
/invite @<Your Bot Name>
```

### 5) チャンネルIDを取得

ブラウザでSlackを開き、対象チャンネルのURLに含まれる `C...` を使用

例：`.../client/TXXXXXXX/C12345678` → `C12345678`

### 6) GitHub Secrets を設定

呼び出し側リポジトリで：

1. **Settings** → **Secrets and variables** → **Actions**
2. `SLACK_BOT_TOKEN` を追加

---

## 投稿内容のイメージ

チャンネルごとに、レビュワー単位でPR一覧をまとめて投稿します。

```
*PRレビュー依頼（open PR / requested reviewers）*  `owner/repo`

*<@レビュワー>*
• #123 PRタイトル (author: xxx) [label1, label2]
• #456 別のPR (author: yyy) [label3]
```

---

## よくあるトラブルシュート

### Slackに投稿できない（not_in_channel / channel_not_found）

Botを対象チャンネルに招待してください：`/invite @Bot`

### 期待したチャンネルに出ない

`label_channel_map` の以下を確認：

- ラベル名のスペル一致
- ルール順（上から評価）
- `default_channel_id`

### 通知が出ない

`requested_reviewers` が空のPRは対象外です

---

## 制約・今後の拡張

- **Team reviewer（requested_teams）は対象外**
- **毎回同じ内容を投稿します**（重複抑止機能なし）

---

## セキュリティ

- Slackトークンは必ず **GitHub Secrets** に保存
- workflowは `schedule` / `workflow_dispatch` のみで動作（外部PRでSecretsが漏れにくい設計）

---

## License

MIT
