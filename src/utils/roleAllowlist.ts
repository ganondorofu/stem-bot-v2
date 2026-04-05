import { supabase } from './supabase';
import { logger } from './logger';

/**
 * Builds a set of role IDs that this bot is allowed to manage.
 * Includes:
 * - Generation roles (from generation_roles table)
 * - Team roles (from teams table)
 * - Status/env-configured roles (leader, JH, H, OB, member, verified)
 */
export const getAllowedRoleIds = async (): Promise<Set<string>> => {
  const allowed = new Set<string>();

  // 1. Generation roles from DB
  try {
    const { data: genRoles } = await supabase
      .from('generation_roles')
      .select('discord_role_id');
    if (genRoles) {
      for (const r of genRoles) {
        allowed.add(r.discord_role_id);
      }
    }
  } catch (error) {
    logger.error('Failed to fetch generation roles for allowlist', error);
  }

  // 2. Team roles from DB
  try {
    const { data: teams } = await supabase
      .from('teams')
      .select('discord_role_id');
    if (teams) {
      for (const t of teams) {
        allowed.add(t.discord_role_id);
      }
    }
  } catch (error) {
    logger.error('Failed to fetch team roles for allowlist', error);
  }

  // 3. Environment-configured roles
  const envRoleKeys = [
    'DISCORD_LEADER_ROLE_ID',
    'DISCORD_JH_ROLE_ID',
    'DISCORD_H_ROLE_ID',
    'DISCORD_OB_ROLE_ID',
    'DISCORD_MEMBER_ROLE_ID',
    'DISCORD_VERIFIED_ROLE_ID',
  ];

  for (const key of envRoleKeys) {
    const value = process.env[key];
    if (value) {
      allowed.add(value);
    }
  }

  return allowed;
};
