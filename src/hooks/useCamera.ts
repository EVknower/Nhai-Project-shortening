import {useRef, useState, useCallback, useEffect} from 'react';
import {AppState, AppStateStatus, Platform} from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
} from 'react-native-vision-camera';
import {shouldProcessFrame} from '../utils/frameProcessor';
import {logger} from '../utils/logger';

export interface UseCameraReturn {
  cameraRef: React.RefObject<InstanceType<typeof Camera>>;
  device: ReturnType<typeof useCameraDevice>;
  hasPermission: boolean;
  isPermissionGranted: boolean;
  requestPermission: () => Promise<void>;
  isCameraActive: boolean;
  setIsCameraActive: (v: boolean) => void;
}

export function useCamera(): UseCameraReturn {
  const cameraRef = useRef<InstanceType<typeof Camera>>(null);
  const [isCameraActive, setIsCameraActive] = useState(true);

  // Prefer front camera for authentication
  const device = useCameraDevice('front');

  const {hasPermission, requestPermission: _request} = useCameraPermission();

  const requestPermission = useCallback(async () => {
    try {
      await _request();
    } catch (error) {
      logger.error('Camera permission request failed:', error);
    }
  }, [_request]);

  // Request permission on mount if not already granted
  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission, requestPermission]);

  // Pause camera when app goes to background, resume on foreground
  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        setIsCameraActive(true);
        logger.info('Camera resumed (app foregrounded)');
      } else if (nextState === 'background' || nextState === 'inactive') {
        setIsCameraActive(false);
        logger.info('Camera paused (app backgrounded)');
      }
    };

    const subscription = AppState.addEventListener(
      'change',
      handleAppStateChange,
    );
    return () => subscription.remove();
  }, []);

  return {
    cameraRef,
    device,
    hasPermission,
    isPermissionGranted: hasPermission,
    requestPermission,
    isCameraActive,
    setIsCameraActive,
  };
}
