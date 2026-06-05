import React, {useState, useCallback, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import AttendanceRepository from '../database/repositories/AttendanceRepository';
import EmployeeRepository from '../database/repositories/EmployeeRepository';
import {AttendanceRecord} from '../types/Attendance';
import {Employee} from '../types/Employee';
import dayjs from 'dayjs';

const PAGE_SIZE = 50;

const OfflineRecordsScreen: React.FC = () => {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [employees, setEmployees] = useState<Record<string, Employee>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'ALL' | 'PENDING_SYNC' | 'SUCCESS'
  >('ALL');
  const [page, setPage] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const loadData = useCallback(
    async (reset = false) => {
      const currentPage = reset ? 0 : page;
      const [allRecords, allEmployees] = await Promise.all([
        AttendanceRepository.findAll(PAGE_SIZE, currentPage * PAGE_SIZE),
        EmployeeRepository.findAll(false),
      ]);

      const empMap: Record<string, Employee> = {};
      allEmployees.forEach(e => {
        empMap[e.id] = e;
      });

      if (reset) {
        setRecords(allRecords);
        setPage(1);
      } else {
        setRecords(prev => [...prev, ...allRecords]);
        setPage(p => p + 1);
      }
      setEmployees(empMap);
      setHasMore(allRecords.length === PAGE_SIZE);
    },
    [page],
  );

  useFocusEffect(
    useCallback(() => {
      loadData(true);
    }, []),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData(true);
    setRefreshing(false);
  };

  const filteredRecords = records.filter(r => {
    const employee = employees[r.employeeId];
    const matchesSearch =
      !searchQuery ||
      employee?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      employee?.employeeCode.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === 'ALL' || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const renderItem = ({item}: {item: AttendanceRecord}) => {
    const employee = employees[item.employeeId];
    return (
      <View style={styles.recordCard}>
        <View style={styles.recordLeft}>
          <View
            style={[
              styles.typeIndicator,
              item.type === 'CHECK_IN' ? styles.checkInIndicator : styles.checkOutIndicator,
            ]}
          />
          <View>
            <Text style={styles.employeeName}>
              {employee?.name ?? 'Unknown'}
            </Text>
            <Text style={styles.recordMeta}>
              {dayjs(item.timestamp).format('DD MMM, HH:mm')} ·{' '}
              {item.type === 'CHECK_IN' ? 'IN' : 'OUT'}
            </Text>
            <Text style={styles.recordScore}>
              Match: {(item.matchScore * 100).toFixed(0)}% · Liveness:{' '}
              {(item.livenessScore * 100).toFixed(0)}%
            </Text>
          </View>
        </View>
        <View
          style={[
            styles.statusBadge,
            item.status === 'SUCCESS' ? styles.statusSynced : styles.statusPending,
          ]}>
          <Text style={styles.statusBadgeText}>
            {item.status === 'SUCCESS' ? '✓' : '⏳'}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Search */}
      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search employee..."
          placeholderTextColor="#4A5568"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Filter chips */}
      <View style={styles.filterRow}>
        {(['ALL', 'PENDING_SYNC', 'SUCCESS'] as const).map(f => (
          <TouchableOpacity
            key={f}
            style={[
              styles.filterChip,
              statusFilter === f && styles.filterChipActive,
            ]}
            onPress={() => setStatusFilter(f)}>
            <Text
              style={[
                styles.filterChipText,
                statusFilter === f && styles.filterChipTextActive,
              ]}>
              {f === 'PENDING_SYNC' ? 'Pending' : f === 'SUCCESS' ? 'Synced' : 'All'}
            </Text>
          </TouchableOpacity>
        ))}
        <Text style={styles.countText}>{filteredRecords.length} records</Text>
      </View>

      <FlatList
        data={filteredRecords}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#00D4FF"
          />
        }
        onEndReached={() => hasMore && loadData()}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyText}>No records found</Text>
          </View>
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#0A0E1A'},
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1F2E',
    margin: 16,
    marginBottom: 8,
    borderRadius: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  searchIcon: {fontSize: 16, marginRight: 8},
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    paddingVertical: 14,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 12,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: '#1A1F2E',
  },
  filterChipActive: {
    backgroundColor: 'rgba(0,212,255,0.2)',
    borderColor: '#00D4FF',
  },
  filterChipText: {fontSize: 12, color: '#8892A4', fontWeight: '600'},
  filterChipTextActive: {color: '#00D4FF'},
  countText: {
    marginLeft: 'auto',
    fontSize: 12,
    color: '#8892A4',
  },
  listContent: {paddingHorizontal: 16, paddingBottom: 32},
  recordCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1F2E',
    borderRadius: 14,
    padding: 14,
    justifyContent: 'space-between',
  },
  recordLeft: {flexDirection: 'row', alignItems: 'center', flex: 1},
  typeIndicator: {
    width: 4,
    height: 48,
    borderRadius: 2,
    marginRight: 12,
  },
  checkInIndicator: {backgroundColor: '#64FFB4'},
  checkOutIndicator: {backgroundColor: '#FF6B35'},
  employeeName: {fontSize: 15, fontWeight: '700', color: '#FFFFFF', marginBottom: 3},
  recordMeta: {fontSize: 12, color: '#8892A4', marginBottom: 2},
  recordScore: {fontSize: 11, color: '#4A5568'},
  statusBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusSynced: {backgroundColor: 'rgba(100,255,180,0.2)'},
  statusPending: {backgroundColor: 'rgba(255,179,71,0.2)'},
  statusBadgeText: {fontSize: 14},
  separator: {height: 8},
  empty: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyIcon: {fontSize: 48, marginBottom: 12},
  emptyText: {fontSize: 16, color: '#8892A4'},
});

export default OfflineRecordsScreen;
