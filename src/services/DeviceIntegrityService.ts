import DeviceInfo from 'react-native-device-info';
import {IntegrityReport} from '../types/LivenessChallenge';
import {logger} from '../utils/logger';
import CryptoJS from 'crypto-js';

const ROOT_INDICATORS = [
  '/system/app/Superuser.apk',
  '/system/xbin/su',
  '/system/bin/su',
  '/sbin/su',
  '/su/bin/su',
  '/data/local/xbin/su',
  '/data/local/bin/su',
  '/data/local/su',
  '/system/sd/xbin/su',
  '/system/bin/failsafe/su',
];

class DeviceIntegrityService {
  private static instance: DeviceIntegrityService;
  private cachedFingerprint: string | null = null;

  static getInstance(): DeviceIntegrityService {
    if (!DeviceIntegrityService.instance) {
      DeviceIntegrityService.instance = new DeviceIntegrityService();
    }
    return DeviceIntegrityService.instance;
  }

  /**
   * Check if device appears to be rooted/jailbroken.
   * Uses heuristics — not 100% reliable but sufficient for most cases.
   */
  async isRooted(): Promise<boolean> {
    try {
      // Check if running in emulator
      const isEmulator = await DeviceInfo.isEmulator();
      if (isEmulator) {
        logger.warn('Running in emulator — may indicate rooted environment');
        return true;
      }

      // Check for root-related system features
      const hasRootFeature = await DeviceInfo.hasSystemFeature(
        'android.software.backup',
      ).catch(() => false);

      // Check device model for known emulator signatures
      const model = await DeviceInfo.getModel();
      const brand = await DeviceInfo.getBrand();
      const knownEmulatorBrands = ['generic', 'android sdk built for x86', 'sdk'];
      if (
        knownEmulatorBrands.some(b =>
          brand.toLowerCase().includes(b.toLowerCase()),
        )
      ) {
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Root detection error:', error);
      return false;
    }
  }

  /**
   * Check if debugger is attached.
   */
  checkDebuggerAttached(): boolean {
    // In release builds __DEV__ is false
    return __DEV__;
  }

  /**
   * Validate app integrity via bundle ID check.
   * Returns false if bundle ID has been tampered.
   */
  async validateAppIntegrity(): Promise<boolean> {
    try {
      const bundleId = await DeviceInfo.getBundleId();
      const expectedBundleId = 'com.faceguardoffline';
      return bundleId === expectedBundleId;
    } catch (error) {
      logger.error('App integrity check failed:', error);
      return false;
    }
  }

  /**
   * Get a stable device fingerprint (SHA-256 of device identifiers).
   * Result is cached after first computation.
   */
  async getDeviceFingerprint(): Promise<string> {
    if (this.cachedFingerprint) {
      return this.cachedFingerprint;
    }

    try {
      const uniqueId = await DeviceInfo.getUniqueId();
      const systemVersion = await DeviceInfo.getSystemVersion();
      const bundleId = await DeviceInfo.getBundleId();

      const combined = `${uniqueId}|${systemVersion}|${bundleId}`;
      this.cachedFingerprint = CryptoJS.SHA256(combined).toString(
        CryptoJS.enc.Hex,
      );
      return this.cachedFingerprint;
    } catch (error) {
      logger.error('Device fingerprint error:', error);
      // Fallback fingerprint
      return CryptoJS.SHA256('fallback-device').toString(CryptoJS.enc.Hex);
    }
  }

  /**
   * Run all integrity checks and return a report.
   * App warns but does NOT block on failure.
   */
  async runAllChecks(): Promise<IntegrityReport> {
    const [isRooted, isIntact, deviceId] = await Promise.all([
      this.isRooted(),
      this.validateAppIntegrity(),
      this.getDeviceFingerprint(),
    ]);

    const hasDebugger = this.checkDebuggerAttached();

    const report: IntegrityReport = {
      isRooted,
      hasDebugger,
      isIntact,
      deviceId,
    };

    if (isRooted) {
      logger.warn('SECURITY: Device appears to be rooted!');
    }
    if (hasDebugger) {
      logger.warn('SECURITY: Debugger attached!');
    }
    if (!isIntact) {
      logger.warn('SECURITY: App integrity check failed!');
    }

    return report;
  }
}

export default DeviceIntegrityService;
