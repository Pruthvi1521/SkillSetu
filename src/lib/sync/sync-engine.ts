import { localDb, MutationQueueItem } from '../db/idb';
import { hashPayload } from '../idempotency/idempotency-manager';

export interface SyncEngineStatus {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  conflictCount: number;
  lastSyncAt: string | null;
  error?: string | null;
}

export type SyncStatusListener = (status: SyncEngineStatus) => void;

class SyncEngine {
  private isSyncing = false;
  private listeners: Set<SyncStatusListener> = new Set();
  private lastSyncAt: string | null = null;
  private currentError: string | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleNetworkChange(true));
      window.addEventListener('offline', () => this.handleNetworkChange(false));
    }
  }

  public subscribe(listener: SyncStatusListener): () => void {
    this.listeners.add(listener);
    this.notify();
    return () => this.listeners.delete(listener);
  }

  private async notify(): Promise<void> {
    const status = await this.getStatus();
    this.listeners.forEach(fn => fn(status));
  }

  public async getStatus(): Promise<SyncEngineStatus> {
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    const pendingCount = await localDb.mutation_queue.where('status').equals('pending').count();
    const conflictCount = await localDb.mutation_queue.where('status').equals('conflict').count();

    return {
      isOnline,
      isSyncing: this.isSyncing,
      pendingCount,
      conflictCount,
      lastSyncAt: this.lastSyncAt,
      error: this.currentError
    };
  }

  private handleNetworkChange(isOnline: boolean): void {
    this.notify();
    if (isOnline) {
      this.triggerSync();
    }
  }

  /**
   * Enqueues an offline mutation with an idempotency key.
   */
  public async enqueueMutation(
    operation: MutationQueueItem['operation'],
    payload: Record<string, unknown>,
    assessmentId?: string
  ): Promise<string> {
    const clientSyncId = 'sync_' + Math.random().toString(36).substring(2, 12);
    const idempotencyKey = 'idem_' + clientSyncId + '_' + Date.now();

    await localDb.mutation_queue.add({
      client_sync_id: clientSyncId,
      idempotency_key: idempotencyKey,
      operation,
      assessment_id: assessmentId,
      payload,
      status: 'pending',
      retry_count: 0,
      created_at: new Date().toISOString()
    });

    await this.notify();
    this.triggerSync();
    return clientSyncId;
  }

  /**
   * Triggers processing of the pending queue.
   */
  public async triggerSync(): Promise<void> {
    if (this.isSyncing) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return;
    }

    this.isSyncing = true;
    this.currentError = null;
    await this.notify();

    try {
      const pendingItems = await localDb.mutation_queue
        .where('status')
        .equals('pending')
        .toArray();

      for (const item of pendingItems) {
        if (!item.id) continue;

        try {
          // Mark in-flight
          await localDb.mutation_queue.update(item.id, { status: 'in_flight' });

          // In production, this dispatches to Supabase RPC with headers:
          // X-Idempotency-Key: item.idempotency_key
          // In mock/test/demo mode, we simulate successful sync or conflict detection
          const result = await this.dispatchToServer(item);

          if (result.success) {
            await localDb.mutation_queue.update(item.id, { status: 'synced' });
          } else if (result.isConflict) {
            await localDb.mutation_queue.update(item.id, {
              status: 'conflict',
              error_message: result.error
            });
          } else {
            // Transient error: increment retry
            await localDb.mutation_queue.update(item.id, {
              status: 'pending',
              retry_count: item.retry_count + 1,
              error_message: result.error
            });
          }
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Unknown sync error';
          await localDb.mutation_queue.update(item.id, {
            status: 'pending',
            retry_count: item.retry_count + 1,
            error_message: message
          });
        }
      }

      this.lastSyncAt = new Date().toISOString();
    } catch (err: unknown) {
      this.currentError = err instanceof Error ? err.message : 'Batch sync failure';
    } finally {
      this.isSyncing = false;
      await this.notify();
    }
  }

  /**
   * Internal dispatcher connecting to Supabase RPCs.
   */
  private async dispatchToServer(
    item: MutationQueueItem
  ): Promise<{ success: boolean; isConflict?: boolean; error?: string }> {
    // If Supabase environment is configured, call supabase.rpc()
    // Check if SUPABASE_URL exists
    const hasSupabase = typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SUPABASE_URL;

    if (!hasSupabase) {
      // Offline/Local demonstration mode: mark synced after artificial network delay
      await new Promise(res => setTimeout(res, 200));
      return { success: true };
    }

    // Call server endpoint / RPC with payload and idempotency key
    try {
      const response = await fetch('/api/sync/dispatch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': item.idempotency_key
        },
        body: JSON.stringify({
          operation: item.operation,
          assessment_id: item.assessment_id,
          payload: item.payload
        })
      });

      if (response.status === 409) {
        const data = await response.json().catch(() => ({}));
        return { success: false, isConflict: true, error: data.error || 'Version Conflict' };
      }

      if (!response.ok) {
        const text = await response.text();
        return { success: false, error: `HTTP ${response.status}: ${text}` };
      }

      return { success: true };
    } catch (e: unknown) {
      return { success: false, error: e instanceof Error ? e.message : 'Network error' };
    }
  }
}

export const syncEngine = new SyncEngine();
