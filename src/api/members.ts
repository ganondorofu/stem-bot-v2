import { Request, Response } from 'express';
import { supabase } from '../utils/supabase';
import { logger } from '../utils/logger';
import { getDiscordClient } from '../utils/discord';

/**
 * 全メンバーの名前とUIDを取得
 * GET /api/members
 */
export const getAllMembers = async (req: Request, res: Response) => {
  try {
    // Pagination support
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
    const offset = (page - 1) * limit;

    logger.info(`Fetching members page=${page} limit=${limit}...`);

    // Get total count first
    const { count: totalCount, error: countError } = await supabase
      .from('members')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null);

    if (countError) {
      logger.error('Failed to count members', countError);
      return res.status(500).json({ success: false, error: 'Failed to count members' });
    }

    // Supabaseからメンバーを取得（ページネーション付き）
    const { data: members, error } = await supabase
      .from('members')
      .select('discord_uid, student_number, generation, status, deleted_at')
      .is('deleted_at', null) // 削除されていないメンバーのみ
      .order('generation', { ascending: false })
      .order('student_number', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      logger.error('Failed to fetch members from database', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch members from database',
      });
    }

    if (!members || members.length === 0) {
      logger.info('No members found in database');
      return res.json({
        success: true,
        data: [],
      });
    }

    // Discord Clientを取得
    const client = getDiscordClient();
    const guildId = process.env.DISCORD_GUILD_ID;
    if (!guildId) {
      logger.error('DISCORD_GUILD_ID is not set');
      return res.status(500).json({
        success: false,
        error: 'Server configuration error',
      });
    }

    const guild = await client.guilds.fetch(guildId);

    // 各メンバーのニックネームを取得
    const memberList = await Promise.all(
      members.map(async (member: any) => {
        try {
          // Discordメンバー情報を取得
          const discordMember = await guild.members.fetch(member.discord_uid);
          
          // ニックネームから名前部分を抽出
          // 形式: "名前(学籍番号)" または "名前(XX期卒業生)"
          const displayName = discordMember.nickname || discordMember.user.displayName;
          let name = displayName;
          
          // カッコの前までを名前として抽出
          const match = displayName.match(/^(.+?)(?:\(|（)/);
          if (match) {
            name = match[1].trim();
          }

          return {
            uid: member.discord_uid,
            name: name,
            username: discordMember.user.username,
          };
        } catch (err) {
          // メンバーが見つからない場合はスキップ
          logger.warn(`Discord member not found: ${member.discord_uid}`);
          return null;
        }
      })
    );

    // nullを除外
    const validMembers = memberList.filter((m) => m !== null);

    logger.info(`Successfully fetched ${validMembers.length} members (page ${page})`);

    return res.json({
      success: true,
      data: validMembers,
      pagination: {
        page,
        limit,
        total: totalCount ?? 0,
        total_pages: Math.ceil((totalCount ?? 0) / limit),
      },
    });
  } catch (error) {
    logger.error('Error in getAllMembers', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};
