import { Request, Response } from 'express';
import { getMember } from '../utils/discord';
import { logger } from '../utils/logger';
import { MemberStatusResponse } from '../types/api';

// GET /api/member/status - Discord在籍確認
export const getMemberStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const discord_uid = req.query.discord_uid as string;

    if (!discord_uid) {
      res.status(400).json({ success: false, error: 'discord_uid is required' });
      return;
    }

    const member = await getMember(discord_uid);

    if (!member) {
      const response: MemberStatusResponse = {
        discord_uid,
        is_in_server: false,
        current_nickname: null,
        current_roles: [],
      };
      res.json(response);
      return;
    }

    const currentNickname = member.nickname || member.user.username;
    const currentRoles = member.roles.cache.map(role => role.name).filter(name => name !== '@everyone');

    const response: MemberStatusResponse = {
      discord_uid,
      is_in_server: true,
      current_nickname: currentNickname,
      current_roles: currentRoles,
    };

    res.json(response);
  } catch (error) {
    logger.error('Error in getMemberStatus', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};
