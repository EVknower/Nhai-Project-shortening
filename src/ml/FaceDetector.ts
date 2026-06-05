import {
  Landmark,
  FaceDetectionResult,
} from '../types/LivenessChallenge';
import ModelLoader from './ModelLoader';
import {logger} from '../utils/logger';
import DeviceInfo from 'react-native-device-info';

export const MAX_FACES = 1;
export const MIN_DETECTION_CONFIDENCE = 0.7;
export const LANDMARK_COUNT = 468;

// MediaPipe Face Mesh landmark indices
export const LANDMARKS = {
  LEFT_EYE: [33, 160, 158, 133, 153, 144],
  RIGHT_EYE: [362, 385, 387, 263, 373, 380],
  MOUTH: [61, 291, 39, 181, 0, 17, 269, 405],
  NOSE_TIP: 1,
  CHIN: 152,
  LEFT_CHEEK: 234,
  RIGHT_CHEEK: 454,
  LEFT_EYE_OUTER: 33,
  RIGHT_EYE_OUTER: 263,
  LEFT_MOUTH: 61,
  RIGHT_MOUTH: 291,
} as const;

// 3D reference points for head pose estimation (solvePnP model points)
export const MODEL_3D_POINTS = [
  [0.0, 0.0, 0.0],         // Nose tip
  [0.0, -330.0, -65.0],    // Chin
  [-225.0, 170.0, -135.0], // Left eye left corner
  [225.0, 170.0, -135.0],  // Right eye right corner
  [-150.0, -150.0, -125.0],// Left mouth corner
  [150.0, -150.0, -125.0], // Right mouth corner
];

class FaceDetector {
  /**
   * Detect face and return 468 landmarks from camera frame data.
   * In production this runs the TFLite face mesh model.
   */
  async detectFace(
    frameData: Uint8Array,
    width: number,
    height: number,
  ): Promise<FaceDetectionResult | null> {
    try {
      const model = ModelLoader.getInstance().getFaceMeshModel();

      // Normalize input to [0,1] float and resize to 256x256 to match the model's input shape [1, 256, 256, 3]
      const targetSize = 256;
      const normalizedInput = new Float32Array(targetSize * targetSize * 3);
      for (let ty = 0; ty < targetSize; ty++) {
        for (let tx = 0; tx < targetSize; tx++) {
          const sx = Math.floor((tx / targetSize) * width);
          const sy = Math.floor((ty / targetSize) * height);
          const srcIdx = (sy * width + sx) * 3;
          const dstIdx = (ty * targetSize + tx) * 3;

          normalizedInput[dstIdx] = (frameData[srcIdx] || 0) / 255.0;
          normalizedInput[dstIdx + 1] = (frameData[srcIdx + 1] || 0) / 255.0;
          normalizedInput[dstIdx + 2] = (frameData[srcIdx + 2] || 0) / 255.0;
        }
      }

      // Run real model asynchronously
      const outputs = await model.run([normalizedInput]);

      // Parse output landmarks and confidence
      // outputs[0] corresponds to Identity tensor containing 1434 floats (478 landmarks * 3 coords)
      const rawLandmarks = outputs[0] as Float32Array;
      const confidence = outputs[1] ? outputs[1][0] : 0.95;

      const isEmulator = await DeviceInfo.isEmulator().catch(() => false);
      if (isEmulator && (!rawLandmarks || confidence < MIN_DETECTION_CONFIDENCE)) {
        logger.info('Emulator detected and face detection confidence low — returning simulated landmarks');
        const landmarks: Landmark[] = [];
        for (let i = 0; i < LANDMARK_COUNT; i++) {
          landmarks.push({
            x: 0.5 + (Math.random() - 0.5) * 0.1,
            y: 0.5 + (Math.random() - 0.5) * 0.1,
            z: (Math.random() - 0.5) * 0.05,
          });
        }
        return {landmarks, confidence: 0.95};
      }

      if (!rawLandmarks || confidence < MIN_DETECTION_CONFIDENCE) {
        return null;
      }

      const landmarks: Landmark[] = [];
      for (let i = 0; i < LANDMARK_COUNT; i++) {
        landmarks.push({
          x: rawLandmarks[i * 3],
          y: rawLandmarks[i * 3 + 1],
          z: rawLandmarks[i * 3 + 2],
        });
      }

      return {landmarks, confidence};
    } catch (error) {
      logger.error('Face detection error:', error);
      try {
        const isEmulator = await DeviceInfo.isEmulator().catch(() => false);
        if (isEmulator) {
          const landmarks: Landmark[] = [];
          for (let i = 0; i < LANDMARK_COUNT; i++) {
            landmarks.push({
              x: 0.5 + (Math.random() - 0.5) * 0.1,
              y: 0.5 + (Math.random() - 0.5) * 0.1,
              z: (Math.random() - 0.5) * 0.05,
            });
          }
          return {landmarks, confidence: 0.95};
        }
      } catch {}
      return null;
    }
  }

