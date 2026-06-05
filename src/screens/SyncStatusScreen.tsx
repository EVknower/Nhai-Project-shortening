import React, {useState, useCallback, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {useSync} from '../hooks/useSync';
import SyncQueueRepository from '../database/repositories/SyncQueueRepository';
import {SyncQueueItem} from '../types/LivenessChallenge';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const SyncStatusScreen: React.FC = () => {
  const {pendingCount, isSyncing, lastSyncResult, syncNow, refreshPendingCount} =
    useSync();
  const [failedItems, setFailedItems] = useState<SyncQueueItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);

  const loadSyncStatus = useCallback(async () => {
    await refreshPendingCount();
    const failed = await SyncQueueRepository.getFailedItems();
    setFailedItems(failed);
  }, [refreshPendingCount]);

  useFocusEffect(
    useCallback(() => {
      loadSyncStatus();
      const interval = setInterval(loadSyncStatus, 30_000);
      return () => clearInterval(interval);
    }, [loadSyncStatus]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadSyncStatus();
    setRefreshing(false);
  };

  const handleSyncNow = async () => {
    await syncNow();
    setLastSyncTime(Date.now());
    await loadSyncStatus();
  };

  const isOnline = true; // In production: use NetInfo

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#00D4FF"
        />
      }>
      {/* Connection status */}
      <View
        style={[
          styles.connectionCard,
          isOnline ? styles.onlineCard : styles.offlineCard,
        ]}>
        <View style={[styles.connectionDot, isOnline ? styles.onlineDot : styles.offlineDot]} />
        <Text style={styles.connectionText}>
          {isOnline ? 'Online' : 'Offline'}
        </Text>
        <Text style={styles.connectionHint}>
          {isOnline
            ? 'Connected — sync available'
            : 'No internet — data saved locally'}
        </Text>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{pendingCount}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, {color: '#FF6B35'}]}>
            {failedItems.length}
          </Text>
          <Text style={styles.statLabel}>Failed</Text>
        </View>
        {lastSyncTime && (
          <View style={styles.statCard}>
            <Text style={[styles.statValue, {fontSize: 14}]}>
              {dayjs(lastSyncTime).fromNow()}
            </Text>
            <Text style={styles.statLabel}>Last Sync</Text>
          </View>
        )}
      </View>

      {/* Sync result */}
      {lastSyncResult && (
        <View style={styles.resultCard}>
          <Text style={styles.resultTitle}>Last Sync Result</Text>
          <View style={styles.resultRow}>
            <View style={styles.resultItem}>
              <Text style={[styles.resultValue, {color: '#64FFB4'}]}>
                {lastSyncResult.synced}
              </Text>
              <Text style={styles.resultLabel}>Synced</Text>
            </View>
            <View style={styles.resultItem}>
              <Text style={[styles.resultValue, {color: '#FF6B35'}]}>
                {lastSyncResult.failed}
              </Text>
              <Text style={styles.resultLabel}>Failed</Text>
            </View>
            <View style={styles.resultItem}>
              <Text style={[styles.resultValue, {color: '#FFB347'}]}>
                {lastSyncResult.pending}
              </Text>
              <Text style={styles.resultLabel}>Remaining</Text>
            </View>
          </View>
        </View>
      )}

      {/* Sync button */}
      <TouchableOpacity
        style={[
          styles.syncButton,
          (!isOnline || isSyncing) && styles.syncButtonDisabled,
        ]}
        onPress={handleSyncNow}
        disabled={!isOnline || isSyncing}
        activeOpacity={0.85}>
        {isSyncing ? (
          <ActivityIndicator color="#0A0E1A" />
        ) : (
          <Text style={styles.syncButtonText}>
            {isOnline ? '☁️ Sync Now' : '📵 Offline — Cannot Sync'}
          </Text>
        )}
      </TouchableOpacity>

      {/* Failed items */}
      {failedItems.length > 0 && (
        <View style={styles.failedSection}>
          <Text style={styles.sectionTitle}>Failed Items ({failedItems.length})</Text>
          {failedItems.map(item => (
            <View key={item.id} style={styles.failedCard}>
              <View>
                <Text style={styles.failedType}>{item.entityType}</Text>
                <Text style={styles.failedMeta}>
                  {item.operation} · Attempts: {item.attempts}
                </Text>
                {item.lastAttemptedAt && (
                  <Text style={styles.failedTime}>
                    Last tried: {dayjs(item.lastAttemptedAt).fromNow()}
                  </Text>
                )}
              </View>
              <Text style={styles.failedBadge}>⚠️</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#0A0E1A'},
  content: {padding: 20, paddingBottom: 40},
  connectionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    gap: 12,
  },
  onlineCard: {
    backgroundColor: 'rgba(100,255,180,0.08)',
    borderColor: 'rgba(100,255,180,0.3)',
  },
  offlineCard: {
    backgroundColor: 'rgba(255,107,53,0.08)',
    borderColor: 'rgba(255,107,53,0.3)',
  },
  connectionDot: {width: 12, height: 12, borderRadius: 6},
  onlineDot: {backgroundColor: '#64FFB4'},
  offlineDot: {backgroundColor: '#FF6B35'},
  connectionText: {fontSize: 16, fontWeight: '700', color: '#FFFFFF'},
  connectionHint: {fontSize: 12, color: '#8892A4', flex: 1},
  statsRow: {flexDirection: 'row', gap: 12, marginBottom: 20},
  statCard: {
    flex: 1,
    backgroundColor: '#1A1F2E',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  statValue: {fontSize: 28, fontWeight: '800', color: '#00D4FF'},
  statLabel: {fontSize: 12, color: '#8892A4', marginTop: 4},
  resultCard: {
    backgroundColor: '#1A1F2E',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  resultTitle: {fontSize: 13, color: '#8892A4', marginBottom: 12, fontWeight: '600'},
  resultRow: {flexDirection: 'row', justifyContent: 'space-around'},
  resultItem: {alignItems: 'center'},
  resultValue: {fontSize: 24, fontWeight: '800'},
  resultLabel: {fontSize: 12, color: '#8892A4', marginTop: 4},
  syncButton: {
    backgroundColor: '#00D4FF',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 24,
  },
  syncButtonDisabled: {opacity: 0.4},
  syncButtonText: {color: '#0A0E1A', fontWeight: '800', fontSize: 17},
  failedSection: {},
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  failedCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255,107,53,0.08)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,107,53,0.2)',
  },
  failedType: {fontWeight: '700', color: '#FFFFFF', fontSize: 14},
  failedMeta: {fontSize: 12, color: '#8892A4', marginTop: 2},
  failedTime: {fontSize: 11, color: '#4A5568', marginTop: 2},
  failedBadge: {fontSize: 20},
});

export default SyncStatusScreen;
