import { Request, Response } from 'express';
import { supabase } from '../utils/supabase';
import { getMember, addRoleToMember, removeRoleFromMember } from '../utils/discord';
import { logger } from '../utils/logger';
import { RolesSyncRequest, RolesSyncResponse } from '../types/api';
import { Member, GenerationRole, Team, MemberTeamRelation, TeamLeader } from '../types/database';

export const syncRoles = async (req: Request, res: Response): Promise<void> => {
  try {
    const { discord_uid } = req.body as RolesSyncRequest;

    if (!discord_uid) {
      res.status(400).json({ success: false, error: 'discord_uid is required' });
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

    const rolesAssigned: string[] = [];
    const rolesRemoved: string[] = [];

    // 1. 期生ロールの同期
    const { data: generationRole } = await supabase
      .from('generation_roles')
      .select('*')
      .eq('generation', memberData.generation)
      .single<GenerationRole>();

    if (generationRole) {
      // 期生ロールを付与
      const hasRole = member.roles.cache.has(generationRole.discord_role_id);
      if (!hasRole) {
        await addRoleToMember(member, generationRole.discord_role_id);
        rolesAssigned.push(`${memberData.generation}期生`);
      }

      // 他の期生ロールを削除
      const { data: allGenerationRoles } = await supabase
        .from('generation_roles')
        .select('*')
        .neq('generation', memberData.generation);

      if (allGenerationRoles) {
        for (const otherGenRole of allGenerationRoles) {
          if (member.roles.cache.has(otherGenRole.discord_role_id)) {
            await removeRoleFromMember(member, otherGenRole.discord_role_id);
            rolesRemoved.push(`${otherGenRole.generation}期生`);
          }
        }
      }
    }

    // 2. 班ロールの同期
    // メンバーが所属する班を取得
    const { data: memberTeams } = await supabase
      .from('member_team_relations')
      .select('team_id')
      .eq('member_id', memberData.supabase_auth_user_id);

    const teamIds = memberTeams?.map((mt: { team_id: string }) => mt.team_id) || [];

    // 所属班のロールを取得
    const { data: teams } = await supabase
      .from('teams')
      .select('*')
      .in('id', teamIds);

    const teamRoleIds = teams?.map((t: Team) => t.discord_role_id) || [];

    // 所属班のロールを付与
    for (const team of teams || []) {
      if (!member.roles.cache.has(team.discord_role_id)) {
        await addRoleToMember(member, team.discord_role_id);
        rolesAssigned.push(team.name);
      }
    }

    // 全ての班を取得
    const { data: allTeams } = await supabase.from('teams').select('*');

    // 所属していない班のロールを削除
    for (const team of allTeams || []) {
      if (
        !teamRoleIds.includes(team.discord_role_id) &&
        member.roles.cache.has(team.discord_role_id)
      ) {
        await removeRoleFromMember(member, team.discord_role_id);
        rolesRemoved.push(team.name);
      }
    }

    // 3. 班長ロールの同期
    const leaderRoleId = process.env.DISCORD_LEADER_ROLE_ID;
    if (leaderRoleId) {
      const { data: isLeader } = await supabase
        .from('team_leaders')
        .select('*')
        .eq('member_id', memberData.supabase_auth_user_id)
        .single<TeamLeader>();

      if (isLeader) {
        // 班長ロールを付与
        if (!member.roles.cache.has(leaderRoleId)) {
          await addRoleToMember(member, leaderRoleId);
          rolesAssigned.push('班長');
        }
      } else {
        // 班長ロールを削除
        if (member.roles.cache.has(leaderRoleId)) {
          await removeRoleFromMember(member, leaderRoleId);
          rolesRemoved.push('班長');
        }
      }
    }

    const response: RolesSyncResponse = {
      success: true,
      roles_assigned: rolesAssigned,
      roles_removed: rolesRemoved,
    };

    logger.info(`Roles synced for ${discord_uid}`, response);
    res.json(response);
  } catch (error) {
    logger.error('Error in syncRoles', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};
