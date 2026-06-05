export const EMBEDDING_ANGLES = ['FRONT', 'LEFT', 'RIGHT', 'UP', 'DOWN'] as const;
export type EmbeddingAngle = (typeof EMBEDDING_ANGLES)[number];

export interface FaceEmbedding {
  id: string;
  employeeId: string;
  angle: EmbeddingAngle;
  embeddingData: string; // Encrypted embedding data string
  createdAt: number;
}

export interface RawEmbedding {
  vector: Float32Array;
  angle: EmbeddingAngle;
}
