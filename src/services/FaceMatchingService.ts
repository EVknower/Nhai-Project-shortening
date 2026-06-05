import FaceDetector from '../ml/FaceDetector';
import EmbeddingExtractor from '../ml/EmbeddingExtractor';
import EmbeddingRepository from '../database/repositories/EmbeddingRepository';
import {cosineSimilarity} from '../utils/cosineDistance';
import {MatchResult, RawEmbedding} from '../types';
import {logger} from '../utils/logger';
import {EMBEDDING_ANGLES} from '../types/FaceEmbedding';

const MATCH_THRESHOLD = 0.75;
const EMBEDDING_DIMENSION = 128;

class FaceMatchingService {
  private static instance: FaceMatchingService;

  static getInstance(): FaceMatchingService {
    if (!FaceMatchingService.instance) {
      FaceMatchingService.instance = new FaceMatchingService();
    }
    return FaceMatchingService.instance;
  }

  /**
   * Extract a 128-dim embedding from a 112×112 face ROI.
   */
  async extractEmbedding(faceROI: Float32Array): Promise<Float32Array> {
    return EmbeddingExtractor.getInstance().extract(faceROI);
  }

  /**
   * Cosine similarity between two L2-normalized embeddings.
   */
  cosineSimilarity(a: Float32Array, b: Float32Array): number {
    return cosineSimilarity(a, b);
  }

  /**
   * Match a probe embedding against all enrolled employees.
   * Returns the best match above threshold, or null.
   */
  matchEmployee(
    probe: Float32Array,
    candidates: {employeeId: string; embeddings: Float32Array[]}[],
  ): MatchResult | null {
    let bestSimilarity = -1;
    let bestEmployeeId = '';

    for (const candidate of candidates) {
      if (candidate.embeddings.length === 0) {
        continue;
      }
      // Take MAX similarity across all stored angles for this employee
      const maxSim = Math.max(
        ...candidate.embeddings.map(e => cosineSimilarity(probe, e)),
      );
      if (maxSim > bestSimilarity) {
        bestSimilarity = maxSim;
        bestEmployeeId = candidate.employeeId;
      }
    }

    if (bestSimilarity < MATCH_THRESHOLD || !bestEmployeeId) {
      logger.info(
        `No match found. Best similarity: ${bestSimilarity.toFixed(3)}`,
      );
      return null;
    }

    const confidence: MatchResult['confidence'] =
      bestSimilarity >= 0.9
        ? 'HIGH'
        : bestSimilarity >= 0.8
        ? 'MEDIUM'
        : 'LOW';

    logger.info(
      `Match found: ${bestEmployeeId} (sim=${bestSimilarity.toFixed(3)}, ${confidence})`,
    );

    return {
      employeeId: bestEmployeeId,
      similarity: bestSimilarity,
      confidence,
    };
  }

  /**
   * Full matching pipeline: load all embeddings from DB and match probe.
   */
  async matchFromDatabase(
    frameData: Uint8Array,
    frameWidth: number,
    frameHeight: number,
  ): Promise<MatchResult | null> {
    // Detect face
    const faceResult = await FaceDetector.detectFace(
      frameData,
      frameWidth,
      frameHeight,
    );
    if (!faceResult) {
      return null;
    }

    // Extract ROI and embedding
    const roi = FaceDetector.extractROI(
      frameData,
      frameWidth,
      frameHeight,
      faceResult.landmarks,
    );
    const probe = await this.extractEmbedding(roi);

    // Load all stored embeddings
    const allCandidates =
      await EmbeddingRepository.getAllEmployeeEmbeddings();

    return this.matchEmployee(probe, allCandidates);
  }

  /**
   * Enroll 5 face frames for an employee (one per angle).
   * Requires at least 4/5 successful embeddings.
   */
  async enrollEmbeddings(
    employeeId: string,
    frames: Array<{
      data: Uint8Array;
      width: number;
      height: number;
      angle: RawEmbedding['angle'];
    }>,
  ): Promise<void> {
    if (frames.length !== EMBEDDING_ANGLES.length) {
      throw new Error(
        `Expected ${EMBEDDING_ANGLES.length} frames, got ${frames.length}`,
      );
    }

    let saved = 0;
    const errors: Error[] = [];

    for (const frame of frames) {
      try {
        const faceResult = await FaceDetector.detectFace(
          frame.data,
          frame.width,
          frame.height,
        );
        if (!faceResult) {
          errors.push(new Error(`No face detected for angle ${frame.angle}`));
          continue;
        }

        const roi = FaceDetector.extractROI(
          frame.data,
          frame.width,
          frame.height,
          faceResult.landmarks,
        );
        const vector = await this.extractEmbedding(roi);

        await EmbeddingRepository.save({vector, angle: frame.angle}, employeeId);
        saved++;
        logger.info(
          `Saved embedding ${saved}/${frames.length} (${frame.angle})`,
        );
      } catch (err) {
        errors.push(err as Error);
        logger.error(`Failed to save embedding for angle ${frame.angle}:`, err);
      }
    }

    if (saved < 4) {
      throw new Error(
        `Enrollment failed: only ${saved}/5 embeddings saved successfully. ` +
          `Errors: ${errors.map(e => e.message).join(', ')}`,
      );
    }

    logger.info(
      `Enrollment complete for employee ${employeeId}: ${saved}/5 embeddings saved`,
    );
  }
}

export default FaceMatchingService;
