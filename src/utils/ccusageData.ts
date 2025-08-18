import { exec } from 'child_process';
import { promisify } from 'util';
import { CcusageResponse } from '../types/ccusage';

const execAsync = promisify(exec);

export async function getCcusageData(): Promise<CcusageResponse | null> {
  try {
    const { stdout, stderr } = await execAsync('ccusage blocks --active --json');
    
    if (stderr) {
      console.error('Error executing ccusage:', stderr);
      return null;
    }

    const data: CcusageResponse = JSON.parse(stdout);
    return data;
  } catch (error) {
    console.error('Failed to get ccusage data:', error);
    return null;
  }
}

export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  } else if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}k`;
  }
  return num.toFixed(0);
}

export function formatTokensWithUnits(tokens: number): string {
  if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(2)}M`;
  } else if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}k`;
  }
  return tokens.toFixed(0);
}

export function formatTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
}

export function getElapsedTime(startTime: string): string {
  const start = new Date(startTime);
  const now = new Date();
  const diffMs = now.getTime() - start.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  return formatTime(diffMins);
}

export function getBurnRateStatus(tokensPerMinute: number): { emoji: string; status: string; color: number } {
  if (tokensPerMinute < 100000) {
    return { emoji: '✅', status: 'NORMAL', color: 0x00ff00 };
  } else if (tokensPerMinute < 200000) {
    return { emoji: '⚠️', status: 'MODERATE', color: 0xffaa00 };
  } else {
    return { emoji: '🔥', status: 'HIGH', color: 0xff0000 };
  }
}

export function getProgressBar(current: number, limit: number, length: number = 20): string {
  const percentage = Math.min((current / limit) * 100, 100);
  const filled = Math.floor((percentage / 100) * length);
  const empty = length - filled;
  
  let bar = '█'.repeat(filled) + '░'.repeat(empty);
  return `[${bar}] ${percentage.toFixed(1)}%`;
}