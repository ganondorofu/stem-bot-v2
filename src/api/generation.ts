import { Request, Response } from 'express';
import { supabase } from '../utils/supabase';
import { createRole } from '../utils/discord';
import { logger } from '../utils/logger';
import { GenerationCreateRequest, GenerationCreateResponse } from '../types/api';

// POST /api/generation - 期生ロール作成
export const createGeneration = async (req: Request, res: Response): Promise<void> => {
  try {
    const { generation } = req.body as GenerationCreateRequest;

    if (!generation) {
      res.status(400).json({ 
        success: false, 
        error: 'generation is required' 
      });
      return;
    }

    // DBで既に存在するか確認
    const { data: existingRole } = await supabase
      .from('generation_roles')
      .select('*')
      .eq('generation', generation)
      .single();

    if (existingRole) {
      res.status(409).json({ 
        success: false, 
        error: 'Generation role already exists' 
      });
      return;
    }

    // ロール名を自動生成: "52期生"
    const roleName = `${generation}期生`;

    // Discordでロールを作成
    const role = await createRole(roleName);

    if (!role) {
      res.status(500).json({ 
        success: false, 
        error: 'Failed to create role on Discord' 
      });
      return;
    }

    // DBに保存
    const { error: insertError } = await supabase
      .from('generation_roles')
      .insert({
        generation,
        discord_role_id: role.id,
      });

    if (insertError) {
      logger.error('Failed to insert generation role to DB', insertError);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to save generation role to database' 
      });
      return;
    }

    const response: GenerationCreateResponse = {
      success: true,
      role_id: role.id,
      generation,
    };

    logger.info(`Generation role created: ${generation}`, response);
    res.json(response);
  } catch (error) {
    logger.error('Error in createGeneration', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};
