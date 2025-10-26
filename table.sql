-- 既存テーブル削除
DROP TABLE IF EXISTS member.generation_roles CASCADE;
DROP TABLE IF EXISTS member.team_leaders CASCADE;
DROP TABLE IF EXISTS member.member_team_relations CASCADE;
DROP TABLE IF EXISTS member.teams CASCADE;
DROP TABLE IF EXISTS member.members CASCADE;
DROP SCHEMA IF EXISTS member CASCADE;

-- スキーマ作成
CREATE SCHEMA IF NOT EXISTS member;

-- 部員テーブル
CREATE TABLE member.members (
    supabase_auth_user_id UUID PRIMARY KEY,
    status INTEGER NOT NULL,
    generation INTEGER NOT NULL,
    student_number TEXT,
    discord_uid TEXT UNIQUE NOT NULL,
    avatar_url TEXT,
    is_admin BOOLEAN NOT NULL DEFAULT FALSE,
    joined_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT fk_supabase_auth_user_id FOREIGN KEY (supabase_auth_user_id)
        REFERENCES auth.users(id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- 班テーブル
CREATE TABLE member.teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    discord_role_id TEXT NOT NULL
);

-- 部員⇔班の関係（多対多）
CREATE TABLE member.member_team_relations (
    member_id UUID NOT NULL REFERENCES member.members(supabase_auth_user_id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES member.teams(id) ON DELETE CASCADE,
    PRIMARY KEY (member_id, team_id)
);

-- 班長テーブル（複数班長対応）
CREATE TABLE member.team_leaders (
    team_id UUID NOT NULL REFERENCES member.teams(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES member.members(supabase_auth_user_id) ON DELETE CASCADE,
    PRIMARY KEY (team_id, member_id)
);

-- 期生⇔Discord Role対応テーブル
CREATE TABLE member.generation_roles (
    generation INTEGER PRIMARY KEY,
    discord_role_id TEXT NOT NULL
);

-- インデックス
CREATE INDEX ON member.members(status);
CREATE INDEX ON member.members(discord_uid);
CREATE INDEX ON member.members(is_admin);
CREATE INDEX ON member.teams(discord_role_id);
CREATE INDEX ON member.member_team_relations(member_id);
CREATE INDEX ON member.member_team_relations(team_id);
CREATE INDEX ON member.team_leaders(team_id);
CREATE INDEX ON member.team_leaders(member_id);
CREATE INDEX ON member.generation_roles(discord_role_id);
