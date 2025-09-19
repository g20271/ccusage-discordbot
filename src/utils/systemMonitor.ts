import * as os from 'os';
import * as fs from 'fs';
import * as process from 'process';
import logger from '../logger';

export interface SystemMetrics {
  timestamp: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
    heap: {
      used: number;
      total: number;
      percentage: number;
    };
  };
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  network: {
    connectionsActive: boolean;
    discordApiReachable: boolean;
  };
  process: {
    pid: number;
    uptime: number;
    version: string;
  };
  system: {
    platform: string;
    arch: string;
    uptime: number;
    freeMemory: number;
    totalMemory: number;
  };
}

class SystemMonitor {
  private isMonitoring = false;
  private monitorInterval: NodeJS.Timeout | null = null;
  private lastCpuUsage = process.cpuUsage();
  private lastTime = Date.now();

  start(intervalMs: number = 30000) {
    if (this.isMonitoring) {
      logger.warn('System monitor already running');
      return;
    }

    this.isMonitoring = true;
    logger.info(`Starting system monitor with ${intervalMs}ms interval`);

    // 即座に初回実行
    this.collectMetrics();

    this.monitorInterval = setInterval(() => {
      this.collectMetrics();
    }, intervalMs);
  }

  stop() {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
    this.isMonitoring = false;
    logger.info('System monitor stopped');
  }

  private async collectMetrics() {
    try {
      const metrics = await this.getSystemMetrics();

      // 詳細ログ出力
      logger.info('SYSTEM_METRICS', {
        timestamp: metrics.timestamp,
        memory_used_mb: Math.round(metrics.memory.used / 1024 / 1024),
        memory_percentage: metrics.memory.percentage.toFixed(1),
        heap_used_mb: Math.round(metrics.memory.heap.used / 1024 / 1024),
        heap_percentage: metrics.memory.heap.percentage.toFixed(1),
        cpu_usage: metrics.cpu.usage.toFixed(1),
        load_avg: metrics.cpu.loadAverage.map(l => l.toFixed(2)).join(','),
        uptime_hours: (metrics.process.uptime / 3600).toFixed(1),
        pid: metrics.process.pid,
        discord_reachable: metrics.network.discordApiReachable,
        connections_active: metrics.network.connectionsActive
      });

      // 警告条件のチェック
      this.checkAlerts(metrics);

    } catch (error) {
      logger.error('Failed to collect system metrics:', error);
    }
  }

  private async getSystemMetrics(): Promise<SystemMetrics> {
    const memUsage = process.memoryUsage();
    const cpuUsage = this.calculateCpuUsage();
    const networkStatus = await this.checkNetworkStatus();

    return {
      timestamp: Date.now(),
      memory: {
        used: memUsage.rss,
        total: os.totalmem(),
        percentage: (memUsage.rss / os.totalmem()) * 100,
        heap: {
          used: memUsage.heapUsed,
          total: memUsage.heapTotal,
          percentage: (memUsage.heapUsed / memUsage.heapTotal) * 100
        }
      },
      cpu: {
        usage: cpuUsage,
        loadAverage: os.loadavg()
      },
      network: networkStatus,
      process: {
        pid: process.pid,
        uptime: process.uptime(),
        version: process.version
      },
      system: {
        platform: os.platform(),
        arch: os.arch(),
        uptime: os.uptime(),
        freeMemory: os.freemem(),
        totalMemory: os.totalmem()
      }
    };
  }

  private calculateCpuUsage(): number {
    const currentUsage = process.cpuUsage();
    const currentTime = Date.now();

    const userDiff = currentUsage.user - this.lastCpuUsage.user;
    const systemDiff = currentUsage.system - this.lastCpuUsage.system;
    const timeDiff = (currentTime - this.lastTime) * 1000; // Convert to microseconds

    const cpuPercent = ((userDiff + systemDiff) / timeDiff) * 100;

    this.lastCpuUsage = currentUsage;
    this.lastTime = currentTime;

    return Math.min(cpuPercent, 100); // Cap at 100%
  }

  private async checkNetworkStatus(): Promise<{ connectionsActive: boolean; discordApiReachable: boolean }> {
    let connectionsActive = false;
    let discordApiReachable = false;

    try {
      // Check active connections
      const connections = await this.getActiveConnections();
      connectionsActive = connections > 0;

      // Check Discord API reachability
      discordApiReachable = await this.pingDiscordApi();
    } catch (error) {
      logger.debug('Network status check failed:', error);
    }

    return { connectionsActive, discordApiReachable };
  }

  private async getActiveConnections(): Promise<number> {
    return new Promise((resolve) => {
      try {
        if (os.platform() === 'linux') {
          // Count established TCP connections
          fs.readFile('/proc/net/tcp', 'utf8', (err, data) => {
            if (err) {
              resolve(0);
              return;
            }
            const lines = data.split('\n');
            const established = lines.filter(line => line.includes('01')); // State 01 = ESTABLISHED
            resolve(established.length);
          });
        } else {
          resolve(1); // Assume at least one connection on non-Linux
        }
      } catch {
        resolve(0);
      }
    });
  }

  private async pingDiscordApi(): Promise<boolean> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(false), 5000);

      try {
        const https = require('https');
        const req = https.request('https://discord.com/api/v10/gateway', {
          method: 'HEAD',
          timeout: 4000
        }, (res: any) => {
          clearTimeout(timeout);
          resolve(res.statusCode === 200);
        });

        req.on('error', () => {
          clearTimeout(timeout);
          resolve(false);
        });

        req.on('timeout', () => {
          req.destroy();
          clearTimeout(timeout);
          resolve(false);
        });

        req.end();
      } catch {
        clearTimeout(timeout);
        resolve(false);
      }
    });
  }

  private checkAlerts(metrics: SystemMetrics) {
    // メモリ使用量警告 (90%以上)
    if (metrics.memory.percentage > 90) {
      logger.warn(`HIGH_MEMORY_USAGE: ${metrics.memory.percentage.toFixed(1)}% (${Math.round(metrics.memory.used / 1024 / 1024)}MB)`);
    }

    // ヒープメモリ警告 (85%以上)
    if (metrics.memory.heap.percentage > 85) {
      logger.warn(`HIGH_HEAP_USAGE: ${metrics.memory.heap.percentage.toFixed(1)}% (${Math.round(metrics.memory.heap.used / 1024 / 1024)}MB)`);
    }

    // CPU使用量警告 (80%以上)
    if (metrics.cpu.usage > 80) {
      logger.warn(`HIGH_CPU_USAGE: ${metrics.cpu.usage.toFixed(1)}%`);
    }

    // ネットワーク接続警告
    if (!metrics.network.discordApiReachable) {
      logger.error('DISCORD_API_UNREACHABLE: Cannot reach Discord API');
    }

    if (!metrics.network.connectionsActive) {
      logger.warn('NO_ACTIVE_CONNECTIONS: No active network connections detected');
    }

    // 負荷平均警告 (CPUコア数の2倍以上)
    const loadThreshold = os.cpus().length * 2;
    if (metrics.cpu.loadAverage[0] > loadThreshold) {
      logger.warn(`HIGH_LOAD_AVERAGE: ${metrics.cpu.loadAverage[0].toFixed(2)} (threshold: ${loadThreshold})`);
    }
  }
}

export const systemMonitor = new SystemMonitor();