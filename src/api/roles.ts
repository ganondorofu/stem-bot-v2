import { Request, Response } from 'express';
import { getMember, addRoleToMember, removeRoleFromMember, getAllDiscordRoles } from '../utils/discord';
import { logger } from '../utils/logger';
import { 
  RoleAssignRequest, 
  RoleAssignResponse, 
  RoleRemoveRequest, 
  RoleRemoveResponse,
  DiscordRoleListResponse 
} from '../types/api';

// POST /api/roles/assign - ロール付与
export const assignRole = async (req: Request, res: Response): Promise<void> => {
  try {
    const { discord_uid, discord_role_id } = req.body as RoleAssignRequest;

    if (!discord_uid || !discord_role_id) {
      res.status(400).json({ 
        success: false, 
        error: 'discord_uid and discord_role_id are required' 
      });
      return;
    }

    // Discordメンバーを取得
    const member = await getMember(discord_uid);
    if (!member) {
      res.status(404).json({ success: false, error: 'Discord member not found' });
      return;
    }

    // ロールを付与
    const success = await addRoleToMember(member, discord_role_id);
    if (!success) {
      res.status(500).json({ success: false, error: 'Failed to assign role' });
      return;
    }

    const response: RoleAssignResponse = { success: true };
    logger.info(`Role ${discord_role_id} assigned to ${discord_uid}`);
    res.json(response);
  } catch (error) {
    logger.error('Error in assignRole', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// POST /api/roles/remove - ロール削除
export const removeRole = async (req: Request, res: Response): Promise<void> => {
  try {
    const { discord_uid, discord_role_id } = req.body as RoleRemoveRequest;

    if (!discord_uid || !discord_role_id) {
      res.status(400).json({ 
        success: false, 
        error: 'discord_uid and discord_role_id are required' 
      });
      return;
    }

    // Discordメンバーを取得
    const member = await getMember(discord_uid);
    if (!member) {
      res.status(404).json({ success: false, error: 'Discord member not found' });
      return;
    }

    // ロールを削除
    const success = await removeRoleFromMember(member, discord_role_id);
    if (!success) {
      res.status(500).json({ success: false, error: 'Failed to remove role' });
      return;
    }

    const response: RoleRemoveResponse = { success: true };
    logger.info(`Role ${discord_role_id} removed from ${discord_uid}`);
    res.json(response);
  } catch (error) {
    logger.error('Error in removeRole', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// GET /api/roles/discord-list - Discord上の全ロール取得
export const listDiscordRoles = async (req: Request, res: Response): Promise<void> => {
  try {
    const roles = await getAllDiscordRoles();
    
    if (!roles) {
      res.status(500).json({ success: false, error: 'Failed to fetch Discord roles' });
      return;
    }

    const response: DiscordRoleListResponse = {
      success: true,
      roles,
    };

    logger.info(`Retrieved ${roles.length} Discord roles`);
    res.json(response);
  } catch (error) {
    logger.error('Error in listDiscordRoles', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};
