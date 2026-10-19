-- Migration: 00004_audit_hash_chain.sql
-- Description: Serial hash-chained audit logging, checkpointing, and verification procedures.

-- 1. Append Audit Log Procedure (Callable exclusively via trusted internal procedures)
CREATE OR REPLACE FUNCTION public.append_audit_log_entry(
    p_entity_name TEXT,
    p_entity_id UUID,
    p_action TEXT,
    p_old_state JSONB,
    p_new_state JSONB,
    p_client_timestamp TIMESTAMPTZ,
    p_ip_address TEXT,
    p_user_agent TEXT
) RETURNS BIGINT 
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_prev_hash TEXT;
    v_record_hash TEXT;
    v_new_id BIGINT;
    v_server_timestamp TIMESTAMPTZ := NOW();
    v_actor_id UUID := auth.uid();
    v_canonical_json JSONB;
BEGIN
    -- Transaction-scoped advisory lock guarantees deterministic serial order
    PERFORM pg_advisory_xact_lock(749201948201);
    
    SELECT record_hash INTO v_prev_hash FROM public.audit_trail ORDER BY id DESC LIMIT 1;
    IF v_prev_hash IS NULL THEN
        v_prev_hash := 'GENESIS_RECORD_HASH_000000000000000000000000000000000000000000000000';
    END IF;
    
    -- Canonical key sorting and null-safe JSON construction
    v_canonical_json := jsonb_build_object(
        'action', p_action,
        'actor_id', COALESCE(v_actor_id::text, 'NULL_ACTOR'),
        'client_timestamp', p_client_timestamp,
        'entity_id', p_entity_id::text,
        'entity_name', p_entity_name,
        'ip_address', p_ip_address,
        'new_state', COALESCE(p_new_state, '{}'::jsonb),
        'old_state', COALESCE(p_old_state, '{}'::jsonb),
        'prev_record_hash', v_prev_hash,
        'server_timestamp', v_server_timestamp,
        'user_agent', p_user_agent
    );
    
    v_record_hash := encode(digest(v_canonical_json::text, 'sha256'), 'hex');
    
    INSERT INTO public.audit_trail (
        entity_name, entity_id, action, actor_id, old_state, new_state,
        client_timestamp, server_timestamp, ip_address, user_agent, prev_record_hash, record_hash
    ) VALUES (
        p_entity_name, p_entity_id, p_action, v_actor_id, p_old_state, p_new_state,
        p_client_timestamp, v_server_timestamp, p_ip_address, p_user_agent, v_prev_hash, v_record_hash
    ) RETURNING id INTO v_new_id;
    
    RETURN v_new_id;
END;
$$ LANGUAGE plpgsql;

REVOKE EXECUTE ON FUNCTION public.append_audit_log_entry FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.append_audit_log_entry TO service_role;

-- 2. Audit Verification Function (Restricted to Administrators)
CREATE OR REPLACE FUNCTION public.verify_audit_chain()
RETURNS TABLE (
    is_valid BOOLEAN,
    broken_record_id BIGINT,
    error_message TEXT
) 
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller RECORD;
    r RECORD;
    v_expected_prev TEXT := 'GENESIS_RECORD_HASH_000000000000000000000000000000000000000000000000';
    v_calculated_hash TEXT;
    v_canonical_json JSONB;
BEGIN
    v_caller := public.get_authenticated_active_profile();
    IF v_caller.role != 'admin' THEN
        RAISE EXCEPTION 'Unauthorized: Only system administrators can verify audit chain.' USING ERRCODE = '42501';
    END IF;

    FOR r IN SELECT * FROM public.audit_trail ORDER BY id ASC LOOP
        IF r.prev_record_hash != v_expected_prev THEN
            RETURN QUERY SELECT FALSE, r.id, 'Chain broken: prev_record_hash does not match preceding record_hash';
            RETURN;
        END IF;
        
        v_canonical_json := jsonb_build_object(
            'action', r.action,
            'actor_id', COALESCE(r.actor_id::text, 'NULL_ACTOR'),
            'client_timestamp', r.client_timestamp,
            'entity_id', r.entity_id::text,
            'entity_name', r.entity_name,
            'ip_address', r.ip_address,
            'new_state', COALESCE(r.new_state, '{}'::jsonb),
            'old_state', COALESCE(r.old_state, '{}'::jsonb),
            'prev_record_hash', r.prev_record_hash,
            'server_timestamp', r.server_timestamp,
            'user_agent', r.user_agent
        );
        
        v_calculated_hash := encode(digest(v_canonical_json::text, 'sha256'), 'hex');
        
        IF r.record_hash != v_calculated_hash THEN
            RETURN QUERY SELECT FALSE, r.id, 'Data tampering detected: record_hash does not match canonical payload digest';
            RETURN;
        END IF;
        
        v_expected_prev := r.record_hash;
    END LOOP;
    
    RETURN QUERY SELECT TRUE, NULL::BIGINT, 'Audit chain fully verified.'::TEXT;
END;
$$ LANGUAGE plpgsql;

REVOKE EXECUTE ON FUNCTION public.verify_audit_chain FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_audit_chain TO authenticated;

-- 3. Checkpoint Verification against external anchor
CREATE OR REPLACE FUNCTION public.create_audit_checkpoint(
    p_signed_digest TEXT DEFAULT NULL
) RETURNS BIGINT
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller RECORD;
    v_last_rec RECORD;
    v_checkpoint_id BIGINT;
BEGIN
    v_caller := public.get_authenticated_active_profile();
    IF v_caller.role != 'admin' THEN
        RAISE EXCEPTION 'Unauthorized: Only system administrators can create checkpoints.' USING ERRCODE = '42501';
    END IF;

    SELECT id, record_hash INTO v_last_rec FROM public.audit_trail ORDER BY id DESC LIMIT 1;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Cannot create checkpoint: Audit trail is empty.' USING ERRCODE = 'P0002';
    END IF;

    INSERT INTO public.audit_checkpoints (last_audit_id, last_record_hash, signed_digest, created_by)
    VALUES (v_last_rec.id, v_last_rec.record_hash, p_signed_digest, v_caller.id)
    RETURNING id INTO v_checkpoint_id;

    RETURN v_checkpoint_id;
END;
$$ LANGUAGE plpgsql;

REVOKE EXECUTE ON FUNCTION public.create_audit_checkpoint FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_audit_checkpoint TO authenticated;
