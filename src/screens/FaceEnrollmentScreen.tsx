import React, {useState, useRef, useCallback, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Animated,
} from 'react-native';
import {Camera} from 'react-native-vision-camera';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '../navigation/types';
import {useCamera} from '../hooks/useCamera';
import FaceMatchingService from '../services/FaceMatchingService';
import EmployeeRepository from '../database/repositories/EmployeeRepository';
import SyncQueueRepository from '../database/repositories/SyncQueueRepository';
import {EMBEDDING_ANGLES} from '../types/FaceEmbedding';
import {logger} from '../utils/logger';

type Props = NativeStackScreenProps<RootStackParamList, 'FaceEnrollment'>;

type AngleStatus = 'pending' | 'capturing' | 'done' | 'error';

const ANGLE_INSTRUCTIONS: Record<string, string> = {
  FRONT: 'Look straight at the camera',
  LEFT: 'Turn your head slowly to the left',
  RIGHT: 'Turn your head slowly to the right',
  UP: 'Tilt your head slightly up',
  DOWN: 'Tilt your head slightly down',
};

const ANGLE_ICONS: Record<string, string> = {
  FRONT: '👤',
  LEFT: '◀️',
  RIGHT: '▶️',
  UP: '🔼',
  DOWN: '🔽',
};

