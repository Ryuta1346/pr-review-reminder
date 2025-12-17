# PR Review Reminder to Slack（label → channel）

GitHub Actions（schedule）で オープン中のPR を定期チェックし、PRの Requested
reviewers（レビュワー） を対象に、PRラベルに応じて
Slackの投稿チャンネルを分岐して通知します。

- **対象PR**: `state=open` のPRのみ
- **対象者**: `requested_reviewers`（個人レビュワー）だけ
- **チャンネル分岐**: PRラベル → SlackチャンネルID（ルール表で制御）
- **実行基盤**: GitHub Actions（cron）

---

## リポジトリ構成

```
.
├─ .github/
│  ├─ workflows/
│  │  └─ pr-review-reminder.yml
│  ├─ scripts/
│  │  └─ pr-review-reminder-by-label.mjs
│  ├─ pr-label-channel-map.json
│  └─ slack-user-map.json        # 任意（GitHub→Slackメンション紐付け）
└─ README.md
```

---

## セットアップ手順（詳細）

### 1) Slack App を作成（Botトークン方式）

#### 1-1. Slack Developer Portal でアプリを作る

1. [Slack Developer Portal](https://api.slack.com/apps) の Your Apps を開く
2. **Create New App** を押す
3. **From scratch** を選択
4. App名を入力（例：PR Review Reminder）
5. インストール先のワークスペースを選択して作成

#### 1-2. Bot権限（Scopes）を付与

1. App設定 → **OAuth & Permissions**
2. **Bot Token Scopes** に以下を追加
   - `chat:write`（Slack投稿に必須）

> チャンネルに参加させない運用をしたい場合は `chat:write.public`
> が必要になることがありますが、基本は
> Botをチャンネルに招待する運用を推奨します。

#### 1-3. ワークスペースにインストールしてトークン取得

1. **Install to Workspace** を実行
2. 発行される **Bot User OAuth Token**（`xoxb-…`） を控える

例：`xoxb-************-************-************************`

---

### 2) Bot を投稿先チャンネルへ招待

通知したい各チャンネルで、Slack上から以下を実行します。

```
/invite @<Your Bot Name>
```

> Botがチャンネルにいないと `not_in_channel` や `channel_not_found`
> で失敗します。 プライベートチャンネルも同様に招待が必要です。

---

### 3) チャンネルID（Cから始まるID）を取得

このテンプレートは **チャンネル名ではなくチャンネルID** を使います。

**簡単な方法：**

ブラウザでSlackを開き、対象チャンネルを開いたときのURLに含まれる `C...` を使う

例：`.../client/TXXXXXXX/C12345678` → `C12345678`

---

### 4) テンプレートから導入先リポジトリを作成

#### パターンA：新規リポジトリを作る（Use this template）

1. テンプレートリポジトリを開く
2. **Use this template** → **Create a new repository**
3. 作成されたリポジトリがそのまま導入先になります

#### パターンB：既存リポジトリに導入（現実的）

既存リポジトリに以下をコピーしてください。

- `.github/workflows/pr-review-reminder.yml`
- `.github/scripts/pr-review-reminder-by-label.mjs`
- `.github/pr-label-channel-map.json`
- （任意）`.github/slack-user-map.json`

---

### 5) GitHub Secrets を設定（必須）

導入先リポジトリで：

1. GitHub → **Settings**
2. **Secrets and variables** → **Actions**
3. **New repository secret**

**追加するSecrets：**

| Secret名          | 値                 |
| ----------------- | ------------------ |
| `SLACK_BOT_TOKEN` | Slackの `xoxb-...` |

**任意：**

| Secret名  | 値                                       |
| --------- | ---------------------------------------- |
| `DRY_RUN` | `1`（最初は投稿せずActionsログだけ出す） |

---

## 設定ファイル

### 1) ラベル → チャンネル分岐（必須）

`.github/pr-label-channel-map.json`

```json
{
	"default_channel_id": "C012DEFAULT",
	"rules": [
		{ "labels_any": ["frontend", "ui"], "channel_id": "C111FRONT" },
		{ "labels_any": ["backend", "api"], "channel_id": "C222BACK" },
		{ "labels_any": ["infra", "terraform"], "channel_id": "C333INFRA" }
	]
}
```

**挙動：**

- PRのラベルが `labels_any` のいずれか1つでも一致 → その `channel_id` に投稿
- 複数一致 → 上から順で最初に一致したルールが勝ち
- 一致なし → `default_channel_id` に投稿

---

### 2) GitHubユーザー → Slackメンション（任意）

`.github/slack-user-map.json`

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

## 実行方法

### 手動実行（推奨：初回検証）

1. （任意）Secretsに `DRY_RUN=1` を入れる
2. GitHub → **Actions**
3. **PR review reminder (by label -> Slack channel)** を選択
4. **Run workflow**（workflow_dispatch）で実行
5. ログを確認
6. 問題なければ `DRY_RUN` を削除して再実行し、Slack投稿を確認

---

### 定期実行（cron）

`.github/workflows/pr-review-reminder.yml` の例：

```yaml
on:
    schedule:
        - cron: "0 0,4,8,12 * * *"
```

**注意：**

- cronは **UTC** です
- JSTで 09:00/13:00/17:00/21:00 にしたい場合は、UTCで 00:00/04:00/08:00/12:00
  に設定します

---

## 投稿内容のイメージ

チャンネルごとに、レビュワー単位でPR一覧をまとめて投稿します。

```
<@レビュワー>（または @github-login）
• #123 PRタイトル（リンク） (author: xxx) [label1, label2]
```

---

## よくあるトラブルシュート

### Slackに投稿できない（not_in_channel / channel_not_found）

Botを対象チャンネルに招待してください：`/invite @Bot`

### 期待したチャンネルに出ない

`.github/pr-label-channel-map.json` の以下を確認してください：

- ラベル名のスペル一致
- ルール順（上から評価）
- `default_channel_id`

### 通知が出ない

`requested_reviewers`
が空のPRは対象外です（レビュワー指定が無いPRは通知しません）

---

## 制約・今後の拡張

- **Team reviewer（requested_teams）は対象外**
  - チームを個人に展開して通知する拡張は可能（Org権限・可視性の考慮が必要）
- **"毎回同じ内容" を投稿します**
  - 必要なら「重複抑止（前回と同一なら投稿しない）」を追加できます

---

## セキュリティ

- Slackトークンは必ず **GitHub Secrets**
  に保存し、リポジトリにコミットしないでください
- workflowは `schedule` / `workflow_dispatch`
  のみで動かす想定（外部PRでSecretsが漏れにくい設計）

---

## License

MIT
