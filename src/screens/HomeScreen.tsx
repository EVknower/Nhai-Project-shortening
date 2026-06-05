import React, {useEffect, useState, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  StatusBar,
} from 'react-native';
import {CompositeNavigationProp, useFocusEffect} from '@react-navigation/native';
import {BottomTabNavigationProp} from '@react-navigation/bottom-tabs';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {MainTabParamList, RootStackParamList} from '../navigation/types';
import EmployeeRepository from '../database/repositories/EmployeeRepository';
import AttendanceRepository from '../database/repositories/AttendanceRepository';
import SyncQueueRepository from '../database/repositories/SyncQueueRepository';
import {logger} from '../utils/logger';
import dayjs from 'dayjs';

type HomeNavProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Home'>,
  NativeStackNavigationProp<RootStackParamList>
>;

interface HomeStats {
  employeeCount: number;
  todayAttendance: number;
  pendingSync: number;
  lastSync: number | null;
}

const HomeScreen: React.FC<{navigation: HomeNavProp}> = ({navigation}) => {
  const [stats, setStats] = useState<HomeStats>({
    employeeCount: 0,
    todayAttendance: 0,
    pendingSync: 0,
    lastSync: null,
  });
  const [refreshing, setRefreshing] = useState(false);

  const loadStats = useCallback(async () => {
    try {
      const [employees, todayCount, pending] = await Promise.all([
        EmployeeRepository.count(true),
        AttendanceRepository.countToday(),
        SyncQueueRepository.getPendingCount(),
      ]);
      setStats({
        employeeCount: employees,
        todayAttendance: todayCount,
        pendingSync: pending,
        lastSync: pending === 0 ? Date.now() : null,
      });
    } catch (error) {
      logger.error('Failed to load home stats:', error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadStats();
    }, [loadStats]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStats();
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0E1A" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#00D4FF"
          />
        }>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Good{getTimeGreeting()},</Text>
            <Text style={styles.title}>FaceGuard Offline</Text>
          </View>
          <View style={styles.offlineBadge}>
            <View style={styles.offlineDot} />
            <Text style={styles.offlineText}>Offline Mode</Text>
          </View>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <StatCard
            icon="👥"
            value={String(stats.employeeCount)}
            label="Enrolled"
          />
          <StatCard
            icon="✅"
            value={String(stats.todayAttendance)}
            label="Today"
          />
          <StatCard
            icon="🔄"
            value={String(stats.pendingSync)}
            label="Pending Sync"
            accent={stats.pendingSync > 0 ? '#FF6B35' : '#00D4FF'}
          />
        </View>

        {/* Main Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>

        <TouchableOpacity
          style={[styles.actionCard, styles.attendanceCard]}
          onPress={() => navigation.navigate('Attendance')}
          activeOpacity={0.85}>
          <View style={styles.actionIcon}>
            <Text style={styles.actionEmoji}>📸</Text>
          </View>
          <View style={styles.actionText}>
            <Text style={styles.actionTitle}>Mark Attendance</Text>
            <Text style={styles.actionSubtitle}>
              Face scan + liveness check
            </Text>
          </View>
          <Text style={styles.actionArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionCard, styles.registerCard]}
          onPress={() => navigation.navigate('EmployeeRegistration')}
          activeOpacity={0.85}>
          <View style={[styles.actionIcon, styles.registerIcon]}>
            <Text style={styles.actionEmoji}>➕</Text>
          </View>
          <View style={styles.actionText}>
            <Text style={styles.actionTitle}>Register Employee</Text>
            <Text style={styles.actionSubtitle}>Enroll face + details</Text>
          </View>
          <Text style={styles.actionArrow}>›</Text>
        </TouchableOpacity>

        {/* Last Sync */}
        {stats.lastSync && (
          <View style={styles.syncInfo}>
            <Text style={styles.syncText}>
              Last sync: {dayjs(stats.lastSync).format('DD MMM, HH:mm')}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const StatCard: React.FC<{
  icon: string;
  value: string;
  label: string;
  accent?: string;
}> = ({icon, value, label, accent = '#00D4FF'}) => (
  <View style={styles.statCard}>
    <Text style={styles.statIcon}>{icon}</Text>
    <Text style={[styles.statValue, {color: accent}]}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) {
    return ' Morning';
  }
  if (hour < 18) {
    return ' Afternoon';
  }
  return ' Evening';
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#0A0E1A'},
  scroll: {padding: 20, paddingBottom: 40},
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  greeting: {fontSize: 14, color: '#8892A4'},
  title: {fontSize: 24, fontWeight: '800', color: '#FFFFFF', marginTop: 2},
  offlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,107,53,0.15)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,107,53,0.3)',
  },
  offlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FF6B35',
    marginRight: 6,
  },
  offlineText: {fontSize: 11, color: '#FF6B35', fontWeight: '600'},
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 28,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1A1F2E',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  statIcon: {fontSize: 20, marginBottom: 6},
  statValue: {fontSize: 24, fontWeight: '800', color: '#00D4FF'},
  statLabel: {fontSize: 11, color: '#8892A4', marginTop: 2},
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 14,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    padding: 20,
    marginBottom: 14,
    borderWidth: 1,
  },
  attendanceCard: {
    backgroundColor: 'rgba(0, 212, 255, 0.1)',
    borderColor: 'rgba(0, 212, 255, 0.3)',
  },
  registerCard: {
    backgroundColor: 'rgba(100, 255, 180, 0.08)',
    borderColor: 'rgba(100, 255, 180, 0.25)',
  },
  actionIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 212, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  registerIcon: {
    backgroundColor: 'rgba(100, 255, 180, 0.2)',
  },
  actionEmoji: {fontSize: 24},
  actionText: {flex: 1},
  actionTitle: {fontSize: 17, fontWeight: '700', color: '#FFFFFF'},
  actionSubtitle: {fontSize: 13, color: '#8892A4', marginTop: 3},
  actionArrow: {fontSize: 24, color: '#8892A4'},
  syncInfo: {
    marginTop: 16,
    alignItems: 'center',
  },
  syncText: {fontSize: 12, color: '#8892A4'},
});

export default HomeScreen;
