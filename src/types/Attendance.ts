export type AttendanceType = 'CHECK_IN' | 'CHECK_OUT';
export type AttendanceStatus = 'PENDING_SYNC' | 'SUCCESS' | 'FAILED';

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  type: AttendanceType;
  timestamp: number;
  livenessScore: number;  // 0–1
  matchScore: number;     // cosine similarity
  deviceId: string;
  status: AttendanceStatus;
  syncedAt: number | null;
}

export type AttendanceCreateInput = Pick<
  AttendanceRecord,
  'employeeId' | 'type' | 'livenessScore' | 'matchScore' | 'deviceId'
>;
