/**
 * VisionCamera frame processor for face detection.
 * Processes every Nth frame to maintain performance.
 *
 * NOTE: Frame processors run on a separate JSI thread.
 * Heavy computation should be offloaded to worklets.
 */

// Frame skip for performance (process every 3rd frame → ~10fps inference at 30fps preview)
const FRAME_SKIP_INTERVAL = 3;
let frameCounter = 0;

export interface FrameProcessorResult {
  hasFrame: boolean;
  frameData?: Uint8Array;
  width?: number;
  height?: number;
}

/**
 * Extracts raw pixel data from a VisionCamera Frame.
 * Returns null if the frame should be skipped.
 *
 * Usage in component:
 *   const frameProcessor = useFrameProcessor((frame) => {
 *     'worklet';
 *     const result = processFrame(frame);
 *     runOnJS(onFrame)(result);
 *   }, []);
 */
export function shouldProcessFrame(): boolean {
  frameCounter = (frameCounter + 1) % FRAME_SKIP_INTERVAL;
  return frameCounter === 0;
}

export function resetFrameCounter(): void {
  frameCounter = 0;
}

/**
 * Convert a YUV frame buffer to an RGB Uint8Array.
 * Simplified NV21/YUV420sp conversion.
 */
export function yuv2rgb(
  yuvData: Uint8Array,
  width: number,
  height: number,
): Uint8Array {
  const rgb = new Uint8Array(width * height * 3);
  const frameSize = width * height;

  for (let j = 0; j < height; j++) {
    for (let i = 0; i < width; i++) {
      const y = (yuvData[j * width + i] & 0xff) - 16;
      const uvIndex = frameSize + (j >> 1) * width + (i & ~1);
      const u = (yuvData[uvIndex] & 0xff) - 128;
      const v = (yuvData[uvIndex + 1] & 0xff) - 128;

      let r = (1.164 * y + 1.596 * v);
      let g = (1.164 * y - 0.392 * u - 0.813 * v);
      let b = (1.164 * y + 2.017 * u);

      r = Math.max(0, Math.min(255, r));
      g = Math.max(0, Math.min(255, g));
      b = Math.max(0, Math.min(255, b));

      const idx = (j * width + i) * 3;
      rgb[idx] = r;
      rgb[idx + 1] = g;
      rgb[idx + 2] = b;
    }
  }
  return rgb;
}

/**
 * Apply simple contrast normalization for outdoor/dark conditions.
 * Uses histogram equalization approximation.
 */
export function normalizeContrast(rgb: Uint8Array): Uint8Array {
  const result = new Uint8Array(rgb.length);
  let min = 255;
  let max = 0;

  for (let i = 0; i < rgb.length; i++) {
    if (rgb[i] < min) {
      min = rgb[i];
    }
    if (rgb[i] > max) {
      max = rgb[i];
    }
  }

  const range = max - min || 1;
  for (let i = 0; i < rgb.length; i++) {
    result[i] = Math.round(((rgb[i] - min) / range) * 255);
  }
  return result;
}
