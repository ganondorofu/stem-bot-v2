import { Request, Response } from 'express';
import { supabase } from '../utils/supabase';
import { getMember, setNickname } from '../utils/discord';
import { logger } from '../utils/logger';
import { NicknameResponse, NicknameUpdateRequest, NicknameUpdateResponse } from '../types/api';
import { Member } from '../types/database';

// GET /api/nickname - 現在のニックネームを取得
export const getNickname = async (req: Request, res: Response): Promise<void> => {
  try {
    const discord_uid = req.query.discord_uid as string;

    if (!discord_uid) {
      res.status(400).json({ success: false, error: 'discord_uid is required' });
      return;
    }

    const member = await getMember(discord_uid);
    if (!member) {
      res.status(404).json({ success: false, error: 'Discord member not found' });
      return;
    }

    const fullNickname = member.nickname || member.user.username;
    
    // 括弧部分を除去して名前部分を抽出
    const nameOnly = fullNickname.replace(/\([^)]*\)$/, '').trim();

    const response: NicknameResponse = {
      discord_uid,
      full_nickname: fullNickname,
      name_only: nameOnly,
    };

    res.json(response);
  } catch (error) {
    logger.error('Error in getNickname', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// POST /api/nickname/update - ニックネームを更新
export const updateNickname = async (req: Request, res: Response): Promise<void> => {
  try {
    const { discord_uid, name } = req.body as NicknameUpdateRequest;

    if (!discord_uid || !name) {
      res.status(400).json({ 
        success: false, 
        error: 'discord_uid and name are required' 
      });
      return;
    }

    // Discordメンバーを取得
    const member = await getMember(discord_uid);
    if (!member) {
      res.status(404).json({ success: false, error: 'Discord member not found' });
      return;
    }

    // DBから部員情報を取得
    const { data: memberData, error: memberError } = await supabase
      .from('members')
      .select('*')
      .eq('discord_uid', discord_uid)
      .single<Member>();

    if (memberError || !memberData) {
      logger.error('Failed to fetch member from DB', memberError);
      res.status(404).json({ success: false, error: 'Member not found in database' });
      return;
    }

    // ニックネームを整形
    let updatedNickname: string;

    if (memberData.status === 0 || memberData.status === 1) {
      // 在籍中: 名前(学籍番号)
      if (!memberData.student_number) {
        res.status(400).json({ 
          success: false, 
          error: 'Student number is missing for active member' 
        });
        return;
      }
      updatedNickname = `${name}(${memberData.student_number})`;
    } else if (memberData.status === 2) {
      // 卒業生: 名前(generation期卒業生)
      updatedNickname = `${name}(${memberData.generation}期卒業生)`;
    } else {
      res.status(400).json({ success: false, error: 'Invalid member status' });
      return;
    }

    // Discordでニックネームを設定
    const success = await setNickname(member, updatedNickname);

    if (!success) {
      res.status(500).json({ 
        success: false, 
        error: 'Failed to update nickname on Discord' 
      });
      return;
    }

    const response: NicknameUpdateResponse = {
      success: true,
      name,
      updated_nickname: updatedNickname,
    };

    logger.info(`Nickname updated for ${discord_uid}`, response);
    res.json(response);
  } catch (error) {
    logger.error('Error in updateNickname', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};
