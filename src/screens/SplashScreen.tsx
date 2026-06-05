import React, {useEffect, useRef, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Modal,
  TouchableOpacity,
} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '../navigation/types';
import DatabaseManager from '../database/DatabaseManager';
import ModelLoader from '../ml/ModelLoader';
import DeviceIntegrityService from '../services/DeviceIntegrityService';
import EncryptionService from '../services/EncryptionService';
import {IntegrityReport} from '../types/LivenessChallenge';
import {logger} from '../utils/logger';

type Props = NativeStackScreenProps<RootStackParamList, 'Splash'>;

const SplashScreen: React.FC<Props> = ({navigation}) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [statusText, setStatusText] = useState('Initializing...');
  const [showRootWarning, setShowRootWarning] = useState(false);
  const [integrityReport, setIntegrityReport] = useState<IntegrityReport | null>(null);

  useEffect(() => {
    // Pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    ).start();

    // Fade in
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();

    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      setStatusText('Checking device integrity...');
      const deviceService = DeviceIntegrityService.getInstance();
      const report = await deviceService.runAllChecks();
      setIntegrityReport(report);

      if (report.isRooted) {
        setShowRootWarning(true);
        return; // Wait for user to dismiss warning
      }

      await continueInit(report);
    } catch (error) {
      logger.error('Splash init error:', error);
      setStatusText('Initialization failed. Please restart the app.');
    }
  };

  const continueInit = async (report: IntegrityReport) => {
    try {
      setStatusText('Initializing database...');
      const enc = EncryptionService.getInstance();
      await enc.initialize(report.deviceId);
      await DatabaseManager.getInstance().initialize();

      setStatusText('Loading AI models...');
      await ModelLoader.getInstance().loadModels();

      setStatusText('Ready!');
      logger.info('Splash initialization complete');

      // Navigate after brief delay
      setTimeout(() => {
        navigation.replace('Main', {screen: 'Home'});
      }, 500);
    } catch (error) {
      logger.error('Init error:', error);
      setStatusText('Initialization failed. Please restart.');
    }
  };

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.logoContainer,
          {
            transform: [{scale: pulseAnim}],
            opacity: fadeAnim,
          },
        ]}>
        <View style={styles.shieldOuter}>
          <View style={styles.shieldInner}>
            <Text style={styles.shieldIcon}>🛡️</Text>
          </View>
        </View>
      </Animated.View>

      <Animated.View style={{opacity: fadeAnim}}>
        <Text style={styles.appName}>FaceGuard Offline</Text>
        <Text style={styles.tagline}>Secure · Private · On-Device</Text>
      </Animated.View>

      <View style={styles.statusContainer}>
        <Text style={styles.statusText}>{statusText}</Text>
        <View style={styles.dotsContainer}>
          {[0, 1, 2].map(i => (
            <LoadingDot key={i} delay={i * 200} />
          ))}
        </View>
      </View>

      <Modal
        visible={showRootWarning}
        transparent
        animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalIcon}>⚠️</Text>
            <Text style={styles.modalTitle}>Security Warning</Text>
            <Text style={styles.modalBody}>
              This device appears to be rooted or running in an emulator.
              Biometric data may be at risk. For maximum security, use a
              non-rooted device.
            </Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => {
                setShowRootWarning(false);
                if (integrityReport) {
                  continueInit(integrityReport);
                }
              }}>
              <Text style={styles.modalButtonText}>Continue Anyway</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const LoadingDot: React.FC<{delay: number}> = ({delay}) => {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [delay, opacity]);

  return <Animated.View style={[styles.dot, {opacity}]} />;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0E1A',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  logoContainer: {
    marginBottom: 8,
  },
  shieldOuter: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(0, 212, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(0, 212, 255, 0.4)',
  },
  shieldInner: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(0, 212, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shieldIcon: {
    fontSize: 40,
  },
  appName: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 1,
  },
  tagline: {
    fontSize: 13,
    color: '#00D4FF',
    textAlign: 'center',
    letterSpacing: 3,
    marginTop: 4,
  },
  statusContainer: {
    alignItems: 'center',
    marginTop: 16,
  },
  statusText: {
    fontSize: 14,
    color: '#8892A4',
    marginBottom: 12,
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00D4FF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#1A1F2E',
    borderRadius: 20,
    padding: 28,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FF6B35',
  },
  modalIcon: {fontSize: 48, marginBottom: 12},
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  modalBody: {
    fontSize: 14,
    color: '#8892A4',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  modalButton: {
    backgroundColor: '#FF6B35',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
});

export default SplashScreen;
