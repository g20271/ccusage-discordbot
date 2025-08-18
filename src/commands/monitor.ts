import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  Message,
  TextChannel
} from 'discord.js';
import { getCcusageData } from '../utils/ccusageData';
import { createUsageEmbed, createNoDataEmbed, createErrorEmbed } from '../utils/embedBuilder';

const activeMonitors = new Map<string, NodeJS.Timeout>();

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
          .setMinValue(5)
          .setMaxValue(300)
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

    const interval = (interaction.options.getInteger('interval') || 15) * 1000;
    await interaction.deferReply();

    let lastMessage: Message | null = null;

    const updateMonitor = async () => {
      try {
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

    const channel = interaction.channel as TextChannel;
    await channel.send(
      `📊 監視を開始しました (更新間隔: ${interval / 1000}秒)\n停止するには \`/monitor stop\` を使用してください。`
    );

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