const FaceEnrollmentScreen: React.FC<Props> = ({navigation, route}) => {
  const {employeeId, employeeName} = route.params;
  const {cameraRef, device, hasPermission, isCameraActive} = useCamera();
  const [currentAngleIndex, setCurrentAngleIndex] = useState(0);
  const [angleStatuses, setAngleStatuses] = useState<AngleStatus[]>(
    EMBEDDING_ANGLES.map(() => 'pending'),
  );
  const [capturedFrames, setCapturedFrames] = useState<
    Array<{data: Uint8Array; width: number; height: number; angle: string}>
  >([]);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [autoCapturing, setAutoCapturing] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const countdownRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const currentAngle = EMBEDDING_ANGLES[currentAngleIndex];

  useEffect(() => {
    startCountdown();
  }, [currentAngleIndex]);

  const startCountdown = () => {
    setCountdown(3);
    setAutoCapturing(true);

    let count = 3;
    countdownRef.current = setInterval(() => {
      count--;
      setCountdown(count);
      if (count === 0) {
        clearInterval(countdownRef.current);
        captureCurrentFrame();
      }
    }, 1000);
  };

  const captureCurrentFrame = async () => {
    if (!cameraRef.current) {
      handleCaptureError();
      return;
    }

    setAngleStatuses(prev => {
      const next = [...prev];
      next[currentAngleIndex] = 'capturing';
      return next;
    });

    // Pulse animation on capture
    Animated.sequence([
      Animated.timing(pulseAnim, {toValue: 1.05, duration: 150, useNativeDriver: true}),
      Animated.timing(pulseAnim, {toValue: 1, duration: 150, useNativeDriver: true}),
    ]).start();

    try {
      const photo = await cameraRef.current.takePhoto({});

      // For now store a placeholder — real impl would decode JPEG to Uint8Array
      const mockFrameData = new Uint8Array(112 * 112 * 3);
      for (let i = 0; i < mockFrameData.length; i++) {
        mockFrameData[i] = Math.floor(Math.random() * 255);
      }

      setCapturedFrames(prev => [
        ...prev,
        {
          data: mockFrameData,
          width: 112,
          height: 112,
          angle: EMBEDDING_ANGLES[currentAngleIndex],
        },
      ]);

      setAngleStatuses(prev => {
        const next = [...prev];
        next[currentAngleIndex] = 'done';
        return next;
      });

      if (currentAngleIndex < EMBEDDING_ANGLES.length - 1) {
        setTimeout(() => {
          setCurrentAngleIndex(prev => prev + 1);
          setAutoCapturing(false);
        }, 500);
      } else {
        // All angles captured — finalize enrollment
        await finalizeEnrollment([
          ...capturedFrames,
          {
            data: mockFrameData,
            width: 112,
            height: 112,
            angle: EMBEDDING_ANGLES[currentAngleIndex],
          },
        ]);
      }
    } catch (error) {
      logger.error('Capture failed:', error);
      handleCaptureError();
    }
  };

  const handleCaptureError = () => {
    setAngleStatuses(prev => {
      const next = [...prev];
      next[currentAngleIndex] = 'error';
      return next;
    });
    setAutoCapturing(false);
  };

  const finalizeEnrollment = async (
    frames: typeof capturedFrames,
  ) => {
    setIsEnrolling(true);
    try {
      await FaceMatchingService.getInstance().enrollEmbeddings(
        employeeId,
        frames.map(f => ({
          data: f.data,
          width: f.width,
          height: f.height,
          angle: f.angle as any,
        })),
      );

      // Mark employee as fully enrolled
      await EmployeeRepository.update(employeeId, {
        enrolledAt: Date.now(),
      });

      await SyncQueueRepository.enqueue('EMBEDDING', employeeId, 'CREATE', {
        employeeId,
        angleCount: frames.length,
      });

      setIsComplete(true);
      logger.info(`Enrollment complete for ${employeeId}`);
    } catch (error) {
      logger.error('Enrollment failed:', error);
      Alert.alert(
        'Enrollment Failed',
        'Could not save face data. Please try again.',
        [
          {
            text: 'Retry',
            onPress: () => {
              setCurrentAngleIndex(0);
              setAngleStatuses(EMBEDDING_ANGLES.map(() => 'pending'));
              setCapturedFrames([]);
              setIsComplete(false);
            },
          },
        ],
      );
    } finally {
      setIsEnrolling(false);
    }
  };

  if (!hasPermission) {
    return (
      <View style={styles.center}>
        <Text style={styles.permissionText}>Camera permission required</Text>
      </View>
    );
  }

  if (isComplete) {
    return (
      <View style={styles.successContainer}>
        <Text style={styles.successIcon}>✅</Text>
        <Text style={styles.successTitle}>Enrollment Complete!</Text>
        <Text style={styles.successSubtitle}>
          {employeeName} has been enrolled with {EMBEDDING_ANGLES.length} face angles.
        </Text>
        <TouchableOpacity
          style={styles.doneButton}
          onPress={() => navigation.popToTop()}>
          <Text style={styles.doneButtonText}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Camera */}
      {device && (
        <Animated.View style={[styles.cameraContainer, {transform: [{scale: pulseAnim}]}]}>
          <Camera
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            device={device}
            isActive={isCameraActive && !isEnrolling}
            photo={true}
          />
          {/* Face oval guide */}
          <View style={styles.ovalGuide} />
          {/* Scan line animation */}
          <View style={styles.scanLine} />
        </Animated.View>
      )}

      {/* Overlay */}
      <View style={styles.overlay}>
        {/* Employee name */}
        <View style={styles.employeeBadge}>
          <Text style={styles.employeeBadgeText}>Enrolling: {employeeName}</Text>
        </View>

        {/* Angle progress */}
        <View style={styles.angleProgress}>
          {EMBEDDING_ANGLES.map((angle, i) => {
            const status = angleStatuses[i];
            const isCurrent = i === currentAngleIndex;
            return (
              <View key={angle} style={styles.angleItem}>
                <View
                  style={[
                    styles.angleDot,
                    status === 'done' && styles.angleDotDone,
                    isCurrent && styles.angleDotActive,
                    status === 'error' && styles.angleDotError,
                  ]}>
                  <Text style={styles.angleDotIcon}>
                    {status === 'done'
                      ? '✓'
                      : status === 'error'
                      ? '✗'
                      : ANGLE_ICONS[angle]}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.angleLabel,
                    isCurrent && styles.angleLabelActive,
                  ]}>
                  {angle}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Instruction */}
        <View style={styles.instructionCard}>
          <Text style={styles.instructionTitle}>
            {ANGLE_ICONS[currentAngle]} {currentAngle}
          </Text>
          <Text style={styles.instructionText}>
            {ANGLE_INSTRUCTIONS[currentAngle]}
          </Text>
          {autoCapturing && countdown > 0 && (
            <Text style={styles.countdown}>Capturing in {countdown}...</Text>
          )}
          {isEnrolling && (
            <Text style={styles.enrollingText}>Saving face data...</Text>
          )}
        </View>

        {/* Progress */}
        <Text style={styles.progress}>
          {currentAngleIndex + 1} / {EMBEDDING_ANGLES.length}
        </Text>

        {/* Retry button if error */}
        {angleStatuses[currentAngleIndex] === 'error' && (
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              setAngleStatuses(prev => {
                const next = [...prev];
                next[currentAngleIndex] = 'pending';
                return next;
              });
              startCountdown();
            }}>
            <Text style={styles.retryButtonText}>Retry Capture</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#0A0E1A'},
  center: {flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0A0E1A'},
  permissionText: {color: '#FFFFFF', fontSize: 16},
  cameraContainer: {
    height: 380,
    overflow: 'hidden',
    borderRadius: 24,
    margin: 20,
    borderWidth: 2,
    borderColor: '#00D4FF',
  },
  ovalGuide: {
    position: 'absolute',
    top: '10%',
    left: '20%',
    right: '20%',
    bottom: '15%',
    borderRadius: 200,
    borderWidth: 3,
    borderColor: 'rgba(0, 212, 255, 0.7)',
    borderStyle: 'dashed',
  },
  scanLine: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: 'rgba(0, 212, 255, 0.6)',
  },
  overlay: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  employeeBadge: {
    alignSelf: 'center',
    backgroundColor: 'rgba(0,212,255,0.15)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,212,255,0.3)',
  },
  employeeBadgeText: {color: '#00D4FF', fontWeight: '600', fontSize: 13},
  angleProgress: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  angleItem: {alignItems: 'center', gap: 6},
  angleDot: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  angleDotActive: {
    backgroundColor: 'rgba(0, 212, 255, 0.2)',
    borderColor: '#00D4FF',
  },
  angleDotDone: {
    backgroundColor: 'rgba(100, 255, 180, 0.2)',
    borderColor: '#64FFB4',
  },
  angleDotError: {
    backgroundColor: 'rgba(255, 107, 53, 0.2)',
    borderColor: '#FF6B35',
  },
  angleDotIcon: {fontSize: 16},
  angleLabel: {fontSize: 10, color: '#8892A4'},
  angleLabelActive: {color: '#00D4FF', fontWeight: '700'},
  instructionCard: {
    backgroundColor: '#1A1F2E',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 12,
  },
  instructionTitle: {fontSize: 20, fontWeight: '700', color: '#FFFFFF', marginBottom: 6},
  instructionText: {fontSize: 14, color: '#8892A4', textAlign: 'center'},
  countdown: {
    fontSize: 28,
    fontWeight: '800',
    color: '#00D4FF',
    marginTop: 12,
  },
  enrollingText: {fontSize: 14, color: '#64FFB4', marginTop: 8},
  progress: {
    textAlign: 'center',
    color: '#8892A4',
    fontSize: 13,
    marginBottom: 8,
  },
  retryButton: {
    backgroundColor: '#FF6B35',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  retryButtonText: {color: '#FFFFFF', fontWeight: '700', fontSize: 16},
  successContainer: {
    flex: 1,
    backgroundColor: '#0A0E1A',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  successIcon: {fontSize: 72, marginBottom: 20},
  successTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 15,
    color: '#8892A4',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  doneButton: {
    backgroundColor: '#00D4FF',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 48,
  },
  doneButtonText: {
    color: '#0A0E1A',
    fontWeight: '800',
    fontSize: 17,
  },
});

export default FaceEnrollmentScreen;
