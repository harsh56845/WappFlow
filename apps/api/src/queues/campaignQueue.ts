import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import EventEmitter from 'events';
import { env } from '../config/env';
import { logger } from '../config/logger';

export interface CampaignJobData {
  campaignId: string;
  userId: string;
}

export const inMemoryCampaignEmitter = new EventEmitter();

let bullQueue: Queue<CampaignJobData> | null = null;
let isRedisAvailable = false;

export function initCampaignQueue(): void {
  try {
    const redisClient = new IORedis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      connectTimeout: 2000,
      retryStrategy: () => null // don't infinitely retry if Redis is absent locally
    });

    redisClient.on('connect', () => {
      logger.info('Connected to Redis for BullMQ');
      isRedisAvailable = true;
    });

    redisClient.on('error', (_err) => {
      if (!isRedisAvailable) {
        // Suppress noisy logs if redis is not running locally; fallback active
      }
    });

    bullQueue = new Queue<CampaignJobData>('whatsapp-campaigns', {
      connection: redisClient
    });
  } catch (err) {
    logger.warn('Redis not available; falling back to resilient in-memory campaign queue worker');
    isRedisAvailable = false;
  }
}

export async function addCampaignToQueue(campaignId: string, userId: string): Promise<void> {
  if (isRedisAvailable && bullQueue) {
    try {
      await bullQueue.add('process-campaign', { campaignId, userId }, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 }
      });
      return;
    } catch (err) {
      logger.warn({ err }, 'Failed to queue in Redis BullMQ, falling back to in-memory queue');
    }
  }

  // Fallback / Standalone mode
  setImmediate(() => {
    inMemoryCampaignEmitter.emit('process-campaign', { campaignId, userId });
  });
}
