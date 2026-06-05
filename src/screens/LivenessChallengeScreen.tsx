import React, {useEffect, useRef, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Alert,
} from 'react-native';
import {Camera} from 'react-native-vision-camera';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '../navigation/types';
import {useCamera} from '../hooks/useCamera';
import {useLiveness} from '../hooks/useLiveness';
import AttendanceRepository from '../database/repositories/AttendanceRepository';
import SyncQueueRepository from '../database/repositories/SyncQueueRepository';
import DeviceIntegrityService from '../services/DeviceIntegrityService';
import {ChallengeAction} from '../types/LivenessChallenge';
import {logger} from '../utils/logger';
import dayjs from 'dayjs';

type Props = NativeStackScreenProps<RootStackParamList, 'LivenessChallenge'>;

const ACTION_ICONS: Record<ChallengeAction, string> = {
  BLINK: '👁️',
  SMILE: '😊',
  TURN_LEFT: '◀️',
  TURN_RIGHT: '▶️',
};

const ACTION_LABELS: Record<ChallengeAction, string> = {
  BLINK: 'Please BLINK',
  SMILE: 'Please SMILE',
  TURN_LEFT: 'Turn HEAD LEFT',
  TURN_RIGHT: 'Turn HEAD RIGHT',
};

const CHALLENGE_TIMEOUT = 30;

