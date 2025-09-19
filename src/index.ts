import { Client, Collection, Events, GatewayIntentBits, REST, Routes } from 'discord.js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import * as monitorCommand from './commands/monitor';
import logger from './logger';
import { systemMonitor } from './utils/systemMonitor';

dotenv.config();

// ログディレクトリの作成
const logDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

logger.info('Discord Bot starting up...');

// システム監視開始（30秒間隔）
systemMonitor.start(30000);

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
  const message = `✅ ログイン完了: ${readyClient.user.tag}`;
  console.log(message);
  logger.info(message);
  logger.info(`Bot ready - PID: ${process.pid}, Memory: ${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`);
  
  try {
    const rest = new REST().setToken(process.env.DISCORD_TOKEN!);
    
    const registerMessage = '📝 スラッシュコマンドを登録中...';
    console.log(registerMessage);
    logger.info(registerMessage);
    
    const commandData = Array.from(commands.values()).map(cmd => cmd.data.toJSON());
    
    if (process.env.DISCORD_GUILD_ID) {
      await rest.put(
        Routes.applicationGuildCommands(
          process.env.DISCORD_CLIENT_ID!,
          process.env.DISCORD_GUILD_ID
        ),
        { body: commandData }
      );
      const guildMessage = `✅ ギルド ${process.env.DISCORD_GUILD_ID} にコマンドを登録しました`;
      console.log(guildMessage);
      logger.info(guildMessage);
    } else {
      await rest.put(
        Routes.applicationCommands(process.env.DISCORD_CLIENT_ID!),
        { body: commandData }
      );
      const globalMessage = '✅ グローバルコマンドを登録しました';
      console.log(globalMessage);
      logger.info(globalMessage);
    }
  } catch (error) {
    console.error('コマンド登録エラー:', error);
    logger.error('コマンド登録エラー:', error);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = commands.get(interaction.commandName);

  if (!command) {
    const errorMsg = `コマンドが見つかりません: ${interaction.commandName}`;
    console.error(errorMsg);
    logger.error(errorMsg);
    return;
  }

  try {
    logger.debug(`Executing command: ${interaction.commandName}`);
    await command.execute(interaction);
  } catch (error) {
    console.error('コマンド実行エラー:', error);
    logger.error('コマンド実行エラー:', error);
    
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
  const shutdownMsg = '\n👋 シャットダウン中... (SIGINT)';
  console.log(shutdownMsg);
  logger.info(shutdownMsg);
  systemMonitor.stop();
  monitorCommand.cleanupMonitors();
  client.destroy();
  process.exit(0);
});

process.on('SIGTERM', () => {
  const shutdownMsg = '\n👋 シャットダウン中... (SIGTERM)';
  console.log(shutdownMsg);
  logger.info(shutdownMsg);
  systemMonitor.stop();
  monitorCommand.cleanupMonitors();
  client.destroy();
  process.exit(0);
});

if (!process.env.DISCORD_TOKEN) {
  const tokenError = '❌ DISCORD_TOKENが設定されていません';
  console.error(tokenError);
  logger.error(tokenError);
  process.exit(1);
}

if (!process.env.DISCORD_CLIENT_ID) {
  const clientIdError = '❌ DISCORD_CLIENT_IDが設定されていません';
  console.error(clientIdError);
  logger.error(clientIdError);
  process.exit(1);
}

// 追加のプロセス監視
process.on('disconnect', () => {
  logger.warn('Process disconnected from parent');
});

process.on('beforeExit', (code) => {
  logger.info(`Process about to exit with code: ${code}`);
  systemMonitor.stop();
});

// メモリ使用量の定期チェック
setInterval(() => {
  const memUsage = process.memoryUsage();
  const heapPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
  if (heapPercent > 90) {
    logger.error(`CRITICAL_HEAP_USAGE: ${heapPercent.toFixed(1)}% - Potential memory leak!`);
  }
}, 60000); // 1分間隔

logger.info('Attempting to login to Discord...');
client.login(process.env.DISCORD_TOKEN).catch((error) => {
  console.error('❌ ログインエラー:', error);
  logger.error('❌ ログインエラー:', error);
  systemMonitor.stop();
  process.exit(1);
});