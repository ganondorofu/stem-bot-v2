import { Request, Response } from 'express';
import { supabase } from '../utils/supabase';
import { getMember, addRoleToMember, removeRoleFromMember } from '../utils/discord';
import { logger } from '../utils/logger';
import { Member, GenerationRole, Team, MemberTeamRelation, TeamLeader } from '../types/database';

/**
 * 全メンバーのロールを一括同期
 * POST /api/roles/sync-all
 */
export const syncAllRoles = async (req: Request, res: Response): Promise<void> => {
  try {
    logger.info('Starting sync for all members...');

    // DBから全メンバーを取得（削除されていないメンバーのみ）
    const { data: members, error: membersError } = await supabase
      .from('members')
      .select('*')
      .is('deleted_at', null);

    if (membersError || !members) {
      logger.error('Failed to fetch members from DB', membersError);
      res.status(500).json({ success: false, error: 'Failed to fetch members from database' });
      return;
    }

    if (members.length === 0) {
      logger.info('No members found in database');
      res.json({ success: true, message: 'No members to sync', synced: 0, failed: 0 });
      return;
    }

    const results = {
      synced: 0,
      failed: 0,
      errors: [] as { discord_uid: string; error: string }[],
    };

    // 各メンバーのロールを同期
    for (const memberData of members as Member[]) {
      try {
        logger.info(`Syncing roles for member: ${memberData.discord_uid}`);

        // Discordメンバーを取得
        const member = await getMember(memberData.discord_uid);
        if (!member) {
          logger.warn(`Discord member not found: ${memberData.discord_uid}`);
          results.failed++;
          results.errors.push({
            discord_uid: memberData.discord_uid,
            error: 'Discord member not found',
          });
          continue;
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
          const hasRole = member.roles.cache.has(generationRole.discord_role_id);
          if (!hasRole) {
            await addRoleToMember(member, generationRole.discord_role_id);
            rolesAssigned.push(generationRole.discord_role_id);
            logger.info(`Added generation role to ${memberData.discord_uid}`);
          }
        }

        // 2. 班ロールの同期
        const { data: memberTeams } = await supabase
          .from('member_team_relations')
          .select('team_id')
          .eq('member_id', memberData.supabase_auth_user_id);

        if (memberTeams && memberTeams.length > 0) {
          const teamIds = memberTeams.map((mt: any) => mt.team_id);
          const { data: teams } = await supabase
            .from('teams')
            .select('*')
            .in('id', teamIds);

          if (teams) {
            for (const team of teams as Team[]) {
              const hasRole = member.roles.cache.has(team.discord_role_id);
              if (!hasRole) {
                await addRoleToMember(member, team.discord_role_id);
                rolesAssigned.push(team.discord_role_id);
                logger.info(`Added team role ${team.name} to ${memberData.discord_uid}`);
              }
            }
          }
        }

        // 3. 班長ロールの同期
        const leaderRoleId = process.env.LEADER_ROLE_ID;
        if (leaderRoleId) {
          const { data: isLeader } = await supabase
            .from('team_leaders')
            .select('*')
            .eq('member_id', memberData.supabase_auth_user_id)
            .single<TeamLeader>();

          const hasLeaderRole = member.roles.cache.has(leaderRoleId);

          if (isLeader && !hasLeaderRole) {
            await addRoleToMember(member, leaderRoleId);
            rolesAssigned.push(leaderRoleId);
            logger.info(`Added leader role to ${memberData.discord_uid}`);
          } else if (!isLeader && hasLeaderRole) {
            await removeRoleFromMember(member, leaderRoleId);
            rolesRemoved.push(leaderRoleId);
            logger.info(`Removed leader role from ${memberData.discord_uid}`);
          }
        }

        // 4. ステータス別ロールの同期（中学生/高校生/OB）
        const jhRoleId = process.env.JH_ROLE_ID;
        const hRoleId = process.env.H_ROLE_ID;
        const obRoleId = process.env.OB_ROLE_ID;

        // 既存のステータスロールを削除
        if (jhRoleId && member.roles.cache.has(jhRoleId)) {
          await removeRoleFromMember(member, jhRoleId);
          rolesRemoved.push(jhRoleId);
        }
        if (hRoleId && member.roles.cache.has(hRoleId)) {
          await removeRoleFromMember(member, hRoleId);
          rolesRemoved.push(hRoleId);
        }
        if (obRoleId && member.roles.cache.has(obRoleId)) {
          await removeRoleFromMember(member, obRoleId);
          rolesRemoved.push(obRoleId);
        }

        // 新しいステータスロールを付与
        let statusRoleId: string | undefined;
        if (memberData.status === 0 && jhRoleId) {
          statusRoleId = jhRoleId;
        } else if (memberData.status === 1 && hRoleId) {
          statusRoleId = hRoleId;
        } else if (memberData.status === 2 && obRoleId) {
          statusRoleId = obRoleId;
        }

        if (statusRoleId) {
          await addRoleToMember(member, statusRoleId);
          rolesAssigned.push(statusRoleId);
          logger.info(`Added status role to ${memberData.discord_uid}`);
        }

        // 5. 部員ロールの同期（中学生・高校生のみ）
        const memberRoleId = process.env.MEMBER_ROLE_ID;
        if (memberRoleId && (memberData.status === 0 || memberData.status === 1)) {
          const hasMemberRole = member.roles.cache.has(memberRoleId);
          if (!hasMemberRole) {
            await addRoleToMember(member, memberRoleId);
            rolesAssigned.push(memberRoleId);
            logger.info(`Added member role to ${memberData.discord_uid}`);
          }
        } else if (memberRoleId && memberData.status === 2) {
          // OBの場合は部員ロールを削除
          const hasMemberRole = member.roles.cache.has(memberRoleId);
          if (hasMemberRole) {
            await removeRoleFromMember(member, memberRoleId);
            rolesRemoved.push(memberRoleId);
            logger.info(`Removed member role from ${memberData.discord_uid}`);
          }
        }

        // 6. 認証済みロールの同期
        const verifiedRoleId = process.env.VERIFIED_ROLE_ID;
        if (verifiedRoleId) {
          const hasVerifiedRole = member.roles.cache.has(verifiedRoleId);
          if (!hasVerifiedRole) {
            await addRoleToMember(member, verifiedRoleId);
            rolesAssigned.push(verifiedRoleId);
            logger.info(`Added verified role to ${memberData.discord_uid}`);
          }
        }

        logger.info(
          `Successfully synced roles for ${memberData.discord_uid} - Assigned: ${rolesAssigned.length}, Removed: ${rolesRemoved.length}`
        );
        results.synced++;
      } catch (error) {
        logger.error(`Failed to sync roles for ${memberData.discord_uid}`, error);
        results.failed++;
        results.errors.push({
          discord_uid: memberData.discord_uid,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    logger.info(
      `Sync completed - Synced: ${results.synced}, Failed: ${results.failed}`
    );

    res.json({
      success: true,
      synced: results.synced,
      failed: results.failed,
      total: members.length,
      errors: results.errors.length > 0 ? results.errors : undefined,
    });
  } catch (error) {
    logger.error('Error in syncAllRoles', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};
