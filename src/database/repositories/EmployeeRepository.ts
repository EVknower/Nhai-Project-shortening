import {v4 as uuidv4} from 'uuid';
import DatabaseManager from '../DatabaseManager';
import {Employee, EmployeeCreateInput} from '../../types/Employee';
import {logger} from '../../utils/logger';

class EmployeeRepository {
  private db = DatabaseManager.getInstance();

  async create(input: EmployeeCreateInput): Promise<Employee> {
    const id = uuidv4();
    const now = Date.now();

    await this.db.execute(
      `INSERT INTO employees
        (id, name, employee_code, department, is_active, enrolled_at, synced_at, created_at)
       VALUES (?, ?, ?, ?, 1, ?, NULL, ?)`,
      [id, input.name, input.employeeCode, input.department, now, now],
    );

    logger.info(`Employee created: ${id}`);
    return {
      id,
      name: input.name,
      employeeCode: input.employeeCode,
      department: input.department,
      isActive: true,
      enrolledAt: now,
      syncedAt: null,
      createdAt: now,
    };
  }

  async findById(id: string): Promise<Employee | null> {
    const rows = await this.db.query<any>(
      'SELECT * FROM employees WHERE id = ?',
      [id],
    );
    if (rows.length === 0) {
      return null;
    }
    return this.mapRow(rows[0]);
  }

  async findByEmployeeCode(code: string): Promise<Employee | null> {
    const rows = await this.db.query<any>(
      'SELECT * FROM employees WHERE employee_code = ?',
      [code],
    );
    if (rows.length === 0) {
      return null;
    }
    return this.mapRow(rows[0]);
  }

  async findAll(activeOnly = false): Promise<Employee[]> {
    const sql = activeOnly
      ? 'SELECT * FROM employees WHERE is_active = 1 ORDER BY name ASC'
      : 'SELECT * FROM employees ORDER BY name ASC';
    const rows = await this.db.query<any>(sql);
    return rows.map(this.mapRow);
  }

  async update(id: string, updates: Partial<Employee>): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.name !== undefined) {
      fields.push('name = ?');
      values.push(updates.name);
    }
    if (updates.department !== undefined) {
      fields.push('department = ?');
      values.push(updates.department);
    }
    if (updates.isActive !== undefined) {
      fields.push('is_active = ?');
      values.push(updates.isActive ? 1 : 0);
    }
    if (updates.enrolledAt !== undefined) {
      fields.push('enrolled_at = ?');
      values.push(updates.enrolledAt);
    }

    if (fields.length === 0) {
      return;
    }

    values.push(id);
    await this.db.execute(
      `UPDATE employees SET ${fields.join(', ')} WHERE id = ?`,
      values,
    );
    logger.info(`Employee updated: ${id}`);
  }

  async markSynced(id: string): Promise<void> {
    await this.db.execute(
      'UPDATE employees SET synced_at = ? WHERE id = ?',
      [Date.now(), id],
    );
  }

  async delete(id: string): Promise<void> {
    // Soft delete
    await this.db.execute(
      'UPDATE employees SET is_active = 0 WHERE id = ?',
      [id],
    );
    logger.info(`Employee soft-deleted: ${id}`);
  }

  async count(activeOnly = true): Promise<number> {
    const sql = activeOnly
      ? 'SELECT COUNT(*) as cnt FROM employees WHERE is_active = 1'
      : 'SELECT COUNT(*) as cnt FROM employees';
    const rows = await this.db.query<any>(sql);
    return rows[0]?.cnt ?? 0;
  }

  private mapRow(row: any): Employee {
    return {
      id: row.id,
      name: row.name,
      employeeCode: row.employee_code,
      department: row.department,
      isActive: row.is_active === 1,
      enrolledAt: row.enrolled_at,
      syncedAt: row.synced_at,
      createdAt: row.created_at,
    };
  }
}

export default new EmployeeRepository();
