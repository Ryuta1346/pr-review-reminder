# PR: TypeScript への移行

## 概要 (Overview)

PR Review Reminder を JavaScript (`.mjs`) 実装から TypeScript 実装に移行し、GitHub Actions として直接利用可能な形式に変換しました。

主な変更点：
- **スタンドアロンの GitHub Action として再構築**: Reusable Workflow から `uses:` で直接利用できる Action 形式に変更
- **TypeScript による完全な書き直し**: 型安全性の向上とコードの保守性改善
- **テストの追加**: Vitest によるユニットテストとカバレッジ
- **CI/CD パイプラインの整備**: Build、Test、Release ワークフローの追加

## 対応 (Changes implemented)

### アーキテクチャの変更
- Reusable Workflow (`.github/workflows/reusable-pr-review-reminder.yml`) から GitHub Action (`action.yml`) に変更
- 他リポジトリからの利用方法を `uses: Ryuta1346/pr-review-reminder@v1` 形式に簡素化

### 新規ファイル
- `action.yml`: GitHub Action 定義ファイル
- `src/index.ts`: メインエントリーポイント
- `src/github.ts`: GitHub API 関連処理
- `src/slack.ts`: Slack API 関連処理
- `src/types.ts`: TypeScript 型定義
- `src/utils.ts`: ユーティリティ関数
- `test/github.test.ts`: GitHub モジュールのテスト
- `test/slack.test.ts`: Slack モジュールのテスト
- `test/utils.test.ts`: ユーティリティのテスト

### CI/CD ワークフロー
- `.github/workflows/build.yml`: PR時のビルドチェック（dist/ の更新確認含む）
- `.github/workflows/test.yml`: テスト実行とカバレッジ
- `.github/workflows/release.yml`: タグプッシュ時の自動リリース（メジャーバージョンタグ更新含む）

### 削除ファイル
- `.github/scripts/pr-review-reminder-by-label.mjs`: 旧 JavaScript 実装
- `.github/workflows/reusable-pr-review-reminder.yml`: 旧 Reusable Workflow

### ドキュメント更新
- `README.md` / `README.ja.md`: 新しい利用方法に合わせて全面更新
- 開発セクション（ビルド、テスト、リリース手順）を追加

## やらないこと (Out of scope)

- Team reviewers (`requested_teams`) のサポート
- レビューコメント・Approve/Request changes のステータス追跡
- 既存の機能変更（WIP/Draft PR の除外、レビュワー未アサイン PR の通知等は維持）

## 懸念事項 (Concerns)

- `dist/index.js` がリポジトリにコミットされている（GitHub Action の仕様上必要）
  - PR 時に dist/ の更新漏れをチェックする CI を追加済み
- Node.js 24 を使用（現時点では LTS ではない）

## ドキュメント (Documentation)

- README.md: 英語版ドキュメント（使用方法、設定、開発ガイド）
- README.ja.md: 日本語版ドキュメント

## チケット (Tickets)

なし

## その他資料等 (Additional information)

### 使用技術
- TypeScript 5.8
- Node.js 24
- pnpm 10
- Vitest (テストフレームワーク)
- esbuild (バンドラー)
- @actions/core, @actions/github (GitHub Actions SDK)

### テストカバレッジ
- ユニットテストで主要なビジネスロジックをカバー
- Codecov へのアップロードを CI に組み込み
