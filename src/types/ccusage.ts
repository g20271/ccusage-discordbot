export interface TokenCounts {
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
}

export interface BurnRate {
  tokensPerMinute: number;
  tokensPerMinuteForIndicator: number;
  costPerHour: number;
}

export interface Projection {
  totalTokens: number;
  totalCost: number;
  remainingMinutes: number;
}

export interface Block {
  id: string;
  startTime: string;
  endTime: string;
  actualEndTime?: string;
  isActive: boolean;
  isGap: boolean;
  entries: number;
  tokenCounts: TokenCounts;
  totalTokens: number;
  costUSD: number;
  models: string[];
  burnRate: BurnRate;
  projection: Projection;
}

export interface CcusageResponse {
  blocks: Block[];
}