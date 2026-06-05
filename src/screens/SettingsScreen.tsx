import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  Alert,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import EncryptionService from '../services/EncryptionService';
import DeviceIntegrityService from '../services/DeviceIntegrityService';
import EmbeddingRepository from '../database/repositories/EmbeddingRepository';
import DatabaseManager from '../database/DatabaseManager';
import {logger} from '../utils/logger';

const SettingsScreen: React.FC = () => {
  const [matchThreshold, setMatchThreshold] = useState(0.75);
  const [livenessRequired, setLivenessRequired] = useState(true);
  const [awsEndpoint, setAwsEndpoint] = useState('');
  const [syncOnWifiOnly, setSyncOnWifiOnly] = useState(true);
  const [rotatingKey, setRotatingKey] = useState(false);
  const [clearingData, setClearingData] = useState(false);

  const handleRotateKey = async () => {
    Alert.alert(
      'Rotate Encryption Key',
      'This will re-encrypt all stored face data with a new key. The process may take a moment. Continue?',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Rotate Key',
          style: 'destructive',
          onPress: async () => {
            setRotatingKey(true);
            try {
              const fingerprint =
                await DeviceIntegrityService.getInstance().getDeviceFingerprint();
              const enc = EncryptionService.getInstance();

              await enc.rotateKey(
                fingerprint,
                async (oldEnc, newEnc) => {
                  // Re-encrypt all embeddings
                  const rows = await DatabaseManager.getInstance().query(
                    'SELECT * FROM face_embeddings',
                  );
                  for (const row of rows) {
                    const decrypted = oldEnc.decryptEmbedding(row.embedding_data);
                    const reEncrypted = newEnc.encryptEmbedding(decrypted);
                    await DatabaseManager.getInstance().execute(
                      'UPDATE face_embeddings SET embedding_data = ? WHERE id = ?',
                      [reEncrypted, row.id],
                    );
                  }
                  logger.info(`Re-encrypted ${rows.length} embeddings`);
                },
              );

              Alert.alert('Success', 'Encryption key rotated successfully.');
            } catch (error) {
              logger.error('Key rotation failed:', error);
              Alert.alert('Error', 'Key rotation failed. Please try again.');
            } finally {
              setRotatingKey(false);
            }
          },
        },
      ],
    );
  };

  const handleClearAllData = () => {
    Alert.alert(
      '⚠️ Clear All Data',
      'This will permanently delete ALL employees, face data, and attendance records. This cannot be undone!',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Confirm Delete',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              '🚨 Final Confirmation',
              'Are you absolutely sure? ALL DATA will be permanently deleted.',
              [
                {text: 'Cancel', style: 'cancel'},
                {
                  text: 'Delete Everything',
                  style: 'destructive',
                  onPress: async () => {
                    setClearingData(true);
                    try {
                      const db = DatabaseManager.getInstance();
                      await db.execute('DELETE FROM face_embeddings');
                      await db.execute('DELETE FROM attendance');
                      await db.execute('DELETE FROM sync_queue');
                      await db.execute('DELETE FROM employees');
                      Alert.alert('Done', 'All data has been cleared.');
                    } catch (error) {
                      logger.error('Clear data failed:', error);
                      Alert.alert('Error', 'Failed to clear data.');
                    } finally {
                      setClearingData(false);
                    }
                  },
                },
              ],
            );
          },
        },
      ],
    );
  };

  const thresholdSteps = [0.65, 0.70, 0.75, 0.80, 0.85, 0.90, 0.95];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Recognition Settings */}
      <Section title="Recognition Settings">
        <Text style={styles.settingLabel}>
          Match Threshold: {matchThreshold.toFixed(2)}
        </Text>
        <View style={styles.thresholdSteps}>
          {thresholdSteps.map(t => (
            <TouchableOpacity
              key={t}
              style={[
                styles.thresholdStep,
                matchThreshold === t && styles.thresholdStepActive,
              ]}
              onPress={() => setMatchThreshold(t)}>
              <Text
                style={[
                  styles.thresholdStepText,
                  matchThreshold === t && styles.thresholdStepTextActive,
                ]}>
                {t.toFixed(2)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.settingHint}>
          Higher = stricter matching. Recommended: 0.75–0.85
        </Text>

        <SettingRow
          label="Liveness Check Required"
          description="Require blink/smile challenge for attendance"
          value={livenessRequired}
          onToggle={setLivenessRequired}
        />
      </Section>

      {/* Security Settings */}
      <Section title="Security Settings">
        <TouchableOpacity
          style={[styles.dangerButton, styles.primaryButton]}
          onPress={handleRotateKey}
          disabled={rotatingKey}
          activeOpacity={0.85}>
          {rotatingKey ? (
            <ActivityIndicator color="#0A0E1A" />
          ) : (
            <>
              <Text style={styles.dangerButtonText}>🔑 Rotate Encryption Key</Text>
            </>
          )}
        </TouchableOpacity>
        <Text style={styles.settingHint}>
          Re-encrypts all face data with a new AES-256 key
        </Text>

        <TouchableOpacity
          style={[styles.dangerButton, {marginTop: 12}]}
          onPress={handleClearAllData}
          disabled={clearingData}
          activeOpacity={0.85}>
          {clearingData ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.dangerButtonText}>🗑️ Clear All Data</Text>
          )}
        </TouchableOpacity>
      </Section>

      {/* Sync Settings */}
      <Section title="Sync Settings">
        <Text style={styles.settingLabel}>AWS API Endpoint</Text>
        <TextInput
          style={styles.input}
          placeholder="https://api.example.amazonaws.com/prod"
          placeholderTextColor="#4A5568"
          value={awsEndpoint}
          onChangeText={setAwsEndpoint}
          autoCapitalize="none"
          keyboardType="url"
        />

        <SettingRow
          label="Sync on WiFi Only"
          description="Avoid mobile data usage for syncing"
          value={syncOnWifiOnly}
          onToggle={setSyncOnWifiOnly}
        />
      </Section>

      {/* About */}
      <Section title="About">
        <AboutRow label="App Version" value="1.0.0" />
        <AboutRow label="Model" value="MobileFaceNet INT8 + MediaPipe" />
        <AboutRow label="Database" value="SQLite (AES-256 Encrypted)" />
        <AboutRow label="Compliance" value="DPDP Act 2023" />
      </Section>
    </ScrollView>
  );
};

