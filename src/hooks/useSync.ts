import {useState, useCallback, useRef, useEffect} from 'react';
import SyncQueueRepository from '../database/repositories/SyncQueueRepository';
import SyncService from '../services/SyncService';
import {SyncResult} from '../types/LivenessChallenge';
import {logger} from '../utils/logger';

export interface UseSyncReturn {
  pendingCount: number;
  isSyncing: boolean;
  lastSyncResult: SyncResult | null;
  syncNow: () => Promise<void>;
  refreshPendingCount: () => Promise<void>;
}

export function useSync(): UseSyncReturn {
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    refreshPendingCount();
    return () => {
      isMounted.current = false;
    };
  }, []);

  const refreshPendingCount = useCallback(async () => {
    try {
      const count = await SyncQueueRepository.getPendingCount();
      if (isMounted.current) {
        setPendingCount(count);
      }
    } catch (error) {
      logger.error('Failed to get pending count:', error);
    }
  }, []);

  const syncNow = useCallback(async () => {
    if (isSyncing) {
      return;
    }
    setIsSyncing(true);
    try {
      const result = await SyncService.getInstance().syncNow();
      if (isMounted.current) {
        setLastSyncResult(result);
        await refreshPendingCount();
      }
    } catch (error) {
      logger.error('Sync failed:', error);
    } finally {
      if (isMounted.current) {
        setIsSyncing(false);
      }
    }
  }, [isSyncing, refreshPendingCount]);

  return {pendingCount, isSyncing, lastSyncResult, syncNow, refreshPendingCount};
}
