/**
 * Integration test: Full attendance flow
 * Tests the complete pipeline from employee creation through attendance recording.
 *
 * All database and ML operations are mocked to isolate business logic.
 */

import {AttendanceRecord} from '../../src/types/Attendance';
import {Employee} from '../../src/types/Employee';
import {l2Normalize} from '../../src/utils/cosineDistance';

// ─── Mocks ───────────────────────────────────────────────────────────────────

let mockEmployees: Record<string, Employee> = {};
let mockEmbeddings: Record<string, Float32Array[]> = {};
let mockAttendance: AttendanceRecord[] = [];
let mockSyncQueue: any[] = [];

jest.mock('../../src/database/repositories/EmployeeRepository', () => ({
  __esModule: true,
  default: {
    create: jest.fn(async (input: any) => {
      const emp: Employee = {
        id: 'emp-test-001',
        ...input,
        isActive: true,
        enrolledAt: Date.now(),
        syncedAt: null,
        createdAt: Date.now(),
      };
      mockEmployees[emp.id] = emp;
      return emp;
    }),
    findById: jest.fn(async (id: string) => mockEmployees[id] ?? null),
    update: jest.fn(async () => {}),
  },
}));

jest.mock('../../src/database/repositories/EmbeddingRepository', () => ({
  __esModule: true,
  default: {
    save: jest.fn(async (embedding: any, employeeId: string) => {
      if (!mockEmbeddings[employeeId]) {
        mockEmbeddings[employeeId] = [];
      }
      mockEmbeddings[employeeId].push(embedding.vector);
      return {id: 'emb-' + Date.now(), employeeId, angle: embedding.angle};
    }),
    countByEmployeeId: jest.fn(async (id: string) => (mockEmbeddings[id]?.length ?? 0)),
    getAllEmployeeEmbeddings: jest.fn(async () =>
      Object.entries(mockEmbeddings).map(([employeeId, embeddings]) => ({
        employeeId,
        embeddings,
      }))
    ),
  },
}));

jest.mock('../../src/database/repositories/AttendanceRepository', () => ({
  __esModule: true,
  default: {
    record: jest.fn(async (input: any) => {
      const record: AttendanceRecord = {
        id: 'att-' + Date.now(),
        ...input,
        timestamp: Date.now(),
        status: 'PENDING_SYNC',
        syncedAt: null,
      };
      mockAttendance.push(record);
      return record;
    }),
    getLastAttendance: jest.fn(async () => null),
  },
}));

jest.mock('../../src/database/repositories/SyncQueueRepository', () => ({
  __esModule: true,
  default: {
    enqueue: jest.fn(async (...args: any[]) => { mockSyncQueue.push(args); }),
    getPendingCount: jest.fn(async () => mockSyncQueue.length),
  },
}));

// Mock ML models with deterministic outputs
jest.mock('../../src/ml/ModelLoader', () => ({
  __esModule: true,
  default: {
    getInstance: () => ({
      getFaceMeshModel: () => ({
        run: async () => [
          new Float32Array(468 * 3).fill(0.5),
          new Float32Array([0.95]),
        ],
      }),
      getEmbeddingModel: () => ({
        run: async (_inputs: any) => {
          const {l2Normalize: localL2Normalize} = require('../../src/utils/cosineDistance');
          return [
            localL2Normalize(new Float32Array(192).fill(1 / Math.sqrt(192))),
          ];
        },
      }),
      isLoaded: true,
    }),
  },
}));

jest.mock('../../src/services/EncryptionService', () => ({
  __esModule: true,
  default: {
    getInstance: () => ({
      encryptEmbedding: (v: Float32Array) => JSON.stringify(Array.from(v)),
      decryptEmbedding: (s: string) => new Float32Array(JSON.parse(s)),
    }),
  },
}));

jest.mock('../../src/utils/logger', () => ({
  logger: {info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn()},
}));

jest.mock('uuid', () => ({v4: () => 'att-uuid-' + Math.random()}));

// ─── Tests ───────────────────────────────────────────────────────────────────

import EmployeeRepository from '../../src/database/repositories/EmployeeRepository';
import EmbeddingRepository from '../../src/database/repositories/EmbeddingRepository';
import AttendanceRepository from '../../src/database/repositories/AttendanceRepository';
import SyncQueueRepository from '../../src/database/repositories/SyncQueueRepository';
import FaceMatchingService from '../../src/services/FaceMatchingService';

describe('Full Attendance Flow Integration Test', () => {
  beforeEach(() => {
    mockEmployees = {};
    mockEmbeddings = {};
    mockAttendance = [];
    mockSyncQueue = [];
    jest.clearAllMocks();
  });

  it('complete flow: register → enroll → match → record attendance', async () => {
    const service = FaceMatchingService.getInstance();

    // Step 1: Create employee
    const employee = await EmployeeRepository.create({
      name: 'Test Employee',
      employeeCode: 'TEST001',
      department: 'IT',
    });
    expect(employee.id).toBe('emp-test-001');

    // Step 2: Enroll 5 embeddings (one per angle)
    const angles = ['FRONT', 'LEFT', 'RIGHT', 'UP', 'DOWN'] as const;
    for (const angle of angles) {
      const vector = l2Normalize(new Float32Array(192).fill(1 / Math.sqrt(192)));
      await EmbeddingRepository.save({vector, angle}, employee.id);
    }

    const count = await EmbeddingRepository.countByEmployeeId(employee.id);
    expect(count).toBe(5);

    // Step 3: Get all stored embeddings and match probe
    const allCandidates = await EmbeddingRepository.getAllEmployeeEmbeddings();
    expect(allCandidates).toHaveLength(1);
    expect(allCandidates[0].employeeId).toBe('emp-test-001');

    // Probe = same as stored = perfect match
    const probe = l2Normalize(new Float32Array(192).fill(1 / Math.sqrt(192)));
    const matchResult = service.matchEmployee(probe, allCandidates);

    expect(matchResult).not.toBeNull();
    expect(matchResult?.employeeId).toBe('emp-test-001');
    expect(matchResult?.similarity).toBeGreaterThan(0.75);

    // Step 4: Record attendance
    const record = await AttendanceRepository.record({
      employeeId: employee.id,
      type: 'CHECK_IN',
      livenessScore: 1.0,
      matchScore: matchResult!.similarity,
      deviceId: 'device-fingerprint-hash',
    });

    expect(record.employeeId).toBe('emp-test-001');
    expect(record.type).toBe('CHECK_IN');
    expect(record.status).toBe('PENDING_SYNC');

    // Step 5: Verify sync queue
    await SyncQueueRepository.enqueue('ATTENDANCE', record.id, 'CREATE', record);
    const pending = await SyncQueueRepository.getPendingCount();
    expect(pending).toBeGreaterThan(0);

    expect(mockSyncQueue.length).toBe(1);
    expect(mockSyncQueue[0][0]).toBe('ATTENDANCE');
  });
});