const Section: React.FC<{title: string; children: React.ReactNode}> = ({
  title,
  children,
}) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    <View style={styles.sectionCard}>{children}</View>
  </View>
);

const SettingRow: React.FC<{
  label: string;
  description: string;
  value: boolean;
  onToggle: (v: boolean) => void;
}> = ({label, description, value, onToggle}) => (
  <View style={styles.settingRow}>
    <View style={styles.settingRowLeft}>
      <Text style={styles.settingRowLabel}>{label}</Text>
      <Text style={styles.settingRowDesc}>{description}</Text>
    </View>
    <Switch
      value={value}
      onValueChange={onToggle}
      trackColor={{false: '#1A1F2E', true: 'rgba(0,212,255,0.4)'}}
      thumbColor={value ? '#00D4FF' : '#4A5568'}
    />
  </View>
);

const AboutRow: React.FC<{label: string; value: string}> = ({label, value}) => (
  <View style={styles.aboutRow}>
    <Text style={styles.aboutLabel}>{label}</Text>
    <Text style={styles.aboutValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#0A0E1A'},
  content: {padding: 20, paddingBottom: 48},
  section: {marginBottom: 24},
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#00D4FF',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
    paddingLeft: 4,
  },
  sectionCard: {
    backgroundColor: '#1A1F2E',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    gap: 12,
  },
  settingLabel: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  settingHint: {fontSize: 12, color: '#8892A4', marginTop: -4},
  thresholdSteps: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  thresholdStep: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#0F1219',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  thresholdStepActive: {
    backgroundColor: 'rgba(0,212,255,0.2)',
    borderColor: '#00D4FF',
  },
  thresholdStepText: {color: '#8892A4', fontSize: 13, fontWeight: '600'},
  thresholdStepTextActive: {color: '#00D4FF'},
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  settingRowLeft: {flex: 1, marginRight: 12},
  settingRowLabel: {fontSize: 15, fontWeight: '600', color: '#FFFFFF'},
  settingRowDesc: {fontSize: 12, color: '#8892A4', marginTop: 2},
  dangerButton: {
    backgroundColor: 'rgba(255,107,53,0.15)',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,107,53,0.4)',
  },
  primaryButton: {
    backgroundColor: 'rgba(0,212,255,0.15)',
    borderColor: 'rgba(0,212,255,0.4)',
  },
  dangerButtonText: {color: '#FFFFFF', fontWeight: '700', fontSize: 15},
  input: {
    backgroundColor: '#0F1219',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    color: '#FFFFFF',
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  aboutLabel: {fontSize: 14, color: '#8892A4'},
  aboutValue: {fontSize: 14, color: '#FFFFFF', fontWeight: '600'},
});

export default SettingsScreen;
