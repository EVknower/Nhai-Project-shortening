import LivenessService from '../../src/services/LivenessService';
import {Landmark} from '../../src/types/LivenessChallenge';

// Helper: create a landmark array for eye aspect ratio tests
function makeEyeLandmarks(ear: number): Landmark[] {
  const h = 1.0;
  const v = ear;

  return [
    {x: 0.0, y: 0.0, z: 0},    // p1 (left corner)
    {x: 0.33, y: v / 2, z: 0},  // p2
    {x: 0.67, y: v / 2, z: 0},  // p3
    {x: h, y: 0.0, z: 0},       // p4 (right corner)
    {x: 0.67, y: -v / 2, z: 0}, // p5
    {x: 0.33, y: -v / 2, z: 0}, // p6
  ];
}

describe('LivenessService.calculateEAR', () => {
  it('returns ~0.35 for open eye (not blinking)', () => {
    const landmarks = makeEyeLandmarks(0.35);
    const ear = LivenessService.calculateEAR(landmarks);
    expect(ear).toBeCloseTo(0.35, 1);
  });

  it('returns ~0.18 for closed eye (blinking)', () => {
    const landmarks = makeEyeLandmarks(0.18);
    const ear = LivenessService.calculateEAR(landmarks);
    expect(ear).toBeCloseTo(0.18, 1);
  });

  it('correctly identifies boundary at 0.25', () => {
    const closedLandmarks = makeEyeLandmarks(0.20);
    const openLandmarks = makeEyeLandmarks(0.30);
    expect(LivenessService.calculateEAR(closedLandmarks)).toBeLessThan(0.25);
    expect(LivenessService.calculateEAR(openLandmarks)).toBeGreaterThan(0.25);
  });
});

describe('LivenessService.generateChallenge', () => {
  it('always returns exactly 2 actions', () => {
    for (let i = 0; i < 20; i++) {
      const challenge = LivenessService.generateChallenge();
      expect(challenge.actions).toHaveLength(2);
    }
  });

  it('actions are from valid set', () => {
    const validActions = ['BLINK', 'SMILE', 'TURN_LEFT', 'TURN_RIGHT'];
    for (let i = 0; i < 20; i++) {
      const challenge = LivenessService.generateChallenge();
      challenge.actions.forEach(action => {
        expect(validActions).toContain(action);
      });
    }
  });

  it('produces varied challenges across multiple calls', () => {
    const seenCombos = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const challenge = LivenessService.generateChallenge();
      seenCombos.add(challenge.actions.sort().join('-'));
    }
    // Should see more than 1 unique combination in 50 tries
    expect(seenCombos.size).toBeGreaterThan(1);
  });

  it('starts with empty completedActions', () => {
    const challenge = LivenessService.generateChallenge();
    expect(challenge.completedActions).toHaveLength(0);
    expect(challenge.isPassed).toBe(false);
    expect(challenge.completedAt).toBeNull();
  });
});

describe('LivenessService.evaluateFrame — TURN_LEFT', () => {
  it('detects TURN_LEFT when yaw > 20', () => {
    const challenge = LivenessService.generateChallenge();
    // Force the challenge to have TURN_LEFT as first action
    (challenge as any).actions = ['TURN_LEFT', 'BLINK'];

    const metrics = {
      earLeft: 0.35,
      earRight: 0.35,
      mar: 0.3,
      yaw: 25, // > 20 → TURN_LEFT detected
      pitch: 0,
      roll: 0,
    };

    const {challenge: updated, newlyCompleted} = LivenessService.evaluateFrame(
      metrics,
      challenge,
    );

    expect(newlyCompleted).toBe('TURN_LEFT');
    expect(updated.completedActions).toContain('TURN_LEFT');
  });

  it('does not detect TURN_LEFT when yaw < 20', () => {
    const challenge = LivenessService.generateChallenge();
    (challenge as any).actions = ['TURN_LEFT', 'BLINK'];

    const metrics = {
      earLeft: 0.35,
      earRight: 0.35,
      mar: 0.3,
      yaw: 10, // < 20 → not detected
      pitch: 0,
      roll: 0,
    };

    const {newlyCompleted} = LivenessService.evaluateFrame(metrics, challenge);
    expect(newlyCompleted).toBeNull();
  });
});
