import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis | null = null;
  private readonly logger = new Logger(RedisService.name);
  private memoryBlacklist = new Map<string, number>();

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const host = this.configService.get<string>('REDIS_HOST', 'localhost');
    const port = Number(this.configService.get<number>('REDIS_PORT', 6379));

    try {
      this.client = new Redis({
        host,
        port,
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        retryStrategy: () => null, // Stop retrying repeatedly if Redis is absent in local dev
      });

      this.client.on('error', () => {
        // Silently capture Redis absence and fall back to in-memory store
      });

      this.client.connect().catch(() => {
        this.logger.log('Redis daemon not present locally — in-memory cache and blacklist enabled.');
      });
    } catch {
      this.client = null;
    }
  }

  onModuleDestroy() {
    this.client?.disconnect();
  }

  getClient(): Redis | null {
    return this.client;
  }

  async blacklistToken(token: string, expirySeconds = 900): Promise<void> {
    const expiresAt = Date.now() + expirySeconds * 1000;
    this.memoryBlacklist.set(token, expiresAt);

    try {
      if (this.client?.status === 'ready') {
        await this.client.set(`bl:${token}`, '1', 'EX', expirySeconds);
      }
    } catch {}
  }

  async isTokenBlacklisted(token: string): Promise<boolean> {
    const memExpiry = this.memoryBlacklist.get(token);
    if (memExpiry && memExpiry > Date.now()) {
      return true;
    }

    try {
      if (this.client?.status === 'ready') {
        const result = await this.client.get(`bl:${token}`);
        return result === '1';
      }
    } catch {}
    return false;
  }
}
