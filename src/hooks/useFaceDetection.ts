import {useState, useCallback, useRef} from 'react';
import {FaceDetectionResult, LivenessMetrics} from '../types/LivenessChallenge';
import FaceDetector from '../ml/FaceDetector';
import LivenessService from '../services/LivenessService';
import {shouldProcessFrame} from '../utils/frameProcessor';
import {logger} from '../utils/logger';

export interface UseFaceDetectionReturn {
  faceResult: FaceDetectionResult | null;
  metrics: LivenessMetrics | null;
  isDetecting: boolean;
  processFrame: (
    frameData: Uint8Array,
    width: number,
    height: number,
  ) => Promise<void>;
  reset: () => void;
}

export function useFaceDetection(): UseFaceDetectionReturn {
  const [faceResult, setFaceResult] = useState<FaceDetectionResult | null>(null);
  const [metrics, setMetrics] = useState<LivenessMetrics | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const isProcessing = useRef(false);

  const processFrame = useCallback(
    async (frameData: Uint8Array, width: number, height: number) => {
      // Skip frames for performance
      if (!shouldProcessFrame() || isProcessing.current) {
        return;
      }

      isProcessing.current = true;
      try {
        const result = await FaceDetector.detectFace(frameData, width, height);
        setFaceResult(result);

        if (result) {
          const m = LivenessService.computeMetrics(result.landmarks);
          setMetrics(m);
          setIsDetecting(true);
        } else {
          setMetrics(null);
          setIsDetecting(false);
        }
      } catch (error) {
        logger.error('Frame processing error:', error);
      } finally {
        isProcessing.current = false;
      }
    },
    [],
  );

  const reset = useCallback(() => {
    setFaceResult(null);
    setMetrics(null);
    setIsDetecting(false);
    isProcessing.current = false;
  }, []);

  return {faceResult, metrics, isDetecting, processFrame, reset};
}
