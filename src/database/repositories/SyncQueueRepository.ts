import {v4 as uuidv4} from 'uuid';
import DatabaseManager from '../DatabaseManager';
import {SyncQueueItem} from '../../types/LivenessChallenge';
import {logger} from '../../utils/logger';

const MAX_ATTEMPTS = 5;

class SyncQueueRepository {
  private db = DatabaseManager.getInstance();

  async enqueue(
    entityType: SyncQueueItem['entityType'],
    entityId: string,
    operation: SyncQueueItem['operation'],
    payload: object,
  ): Promise<void> {
    const id = uuidv4();
    const now = Date.now();
    await this.db.execute(
      `INSERT INTO sync_queue
        (id, entity_type, entity_id, operation, payload, attempts, last_attempted_at, created_at)
       VALUES (?, ?, ?, ?, ?, 0, NULL, ?)`,
      [id, entityType, entityId, operation, JSON.stringify(payload), now],
    );
    logger.info(`Enqueued sync item: ${entityType}/${entityId}`);
  }

  async getPendingItems(limit = 100): Promise<SyncQueueItem[]> {
    const rows = await this.db.query<any>(
      `SELECT * FROM sync_queue
       WHERE attempts < ?
       ORDER BY created_at ASC
       LIMIT ?`,
      [MAX_ATTEMPTS, limit],
    );
    return rows.map(this.mapRow);
  }

  async markAttempted(id: string): Promise<void> {
    await this.db.execute(
      `UPDATE sync_queue
       SET attempts = attempts + 1, last_attempted_at = ?
       WHERE id = ?`,
      [Date.now(), id],
    );
  }

  async markCompleted(id: string): Promise<void> {
    await this.db.execute('DELETE FROM sync_queue WHERE id = ?', [id]);
    logger.info(`Sync item completed and removed: ${id}`);
  }

  async getFailedItems(maxAttempts = MAX_ATTEMPTS): Promise<SyncQueueItem[]> {
    const rows = await this.db.query<any>(
      `SELECT * FROM sync_queue
       WHERE attempts >= ?
       ORDER BY last_attempted_at DESC`,
      [maxAttempts],
    );
    return rows.map(this.mapRow);
  }

  async purgeCompleted(): Promise<void> {
    // All completed items are deleted by markCompleted; purge dead letters
    await this.db.execute(
      `DELETE FROM sync_queue WHERE attempts >= ?`,
      [MAX_ATTEMPTS],
    );
  }

  async getPendingCount(): Promise<number> {
    const rows = await this.db.query<any>(
      `SELECT COUNT(*) as cnt FROM sync_queue WHERE attempts < ?`,
      [MAX_ATTEMPTS],
    );
    return rows[0]?.cnt ?? 0;
  }

  private mapRow(row: any): SyncQueueItem {
    return {
      id: row.id,
      entityType: row.entity_type,
      entityId: row.entity_id,
      operation: row.operation,
      payload: row.payload,
      attempts: row.attempts,
      lastAttemptedAt: row.last_attempted_at,
      createdAt: row.created_at,
    };
  }
}

export default new SyncQueueRepository();
