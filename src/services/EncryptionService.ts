import CryptoJS from 'crypto-js';
import EncryptedStorage from 'react-native-encrypted-storage';
import {logger} from '../utils/logger';

const KEY_STORAGE_KEY = 'FACEGUARD_KEY';
const SALT_STORAGE_KEY = 'FACEGUARD_SALT';
const PBKDF2_ITERATIONS = 100_000;
const KEY_SIZE = 256 / 32; // 256 bits = 8 words of 32 bits

class EncryptionService {
  private static instance: EncryptionService;
  private encryptionKey: CryptoJS.lib.WordArray | null = null;

  private constructor() {}

  static getInstance(): EncryptionService {
    if (!EncryptionService.instance) {
      EncryptionService.instance = new EncryptionService();
    }
    return EncryptionService.instance;
  }

  /**
   * Initialize: load or generate AES-256 key using PBKDF2 derivation.
   */
  async initialize(deviceFingerprint: string): Promise<void> {
    try {
      let keyHex = await EncryptedStorage.getItem(KEY_STORAGE_KEY);
      let salt = await EncryptedStorage.getItem(SALT_STORAGE_KEY);

      if (!keyHex || !salt) {
        // First launch: generate salt and derive key
        salt = CryptoJS.lib.WordArray.random(128 / 8).toString(CryptoJS.enc.Hex);
        const derived = CryptoJS.PBKDF2(
          deviceFingerprint,
          CryptoJS.enc.Hex.parse(salt),
          {keySize: KEY_SIZE, iterations: PBKDF2_ITERATIONS},
        );
        keyHex = derived.toString(CryptoJS.enc.Hex);
        await EncryptedStorage.setItem(KEY_STORAGE_KEY, keyHex);
        await EncryptedStorage.setItem(SALT_STORAGE_KEY, salt);
        logger.info('EncryptionService: new key generated');
      }

      this.encryptionKey = CryptoJS.enc.Hex.parse(keyHex);
      logger.info('EncryptionService initialized');
    } catch (error) {
      logger.error('EncryptionService initialization failed:', error);
      throw error;
    }
  }

  private getKey(): CryptoJS.lib.WordArray {
    if (!this.encryptionKey) {
      throw new Error('EncryptionService not initialized. Call initialize() first.');
    }
    return this.encryptionKey;
  }

  /**
   * Encrypt a plaintext string using AES-256-CBC.
   * Returns base64 ciphertext (includes IV prepended).
   */
  encrypt(plaintext: string): string {
    const iv = CryptoJS.lib.WordArray.random(16);
    const encrypted = CryptoJS.AES.encrypt(plaintext, this.getKey(), {
      iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });
    // Prepend IV to ciphertext for decryption
    const combined = iv.toString(CryptoJS.enc.Base64) +
      ':' +
      encrypted.toString();
    return combined;
  }

  /**
   * Decrypt a base64 ciphertext string.
   */
  decrypt(ciphertext: string): string {
    const [ivBase64, encryptedData] = ciphertext.split(':');
    const iv = CryptoJS.enc.Base64.parse(ivBase64);
    const decrypted = CryptoJS.AES.decrypt(encryptedData, this.getKey(), {
      iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });
    return decrypted.toString(CryptoJS.enc.Utf8);
  }

  /**
   * Encrypt a Float32Array embedding vector.
   */
  encryptEmbedding(vector: Float32Array): string {
    const jsonStr = JSON.stringify(Array.from(vector));
    return this.encrypt(jsonStr);
  }

  /**
   * Decrypt an embedding back to Float32Array.
   */
  decryptEmbedding(encrypted: string): Float32Array {
    const jsonStr = this.decrypt(encrypted);
    const arr: number[] = JSON.parse(jsonStr);
    return new Float32Array(arr);
  }

  /**
   * SHA-256 hash for integrity checks.
   */
  hashData(data: string): string {
    return CryptoJS.SHA256(data).toString(CryptoJS.enc.Hex);
  }

  /**
   * Rotate encryption key: re-encrypt all stored embeddings.
   * Called from SettingsScreen.
   */
  async rotateKey(
    deviceFingerprint: string,
    reEncryptCallback: (
      oldService: EncryptionService,
      newService: EncryptionService,
    ) => Promise<void>,
  ): Promise<void> {
    logger.info('Starting key rotation...');

    // Save old key temporarily
    const oldService = new EncryptionService();
    oldService.encryptionKey = this.encryptionKey;

    // Generate new key
    const newSalt = CryptoJS.lib.WordArray.random(128 / 8).toString(
      CryptoJS.enc.Hex,
    );
    const newKey = CryptoJS.PBKDF2(
      deviceFingerprint + Date.now(),
      CryptoJS.enc.Hex.parse(newSalt),
      {keySize: KEY_SIZE, iterations: PBKDF2_ITERATIONS},
    );

    const newService = new EncryptionService();
    newService.encryptionKey = newKey;

    // Re-encrypt via callback (caller handles DB reads/writes)
    await reEncryptCallback(oldService, newService);

    // Commit new key
    await EncryptedStorage.setItem(
      KEY_STORAGE_KEY,
      newKey.toString(CryptoJS.enc.Hex),
    );
    await EncryptedStorage.setItem(SALT_STORAGE_KEY, newSalt);
    this.encryptionKey = newKey;

    logger.info('Key rotation complete');
  }
}

export default EncryptionService;
