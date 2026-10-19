-- Migration: 00003_integrity_triggers.sql
-- Description: Enforces active profile resolution, immutability of locked rubrics, finalized assessments/reports, and idempotency key lifecycle.

-- 1. Helper function: Get authenticated and verified active profile
CREATE OR REPLACE FUNCTION public.get_authenticated_active_profile()
RETURNS RECORD
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_profile RECORD;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Unauthenticated: Valid session required.' USING ERRCODE = '28000';
    END IF;

    SELECT id, role, is_active, assessor_accreditation_id 
    INTO v_profile 
    FROM public.profiles 
    WHERE id = auth.uid();

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Unauthorized: User profile does not exist.' USING ERRCODE = '42501';
    END IF;

    IF v_profile.is_active IS NOT TRUE THEN
        RAISE EXCEPTION 'Forbidden: User account is inactive.' USING ERRCODE = '42501';
    END IF;

    RETURN v_profile;
END;
$$ LANGUAGE plpgsql;

REVOKE EXECUTE ON FUNCTION public.get_authenticated_active_profile FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_authenticated_active_profile TO authenticated, service_role;

-- 2. Prevent role and privileged profile self-updates
CREATE OR REPLACE FUNCTION public.prevent_privileged_profile_updates()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller RECORD;
BEGIN
    IF (OLD.role IS DISTINCT FROM NEW.role) OR 
       (OLD.is_active IS DISTINCT FROM NEW.is_active) OR 
       (OLD.assessor_accreditation_id IS DISTINCT FROM NEW.assessor_accreditation_id) THEN
       
        v_caller := public.get_authenticated_active_profile();
        IF v_caller.role != 'admin' THEN
            RAISE EXCEPTION 'Unauthorized: Privileged profile fields can only be modified by administrators.' USING ERRCODE = '42501';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

REVOKE EXECUTE ON FUNCTION public.prevent_privileged_profile_updates FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prevent_privileged_profile_updates TO authenticated;

DROP TRIGGER IF EXISTS trg_prevent_privileged_profile_updates ON profiles;
CREATE TRIGGER trg_prevent_privileged_profile_updates
BEFORE UPDATE ON profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_privileged_profile_updates();

-- 3. Prevent modifications to locked rubric configurations and child NOS/PC
CREATE OR REPLACE FUNCTION public.prevent_locked_rubric_edits()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF OLD.is_locked = TRUE THEN
        RAISE EXCEPTION 'Illegal Operation: Locked rubric configurations cannot be modified or deleted.' USING ERRCODE = '55000';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

REVOKE EXECUTE ON FUNCTION public.prevent_locked_rubric_edits FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prevent_locked_rubric_edits TO authenticated;

DROP TRIGGER IF EXISTS trg_prevent_locked_rubric_edits ON rubric_configurations;
CREATE TRIGGER trg_prevent_locked_rubric_edits
BEFORE UPDATE OR DELETE ON rubric_configurations
FOR EACH ROW EXECUTE FUNCTION public.prevent_locked_rubric_edits();

-- 4. Prevent modifications to finalized assessments and reports
CREATE OR REPLACE FUNCTION public.check_assessment_immutability()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF OLD.status = 'finalized' THEN
        RAISE EXCEPTION 'Illegal Operation: Finalized assessments are permanently immutable.' USING ERRCODE = '55000';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

REVOKE EXECUTE ON FUNCTION public.check_assessment_immutability FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_assessment_immutability TO authenticated;

DROP TRIGGER IF EXISTS trg_assessment_immutability ON assessments;
CREATE TRIGGER trg_assessment_immutability
BEFORE UPDATE OR DELETE ON assessments
FOR EACH ROW EXECUTE FUNCTION public.check_assessment_immutability();

CREATE OR REPLACE FUNCTION public.check_report_immutability()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    RAISE EXCEPTION 'Illegal Operation: Competency reports cannot be updated or deleted.' USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

REVOKE EXECUTE ON FUNCTION public.check_report_immutability FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_report_immutability TO authenticated;

DROP TRIGGER IF EXISTS trg_report_immutability ON competency_reports;
CREATE TRIGGER trg_report_immutability
BEFORE UPDATE OR DELETE ON competency_reports
FOR EACH ROW EXECUTE FUNCTION public.check_report_immutability();

-- 5. Idempotency Key Management Procedures
-- Scoped to authenticated actor, operation, optional assessment, and canonical payload hash
CREATE OR REPLACE FUNCTION public.reserve_idempotency_key(
    p_client_sync_id UUID,
    p_operation TEXT,
    p_payload_hash TEXT,
    p_assessment_id UUID DEFAULT NULL
) RETURNS JSONB
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller RECORD;
    v_rec RECORD;
BEGIN
    v_caller := public.get_authenticated_active_profile();

    -- Check if key already exists
    SELECT * INTO v_rec FROM public.idempotency_records 
    WHERE client_sync_id = p_client_sync_id FOR UPDATE;

    IF FOUND THEN
        IF v_rec.actor_id != v_caller.id THEN
            RAISE EXCEPTION 'Forbidden: Idempotency key belongs to another user.' USING ERRCODE = '42501';
        END IF;

        IF v_rec.operation != p_operation THEN
            RAISE EXCEPTION 'Conflict: Idempotency key reuse for differing operation.' USING ERRCODE = '40900';
        END IF;

        IF v_rec.status = 'completed' THEN
            IF v_rec.payload_hash = p_payload_hash THEN
                -- Replay success
                RETURN jsonb_build_object(
                    'action', 'replay',
                    'response_code', v_rec.response_code,
                    'response_body', v_rec.response_body
                );
            ELSE
                RAISE EXCEPTION 'Conflict: Idempotency key reuse with mismatched payload.' USING ERRCODE = '40900';
            END IF;
        ELSIF v_rec.status = 'in_progress' THEN
            RAISE EXCEPTION 'Conflict: Mutation currently processing.' USING ERRCODE = '40901';
        ELSE
            -- Failed status: allow safe retry
            UPDATE public.idempotency_records 
            SET status = 'in_progress', payload_hash = p_payload_hash, created_at = NOW() 
            WHERE client_sync_id = p_client_sync_id;
            
            RETURN jsonb_build_object('action', 'proceed');
        END IF;
    END IF;

    -- Key does not exist: reserve atomically
    INSERT INTO public.idempotency_records (
        client_sync_id, actor_id, operation, assessment_id, payload_hash, status
    ) VALUES (
        p_client_sync_id, v_caller.id, p_operation, p_assessment_id, p_payload_hash, 'in_progress'
    );

    RETURN jsonb_build_object('action', 'proceed');
END;
$$ LANGUAGE plpgsql;

-- Revoke direct call from client; internal procedure only
REVOKE EXECUTE ON FUNCTION public.reserve_idempotency_key FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.reserve_idempotency_key TO service_role;

CREATE OR REPLACE FUNCTION public.finalize_idempotency_record(
    p_client_sync_id UUID,
    p_response_code INTEGER,
    p_response_body JSONB
) RETURNS VOID
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    UPDATE public.idempotency_records
    SET status = 'completed',
        response_code = p_response_code,
        response_body = p_response_body,
        completed_at = NOW()
    WHERE client_sync_id = p_client_sync_id;
END;
$$ LANGUAGE plpgsql;

REVOKE EXECUTE ON FUNCTION public.finalize_idempotency_record FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.finalize_idempotency_record TO service_role;
