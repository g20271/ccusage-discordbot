# ccusage Discord Bot

Claude Code使用状況をDiscordでリアルタイム監視するボットです。

## 機能

- ccusageの統計情報をDiscordで表示
- リアルタイム自動更新
- セッション進捗、トークン使用量、コスト予測の視覚化
- プログレスバーによる直感的な表示

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env.example`を`.env`にコピーして編集：

```bash
cp .env.example .env
```

必要な情報：
- `DISCORD_TOKEN`: Discord Botのトークン
- `DISCORD_CLIENT_ID`: BotのクライアントID
- `DISCORD_GUILD_ID`: テスト用サーバーID（オプション）

### 3. ビルド

```bash
npm run build
```

### 4. 起動

開発環境：
```bash
npm run dev
```

本番環境：
```bash
npm start
```

## 使用方法

### コマンド

- `/monitor start [interval]` - 監視を開始（intervalは更新間隔を秒で指定、デフォルト15秒）
- `/monitor stop` - 監視を停止
- `/monitor once` - 現在の状況を1回だけ表示

### 表示内容

- **SESSION**: セッション情報（開始時刻、経過時間、残り時間）
- **USAGE**: 現在の使用状況（トークン数、バーンレート、コスト）
- **PROJECTION**: 予測情報（最終トークン数、総コスト）
- **TOKEN BREAKDOWN**: トークンの内訳
- **MODELS**: 使用中のモデル

## システム要件

- Node.js 18以上
- ccusageコマンドがインストール済み
- Discord Bot権限（メッセージ送信、埋め込み送信）

## トラブルシューティング

### ccusageデータが取得できない場合

1. ccusageがインストールされているか確認
2. `ccusage blocks --active --json`が正常に動作するか確認
3. ボットのログを確認

### Discordに接続できない場合

1. `.env`のトークンが正しいか確認
2. Botの権限を確認
3. ネットワーク接続を確認# ccusage-discord
# ccusage-discord