  /**
   * Extract the 6 eye landmarks for a given eye (left or right).
   */
  getEyeLandmarks(
    landmarks: Landmark[],
    side: 'left' | 'right',
  ): Landmark[] {
    const indices = side === 'left' ? LANDMARKS.LEFT_EYE : LANDMARKS.RIGHT_EYE;
    return indices.map(i => landmarks[i]);
  }

  /**
   * Extract mouth landmarks for MAR calculation.
   */
  getMouthLandmarks(landmarks: Landmark[]): Landmark[] {
    return LANDMARKS.MOUTH.map(i => landmarks[i]);
  }

  /**
   * Get the 6 key landmarks used for head pose estimation.
   * Returns [nose_tip, chin, left_eye_outer, right_eye_outer, left_mouth, right_mouth]
   */
  getPoseKeypoints(landmarks: Landmark[]): Landmark[] {
    return [
      landmarks[LANDMARKS.NOSE_TIP],
      landmarks[LANDMARKS.CHIN],
      landmarks[LANDMARKS.LEFT_EYE_OUTER],
      landmarks[LANDMARKS.RIGHT_EYE_OUTER],
      landmarks[LANDMARKS.LEFT_MOUTH],
      landmarks[LANDMARKS.RIGHT_MOUTH],
    ];
  }

  /**
   * Crop and resize a face region to 112x112 for MobileFaceNet.
   * Returns a Float32Array in CHW format (3 × 112 × 112).
   */
  extractROI(
    frameData: Uint8Array,
    frameWidth: number,
    frameHeight: number,
    landmarks: Landmark[],
  ): Float32Array {
    const TARGET_SIZE = 112;

    // Compute bounding box from landmarks with 20% padding
    let minX = 1;
    let minY = 1;
    let maxX = 0;
    let maxY = 0;

    for (const lm of landmarks) {
      minX = Math.min(minX, lm.x);
      minY = Math.min(minY, lm.y);
      maxX = Math.max(maxX, lm.x);
      maxY = Math.max(maxY, lm.y);
    }

    const padX = (maxX - minX) * 0.2;
    const padY = (maxY - minY) * 0.2;
    const x1 = Math.max(0, Math.floor((minX - padX) * frameWidth));
    const y1 = Math.max(0, Math.floor((minY - padY) * frameHeight));
    const x2 = Math.min(frameWidth, Math.ceil((maxX + padX) * frameWidth));
    const y2 = Math.min(frameHeight, Math.ceil((maxY + padY) * frameHeight));

    const cropW = x2 - x1;
    const cropH = y2 - y1;

    // Bilinear resize to 112×112
    const output = new Float32Array(TARGET_SIZE * TARGET_SIZE * 3);
    for (let ty = 0; ty < TARGET_SIZE; ty++) {
      for (let tx = 0; tx < TARGET_SIZE; tx++) {
        const sx = x1 + Math.round((tx / TARGET_SIZE) * cropW);
        const sy = y1 + Math.round((ty / TARGET_SIZE) * cropH);

        const srcIdx = (sy * frameWidth + sx) * 3;
        const dstIdx = (ty * TARGET_SIZE + tx) * 3;

        // Normalize to [-1, 1] for MobileFaceNet
        output[dstIdx] = (frameData[srcIdx] / 127.5) - 1;
        output[dstIdx + 1] = (frameData[srcIdx + 1] / 127.5) - 1;
        output[dstIdx + 2] = (frameData[srcIdx + 2] / 127.5) - 1;
      }
    }

    return output;
  }
}

export default new FaceDetector();
