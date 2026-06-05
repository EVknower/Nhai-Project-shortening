/**
 * EmployeeRepository unit tests.
 * Uses jest mocking to isolate from the real SQLite database.
 */

import {EmployeeCreateInput} from '../../src/types/Employee';

// Mock DatabaseManager
const mockQuery = jest.fn();
const mockExecute = jest.fn();

jest.mock('../../src/database/DatabaseManager', () => ({
  __esModule: true,
  default: {
    getInstance: () => ({
      query: (...args: any[]) => mockQuery(...args),
      execute: (...args: any[]) => mockExecute(...args),
    }),
  },
}));

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid-1234'),
}));

// Mock logger
jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Import AFTER mocks
import EmployeeRepository from '../../src/database/repositories/EmployeeRepository';

const sampleInput: EmployeeCreateInput = {
  name: 'Rahul Sharma',
  employeeCode: 'EMP001',
  department: 'IT',
};

describe('EmployeeRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExecute.mockResolvedValue({rowsAffected: 1});
    mockQuery.mockResolvedValue([]);
  });

  describe('create', () => {
    it('creates an employee and returns the created object', async () => {
      const result = await EmployeeRepository.create(sampleInput);

      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO employees'),
        expect.arrayContaining(['test-uuid-1234', 'Rahul Sharma', 'EMP001', 'IT']),
      );

      expect(result.id).toBe('test-uuid-1234');
      expect(result.name).toBe('Rahul Sharma');
      expect(result.employeeCode).toBe('EMP001');
      expect(result.department).toBe('IT');
      expect(result.isActive).toBe(true);
      expect(result.syncedAt).toBeNull();
    });
  });

  describe('findById', () => {
    it('returns null when employee not found', async () => {
      mockQuery.mockResolvedValue([]);
      const result = await EmployeeRepository.findById('nonexistent');
      expect(result).toBeNull();
    });

    it('returns mapped employee when found', async () => {
      const now = Date.now();
      mockQuery.mockResolvedValue([
        {
          id: 'test-uuid-1234',
          name: 'Rahul Sharma',
          employee_code: 'EMP001',
          department: 'IT',
          is_active: 1,
          enrolled_at: now,
          synced_at: null,
          created_at: now,
        },
      ]);

      const result = await EmployeeRepository.findById('test-uuid-1234');
      expect(result).not.toBeNull();
      expect(result?.name).toBe('Rahul Sharma');
      expect(result?.isActive).toBe(true);
    });
  });

  describe('findByEmployeeCode', () => {
    it('queries by employee_code', async () => {
      mockQuery.mockResolvedValue([]);
      await EmployeeRepository.findByEmployeeCode('EMP001');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('employee_code'),
        ['EMP001'],
      );
    });
  });

  describe('update', () => {
    it('builds update query for provided fields only', async () => {
      await EmployeeRepository.update('test-id', {name: 'Updated Name'});
      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining('SET name = ?'),
        expect.arrayContaining(['Updated Name', 'test-id']),
      );
    });

    it('does nothing if no update fields are provided', async () => {
      await EmployeeRepository.update('test-id', {});
      expect(mockExecute).not.toHaveBeenCalled();
    });
  });

  describe('delete (soft)', () => {
    it('sets is_active = 0 instead of deleting', async () => {
      await EmployeeRepository.delete('test-id');
      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining('is_active = 0'),
        ['test-id'],
      );
    });
  });

  describe('markSynced', () => {
    it('updates synced_at timestamp', async () => {
      await EmployeeRepository.markSynced('test-id');
      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining('synced_at'),
        expect.arrayContaining(['test-id']),
      );
    });
  });
});
