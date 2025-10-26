// API リクエスト/レスポンス型定義

// POST /api/roles/sync
export interface RolesSyncRequest {
  discord_uid: string;
}

export interface RolesSyncResponse {
  success: boolean;
  roles_assigned: string[];
  roles_removed: string[];
}

// GET /api/nickname
export interface NicknameResponse {
  discord_uid: string;
  full_nickname: string;
  name_only: string;
}

// POST /api/nickname/update
export interface NicknameUpdateRequest {
  discord_uid: string;
  name: string;
}

export interface NicknameUpdateResponse {
  success: boolean;
  name: string;
  updated_nickname: string;
}

// POST /api/generation
export interface GenerationCreateRequest {
  generation: number;
}

export interface GenerationCreateResponse {
  success: boolean;
  role_id: string;
  generation: number;
}

// GET /api/member/status
export interface MemberStatusResponse {
  discord_uid: string;
  is_in_server: boolean;
  current_nickname: string | null;
  current_roles: string[];
}

// エラーレスポンス
export interface ErrorResponse {
  success: false;
  error: string;
  details?: string;
}
