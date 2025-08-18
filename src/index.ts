import { Client, Collection, Events, GatewayIntentBits, REST, Routes } from 'discord.js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as monitorCommand from './commands/monitor';

dotenv.config();

interface Command {
  data: any;
  execute: (interaction: any) => Promise<void>;
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const commands = new Collection<string, Command>();
commands.set(monitorCommand.data.name, monitorCommand);

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`✅ ログイン完了: ${readyClient.user.tag}`);
  
  try {
    const rest = new REST().setToken(process.env.DISCORD_TOKEN!);
    
    console.log('📝 スラッシュコマンドを登録中...');
    
    const commandData = Array.from(commands.values()).map(cmd => cmd.data.toJSON());
    
    if (process.env.DISCORD_GUILD_ID) {
      await rest.put(
        Routes.applicationGuildCommands(
          process.env.DISCORD_CLIENT_ID!,
          process.env.DISCORD_GUILD_ID
        ),
        { body: commandData }
      );
      console.log(`✅ ギルド ${process.env.DISCORD_GUILD_ID} にコマンドを登録しました`);
    } else {
      await rest.put(
        Routes.applicationCommands(process.env.DISCORD_CLIENT_ID!),
        { body: commandData }
      );
      console.log('✅ グローバルコマンドを登録しました');
    }
  } catch (error) {
    console.error('コマンド登録エラー:', error);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = commands.get(interaction.commandName);

  if (!command) {
    console.error(`コマンドが見つかりません: ${interaction.commandName}`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error('コマンド実行エラー:', error);
    
    const errorMessage = {
      content: 'コマンドの実行中にエラーが発生しました。',
      ephemeral: true
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(errorMessage);
    } else {
      await interaction.reply(errorMessage);
    }
  }
});

process.on('SIGINT', () => {
  console.log('\n👋 シャットダウン中...');
  monitorCommand.cleanupMonitors();
  client.destroy();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 シャットダウン中...');
  monitorCommand.cleanupMonitors();
  client.destroy();
  process.exit(0);
});

if (!process.env.DISCORD_TOKEN) {
  console.error('❌ DISCORD_TOKENが設定されていません');
  process.exit(1);
}

if (!process.env.DISCORD_CLIENT_ID) {
  console.error('❌ DISCORD_CLIENT_IDが設定されていません');
  process.exit(1);
}

client.login(process.env.DISCORD_TOKEN).catch((error) => {
  console.error('❌ ログインエラー:', error);
  process.exit(1);
});