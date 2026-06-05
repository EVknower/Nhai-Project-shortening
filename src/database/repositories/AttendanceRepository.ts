import {v4 as uuidv4} from 'uuid';
import DatabaseManager from '../DatabaseManager';
import {
  AttendanceRecord,
  AttendanceCreateInput,
} from '../../types/Attendance';
import {logger} from '../../utils/logger';

class AttendanceRepository {
  private db = DatabaseManager.getInstance();

  async record(input: AttendanceCreateInput): Promise<AttendanceRecord> {
    const id = uuidv4();
    const now = Date.now();

    await this.db.execute(
      `INSERT INTO attendance
        (id, employee_id, type, timestamp, liveness_score, match_score, status, synced_at, device_id)
       VALUES (?, ?, ?, ?, ?, ?, 'PENDING_SYNC', NULL, ?)`,
      [
        id,
        input.employeeId,
        input.type,
        now,
        input.livenessScore,
        input.matchScore,
        input.deviceId,
      ],
    );

    logger.info(
      `Attendance recorded: ${input.type} for employee ${input.employeeId}`,
    );
    return {
      id,
      employeeId: input.employeeId,
      type: input.type,
      timestamp: now,
      livenessScore: input.livenessScore,
      matchScore: input.matchScore,
      status: 'PENDING_SYNC',
      syncedAt: null,
      deviceId: input.deviceId,
    };
  }

  async findByEmployeeId(
    employeeId: string,
    limit = 50,
  ): Promise<AttendanceRecord[]> {
    const rows = await this.db.query<any>(
      `SELECT * FROM attendance
       WHERE employee_id = ?
       ORDER BY timestamp DESC
       LIMIT ?`,
      [employeeId, limit],
    );
    return rows.map(this.mapRow);
  }

  async findByDateRange(
    startTs: number,
    endTs: number,
  ): Promise<AttendanceRecord[]> {
    const rows = await this.db.query<any>(
      `SELECT * FROM attendance
       WHERE timestamp BETWEEN ? AND ?
       ORDER BY timestamp DESC`,
      [startTs, endTs],
    );
    return rows.map(this.mapRow);
  }

  async findUnsyncedRecords(): Promise<AttendanceRecord[]> {
    const rows = await this.db.query<any>(
      `SELECT * FROM attendance
       WHERE status = 'PENDING_SYNC'
       ORDER BY timestamp ASC`,
    );
    return rows.map(this.mapRow);
  }

  async markSynced(id: string): Promise<void> {
    await this.db.execute(
      `UPDATE attendance SET status = 'SUCCESS', synced_at = ? WHERE id = ?`,
      [Date.now(), id],
    );
  }

  async getLastAttendance(
    employeeId: string,
  ): Promise<AttendanceRecord | null> {
    const rows = await this.db.query<any>(
      `SELECT * FROM attendance
       WHERE employee_id = ?
       ORDER BY timestamp DESC
       LIMIT 1`,
      [employeeId],
    );
    return rows.length > 0 ? this.mapRow(rows[0]) : null;
  }

  async countToday(): Promise<number> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const rows = await this.db.query<any>(
      `SELECT COUNT(*) as cnt FROM attendance
       WHERE timestamp >= ? AND type = 'CHECK_IN'`,
      [startOfDay.getTime()],
    );
    return rows[0]?.cnt ?? 0;
  }

  async findAll(limit = 50, offset = 0): Promise<AttendanceRecord[]> {
    const rows = await this.db.query<any>(
      `SELECT * FROM attendance ORDER BY timestamp DESC LIMIT ? OFFSET ?`,
      [limit, offset],
    );
    return rows.map(this.mapRow);
  }

  private mapRow(row: any): AttendanceRecord {
    return {
      id: row.id,
      employeeId: row.employee_id,
      type: row.type,
      timestamp: row.timestamp,
      livenessScore: row.liveness_score,
      matchScore: row.match_score,
      status: row.status,
      syncedAt: row.synced_at,
      deviceId: row.device_id,
    };
  }
}

export default new AttendanceRepository();
