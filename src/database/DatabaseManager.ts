import SQLite, {
  SQLiteDatabase,
  ResultSet,
  Transaction,
} from 'react-native-sqlite-storage';
import EncryptedStorage from 'react-native-encrypted-storage';
import {migration_001} from './migrations/001_initial_schema';
import {migration_002} from './migrations/002_sync_queue';
import {logger} from '../utils/logger';

SQLite.enablePromise(true);

const DB_NAME = 'faceguard.db';
const KEY_STORAGE_KEY = 'FACEGUARD_DB_KEY';
const MAX_RETRIES = 3;
const CURRENT_VERSION = 2;

class DatabaseManager {
  private static instance: DatabaseManager;
  private db: SQLiteDatabase | null = null;
  private initialized = false;

  private constructor() {}

  static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized && this.db) {
      return;
    }
    let attempt = 0;
    while (attempt < MAX_RETRIES) {
      try {
        await this.openDatabase();
        await this.runMigrations();
        this.initialized = true;
        logger.info('DatabaseManager initialized successfully');
        return;
      } catch (error) {
        attempt++;
        logger.error(`DB init attempt ${attempt} failed:`, error);
        if (attempt >= MAX_RETRIES) {
          throw new Error(
            `Failed to initialize database after ${MAX_RETRIES} attempts: ${error}`,
          );
        }
        await new Promise(r => setTimeout(r, 500 * attempt));
      }
    }
  }

  private async openDatabase(): Promise<void> {
    // Ensure encryption key exists
    await this.ensureEncryptionKey();

    this.db = await SQLite.openDatabase({
      name: DB_NAME,
      location: 'default',
    });

    logger.info('SQLite database opened');
  }

  private async ensureEncryptionKey(): Promise<string> {
    try {
      let key = await EncryptedStorage.getItem(KEY_STORAGE_KEY);
      if (!key) {
        // Generate random 256-bit key
        const randomBytes = new Uint8Array(32);
        for (let i = 0; i < 32; i++) {
          randomBytes[i] = Math.floor(Math.random() * 256);
        }
        key = Array.from(randomBytes)
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
        await EncryptedStorage.setItem(KEY_STORAGE_KEY, key);
        logger.info('New database encryption key generated');
      }
      return key;
    } catch (error) {
      logger.error('Failed to ensure encryption key:', error);
      throw error;
    }
  }

  private async runMigrations(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not open');
    }

    // Create schema_version table if not exists
    await this.db.executeSql(`
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY,
        applied_at INTEGER NOT NULL
      )
    `);

    const [result] = await this.db.executeSql(
      'SELECT MAX(version) as v FROM schema_version',
    );
    const currentVersion: number = result.rows.item(0)?.v ?? 0;

    const migrations = [
      {version: 1, sql: migration_001},
      {version: 2, sql: migration_002},
    ];

    for (const migration of migrations) {
      if (migration.version > currentVersion) {
        logger.info(`Running migration v${migration.version}`);
        // Split multiple statements and run each
        const statements = migration.sql
          .split(';')
          .map((s: string) => s.trim())
          .filter((s: string) => s.length > 0);

        for (const stmt of statements) {
          await this.db.executeSql(stmt);
        }
        await this.db.executeSql(
          'INSERT OR REPLACE INTO schema_version (version, applied_at) VALUES (?, ?)',
          [migration.version, Date.now()],
        );
        logger.info(`Migration v${migration.version} applied`);
      }
    }
  }

  getDatabase(): SQLiteDatabase {
    if (!this.db) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.db;
  }

  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    const db = this.getDatabase();
    const [result] = await db.executeSql(sql, params);
    const rows: T[] = [];
    for (let i = 0; i < result.rows.length; i++) {
      rows.push(result.rows.item(i));
    }
    return rows;
  }

  async execute(sql: string, params: any[] = []): Promise<ResultSet> {
    const db = this.getDatabase();
    const [result] = await db.executeSql(sql, params);
    return result;
  }

  async transaction(
    callback: (tx: Transaction) => void,
  ): Promise<void> {
    const db = this.getDatabase();
    await db.transaction(callback);
  }

  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
      this.initialized = false;
      logger.info('Database closed');
    }
  }
}

export default DatabaseManager;
