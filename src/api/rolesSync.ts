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

    // 4. Status別ロールの同期（中学生/高校生/OB）
    const jhRoleId = process.env.DISCORD_JH_ROLE_ID;
    const hRoleId = process.env.DISCORD_H_ROLE_ID;
    const obRoleId = process.env.DISCORD_OB_ROLE_ID;
    const statusRoleIds = [jhRoleId, hRoleId, obRoleId].filter(Boolean) as string[];

    // 現在のstatusに応じたロールを決定
    let targetStatusRoleId: string | null = null;
    let statusRoleName = '';

    if (memberData.status === 0 && jhRoleId) {
      targetStatusRoleId = jhRoleId;
      statusRoleName = '中学生';
    } else if (memberData.status === 1 && hRoleId) {
      targetStatusRoleId = hRoleId;
      statusRoleName = '高校生';
    } else if (memberData.status === 2 && obRoleId) {
      targetStatusRoleId = obRoleId;
      statusRoleName = 'OB';
    }

    // 正しいstatusロールを付与
    if (targetStatusRoleId) {
      if (!member.roles.cache.has(targetStatusRoleId)) {
        await addRoleToMember(member, targetStatusRoleId);
        rolesAssigned.push(statusRoleName);
      }
    }

    // 他のstatusロールを削除
    for (const roleId of statusRoleIds) {
      if (roleId !== targetStatusRoleId && member.roles.cache.has(roleId)) {
        await removeRoleFromMember(member, roleId);
        const removedName = roleId === jhRoleId ? '中学生' : roleId === hRoleId ? '高校生' : 'OB';
        rolesRemoved.push(removedName);
      }
    }

    // 5. 部員ロール（MEMBERロール）の同期
    const memberRoleId = process.env.DISCORD_MEMBER_ROLE_ID;
    if (memberRoleId) {
      // status 0 or 1（中学生・高校生）の場合のみ付与
      if (memberData.status === 0 || memberData.status === 1) {
        if (!member.roles.cache.has(memberRoleId)) {
          await addRoleToMember(member, memberRoleId);
          rolesAssigned.push('部員');
        }
      } else {
        // status 2（OB）の場合は削除
        if (member.roles.cache.has(memberRoleId)) {
          await removeRoleFromMember(member, memberRoleId);
          rolesRemoved.push('部員');
        }
      }
    }

    // 6. 認証済みロール（VERIFIEDロール）の付与
    const verifiedRoleId = process.env.DISCORD_VERIFIED_ROLE_ID;
    if (verifiedRoleId) {
      // DBに登録されていれば付与
      if (!member.roles.cache.has(verifiedRoleId)) {
        await addRoleToMember(member, verifiedRoleId);
        rolesAssigned.push('認証済み');
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
