import {useState, useCallback, useRef} from 'react';
import {
  LivenessChallenge,
  LivenessMetrics,
} from '../types/LivenessChallenge';
import LivenessService from '../services/LivenessService';

export interface UseLivenessReturn {
  challenge: LivenessChallenge | null;
  startChallenge: () => void;
  evaluateMetrics: (metrics: LivenessMetrics) => void;
  livenessScore: number;
  isComplete: boolean;
  isPassed: boolean;
  reset: () => void;
}

export function useLiveness(): UseLivenessReturn {
  const [challenge, setChallenge] = useState<LivenessChallenge | null>(null);
  const [livenessScore, setLivenessScore] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [isPassed, setIsPassed] = useState(false);

  const startChallenge = useCallback(() => {
    const c = LivenessService.generateChallenge();
    setChallenge(c);
    setLivenessScore(0);
    setIsComplete(false);
    setIsPassed(false);
  }, []);

  const evaluateMetrics = useCallback(
    (metrics: LivenessMetrics) => {
      if (!challenge || isComplete) {
        return;
      }

      const {challenge: updated} = LivenessService.evaluateFrame(
        metrics,
        challenge,
      );

      const score = LivenessService.computeScore(updated);
      setChallenge(updated);
      setLivenessScore(score);

      if (updated.isPassed || updated.completedAt !== null) {
        setIsComplete(true);
        setIsPassed(updated.isPassed);
      }
    },
    [challenge, isComplete],
  );

  const reset = useCallback(() => {
    setChallenge(null);
    setLivenessScore(0);
    setIsComplete(false);
    setIsPassed(false);
  }, []);

  return {
    challenge,
    startChallenge,
    evaluateMetrics,
    livenessScore,
    isComplete,
    isPassed,
    reset,
  };
}
