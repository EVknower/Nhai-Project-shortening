import ModelLoader from './ModelLoader';
import {logger} from '../utils/logger';
import {l2Normalize} from '../utils/cosineDistance';

class EmbeddingExtractor {
  private static instance: EmbeddingExtractor;

  static getInstance(): EmbeddingExtractor {
    if (!EmbeddingExtractor.instance) {
      EmbeddingExtractor.instance = new EmbeddingExtractor();
    }
    return EmbeddingExtractor.instance;
  }

  /**
   * Run MobileFaceNet on a 112×112 face ROI.
   * Input: Float32Array in HWC format (112 × 112 × 3), values in [-1, 1].
   * Returns: L2-normalized 128-dimensional embedding.
   */
  async extract(faceROI: Float32Array): Promise<Float32Array> {
    try {
      const model = ModelLoader.getInstance().getEmbeddingModel();
      // Run model asynchronously
      const outputs = await model.run([faceROI]);
      const rawEmbedding = outputs[0] as Float32Array;
      if (!rawEmbedding) {
        throw new Error('No embedding returned from model');
      }
      // L2-normalize the output
      return l2Normalize(rawEmbedding);
    } catch (error) {
      logger.error('Embedding extraction failed:', error);
      throw error;
    }
  }
}

export default EmbeddingExtractor;
