import {v4 as uuidv4} from 'uuid';
import {
  LivenessChallenge,
  LivenessChallengeUpdate,
  LivenessMetrics,
  HeadPose,
  ChallengeAction,
  Landmark,
} from '../types/LivenessChallenge';
import FaceDetector, {LANDMARKS} from '../ml/FaceDetector';
import {logger} from '../utils/logger';

const BLINK_EAR_THRESHOLD = 0.25;
const BLINK_CONSECUTIVE_FRAMES = 2;
const SMILE_RATIO_THRESHOLD = 0.6;
const HEAD_TURN_YAW_THRESHOLD = 20; // degrees
const LIVENESS_TIMEOUT_MS = 30_000;

class LivenessService {
  private blinkFrameCounter = 0;
  private previousEAR = 1.0;

  /**
   * Eye Aspect Ratio — detects blink when EAR drops below threshold.
   * Formula: EAR = (||p2-p6|| + ||p3-p5||) / (2 * ||p1-p4||)
   */
  calculateEAR(eyeLandmarks: Landmark[]): number {
    const [p1, p2, p3, p4, p5, p6] = eyeLandmarks;
    const v1 = this.dist2D(p2, p6);
    const v2 = this.dist2D(p3, p5);
    const h = this.dist2D(p1, p4);
    if (h === 0) {
      return 1;
    }
    return (v1 + v2) / (2 * h);
  }

  /**
   * Mouth Aspect Ratio — detects smile.
   * Ratio: horizontal distance / vertical opening.
   */
  calculateMAR(mouthLandmarks: Landmark[]): number {
    const [leftCorner, rightCorner, topLip, , , bottomLip] = mouthLandmarks;
    const horizontal = this.dist2D(leftCorner, rightCorner);
    const vertical = this.dist2D(topLip, bottomLip);
    if (vertical === 0) {
      return 0;
    }
    return horizontal / vertical;
  }

  /**
   * Estimate head pose (yaw, pitch, roll) from 6 key facial landmarks.
   * Uses a simplified 2D→3D projection approach.
   */
  estimateHeadPose(landmarks: Landmark[]): HeadPose {
    const keypoints = FaceDetector.getPoseKeypoints(landmarks);
    const noseTip = keypoints[0];
    const chin = keypoints[1];
    const leftEye = keypoints[2];
    const rightEye = keypoints[3];

    // Yaw: horizontal asymmetry between nose and eye center
    const eyeCenterX = (leftEye.x + rightEye.x) / 2;
    const yaw = (noseTip.x - eyeCenterX) * 180; // rough degrees

    // Pitch: vertical relationship nose-chin vs eye center
    const eyeCenterY = (leftEye.y + rightEye.y) / 2;
    const pitch = (noseTip.y - eyeCenterY) * 90;

    // Roll: tilt of eye line
    const roll =
      Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x) *
      (180 / Math.PI);

    return {yaw, pitch, roll};
  }

  /**
   * Compute LivenessMetrics from current frame landmarks.
   */
  computeMetrics(landmarks: Landmark[]): LivenessMetrics {
    const leftEyeLMs = FaceDetector.getEyeLandmarks(landmarks, 'left');
    const rightEyeLMs = FaceDetector.getEyeLandmarks(landmarks, 'right');
    const mouthLMs = FaceDetector.getMouthLandmarks(landmarks);
    const pose = this.estimateHeadPose(landmarks);

    return {
      earLeft: this.calculateEAR(leftEyeLMs),
      earRight: this.calculateEAR(rightEyeLMs),
      mar: this.calculateMAR(mouthLMs),
      yaw: pose.yaw,
      pitch: pose.pitch,
      roll: pose.roll,
    };
  }

  /**
   * Generate a new liveness challenge with 2 random actions.
   */
  generateChallenge(): LivenessChallenge {
    const allActions: ChallengeAction[] = [
      'BLINK',
      'SMILE',
      'TURN_LEFT',
      'TURN_RIGHT',
    ];
    const shuffled = [...allActions].sort(() => Math.random() - 0.5);
    return {
      id: uuidv4(),
      actions: [shuffled[0], shuffled[1]],
      completedActions: [],
      startedAt: Date.now(),
      completedAt: null,
      isPassed: false,
    };
  }

  /**
   * Evaluate the current frame metrics against the pending challenge.
   * Returns updated challenge state.
   */
  evaluateFrame(
    metrics: LivenessMetrics,
    challenge: LivenessChallenge,
  ): LivenessChallengeUpdate {
    if (challenge.isPassed || challenge.completedAt !== null) {
      return {challenge, newlyCompleted: null};
    }

    // Check for timeout
    if (Date.now() - challenge.startedAt > LIVENESS_TIMEOUT_MS) {
      const failed = {...challenge, isPassed: false, completedAt: Date.now()};
      return {challenge: failed, newlyCompleted: null};
    }

    const pendingActions = challenge.actions.filter(
      a => !challenge.completedActions.includes(a),
    );
    const nextAction = pendingActions[0];
    if (!nextAction) {
      return {challenge, newlyCompleted: null};
    }

    let detected = false;

    switch (nextAction) {
      case 'BLINK':
        detected = this.detectBlink(metrics);
        break;
      case 'SMILE':
        detected = metrics.mar > SMILE_RATIO_THRESHOLD;
        break;
      case 'TURN_LEFT':
        detected = metrics.yaw > HEAD_TURN_YAW_THRESHOLD;
        break;
      case 'TURN_RIGHT':
        detected = metrics.yaw < -HEAD_TURN_YAW_THRESHOLD;
        break;
    }

    if (!detected) {
      return {challenge, newlyCompleted: null};
    }

    const newCompleted = [...challenge.completedActions, nextAction];
    const isPassed = newCompleted.length >= challenge.actions.length;
    const updated: LivenessChallenge = {
      ...challenge,
      completedActions: newCompleted,
      isPassed,
      completedAt: isPassed ? Date.now() : null,
    };

    return {challenge: updated, newlyCompleted: nextAction};
  }

  /**
   * Compute an overall liveness score [0, 1].
   */
  computeScore(challenge: LivenessChallenge): number {
    return challenge.completedActions.length / challenge.actions.length;
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private detectBlink(metrics: LivenessMetrics): boolean {
    const avgEAR = (metrics.earLeft + metrics.earRight) / 2;
    const isClosed = avgEAR < BLINK_EAR_THRESHOLD;

    if (isClosed) {
      this.blinkFrameCounter++;
    } else {
      if (this.blinkFrameCounter >= BLINK_CONSECUTIVE_FRAMES) {
        this.blinkFrameCounter = 0;
        return true; // Completed blink
      }
      this.blinkFrameCounter = 0;
    }
    this.previousEAR = avgEAR;
    return false;
  }

  private dist2D(a: Landmark, b: Landmark): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
}

export default new LivenessService();
