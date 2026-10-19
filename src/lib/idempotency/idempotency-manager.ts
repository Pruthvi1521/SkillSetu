import { canonicalizeJson, computeReportHash } from '../security/canonical-report-hasher';

export interface IdempotencyReservation {
  idempotency_key: string;
  actor_id: string;
  operation_type: string;
  assessment_id?: string | null;
  payload_hash: string;
  status: 'pending' | 'completed' | 'failed';
  cached_response?: unknown;
  created_at: string;
  expires_at: string;
}

export class IdempotencyConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IdempotencyConflictError';
  }
}

export class IdempotencyInFlightError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IdempotencyInFlightError';
  }
}

/**
 * Computes deterministic SHA-256 hash of operation request payload.
 */
export function hashPayload(payload: unknown): string {
  const canonical = canonicalizeJson(payload);
  // Using universal canonical hasher
  return computeReportHash(payload as any);
}

/**
 * Validates and manages idempotency reservations in memory or database mock.
 */
export class IdempotencyManager {
  private records = new Map<string, IdempotencyReservation>();

  reserve(
    actorId: string,
    operationType: string,
    idempotencyKey: string,
    payload: unknown,
    assessmentId?: string | null,
    ttlSeconds = 300
  ): { isReplay: boolean; cachedResponse?: unknown } {
    if (!actorId || !operationType || !idempotencyKey) {
      throw new Error('actorId, operationType, and idempotencyKey are mandatory');
    }

    const currentHash = hashPayload(payload);
    const existing = this.records.get(idempotencyKey);
    const now = new Date();

    if (existing) {
      // Check expiration
      if (new Date(existing.expires_at) < now) {
        this.records.delete(idempotencyKey);
      } else {
        // Enforce strict actor isolation
        if (existing.actor_id !== actorId) {
          throw new IdempotencyConflictError(
            `Forbidden: Idempotency key "${idempotencyKey}" belongs to another user.`
          );
        }

        // Enforce strict operation isolation
        if (existing.operation_type !== operationType) {
          throw new IdempotencyConflictError(
            `Conflict: Idempotency key "${idempotencyKey}" reuse for differing operation.`
          );
        }

        // Enforce strict assessment isolation
        if ((existing.assessment_id || null) !== (assessmentId || null)) {
          throw new IdempotencyConflictError(
            `Conflict: Idempotency key "${idempotencyKey}" already used for a different assessment.`
          );
        }

        // Enforce strict payload isolation
        if (existing.payload_hash !== currentHash) {
          throw new IdempotencyConflictError(
            `Conflict: Idempotency key "${idempotencyKey}" already used with different payload.`
          );
        }

        if (existing.status === 'pending') {
          throw new IdempotencyInFlightError(
            `Conflict: A mutation with key "${idempotencyKey}" is currently processing.`
          );
        }

        if (existing.status === 'completed') {
          return {
            isReplay: true,
            cachedResponse: existing.cached_response
          };
        }
      }
    }

    // Reserve new pending record
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000).toISOString();
    this.records.set(idempotencyKey, {
      idempotency_key: idempotencyKey,
      actor_id: actorId,
      operation_type: operationType,
      assessment_id: assessmentId || null,
      payload_hash: currentHash,
      status: 'pending',
      created_at: now.toISOString(),
      expires_at: expiresAt
    });

    return { isReplay: false };
  }

  finalize(
    actorId: string,
    operationType: string,
    idempotencyKey: string,
    response: unknown
  ): void {
    const existing = this.records.get(idempotencyKey);
    if (!existing) {
      throw new Error(`Cannot finalize unreserved idempotency record: ${idempotencyKey}`);
    }
    if (existing.actor_id !== actorId || existing.operation_type !== operationType) {
      throw new IdempotencyConflictError(`Unauthorized or mismatched finalize attempt for ${idempotencyKey}`);
    }

    existing.status = 'completed';
    existing.cached_response = response;
  }

  fail(actorId: string, operationType: string, idempotencyKey: string): void {
    const existing = this.records.get(idempotencyKey);
    if (existing && existing.actor_id === actorId) {
      this.records.delete(idempotencyKey);
    }
  }
}
