import axios, {AxiosInstance} from 'axios';
import EncryptedStorage from 'react-native-encrypted-storage';
import SyncQueueRepository from '../database/repositories/SyncQueueRepository';
import DatabaseManager from '../database/DatabaseManager';
import DeviceIntegrityService from '../services/DeviceIntegrityService';
import {SyncQueueItem, SyncResult} from '../types/LivenessChallenge';
import {logger} from '../utils/logger';
import DeviceInfo from 'react-native-device-info';

const SYNC_BATCH_SIZE = 100;
const MAX_ATTEMPTS = 5;
// Exponential backoff delays in ms: 1m, 5m, 15m, 1h, 4h
const BACKOFF_DELAYS = [60_000, 300_000, 900_000, 3_600_000, 14_400_000];

const ENDPOINTS: Record<SyncQueueItem['entityType'], string> = {
  EMPLOYEE: '/api/employees',
  ATTENDANCE: '/api/attendance',
  EMBEDDING: '/api/embeddings',
};

class SyncService {
  private static instance: SyncService;
  private client: AxiosInstance | null = null;
  private scheduledTimer: NodeJS.Timeout | null = null;

  static getInstance(): SyncService {
    if (!SyncService.instance) {
      SyncService.instance = new SyncService();
    }
    return SyncService.instance;
  }

  private async getClient(): Promise<AxiosInstance> {
    if (this.client) {
      return this.client;
    }

    const rows = await DatabaseManager.getInstance().query<any>(
      "SELECT value FROM settings WHERE key = 'AWS_API_ENDPOINT'",
    );
    const baseURL = rows[0]?.value ?? '';

    const token = await EncryptedStorage.getItem('AWS_TOKEN');
    const deviceId =
      await DeviceIntegrityService.getInstance().getDeviceFingerprint();
    const appVersion = await DeviceInfo.getVersion();

    this.client = axios.create({
      baseURL,
      timeout: 30_000,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : '',
        'X-Device-ID': deviceId,
        'X-App-Version': appVersion,
      },
    });

    return this.client;
  }

  async syncNow(): Promise<SyncResult> {
    logger.info('SyncService: starting sync');
    const result: SyncResult = {synced: 0, failed: 0, pending: 0};

    try {
      const items = await SyncQueueRepository.getPendingItems(SYNC_BATCH_SIZE);
      logger.info(`Sync: ${items.length} items to process`);

      const client = await this.getClient();

      for (const item of items) {
        const success = await this.processItem(client, item);
        if (success) {
          result.synced++;
        } else {
          result.failed++;
        }
      }

      result.pending = await SyncQueueRepository.getPendingCount();
      logger.info(
        `Sync complete: ${result.synced} synced, ${result.failed} failed, ${result.pending} remaining`,
      );
    } catch (error) {
      logger.error('Sync error:', error);
    }

    return result;
  }

  private async processItem(
    client: AxiosInstance,
    item: SyncQueueItem,
  ): Promise<boolean> {
    // Check if enough time has passed for backoff
    if (item.attempts > 0 && item.lastAttemptedAt) {
      const waitMs = BACKOFF_DELAYS[Math.min(item.attempts - 1, BACKOFF_DELAYS.length - 1)];
      const elapsed = Date.now() - item.lastAttemptedAt;
      if (elapsed < waitMs) {
        logger.debug(
          `Skipping ${item.id} — backoff not elapsed (${elapsed}ms < ${waitMs}ms)`,
        );
        return false;
      }
    }

    await SyncQueueRepository.markAttempted(item.id);

    try {
      const endpoint = ENDPOINTS[item.entityType];
      const payload = JSON.parse(item.payload);

      if (item.operation === 'CREATE') {
        await client.post(endpoint, payload);
      } else if (item.operation === 'UPDATE') {
        await client.put(`${endpoint}/${item.entityId}`, payload);
      } else if (item.operation === 'DELETE') {
        await client.delete(`${endpoint}/${item.entityId}`);
      }

      await SyncQueueRepository.markCompleted(item.id);
      logger.info(`Synced: ${item.entityType}/${item.entityId}`);
      return true;
    } catch (error: any) {
      const status = error?.response?.status;

      if (status >= 400 && status < 500) {
        // 4xx — permanent failure
        logger.error(
          `Permanent sync failure (${status}) for ${item.id}. Marking as dead letter.`,
        );
        // Max out attempts to prevent further retries
        for (let i = item.attempts; i < MAX_ATTEMPTS; i++) {
          await SyncQueueRepository.markAttempted(item.id);
        }
        return false;
      }

      // 5xx or network error — will retry with backoff
      logger.warn(
        `Transient sync failure for ${item.id} (attempt ${item.attempts}): ${error.message}`,
      );
      return false;
    }
  }

  /**
   * Schedule periodic sync.
   * @param intervalMinutes - 0 means manual only
   */
  scheduleSync(intervalMinutes: number): void {
    if (this.scheduledTimer) {
      clearInterval(this.scheduledTimer);
      this.scheduledTimer = null;
    }

    if (intervalMinutes <= 0) {
      return;
    }

    this.scheduledTimer = setInterval(async () => {
      logger.info('Scheduled sync triggered');
      await this.syncNow();
    }, intervalMinutes * 60_000);

    logger.info(`Sync scheduled every ${intervalMinutes} minutes`);
  }

  stopScheduledSync(): void {
    if (this.scheduledTimer) {
      clearInterval(this.scheduledTimer);
      this.scheduledTimer = null;
    }
  }

  invalidateClient(): void {
    this.client = null;
  }
}

export default SyncService;
