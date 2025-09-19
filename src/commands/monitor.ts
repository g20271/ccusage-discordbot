import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  Message,
  TextChannel
} from 'discord.js';
import { getCcusageData } from '../utils/ccusageData';
import { createUsageEmbed, createNoDataEmbed, createErrorEmbed } from '../utils/embedBuilder';
import logger from '../logger';

const activeMonitors = new Map<string, NodeJS.Timeout>();
const lastUpdateTime = new Map<string, number>();
const RATE_LIMIT_DELAY = 60000; // 1分間隔の強制レート制限

export const data = new SlashCommandBuilder()
  .setName('monitor')
  .setDescription('Claude Code使用状況のリアルタイム監視')
  .addSubcommand(subcommand =>
    subcommand
      .setName('start')
      .setDescription('監視を開始')
      .addIntegerOption(option =>
        option
          .setName('interval')
          .setDescription('更新間隔（秒）')
          .setMinValue(60)
          .setMaxValue(3600)
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('stop')
      .setDescription('監視を停止')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('once')
      .setDescription('現在の状況を1回だけ表示')
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();
  const channelId = interaction.channelId;

  if (subcommand === 'start') {
    if (activeMonitors.has(channelId)) {
      await interaction.reply({
        embeds: [createErrorEmbed('このチャンネルでは既に監視が実行中です。')],
        ephemeral: true
      });
      return;
    }

    const interval = Math.max((interaction.options.getInteger('interval') || 60) * 1000, RATE_LIMIT_DELAY);
    await interaction.deferReply();

    let lastMessage: Message | null = null;

    const updateMonitor = async () => {
      try {
        // レート制限チェック
        const now = Date.now();
        const lastUpdate = lastUpdateTime.get(channelId) || 0;
        if (now - lastUpdate < RATE_LIMIT_DELAY) {
          logger.debug(`Rate limit skip for channel ${channelId}`);
          return;
        }
        lastUpdateTime.set(channelId, now);

        logger.debug(`Updating monitor for channel ${channelId}`);
        const data = await getCcusageData();
        
        if (!data || data.blocks.length === 0) {
          const embed = createNoDataEmbed();
          if (lastMessage) {
            await lastMessage.edit({ embeds: [embed] });
          } else {
            lastMessage = await interaction.editReply({ embeds: [embed] });
          }
          return;
        }

        const activeBlock = data.blocks.find(b => b.isActive);
        if (!activeBlock) {
          const embed = createNoDataEmbed();
          if (lastMessage) {
            await lastMessage.edit({ embeds: [embed] });
          } else {
            lastMessage = await interaction.editReply({ embeds: [embed] });
          }
          return;
        }

        const embed = createUsageEmbed(activeBlock);
        
        if (lastMessage) {
          await lastMessage.edit({ embeds: [embed] });
        } else {
          lastMessage = await interaction.editReply({ embeds: [embed] });
        }
      } catch (error) {
        console.error('Error updating monitor:', error);
        logger.error('Monitor update error:', error);

        // APIエラーの場合は長時間待機
        if (error instanceof Error && error.message.includes('429')) {
          logger.warn('Rate limited by Discord API, extending delay');
          lastUpdateTime.set(channelId, Date.now() + 300000); // 5分間追加待機
        }
        const errorEmbed = createErrorEmbed('データの取得中にエラーが発生しました。');
        if (lastMessage) {
          await lastMessage.edit({ embeds: [errorEmbed] });
        } else {
          await interaction.editReply({ embeds: [errorEmbed] });
        }
      }
    };

    await updateMonitor();

    const intervalId = setInterval(updateMonitor, interval);
    activeMonitors.set(channelId, intervalId);

    // 初回実行後にメッセージ送信
    setTimeout(async () => {
      try {
        const channel = interaction.channel as TextChannel;
        await channel.send(
          `📊 監視を開始しました (更新間隔: ${interval / 1000}秒)\n⚠️ Discord API制限により実際の更新は最低1分間隔です\n停止するには \`/monitor stop\` を使用してください。`
        );
        logger.info(`Monitor started for channel ${channelId} with ${interval/1000}s interval`);
      } catch (error) {
        logger.error('Failed to send monitor start message:', error);
      }
    }, 1000);

  } else if (subcommand === 'stop') {
    const intervalId = activeMonitors.get(channelId);
    
    if (!intervalId) {
      await interaction.reply({
        embeds: [createErrorEmbed('このチャンネルでは監視が実行されていません。')],
        ephemeral: true
      });
      return;
    }

    clearInterval(intervalId);
    activeMonitors.delete(channelId);
    lastUpdateTime.delete(channelId);
    logger.info(`Monitor stopped for channel ${channelId}`);

    await interaction.reply({
      content: '⏹️ 監視を停止しました。',
      ephemeral: false
    });

  } else if (subcommand === 'once') {
    await interaction.deferReply();

    try {
      const data = await getCcusageData();
      
      if (!data || data.blocks.length === 0) {
        await interaction.editReply({ embeds: [createNoDataEmbed()] });
        return;
      }

      const activeBlock = data.blocks.find(b => b.isActive);
      if (!activeBlock) {
        await interaction.editReply({ embeds: [createNoDataEmbed()] });
        return;
      }

      const embed = createUsageEmbed(activeBlock);
      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error getting usage data:', error);
      logger.error('One-time usage data error:', error);
      await interaction.editReply({
        embeds: [createErrorEmbed('データの取得中にエラーが発生しました。')]
      });
    }
  }
}

export function cleanupMonitors() {
  for (const intervalId of activeMonitors.values()) {
    clearInterval(intervalId);
  }
  activeMonitors.clear();
}