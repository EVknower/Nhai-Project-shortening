export interface Landmark {
  x: number;
  y: number;
  z: number;
}

export interface FaceDetectionResult {
  landmarks: Landmark[];
  confidence: number;
}

export interface HeadPose {
  yaw: number;
  pitch: number;
  roll: number;
}

export interface LivenessMetrics {
  earLeft: number;
  earRight: number;
  mar: number;
  yaw: number;
  pitch: number;
  roll: number;
}

export type ChallengeAction = 'BLINK' | 'SMILE' | 'TURN_LEFT' | 'TURN_RIGHT';

export interface LivenessChallenge {
  id: string;
  actions: ChallengeAction[];
  completedActions: ChallengeAction[];
  startedAt: number;
  completedAt: number | null;
  isPassed: boolean;
}

export interface LivenessChallengeUpdate {
  challenge: LivenessChallenge;
  newlyCompleted: ChallengeAction | null;
}

export interface SyncQueueItem {
  id: string;
  entityType: 'EMPLOYEE' | 'ATTENDANCE' | 'EMBEDDING';
  entityId: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  payload: string; // JSON string payload
  attempts: number;
  lastAttemptedAt: number | null;
  createdAt: number;
}

export interface SyncResult {
  synced: number;
  failed: number;
  pending: number;
}

export interface IntegrityReport {
  isRooted: boolean;
  hasDebugger: boolean;
  isIntact: boolean;
  deviceId: string;
}

export interface MatchResult {
  employeeId: string;
  similarity: number;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}
