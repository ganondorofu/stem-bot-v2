-- ====================================
-- デバッグ用SQLクエリ集
-- ====================================

-- 1. 全テーブルのデータ件数確認
SELECT 'members' as table_name, COUNT(*) as count FROM member.members
UNION ALL
SELECT 'teams', COUNT(*) FROM member.teams
UNION ALL
SELECT 'member_team_relations', COUNT(*) FROM member.member_team_relations
UNION ALL
SELECT 'team_leaders', COUNT(*) FROM member.team_leaders
UNION ALL
SELECT 'generation_roles', COUNT(*) FROM member.generation_roles;


-- ====================================
-- 2. 部員情報の確認
-- ====================================

-- 全部員一覧
SELECT 
    supabase_auth_user_id,
    discord_uid,
    generation,
    status,
    student_number,
    is_admin,
    joined_at
FROM member.members
ORDER BY generation DESC, joined_at DESC;

-- 特定のdiscord_uidで部員情報を検索（discord_uidを置き換えて使用）
SELECT 
    supabase_auth_user_id,
    discord_uid,
    generation,
    status,
    student_number,
    is_admin
FROM member.members
WHERE discord_uid = 'あなたのdiscord_uid';  -- ← ここを実際の値に置き換え


-- ====================================
-- 3. 班情報の確認
-- ====================================

-- 全班一覧
SELECT 
    id,
    name,
    discord_role_id
FROM member.teams
ORDER BY name;

-- 班ごとのメンバー数
SELECT 
    t.name as 班名,
    COUNT(mtr.member_id) as メンバー数
FROM member.teams t
LEFT JOIN member.member_team_relations mtr ON t.id = mtr.team_id
GROUP BY t.id, t.name
ORDER BY t.name;


-- ====================================
-- 4. 部員⇔班の関係確認
-- ====================================

-- 全ての部員⇔班の関係
SELECT 
    m.discord_uid,
    m.generation,
    m.student_number,
    t.name as 班名,
    t.discord_role_id
FROM member.member_team_relations mtr
JOIN member.members m ON mtr.member_id = m.supabase_auth_user_id
JOIN member.teams t ON mtr.team_id = t.id
ORDER BY m.generation DESC, t.name;

-- 特定の部員が所属する班（discord_uidを置き換えて使用）
SELECT 
    m.discord_uid,
    m.supabase_auth_user_id,
    t.id as team_id,
    t.name as 班名,
    t.discord_role_id
FROM member.members m
LEFT JOIN member.member_team_relations mtr ON m.supabase_auth_user_id = mtr.member_id
LEFT JOIN member.teams t ON mtr.team_id = t.id
WHERE m.discord_uid = 'あなたのdiscord_uid';  -- ← ここを実際の値に置き換え


-- ====================================
-- 5. 班長情報の確認
-- ====================================

-- 全班長一覧
SELECT 
    t.name as 班名,
    m.discord_uid,
    m.generation,
    m.student_number
FROM member.team_leaders tl
JOIN member.teams t ON tl.team_id = t.id
JOIN member.members m ON tl.member_id = m.supabase_auth_user_id
ORDER BY t.name;

-- 特定の部員が班長かどうか確認（discord_uidを置き換えて使用）
SELECT 
    m.discord_uid,
    t.name as 班長の班,
    CASE WHEN tl.member_id IS NOT NULL THEN '班長' ELSE '班長ではない' END as 班長ステータス
FROM member.members m
LEFT JOIN member.team_leaders tl ON m.supabase_auth_user_id = tl.member_id
LEFT JOIN member.teams t ON tl.team_id = t.id
WHERE m.discord_uid = 'あなたのdiscord_uid';  -- ← ここを実際の値に置き換え


-- ====================================
-- 6. 期生ロールの確認
-- ====================================

-- 全期生ロール一覧
SELECT 
    generation,
    discord_role_id
FROM member.generation_roles
ORDER BY generation DESC;

-- 期生別の部員数
SELECT 
    generation,
    COUNT(*) as 人数
FROM member.members
GROUP BY generation
ORDER BY generation DESC;


-- ====================================
-- 7. 完全な部員情報（ロール同期に必要な全情報）
-- ====================================

-- 特定の部員の完全情報（discord_uidを置き換えて使用）
WITH member_info AS (
    SELECT * FROM member.members WHERE discord_uid = 'あなたのdiscord_uid'  -- ← ここを実際の値に置き換え
)
SELECT 
    'メンバー情報' as カテゴリ,
    m.discord_uid,
    m.supabase_auth_user_id,
    m.generation,
    m.status,
    m.student_number,
    m.is_admin,
    NULL as その他
FROM member_info m

UNION ALL

SELECT 
    '期生ロール' as カテゴリ,
    NULL,
    NULL,
    gr.generation,
    NULL,
    NULL,
    NULL,
    gr.discord_role_id
FROM member_info m
JOIN member.generation_roles gr ON m.generation = gr.generation

UNION ALL

SELECT 
    '所属班' as カテゴリ,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    t.name || ' (role_id: ' || t.discord_role_id || ')'
FROM member_info m
LEFT JOIN member.member_team_relations mtr ON m.supabase_auth_user_id = mtr.member_id
LEFT JOIN member.teams t ON mtr.team_id = t.id

UNION ALL

SELECT 
    '班長ステータス' as カテゴリ,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM member.team_leaders tl 
            WHERE tl.member_id = m.supabase_auth_user_id
        ) THEN '班長'
        ELSE '班長ではない'
    END
FROM member_info m;


-- ====================================
-- 8. データ不整合チェック
-- ====================================

-- member_team_relationsで存在しない班を参照している
SELECT 
    'member_team_relations: 存在しない班を参照' as エラー種類,
    mtr.member_id,
    mtr.team_id
FROM member.member_team_relations mtr
LEFT JOIN member.teams t ON mtr.team_id = t.id
WHERE t.id IS NULL;

-- team_leadersで存在しない班を参照している
SELECT 
    'team_leaders: 存在しない班を参照' as エラー種類,
    tl.member_id,
    tl.team_id
FROM member.team_leaders tl
LEFT JOIN member.teams t ON tl.team_id = t.id
WHERE t.id IS NULL;

-- team_leadersで存在しないメンバーを参照している
SELECT 
    'team_leaders: 存在しないメンバーを参照' as エラー種類,
    tl.member_id,
    tl.team_id
FROM member.team_leaders tl
LEFT JOIN member.members m ON tl.member_id = m.supabase_auth_user_id
WHERE m.supabase_auth_user_id IS NULL;


-- ====================================
-- 9. テストデータ投入用SQL（必要に応じて使用）
-- ====================================

-- 注意: 実際のデータを入れる場合は値を置き換えてください

-- テスト用の班を作成
-- INSERT INTO member.teams (name, discord_role_id) VALUES 
-- ('開発班', 'your_discord_role_id_1'),
-- ('企画班', 'your_discord_role_id_2'),
-- ('広報班', 'your_discord_role_id_3');

-- テスト用の期生ロールを作成
-- INSERT INTO member.generation_roles (generation, discord_role_id) VALUES 
-- (52, 'your_52_generation_role_id'),
-- (51, 'your_51_generation_role_id');

