import { describe, it, expect } from 'vitest';
import {
  IdempotencyManager,
  IdempotencyConflictError,
  IdempotencyInFlightError
} from '../../src/lib/idempotency/idempotency-manager';

describe('Actor-Bound, Operation-Bound Idempotency Manager', () => {
  it('reserves a new key and returns isReplay: false', () => {
    const manager = new IdempotencyManager();
    const result = manager.reserve(
      'user-1',
      'submit_scores',
      'key-123',
      { scores: [{ pc_id: 'pc-1', score_level: 2 }] },
      'assessment-abc'
    );

    expect(result.isReplay).toBe(false);
  });

  it('returns cached response when identical request is replayed after completion', () => {
    const manager = new IdempotencyManager();
    const payload = { scores: [{ pc_id: 'pc-1', score_level: 2 }] };

    manager.reserve('user-1', 'submit_scores', 'key-123', payload, 'assessment-abc');
    manager.finalize('user-1', 'submit_scores', 'key-123', { success: true, overall_score: 75 });

    const replay = manager.reserve('user-1', 'submit_scores', 'key-123', payload, 'assessment-abc');
    expect(replay.isReplay).toBe(true);
    expect(replay.cachedResponse).toEqual({ success: true, overall_score: 75 });
  });

  it('rejects key reuse with modified payload (payload mismatch conflict)', () => {
    const manager = new IdempotencyManager();
    const initialPayload = { scores: [{ pc_id: 'pc-1', score_level: 2 }] };
    const modifiedPayload = { scores: [{ pc_id: 'pc-1', score_level: 3 }] };

    manager.reserve('user-1', 'submit_scores', 'key-123', initialPayload, 'assessment-abc');
    manager.finalize('user-1', 'submit_scores', 'key-123', { success: true });

    expect(() => {
      manager.reserve('user-1', 'submit_scores', 'key-123', modifiedPayload, 'assessment-abc');
    }).toThrowError(IdempotencyConflictError);
  });

  it('rejects key reuse with different assessment ID', () => {
    const manager = new IdempotencyManager();
    const payload = { scores: [{ pc_id: 'pc-1', score_level: 2 }] };

    manager.reserve('user-1', 'submit_scores', 'key-123', payload, 'assessment-abc');

    expect(() => {
      manager.reserve('user-1', 'submit_scores', 'key-123', payload, 'assessment-xyz');
    }).toThrowError(IdempotencyConflictError);
  });

  it('throws InFlightError if same key is sent concurrently while pending', () => {
    const manager = new IdempotencyManager();
    const payload = { scores: [{ pc_id: 'pc-1', score_level: 2 }] };

    manager.reserve('user-1', 'submit_scores', 'key-123', payload, 'assessment-abc');

    expect(() => {
      manager.reserve('user-1', 'submit_scores', 'key-123', payload, 'assessment-abc');
    }).toThrowError(IdempotencyInFlightError);
  });

  it('rejects key reuse across different actors (actor isolation)', () => {
    const manager = new IdempotencyManager();
    const payload = { scores: [{ pc_id: 'pc-1', score_level: 2 }] };

    manager.reserve('user-1', 'submit_scores', 'key-shared-123', payload, 'assessment-abc');
    manager.finalize('user-1', 'submit_scores', 'key-shared-123', { success: true });

    // User-2 attempts to use user-1's key
    expect(() => {
      manager.reserve('user-2', 'submit_scores', 'key-shared-123', payload, 'assessment-abc');
    }).toThrowError(/belongs to another user/i);
  });

  it('rejects key reuse across different operations', () => {
    const manager = new IdempotencyManager();
    const payload = { test: 123 };

    manager.reserve('user-1', 'submit_scores', 'key-op-123', payload, 'assessment-abc');
    manager.finalize('user-1', 'submit_scores', 'key-op-123', { success: true });

    // Same user, same key, different operation
    expect(() => {
      manager.reserve('user-1', 'reviewer_signoff', 'key-op-123', payload, 'assessment-abc');
    }).toThrowError(/differing operation/i);
  });
});
