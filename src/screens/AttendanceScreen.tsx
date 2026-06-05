import React, {useState, useCallback, useRef} from 'react';
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
import EmbeddingRepository from '../database/repositories/EmbeddingRepository';
import AttendanceRepository from '../database/repositories/AttendanceRepository';
import SyncQueueRepository from '../database/repositories/SyncQueueRepository';
import DeviceIntegrityService from '../services/DeviceIntegrityService';
import {Employee} from '../types/Employee';
import {MatchResult} from '../types/LivenessChallenge';
import {logger} from '../utils/logger';
import dayjs from 'dayjs';

type Props = NativeStackScreenProps<RootStackParamList, 'Attendance'>;

type FlowState =
  | 'scanning'
  | 'matched'
  | 'no_match'
  | 'liveness'
  | 'success'
  | 'failed';

const AttendanceScreen: React.FC<Props> = ({navigation}) => {
  const {cameraRef, device, hasPermission, isCameraActive} = useCamera();
  const [flowState, setFlowState] = useState<FlowState>('scanning');
  const [matchedEmployee, setMatchedEmployee] = useState<Employee | null>(null);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [successRecord, setSuccessRecord] = useState<{
    name: string;
    timestamp: number;
    type: string;
  } | null>(null);
  const isProcessing = useRef(false);
  const scanIntervalRef = useRef<NodeJS.Timeout>();
  const glowAnim = useRef(new Animated.Value(0)).current;

  const startGlowAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {toValue: 1, duration: 800, useNativeDriver: true}),
        Animated.timing(glowAnim, {toValue: 0, duration: 800, useNativeDriver: true}),
      ]),
    ).start();
  };

  const simulateFaceScan = useCallback(async () => {
    if (isProcessing.current || flowState !== 'scanning') {
      return;
    }
    isProcessing.current = true;
    try {
      // In production: extract real frame data from camera
      // Simulation: try matching with mock data
      const allCandidates = await EmbeddingRepository.getAllEmployeeEmbeddings();

      if (allCandidates.length === 0) {
        Alert.alert(
          'No Employees',
          'No employees are enrolled. Please register employees first.',
        );
        navigation.goBack();
        return;
      }

      // Generate mock probe embedding for demonstration
      const mockProbe = new Float32Array(128);
      for (let i = 0; i < 128; i++) {
        mockProbe[i] = Math.random() * 2 - 1;
      }

      // Normalize
      let norm = 0;
      for (let i = 0; i < 128; i++) {
        norm += mockProbe[i] * mockProbe[i];
      }
      norm = Math.sqrt(norm);
      for (let i = 0; i < 128; i++) {
        mockProbe[i] /= norm;
      }

      const result = FaceMatchingService.getInstance().matchEmployee(
        mockProbe,
        allCandidates,
      );

      if (result) {
        const employee = await EmployeeRepository.findById(result.employeeId);
        if (employee) {
          setMatchedEmployee(employee);
          setMatchResult(result);
          setFlowState('matched');
          startGlowAnimation();

          // Auto-proceed to liveness after 1.5s
          setTimeout(() => {
            navigation.navigate('LivenessChallenge', {
              employeeId: employee.id,
              employeeName: employee.name,
              matchScore: result.similarity,
            });
          }, 1500);
        }
      } else {
        setFlowState('no_match');
        setTimeout(() => setFlowState('scanning'), 3000);
      }
    } catch (error) {
      logger.error('Attendance scan error:', error);
    } finally {
      isProcessing.current = false;
    }
  }, [flowState, navigation, glowAnim]);

  // Listen for liveness result coming back via focus
  React.useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      // Reset if returning from liveness screen
      setFlowState('scanning');
      setMatchedEmployee(null);
      setMatchResult(null);
      isProcessing.current = false;
    });
    return unsubscribe;
  }, [navigation]);

  if (!hasPermission) {
    return (
      <View style={styles.center}>
        <Text style={styles.permText}>Camera permission required</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Camera */}
      {device && (
        <View style={styles.cameraContainer}>
          <Camera
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            device={device}
            isActive={isCameraActive && flowState === 'scanning'}
          />
          {/* Scan overlay */}
          <View style={styles.scanOverlay}>
            <View
              style={[
                styles.faceBox,
                flowState === 'matched' && styles.faceBoxMatched,
                flowState === 'no_match' && styles.faceBoxNoMatch,
              ]}
            />
            <Animated.View
              style={[
                styles.scanLine,
                {
                  opacity: glowAnim,
                  transform: [
                    {
                      translateY: glowAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, 200],
                      }),
                    },
                  ],
                },
              ]}
            />
          </View>
        </View>
      )}

      {/* Status Panel */}
      <View style={styles.statusPanel}>
        {flowState === 'scanning' && (
          <>
            <Text style={styles.scanningText}>🔍 Scanning for face...</Text>
            <Text style={styles.scanningHint}>
              Position your face in the frame
            </Text>
            <TouchableOpacity
              style={styles.scanButton}
              onPress={simulateFaceScan}
              activeOpacity={0.85}>
              <Text style={styles.scanButtonText}>Tap to Scan</Text>
            </TouchableOpacity>
          </>
        )}

        {flowState === 'matched' && matchedEmployee && matchResult && (
          <View style={styles.matchedCard}>
            <Text style={styles.matchedIcon}>✅</Text>
            <Text style={styles.matchedName}>{matchedEmployee.name}</Text>
            <Text style={styles.matchedDept}>{matchedEmployee.department}</Text>
            <View style={styles.confidenceBadge}>
              <Text style={styles.confidenceText}>
                {matchResult.confidence} CONFIDENCE —{' '}
                {(matchResult.similarity * 100).toFixed(1)}%
              </Text>
            </View>
            <Text style={styles.livenessHint}>
              Starting liveness check...
            </Text>
          </View>
        )}

        {flowState === 'no_match' && (
          <View style={styles.noMatchCard}>
            <Text style={styles.noMatchIcon}>❌</Text>
            <Text style={styles.noMatchTitle}>Face Not Recognized</Text>
            <Text style={styles.noMatchHint}>
              Please ensure good lighting and face the camera directly.
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#0A0E1A'},
  center: {flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0A0E1A'},
  permText: {color: '#FFFFFF', fontSize: 16},
  cameraContainer: {
    flex: 1,
    margin: 20,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#00D4FF',
    maxHeight: 420,
  },
  scanOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  faceBox: {
    width: 200,
    height: 240,
    borderRadius: 100,
    borderWidth: 3,
    borderColor: 'rgba(0,212,255,0.7)',
    borderStyle: 'dashed',
  },
  faceBoxMatched: {
    borderColor: '#64FFB4',
    borderStyle: 'solid',
  },
  faceBoxNoMatch: {
    borderColor: '#FF6B35',
  },
  scanLine: {
    position: 'absolute',
    top: '15%',
    width: 200,
    height: 3,
    backgroundColor: '#00D4FF',
    borderRadius: 2,
    shadowColor: '#00D4FF',
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 4,
  },
  statusPanel: {
    padding: 20,
    paddingBottom: 32,
    alignItems: 'center',
  },
  scanningText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  scanningHint: {fontSize: 13, color: '#8892A4', marginBottom: 20},
  scanButton: {
    backgroundColor: '#00D4FF',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 48,
    marginTop: 8,
  },
  scanButtonText: {color: '#0A0E1A', fontWeight: '800', fontSize: 17},
  matchedCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(100, 255, 180, 0.08)',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(100,255,180,0.3)',
  },
  matchedIcon: {fontSize: 48, marginBottom: 8},
  matchedName: {fontSize: 24, fontWeight: '800', color: '#FFFFFF', marginBottom: 4},
  matchedDept: {fontSize: 14, color: '#8892A4', marginBottom: 12},
  confidenceBadge: {
    backgroundColor: 'rgba(100,255,180,0.2)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginBottom: 12,
  },
  confidenceText: {color: '#64FFB4', fontWeight: '700', fontSize: 12, letterSpacing: 1},
  livenessHint: {fontSize: 13, color: '#8892A4'},
  noMatchCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,107,53,0.08)',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255,107,53,0.3)',
  },
  noMatchIcon: {fontSize: 48, marginBottom: 8},
  noMatchTitle: {fontSize: 20, fontWeight: '700', color: '#FF6B35', marginBottom: 8},
  noMatchHint: {fontSize: 13, color: '#8892A4', textAlign: 'center'},
});

export default AttendanceScreen;