const LivenessChallengeScreen: React.FC<Props> = ({navigation, route}) => {
  const {employeeId, employeeName, matchScore} = route.params;
  const {cameraRef, device, hasPermission, isCameraActive} = useCamera();
  const {
    challenge,
    startChallenge,
    evaluateMetrics,
    livenessScore,
    isComplete,
    isPassed,
  } = useLiveness();

  const [timeLeft, setTimeLeft] = useState(CHALLENGE_TIMEOUT);
  const [isRecording, setIsRecording] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const successAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    startChallenge();
    startTimer();
    setIsRecording(true);
    return () => {
      clearInterval(timerRef.current);
    };
  }, []);

  const startTimer = () => {
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleLivenessResult(false, 0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    if (isComplete) {
      clearInterval(timerRef.current);
      setIsRecording(false);

      if (isPassed) {
        Animated.spring(successAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }).start();
      }

      // Auto navigate after showing result
      setTimeout(() => {
        handleLivenessResult(isPassed, livenessScore);
      }, 2000);
    }
  }, [isComplete, isPassed, livenessScore]);

  const handleLivenessResult = async (passed: boolean, score: number) => {
    if (!passed) {
      navigation.goBack();
      return;
    }

    try {
      const deviceId = await DeviceIntegrityService.getInstance().getDeviceFingerprint();
      // Determine check-in or check-out
      const lastRecord = await AttendanceRepository.getLastAttendance(employeeId);
      const type =
        !lastRecord || lastRecord.type === 'CHECK_OUT'
          ? 'CHECK_IN'
          : 'CHECK_OUT';

      const record = await AttendanceRepository.record({
        employeeId,
        type,
        livenessScore: score,
        matchScore,
        deviceId,
      });

      await SyncQueueRepository.enqueue('ATTENDANCE', record.id, 'CREATE', record);
      logger.info(`Attendance recorded: ${type} for ${employeeId}`);

      // Navigate to success screen (back to attendance with success state)
      Alert.alert(
        `${type === 'CHECK_IN' ? '✅ Checked In' : '🏁 Checked Out'}`,
        `Welcome, ${employeeName}!\n${dayjs().format('DD MMM YYYY, HH:mm')}`,
        [
          {
            text: 'Done',
            onPress: () => navigation.popToTop(),
          },
        ],
      );
    } catch (error) {
      logger.error('Failed to record attendance:', error);
      Alert.alert('Error', 'Failed to record attendance. Please try again.');
      navigation.goBack();
    }
  };

  // Simulate liveness detection (tap to complete for demo)
  const simulateAction = () => {
    if (!challenge) {
      return;
    }
    const pendingAction = challenge.actions.find(
      a => !challenge.completedActions.includes(a),
    );
    if (pendingAction) {
      // Generate mock metrics that would trigger the action
      const mockMetrics = {
        earLeft: pendingAction === 'BLINK' ? 0.15 : 0.35,
        earRight: pendingAction === 'BLINK' ? 0.15 : 0.35,
        mar: pendingAction === 'SMILE' ? 0.8 : 0.3,
        yaw:
          pendingAction === 'TURN_LEFT'
            ? 25
            : pendingAction === 'TURN_RIGHT'
            ? -25
            : 0,
        pitch: 0,
        roll: 0,
      };
      evaluateMetrics(mockMetrics);
    }
  };

  const currentAction = challenge?.actions.find(
    a => !challenge.completedActions.includes(a),
  );

  const timerColor =
    timeLeft > 20 ? '#00D4FF' : timeLeft > 10 ? '#FFB347' : '#FF6B35';

  return (
    <View style={styles.container}>
      {/* Camera */}
      {device && (
        <View style={styles.cameraContainer}>
          <Camera
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            device={device}
            isActive={isCameraActive && isRecording}
          />
          {/* Landmark overlay placeholder */}
          <View style={styles.faceOutline} />

          {/* Timer */}
          <View style={styles.timerBadge}>
            <Text style={[styles.timerText, {color: timerColor}]}>
              {timeLeft}s
            </Text>
          </View>
        </View>
      )}

      {/* Challenge Panel */}
      <View style={styles.panel}>
        {/* Progress Steps */}
        <View style={styles.stepsRow}>
          {challenge?.actions.map((action, i) => {
            const done = challenge.completedActions.includes(action);
            const isCurrent = action === currentAction;
            return (
              <View key={action} style={styles.stepItem}>
                <View
                  style={[
                    styles.stepCircle,
                    done && styles.stepCircleDone,
                    isCurrent && styles.stepCircleCurrent,
                  ]}>
                  <Text style={styles.stepIcon}>
                    {done ? '✓' : ACTION_ICONS[action]}
                  </Text>
                </View>
                <Text style={[styles.stepLabel, done && styles.stepLabelDone]}>
                  {action}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Current Action */}
        {!isComplete && currentAction && (
          <View style={styles.actionCard}>
            <Text style={styles.actionIcon}>{ACTION_ICONS[currentAction]}</Text>
            <Text style={styles.actionLabel}>{ACTION_LABELS[currentAction]}</Text>
          </View>
        )}

        {/* Completed */}
        {isComplete && (
          <Animated.View
            style={[
              styles.resultCard,
              isPassed ? styles.resultCardSuccess : styles.resultCardFail,
              {transform: [{scale: successAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.8, 1],
              })}]},
            ]}>
            <Text style={styles.resultIcon}>{isPassed ? '✅' : '❌'}</Text>
            <Text style={styles.resultText}>
              {isPassed ? 'Liveness Verified!' : 'Liveness Failed'}
            </Text>
          </Animated.View>
        )}

        {/* Demo tap button */}
        {!isComplete && currentAction && (
          <TouchableOpacity
            style={styles.demoButton}
            onPress={simulateAction}
            activeOpacity={0.85}>
            <Text style={styles.demoButtonText}>
              Tap to Simulate: {currentAction}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#0A0E1A'},
  cameraContainer: {
    height: 360,
    margin: 20,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#00D4FF',
  },
  faceOutline: {
    position: 'absolute',
    top: '10%',
    left: '25%',
    right: '25%',
    bottom: '10%',
    borderRadius: 200,
    borderWidth: 2,
    borderColor: 'rgba(0,212,255,0.5)',
  },
  timerBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  timerText: {
    fontSize: 18,
    fontWeight: '800',
  },
  panel: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  stepsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 32,
    marginBottom: 20,
  },
  stepItem: {alignItems: 'center', gap: 6},
  stepCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleCurrent: {
    backgroundColor: 'rgba(0,212,255,0.2)',
    borderColor: '#00D4FF',
  },
  stepCircleDone: {
    backgroundColor: 'rgba(100,255,180,0.2)',
    borderColor: '#64FFB4',
  },
  stepIcon: {fontSize: 22},
  stepLabel: {fontSize: 11, color: '#8892A4', textTransform: 'uppercase'},
  stepLabelDone: {color: '#64FFB4'},
  actionCard: {
    backgroundColor: '#1A1F2E',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,212,255,0.3)',
    marginBottom: 16,
  },
  actionIcon: {fontSize: 48, marginBottom: 12},
  actionLabel: {fontSize: 22, fontWeight: '800', color: '#FFFFFF'},
  resultCard: {
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    marginBottom: 16,
  },
  resultCardSuccess: {
    backgroundColor: 'rgba(100,255,180,0.1)',
    borderColor: '#64FFB4',
  },
  resultCardFail: {
    backgroundColor: 'rgba(255,107,53,0.1)',
    borderColor: '#FF6B35',
  },
  resultIcon: {fontSize: 48, marginBottom: 8},
  resultText: {fontSize: 22, fontWeight: '800', color: '#FFFFFF'},
  demoButton: {
    backgroundColor: 'rgba(0,212,255,0.15)',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,212,255,0.3)',
  },
  demoButtonText: {
    color: '#00D4FF',
    fontWeight: '700',
    fontSize: 14,
  },
});

export default LivenessChallengeScreen;
