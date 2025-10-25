import { Client, GatewayIntentBits, GuildMember, Role } from 'discord.js';
import { logger } from './logger';

let client: Client | null = null;

export const initializeDiscordClient = (): Client => {
  if (client) {
    return client;
  }

  client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
    ],
  });

  client.once('ready', () => {
    logger.info(`✅ Discord Bot is online! Logged in as ${client?.user?.tag}`);
  });

  return client;
};

export const getDiscordClient = (): Client => {
  if (!client) {
    throw new Error('Discord client is not initialized');
  }
  return client;
};

export const loginDiscordBot = async (token: string): Promise<void> => {
  const discordClient = initializeDiscordClient();
  await discordClient.login(token);
};

// Discord ギルド（サーバー）IDを環境変数から取得
export const getGuildId = (): string => {
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!guildId) {
    throw new Error('DISCORD_GUILD_ID is not set in environment variables');
  }
  return guildId;
};

// メンバーを取得
export const getMember = async (discordUid: string): Promise<GuildMember | null> => {
  try {
    const client = getDiscordClient();
    const guildId = getGuildId();
    const guild = await client.guilds.fetch(guildId);
    const member = await guild.members.fetch(discordUid);
    return member;
  } catch (error) {
    logger.error('Failed to fetch Discord member', error);
    return null;
  }
};

// ロールを取得
export const getRole = async (roleId: string): Promise<Role | null> => {
  try {
    const client = getDiscordClient();
    const guildId = getGuildId();
    const guild = await client.guilds.fetch(guildId);
    const role = await guild.roles.fetch(roleId);
    return role;
  } catch (error) {
    logger.error('Failed to fetch Discord role', error);
    return null;
  }
};

// ロールを作成
export const createRole = async (name: string): Promise<Role | null> => {
  try {
    const client = getDiscordClient();
    const guildId = getGuildId();
    const guild = await client.guilds.fetch(guildId);
    const role = await guild.roles.create({ name });
    logger.info(`Created role: ${name} (${role.id})`);
    return role;
  } catch (error) {
    logger.error('Failed to create Discord role', error);
    return null;
  }
};

// メンバーにロールを付与
export const addRoleToMember = async (
  member: GuildMember,
  roleId: string
): Promise<boolean> => {
  try {
    await member.roles.add(roleId);
    logger.info(`Added role ${roleId} to member ${member.user.tag}`);
    return true;
  } catch (error) {
    logger.error('Failed to add role to member', error);
    return false;
  }
};

// メンバーからロールを削除
export const removeRoleFromMember = async (
  member: GuildMember,
  roleId: string
): Promise<boolean> => {
  try {
    await member.roles.remove(roleId);
    logger.info(`Removed role ${roleId} from member ${member.user.tag}`);
    return true;
  } catch (error) {
    logger.error('Failed to remove role from member', error);
    return false;
  }
};

// ニックネームを設定
export const setNickname = async (
  member: GuildMember,
  nickname: string
): Promise<boolean> => {
  try {
    await member.setNickname(nickname);
    logger.info(`Set nickname for ${member.user.tag} to: ${nickname}`);
    return true;
  } catch (error) {
    logger.error('Failed to set nickname', error);
    return false;
  }
};
