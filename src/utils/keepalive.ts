import { supabase } from './supabase';
import { logger } from './logger';

/**
 * Supabaseのアーカイブ防止用定期アクセス
 * 7日間ごとにデータベースにアクセスしてアクティブ状態を維持
 */
export const startKeepAlive = () => {
  const INTERVAL = 6 * 60 * 60 * 1000; // 6時間ごと（ミリ秒）

  // 初回実行
  performKeepAlive();

  // 定期実行
  setInterval(() => {
    performKeepAlive();
  }, INTERVAL);

  logger.info(`✅ Supabase keep-alive started (interval: ${INTERVAL / 1000 / 60 / 60} hours)`);
};

/**
 * 実際のキープアライブ処理
 */
const performKeepAlive = async () => {
  try {
    // teamsテーブルの件数を取得（軽量なクエリ）
    const { count, error } = await supabase
      .from('teams')
      .select('*', { count: 'exact', head: true });

    if (error) {
      logger.error('Keep-alive query failed', error);
    } else {
      logger.info(`✅ Supabase keep-alive: teams table has ${count} records`);
    }
  } catch (error) {
    logger.error('Keep-alive error', error);
  }
};
