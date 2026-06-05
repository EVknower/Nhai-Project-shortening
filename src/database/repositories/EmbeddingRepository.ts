import {v4 as uuidv4} from 'uuid';
import DatabaseManager from '../DatabaseManager';
import {FaceEmbedding, RawEmbedding} from '../../types/FaceEmbedding';
import EncryptionService from '../../services/EncryptionService';
import {logger} from '../../utils/logger';

class EmbeddingRepository {
  private db = DatabaseManager.getInstance();

  async save(
    embedding: RawEmbedding,
    employeeId: string,
  ): Promise<FaceEmbedding> {
    const id = uuidv4();
    const now = Date.now();
    const encrypted = EncryptionService.getInstance().encryptEmbedding(
      embedding.vector,
    );

    await this.db.execute(
      `INSERT INTO face_embeddings (id, employee_id, angle, embedding_data, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [id, employeeId, embedding.angle, encrypted, now],
    );

    logger.info(`Embedding saved for employee ${employeeId}, angle ${embedding.angle}`);
    return {
      id,
      employeeId,
      angle: embedding.angle,
      embeddingData: encrypted,
      createdAt: now,
    };
  }

  async findByEmployeeId(employeeId: string): Promise<FaceEmbedding[]> {
    const rows = await this.db.query<any>(
      'SELECT * FROM face_embeddings WHERE employee_id = ? ORDER BY created_at ASC',
      [employeeId],
    );
    return rows.map(this.mapRow);
  }

  async getDecryptedEmbeddings(employeeId: string): Promise<Float32Array[]> {
    const embeddings = await this.findByEmployeeId(employeeId);
    const enc = EncryptionService.getInstance();
    return embeddings.map(e => enc.decryptEmbedding(e.embeddingData));
  }

  async deleteByEmployeeId(employeeId: string): Promise<void> {
    await this.db.execute(
      'DELETE FROM face_embeddings WHERE employee_id = ?',
      [employeeId],
    );
    logger.info(`Embeddings deleted for employee ${employeeId}`);
  }

  async countByEmployeeId(employeeId: string): Promise<number> {
    const rows = await this.db.query<any>(
      'SELECT COUNT(*) as cnt FROM face_embeddings WHERE employee_id = ?',
      [employeeId],
    );
    return rows[0]?.cnt ?? 0;
  }

  async getAllEmployeeEmbeddings(): Promise<
    {employeeId: string; embeddings: Float32Array[]}[]
  > {
    const rows = await this.db.query<any>(
      'SELECT DISTINCT employee_id FROM face_embeddings',
    );
    const enc = EncryptionService.getInstance();
    const result: {employeeId: string; embeddings: Float32Array[]}[] = [];

    for (const row of rows) {
      const empEmbeddings = await this.findByEmployeeId(row.employee_id);
      const decrypted = empEmbeddings.map(e =>
        enc.decryptEmbedding(e.embeddingData),
      );
      result.push({employeeId: row.employee_id, embeddings: decrypted});
    }
    return result;
  }

  private mapRow(row: any): FaceEmbedding {
    return {
      id: row.id,
      employeeId: row.employee_id,
      angle: row.angle,
      embeddingData: row.embedding_data,
      createdAt: row.created_at,
    };
  }
}

export default new EmbeddingRepository();
