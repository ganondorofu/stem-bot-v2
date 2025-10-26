# Discord Bot API - stem-bot-v2

TypeScript + Express + Discord.js + Supabaseで構築されたDiscord Bot APIサーバー

## 概要

このBotは、Discordサーバーでメンバー管理を自動化するためのREST APIを提供します。
Supabaseデータベースと連携して、ロールの同期、ニックネームの管理、期生ロールの作成などを行います。

## 機能

- **ロール同期**: DBの部員情報に基づいてDiscordロールを自動付与・削除
- **ニックネーム管理**: 学籍番号や期生情報を含むニックネームの取得・設定
- **期生ロール作成**: 新しい期生のDiscordロールを作成しDBに保存
- **メンバーステータス確認**: Discordサーバー在籍確認とロール一覧取得

## セットアップ

### 1. 環境変数の設定

`.env`ファイルに以下の情報を設定してください：

```env
# Discord Bot設定
DISCORD_TOKEN=your_discord_bot_token
DISCORD_GUILD_ID=your_discord_server_id
DISCORD_LEADER_ROLE_ID=your_leader_role_id

# Supabase設定
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# API認証
API_AUTH_TOKEN=your_secure_random_token

# サーバー設定
PORT=3000
```

### 2. Discord Botの設定

1. [Discord Developer Portal](https://discord.com/developers/applications)でBotを作成
2. Bot Tokenをコピーして`DISCORD_TOKEN`に設定
3. Bot PermissionsでManage Roles、Manage Nicknamesを有効化
4. サーバーにBotを招待

### 3. Discord設定値の取得

- **DISCORD_GUILD_ID**: サーバーIDを取得（開発者モードで右クリック→IDをコピー）
- **DISCORD_LEADER_ROLE_ID**: 班長ロールのIDを取得

### 4. インストールと起動

```bash
# 依存パッケージをインストール
npm install

# 開発モードで起動
npm run dev

# 本番用にビルド
npm run build

# 本番モードで起動
npm start
```

## API仕様

すべてのAPIエンドポイントは`Authorization: Bearer <API_AUTH_TOKEN>`ヘッダーが必要です。

### 1. POST /api/roles/sync
**機能**: DB情報を基にDiscordロールを同期

**リクエスト**:
```json
{
  "discord_uid": "string"
}
```

**レスポンス**:
```json
{
  "success": true,
  "roles_assigned": ["52期生", "開発班"],
  "roles_removed": ["51期生"]
}
```

### 2. GET /api/nickname
**機能**: 現在のニックネームを取得

**リクエスト**:
```
GET /api/nickname?discord_uid=string
```

**レスポンス**:
```json
{
  "discord_uid": "123456789012345678",
  "full_nickname": "太郎(12345)",
  "name_only": "太郎"
}
```

### 3. POST /api/nickname/update
**機能**: 名前を受け取り、DB情報と組み合わせてニックネーム整形・設定

**リクエスト**:
```json
{
  "discord_uid": "string",
  "name": "string"
}
```

**整形ルール**:
- status = 0 or 1 (在籍中): `名前(学籍番号)`
- status = 2 (卒業生): `名前(generation期卒業生)`

**レスポンス**:
```json
{
  "success": true,
  "name": "太郎",
  "updated_nickname": "太郎(12345)"
}
```

### 4. POST /api/generation
**機能**: Discord期生ロール作成 + DB保存

**リクエスト**:
```json
{
  "generation": 52
}
```

**処理内容**:
- ロール名を自動生成（例: `52期生`）
- DB内で既存チェック
- Discord APIでロール作成
- `generation_roles`テーブルに保存

**レスポンス**:
```json
{
  "success": true,
  "role_id": "discord_role_id",
  "generation": 52
}
```

### 5. GET /api/member/status
**機能**: Discordサーバー在籍確認

**リクエスト**:
```
GET /api/member/status?discord_uid=string
```

**レスポンス**:
```json
{
  "discord_uid": "string",
  "is_in_server": true,
  "current_nickname": "太郎(12345)",
  "current_roles": ["52期生", "開発班"]
}
```

### ヘルスチェック

**GET /health** (認証不要)

```json
{
  "status": "ok",
  "timestamp": "2025-10-25T12:00:00.000Z"
}
```

## エラーレスポンス

```json
{
  "success": false,
  "error": "エラーメッセージ",
  "details": "詳細情報（開発環境のみ）"
}
```

## データベース構造

### 使用テーブル
- `member.members` - 部員情報
- `member.teams` - 班情報
- `member.member_team_relations` - 部員⇔班の関係
- `member.team_leaders` - 班長情報
- `member.generation_roles` - 期生⇔Discordロール対応

## セキュリティ

- すべてのAPIエンドポイントはBearer Token認証が必須
- 環境変数で認証トークンを管理
- エラーメッセージで内部情報を露出しない（本番環境）

## ログ

- リクエスト処理のログをタイムスタンプ付きで出力
- エラーログを詳細に記録
- 開発環境ではDEBUGログも出力

## ライセンス

ISC
