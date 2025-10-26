import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { loginDiscordBot } from './utils/discord';
import { logger } from './utils/logger';
import { authMiddleware } from './middleware/auth';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { startKeepAlive } from './utils/keepalive';

// APIエンドポイント
import { syncRoles } from './api/rolesSync';
import { getNickname, updateNickname } from './api/nickname';
import { createGeneration } from './api/generation';
import { getMemberStatus } from './api/memberStatus';

const app = express();
const PORT = process.env.PORT || 3000;

// ミドルウェア
app.use(cors());
app.use(express.json());

// ヘルスチェック（認証不要）
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 認証が必要なエンドポイント
app.post('/api/roles/sync', authMiddleware, syncRoles);
app.get('/api/nickname', authMiddleware, getNickname);
app.post('/api/nickname/update', authMiddleware, updateNickname);
app.post('/api/generation', authMiddleware, createGeneration);
app.get('/api/member/status', authMiddleware, getMemberStatus);

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
