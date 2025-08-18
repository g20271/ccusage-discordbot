# Discord Bot セットアップガイド

## Discord Developer Portalでの設定

### 1. Botの作成
1. [Discord Developer Portal](https://discord.com/developers/applications)にアクセス
2. 「New Application」をクリック
3. アプリケーション名を入力（例：ccusage-monitor）

### 2. Bot設定
1. 左メニューの「Bot」をクリック
2. 「Reset Token」をクリックしてトークンを生成
3. トークンをコピー（一度しか表示されません！）

### 3. 必要な情報の取得
- **Application ID**: General Informationタブから
- **Bot Token**: Botタブから
- **Guild ID**: Discordで開発者モードを有効にして、サーバーを右クリック→「IDをコピー」

### 4. Botの招待
1. 左メニューの「OAuth2」→「URL Generator」
2. Scopesで以下を選択：
   - `bot`
   - `applications.commands`
3. Bot Permissionsで以下を選択：
   - Send Messages
   - Embed Links
   - Read Message History
   - Use Slash Commands
4. 生成されたURLをコピーしてブラウザで開く
5. Botを追加したいサーバーを選択

## .envファイルの設定

```env
# Botのトークン（Botタブから取得）
DISCORD_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# アプリケーションID（General Informationタブから取得）
DISCORD_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# サーバーID（オプション：特定のサーバーでのみ使用する場合）
DISCORD_GUILD_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# 更新間隔（ミリ秒）
UPDATE_INTERVAL=15000
```

## トラブルシューティング

### "Unknown Application"エラー
- DISCORD_CLIENT_IDが正しいか確認
- Application IDをGeneral Informationタブから再度コピー

### "401: Unauthorized"エラー
- DISCORD_TOKENが正しいか確認
- トークンを再生成して設定

### コマンドが表示されない
- Botに必要な権限があるか確認
- サーバーからBotを一度削除して再招待
- 1時間程度待つ（グローバルコマンドの場合）