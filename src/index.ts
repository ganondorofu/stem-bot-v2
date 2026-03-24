import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { loginDiscordBot, getDiscordClient, getGuildId } from './utils/discord';
import { logger } from './utils/logger';
import { authMiddleware } from './middleware/auth';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { startKeepAlive } from './utils/keepalive';

// APIエンドポイント
import { syncRoles } from './api/rolesSync';
import { syncAllRoles } from './api/rolesSyncAll';
import { getNickname, updateNickname } from './api/nickname';
import { createGeneration } from './api/generation';
import { getMemberStatus } from './api/memberStatus';
import { getAllMembers } from './api/members';
import { assignRole, removeRole, listDiscordRoles } from './api/roles';

const app = express();
const PORT = process.env.PORT || 3000;

// CORS設定
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',')
    : '*', // 本番環境では具体的なオリジンを指定することを推奨
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400, // プリフライトリクエストのキャッシュ時間（24時間）
};

// ミドルウェア
app.use(cors(corsOptions));
app.use(express.json());

// ヘルスチェック（認証不要）
app.get('/health', async (req, res) => {
  try {
    const client = getDiscordClient();
    const wsStatus = client.ws.status;
    const guildId = getGuildId();
    let guildOk = false;
    let guildError = '';
    try {
      const guild = await client.guilds.fetch(guildId);
      guildOk = !!guild;
    } catch (e: any) {
      guildError = e.message || 'Unknown error';
    }
    res.json({
      status: guildOk ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      discord: {
        ws_status: wsStatus,
        bot_user: client.user?.tag || null,
        guild_id: guildId,
        guild_accessible: guildOk,
        guild_error: guildError || undefined,
        guilds_in_cache: client.guilds.cache.map(g => ({ id: g.id, name: g.name })),
      },
    });
  } catch (e) {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), discord: { error: 'Client not initialized' } });
  }
});

// 認証が必要なエンドポイント
app.post('/api/roles/sync', authMiddleware, syncRoles);
app.post('/api/roles/sync-all', authMiddleware, syncAllRoles);
app.post('/api/roles/assign', authMiddleware, assignRole);
app.post('/api/roles/remove', authMiddleware, removeRole);
app.get('/api/roles/discord-list', authMiddleware, listDiscordRoles);
app.get('/api/nickname', authMiddleware, getNickname);
app.post('/api/nickname/update', authMiddleware, updateNickname);
app.post('/api/generation', authMiddleware, createGeneration);
app.get('/api/member/status', authMiddleware, getMemberStatus);
app.get('/api/members', authMiddleware, getAllMembers);

// 404ハンドラー
app.use(notFoundHandler);

// エラーハンドラー
app.use(errorHandler);

// サーバー起動
const startServer = async () => {
  try {
    // Discord Botをログイン
    const discordToken = process.env.DISCORD_TOKEN;
    if (!discordToken) {
      throw new Error('DISCORD_TOKEN is not set in environment variables');
    }

    logger.info('Logging in Discord Bot...');
    await loginDiscordBot(discordToken);

    // Supabaseキープアライブを開始
    startKeepAlive();

    // Expressサーバーを起動
    app.listen(PORT, () => {
      logger.info(`🚀 Server is running on port ${PORT}`);
      logger.info(`API endpoints are ready`);
    });
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
};

startServer();
