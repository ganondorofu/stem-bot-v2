// データベース型定義

export interface Member {
  supabase_auth_user_id: string;
  status: number;
  generation: number;
  student_number: string | null;
  discord_uid: string;
  avatar_url: string | null;
  is_admin: boolean;
  joined_at: string;
  deleted_at: string | null;
}

export interface Team {
  id: string;
  name: string;
  discord_role_id: string;
}

export interface MemberTeamRelation {
  member_id: string;
  team_id: string;
}

export interface TeamLeader {
  team_id: string;
  member_id: string;
}

export interface GenerationRole {
  generation: number;
  discord_role_id: string;
}
