import {logger} from '../utils/logger';

// react-native-fast-tflite types
interface TFLiteModel {
  run(inputs: Record<string, any>): Record<string, any>;
}

// Lazy imports to avoid module-level failures on unsupported platforms
let loadTensorflowModel: any;

try {
  const tflite = require('react-native-fast-tflite');
  loadTensorflowModel = tflite.loadTensorflowModel;
} catch {
  logger.warn('react-native-fast-tflite not available — using mock');
}

const MODEL_PATHS = {
  faceMesh: 'face_mesh.tflite',
  mobileNet: 'mobile_face_net.tflite',
};

class ModelLoader {
  private static instance: ModelLoader;
  private faceMeshModel: TFLiteModel | null = null;
  private embeddingModel: TFLiteModel | null = null;
  private loadingPromise: Promise<void> | null = null;

  static getInstance(): ModelLoader {
    if (!ModelLoader.instance) {
      ModelLoader.instance = new ModelLoader();
    }
    return ModelLoader.instance;
  }

  async loadModels(): Promise<void> {
    if (this.faceMeshModel && this.embeddingModel) {
      return; // Already loaded
    }
    if (this.loadingPromise) {
      return this.loadingPromise; // Already loading
    }

    this.loadingPromise = this.doLoad();
    await this.loadingPromise;
  }

  private async doLoad(): Promise<void> {
    const start = Date.now();
    logger.info('Loading ML models...');

    try {
      if (loadTensorflowModel) {
        const [mesh, net] = await Promise.all([
          loadTensorflowModel(require('../models/face_mesh.tflite')),
          loadTensorflowModel(require('../models/mobile_face_net.tflite')),
        ]);
        this.faceMeshModel = mesh;
        this.embeddingModel = net;
      } else {
        // Mock models for JS-only testing
        this.faceMeshModel = this.createMockModel('face_mesh');
        this.embeddingModel = this.createMockModel('mobile_face_net');
        logger.warn('Using MOCK ML models — not suitable for production');
      }

      const elapsed = Date.now() - start;
      logger.info(`ML models loaded in ${elapsed}ms`);
    } catch (error) {
      logger.error('Failed to load ML models:', error);
      // Fall back to mock models to keep app functional
      this.faceMeshModel = this.createMockModel('face_mesh');
      this.embeddingModel = this.createMockModel('mobile_face_net');
      logger.warn('Falling back to mock models');
    } finally {
      this.loadingPromise = null;
    }
  }

  private createMockModel(name: string): TFLiteModel {
    return {
      run: (inputs: Record<string, any>) => {
        logger.debug(`Mock model ${name} running`);
        // Return plausible mock data
        if (name === 'mobile_face_net') {
          const embedding = new Float32Array(128);
          for (let i = 0; i < 128; i++) {
            embedding[i] = Math.random() * 2 - 1;
          }
          return {output: embedding};
        }
        // Face mesh: 468 landmarks
        const landmarks = new Float32Array(468 * 3);
        for (let i = 0; i < landmarks.length; i++) {
          landmarks[i] = Math.random();
        }
        return {landmarks};
      },
    };
  }

  getFaceMeshModel(): TFLiteModel {
    if (!this.faceMeshModel) {
      throw new Error('Face mesh model not loaded. Call loadModels() first.');
    }
    return this.faceMeshModel;
  }

  getEmbeddingModel(): TFLiteModel {
    if (!this.embeddingModel) {
      throw new Error('Embedding model not loaded. Call loadModels() first.');
    }
    return this.embeddingModel;
  }

  unloadModels(): void {
    this.faceMeshModel = null;
    this.embeddingModel = null;
    this.loadingPromise = null;
    logger.info('ML models unloaded');
  }

  get isLoaded(): boolean {
    return !!this.faceMeshModel && !!this.embeddingModel;
  }
}

export default ModelLoader;
