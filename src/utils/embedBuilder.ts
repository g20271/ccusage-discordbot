import { EmbedBuilder } from 'discord.js';
import { Block } from '../types/ccusage';
import {
  formatTokensWithUnits,
  formatTime,
  getElapsedTime,
  getBurnRateStatus,
  getProgressBar,
  formatNumber
} from './ccusageData';

export function createUsageEmbed(block: Block): EmbedBuilder {
  const burnRateStatus = getBurnRateStatus(block.burnRate.tokensPerMinute);
  const elapsedTime = getElapsedTime(block.startTime);
  const startTime = new Date(block.startTime);
  const endTime = new Date(block.endTime);
  
  const sessionProgress = calculateSessionProgress(block);
  const usageProgress = (block.totalTokens / 119433347) * 100;
  const projectionProgress = (block.projection.totalTokens / 119433347) * 100;

  const embed = new EmbedBuilder()
    .setTitle('🤖 CLAUDE CODE - LIVE TOKEN USAGE MONITOR')
    .setColor(burnRateStatus.color)
    .setTimestamp()
    .setFooter({ text: '♻ リアルタイム更新中 • Ctrl+C で停止' });

  embed.addFields({
    name: '💻 SESSION',
    value: `\`\`\`yaml
Started: ${startTime.toLocaleTimeString('ja-JP')}
Elapsed: ${elapsedTime}
Remaining: ${formatTime(block.projection.remainingMinutes)}
End Time: ${endTime.toLocaleTimeString('ja-JP')}
${getProgressBar(sessionProgress, 100, 30)} ${sessionProgress.toFixed(1)}%
\`\`\``,
    inline: false
  });

  embed.addFields({
    name: '🔥 USAGE',
    value: `\`\`\`yaml
Tokens: ${formatNumber(block.totalTokens).padEnd(12)} 
Burn Rate: ${formatNumber(block.burnRate.tokensPerMinute)} token/min ${burnRateStatus.emoji} ${burnRateStatus.status}
Limit: 119,433,347 tokens
Cost: $${block.costUSD.toFixed(2)}
${getProgressBar(usageProgress, 100, 30)} ${usageProgress.toFixed(1)}%
(${formatTokensWithUnits(block.totalTokens)}/119.4M)
\`\`\``,
    inline: false
  });

  embed.addFields({
    name: '📊 PROJECTION',
    value: `\`\`\`yaml
Status: ${projectionProgress <= 100 ? '✅ WITHIN LIMIT' : '⚠️ EXCEEDS LIMIT'}
Tokens: ${formatNumber(block.projection.totalTokens)}
Cost: $${block.projection.totalCost.toFixed(2)}
${getProgressBar(projectionProgress, 100, 30)} ${projectionProgress.toFixed(1)}%
(${formatTokensWithUnits(block.projection.totalTokens)}/119.4M)
\`\`\``,
    inline: false
  });

  const tokenBreakdown = `
• Input: ${formatTokensWithUnits(block.tokenCounts.inputTokens)}
• Output: ${formatTokensWithUnits(block.tokenCounts.outputTokens)}
• Cache Creation: ${formatTokensWithUnits(block.tokenCounts.cacheCreationInputTokens)}
• Cache Read: ${formatTokensWithUnits(block.tokenCounts.cacheReadInputTokens)}
  `.trim();

  embed.addFields({
    name: '📈 TOKEN BREAKDOWN',
    value: `\`\`\`${tokenBreakdown}\`\`\``,
    inline: true
  });

  const models = block.models.map(m => `• ${m}`).join('\n');
  embed.addFields({
    name: '⚙️ MODELS',
    value: `\`\`\`${models}\`\`\``,
    inline: true
  });

  return embed;
}

function calculateSessionProgress(block: Block): number {
  const start = new Date(block.startTime).getTime();
  const end = new Date(block.endTime).getTime();
  const now = Date.now();
  
  if (now >= end) return 100;
  if (now <= start) return 0;
  
  return ((now - start) / (end - start)) * 100;
}

export function createErrorEmbed(error: string): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('❌ エラー')
    .setDescription(error)
    .setColor(0xff0000)
    .setTimestamp();
}

export function createNoDataEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('📊 Claude Code Usage Monitor')
    .setDescription('現在アクティブなセッションがありません。')
    .setColor(0x808080)
    .addFields({
      name: 'ℹ️ 情報',
      value: 'ccusageコマンドを実行してセッションを開始してください。'
    })
    .setTimestamp();
}