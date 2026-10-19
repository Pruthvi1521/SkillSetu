import { NextRequest, NextResponse } from 'next/server';
import { IdempotencyManager, IdempotencyConflictError, IdempotencyInFlightError } from '@/lib/idempotency/idempotency-manager';

// Global in-memory idempotency tracker for local development/server simulation
const serverIdempotency = new IdempotencyManager();

export async function POST(req: NextRequest) {
  try {
    const idempotencyKey = req.headers.get('x-idempotency-key');
    if (!idempotencyKey) {
      return NextResponse.json({ error: 'Missing X-Idempotency-Key header' }, { status: 400 });
    }

    const body = await req.json();
    const { operation, assessment_id, payload } = body;

    // Simulate actor from session (in prod from supabase auth)
    const actorId = req.headers.get('x-actor-id') || 'simulated-actor-001';

    // Check / reserve idempotency
    try {
      const reservation = serverIdempotency.reserve(
        actorId,
        operation,
        idempotencyKey,
        payload,
        assessment_id
      );

      if (reservation.isReplay) {
        return NextResponse.json({
          status: 'replayed',
          data: reservation.cachedResponse
        }, { status: 200 });
      }
    } catch (err: unknown) {
      if (err instanceof IdempotencyConflictError) {
        return NextResponse.json({ error: err.message }, { status: 409 });
      }
      if (err instanceof IdempotencyInFlightError) {
        return NextResponse.json({ error: err.message }, { status: 425 });
      }
      throw err;
    }

    // Process mutation
    const simulatedResponse = {
      success: true,
      operation,
      assessment_id,
      timestamp: new Date().toISOString()
    };

    // Finalize idempotency
    serverIdempotency.finalize(actorId, operation, idempotencyKey, simulatedResponse);

    return NextResponse.json({
      status: 'processed',
      data: simulatedResponse
    }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
