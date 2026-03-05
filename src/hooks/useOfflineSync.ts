import { useState, useEffect, useCallback } from 'react';
import { getUnsyncedReports, markReportAsSynced, deleteSyncedReports } from '../utils/db';
import { apiFetch } from '../utils/api';

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  const updatePendingCount = useCallback(async () => {
    const reports = await getUnsyncedReports();
    setPendingCount(reports.length);
  }, []);

  const syncReports = useCallback(async () => {
    if (!navigator.onLine || isSyncing) return;

    const reports = await getUnsyncedReports();
    if (reports.length === 0) return;

    setIsSyncing(true);
    let successCount = 0;

    for (const report of reports) {
      try {
        let endpoint = '';
        if (report.type === 'driver') endpoint = '/api/driver-reports';
        else if (report.type === 'expense') endpoint = '/api/driver-expenses';
        else if (report.type === 'return') endpoint = '/api/return-goods-reports';
        else if (report.type === 'sale') endpoint = '/api/sale-reports/offline-sync';

        await apiFetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(report.data),
        });

        await markReportAsSynced(report.id!);
        successCount++;
      } catch (error) {
        console.error(`Failed to sync report ${report.id}:`, error);
        // Stop syncing if we hit a network error (not just a validation error)
        if (!navigator.onLine) break;
      }
    }

    if (successCount > 0) {
      await deleteSyncedReports();
      await updatePendingCount();
    }
    setIsSyncing(false);
  }, [isSyncing, updatePendingCount]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncReports();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    updatePendingCount();

    // Periodic sync check
    const interval = setInterval(() => {
      if (navigator.onLine) syncReports();
    }, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [syncReports, updatePendingCount]);

  return { isOnline, pendingCount, isSyncing, syncReports, updatePendingCount };
}
