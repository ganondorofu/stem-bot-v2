import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { logger } from '../utils/logger';

// Bearer Token認証ミドルウェア
export const authMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ 
      success: false, 
      error: 'Unauthorized: Bearer token required' 
    });
    return;
  }

  const token = authHeader.substring(7); // "Bearer "を除去

  // 環境変数からAPIトークンを取得
  const validToken = process.env.API_AUTH_TOKEN;

  if (!validToken) {
    logger.error('API_AUTH_TOKEN is not set in environment variables');
    res.status(500).json({ 
      success: false, 
      error: 'Server configuration error' 
    });
    return;
  }

  // Use constant-time comparison to prevent timing attacks
  const tokenBuffer = Buffer.from(token);
  const validTokenBuffer = Buffer.from(validToken);
  if (tokenBuffer.length !== validTokenBuffer.length || !crypto.timingSafeEqual(tokenBuffer, validTokenBuffer)) {
    logger.warn(`Invalid token attempt from ${req.ip}`);
    res.status(401).json({
      success: false,
      error: 'Unauthorized: Invalid token'
    });
    return;
  }

  next();
};
