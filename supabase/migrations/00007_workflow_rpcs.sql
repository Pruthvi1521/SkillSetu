-- Migration: 00007_workflow_rpcs.sql
-- Description: Trusted workflow state-machine procedures: declaration submission, review, QP match confirmation, assessment assignment, QP verification, cancellation, and atomic conflict resolution.

-- 1. Declaration Submission RPC
CREATE OR REPLACE FUNCTION public.submit_worker_declaration(
    p_declaration_id UUID,
    p_client_sync_id UUID
) RETURNS JSONB
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller RECORD;
    v_dec RECORD;
    v_completeness NUMERIC := 0.0;
    v_idemp_res JSONB;
    v_result JSONB;
BEGIN
    v_caller := public.get_authenticated_active_profile();

    -- Idempotency Reservation
    v_idemp_res := public.reserve_idempotency_key(
        p_client_sync_id, 'SUBMIT_DECLARATION', 
        encode(digest(p_declaration_id::text, 'sha256'), 'hex')
    );
    IF (v_idemp_res->>'action') = 'replay' THEN
        RETURN v_idemp_res->'response_body';
    END IF;

    SELECT * INTO v_dec FROM public.worker_declarations WHERE id = p_declaration_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Declaration not found: %', p_declaration_id USING ERRCODE = 'P0002';
    END IF;

    IF v_dec.worker_id != v_caller.id THEN
        RAISE EXCEPTION 'Unauthorized: Caller does not own this declaration.' USING ERRCODE = '42501';
    END IF;

    IF v_dec.status != 'draft' THEN
        RAISE EXCEPTION 'Declaration cannot be submitted from status: %', v_dec.status USING ERRCODE = '55000';
    END IF;

    -- Validate Required Intake Criteria
    IF v_dec.total_experience_months <= 0 THEN
        RAISE EXCEPTION 'Validation Failed: Experience tenure must be greater than zero.' USING ERRCODE = '22023';
    END IF;

    IF jsonb_array_length(v_dec.tasks_performed) = 0 OR jsonb_array_length(v_dec.tools_mastered) = 0 THEN
        RAISE EXCEPTION 'Validation Failed: Tasks and tools must not be empty.' USING ERRCODE = '22023';
    END IF;

    v_completeness := 100.0;

    UPDATE public.worker_declarations 
    SET status = 'submitted', completeness_score = v_completeness, updated_at = NOW() 
    WHERE id = p_declaration_id;

    PERFORM public.append_audit_log_entry(
        'worker_declarations', p_declaration_id, 'SUBMIT_DECLARATION',
        jsonb_build_object('status', 'draft'),
        jsonb_build_object('status', 'submitted', 'client_sync_id', p_client_sync_id),
        NOW(), NULL, NULL
    );

    v_result := jsonb_build_object('status', 'success', 'declaration_id', p_declaration_id, 'new_status', 'submitted');
    PERFORM public.finalize_idempotency_record(p_client_sync_id, 200, v_result);
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

REVOKE EXECUTE ON FUNCTION public.submit_worker_declaration FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_worker_declaration TO authenticated;

-- 2. Review Worker Declaration RPC
CREATE OR REPLACE FUNCTION public.review_worker_declaration(
    p_declaration_id UUID
) RETURNS JSONB
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller RECORD;
    v_dec RECORD;
BEGIN
    v_caller := public.get_authenticated_active_profile();
    IF v_caller.role NOT IN ('reviewer', 'admin') THEN
        RAISE EXCEPTION 'Unauthorized: Only reviewers or admins can review declarations.' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_dec FROM public.worker_declarations WHERE id = p_declaration_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Declaration not found: %', p_declaration_id USING ERRCODE = 'P0002';
    END IF;

    IF v_dec.status != 'submitted' THEN
        RAISE EXCEPTION 'Declaration must be in submitted state to begin review. Current: %', v_dec.status USING ERRCODE = '55000';
    END IF;

    UPDATE public.worker_declarations SET status = 'under_review', updated_at = NOW() WHERE id = p_declaration_id;

    PERFORM public.append_audit_log_entry(
        'worker_declarations', p_declaration_id, 'START_DECLARATION_REVIEW',
        jsonb_build_object('status', 'submitted'),
        jsonb_build_object('status', 'under_review', 'reviewer_id', v_caller.id),
        NOW(), NULL, NULL
    );

    RETURN jsonb_build_object('status', 'success', 'declaration_id', p_declaration_id, 'new_status', 'under_review');
END;
$$ LANGUAGE plpgsql;

REVOKE EXECUTE ON FUNCTION public.review_worker_declaration FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_worker_declaration TO authenticated;

-- 3. Confirm / Override QP Match RPC
CREATE OR REPLACE FUNCTION public.confirm_qp_match(
    p_declaration_id UUID,
    p_qp_id UUID,
    p_decision reviewer_decision_status,
    p_justification TEXT
) RETURNS JSONB
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller RECORD;
    v_dec RECORD;
    v_qp RECORD;
BEGIN
    v_caller := public.get_authenticated_active_profile();
    IF v_caller.role NOT IN ('reviewer', 'admin') THEN
        RAISE EXCEPTION 'Unauthorized: Only reviewers or admins can confirm QP matches.' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_dec FROM public.worker_declarations WHERE id = p_declaration_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Declaration not found' USING ERRCODE = 'P0002';
    END IF;

    IF v_dec.status NOT IN ('submitted', 'under_review') THEN
        RAISE EXCEPTION 'Declaration must be in submitted or under_review state.' USING ERRCODE = '55000';
    END IF;

    SELECT * INTO v_qp FROM public.qualification_packs WHERE id = p_qp_id AND is_active = TRUE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Active Qualification Pack not found' USING ERRCODE = 'P0002';
    END IF;

    IF p_decision = 'overridden' AND (p_justification IS NULL OR length(trim(p_justification)) < 10) THEN
        RAISE EXCEPTION 'Mandatory Justification: Match override requires justification text (min 10 chars).' USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.qp_matches (
        declaration_id, qp_id, heuristic_similarity_score, is_heuristic,
        matched_competencies, missing_competencies, alternative_matches,
        match_rationale, reviewer_status, reviewed_by, reviewer_justification, reviewed_at
    ) VALUES (
        p_declaration_id, p_qp_id, 100.0, FALSE,
        '[]'::jsonb, '[]'::jsonb, '[]'::jsonb,
        'Reviewer confirmed mapping', p_decision, v_caller.id, p_justification, NOW()
    );

    UPDATE public.worker_declarations SET status = 'mapped', updated_at = NOW() WHERE id = p_declaration_id;

    PERFORM public.append_audit_log_entry(
        'worker_declarations', p_declaration_id, 'CONFIRM_QP_MATCH',
        jsonb_build_object('status', v_dec.status),
        jsonb_build_object('status', 'mapped', 'qp_id', p_qp_id, 'decision', p_decision),
        NOW(), NULL, NULL
    );

    RETURN jsonb_build_object('status', 'success', 'declaration_id', p_declaration_id, 'new_status', 'mapped');
END;
$$ LANGUAGE plpgsql;

REVOKE EXECUTE ON FUNCTION public.confirm_qp_match FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_qp_match TO authenticated;

-- 4. Assessment Assignment RPC (Completing the Assignment Workflow)
CREATE OR REPLACE FUNCTION public.assign_assessment(
    p_declaration_id UUID,
    p_qp_id UUID,
    p_rubric_config_id UUID,
    p_assessor_id UUID,
    p_scheduled_date DATE,
    p_location TEXT,
    p_client_sync_id UUID
) RETURNS JSONB
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller RECORD;
    v_dec RECORD;
    v_rubric RECORD;
    v_assessor RECORD;
    v_new_assessment_id UUID;
    v_idemp_res JSONB;
    v_result JSONB;
BEGIN
    v_caller := public.get_authenticated_active_profile();
    IF v_caller.role NOT IN ('reviewer', 'admin') THEN
        RAISE EXCEPTION 'Unauthorized: Only reviewers or admins can assign assessments.' USING ERRCODE = '42501';
    END IF;

    -- Idempotency Check
    v_idemp_res := public.reserve_idempotency_key(
        p_client_sync_id, 'ASSIGN_ASSESSMENT', 
        encode(digest(p_declaration_id::text || '|' || p_assessor_id::text || '|' || p_scheduled_date::text, 'sha256'), 'hex')
    );
    IF (v_idemp_res->>'action') = 'replay' THEN
        RETURN v_idemp_res->'response_body';
    END IF;

    SELECT * INTO v_dec FROM public.worker_declarations WHERE id = p_declaration_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Declaration not found: %', p_declaration_id USING ERRCODE = 'P0002';
    END IF;

    IF v_dec.status != 'mapped' THEN
        RAISE EXCEPTION 'Declaration must be mapped before assigning assessment. Current: %', v_dec.status USING ERRCODE = '55000';
    END IF;

    SELECT * INTO v_assessor FROM public.profiles 
    WHERE id = p_assessor_id AND role = 'assessor' AND is_active = TRUE;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid Assessor: Assessor profile is inactive or non-existent.' USING ERRCODE = '22023';
    END IF;

    -- Verify Rubric belongs to QP and lock it
    SELECT * INTO v_rubric FROM public.rubric_configurations 
    WHERE id = p_rubric_config_id AND qp_id = p_qp_id FOR UPDATE;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Rubric configuration % does not belong to Qualification Pack %', p_rubric_config_id, p_qp_id USING ERRCODE = '23503';
    END IF;

    UPDATE public.rubric_configurations SET is_locked = TRUE WHERE id = p_rubric_config_id;

    INSERT INTO public.assessments (
        declaration_id, qp_id, qp_version, rubric_config_id, rubric_version,
        assessor_id, client_sync_id, status, scheduled_date, assessment_location
    ) VALUES (
        p_declaration_id, p_qp_id, v_rubric.qp_version, p_rubric_config_id, v_rubric.version,
        p_assessor_id, p_client_sync_id, 'assigned', p_scheduled_date, p_location
    ) RETURNING id INTO v_new_assessment_id;

    UPDATE public.worker_declarations SET status = 'assessment_scheduled', updated_at = NOW() WHERE id = p_declaration_id;

    PERFORM public.append_audit_log_entry(
        'assessments', v_new_assessment_id, 'ASSIGN_ASSESSMENT',
        NULL,
        jsonb_build_object('declaration_id', p_declaration_id, 'assessor_id', p_assessor_id, 'qp_id', p_qp_id),
        NOW(), NULL, NULL
    );

    v_result := jsonb_build_object(
        'status', 'success',
        'assessment_id', v_new_assessment_id,
        'declaration_id', p_declaration_id,
        'assessor_id', p_assessor_id,
        'new_status', 'assigned'
    );
    PERFORM public.finalize_idempotency_record(p_client_sync_id, 200, v_result);
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

REVOKE EXECUTE ON FUNCTION public.assign_assessment FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_assessment TO authenticated;

-- 5. Verify Qualification Pack RPC (Admin-Only Provenance Promotion)
CREATE OR REPLACE FUNCTION public.verify_qualification_pack(
    p_qp_id UUID,
    p_source_reference TEXT,
    p_source_url TEXT,
    p_document_checksum TEXT
) RETURNS JSONB
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller RECORD;
    v_qp RECORD;
BEGIN
    v_caller := public.get_authenticated_active_profile();
    IF v_caller.role != 'admin' THEN
        RAISE EXCEPTION 'Unauthorized: Only system administrators can verify qualification packs.' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_qp FROM public.qualification_packs WHERE id = p_qp_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Qualification Pack not found: %', p_qp_id USING ERRCODE = 'P0002';
    END IF;

    IF p_source_reference IS NULL OR p_document_checksum IS NULL THEN
        RAISE EXCEPTION 'Validation Failed: Source gazette reference and document checksum required.' USING ERRCODE = '22023';
    END IF;

    UPDATE public.qualification_packs 
    SET verification_status = 'verified',
        provenance = 'verified_official',
        source_reference = p_source_reference,
        source_url = p_source_url,
        source_document_checksum = p_document_checksum,
        verified_by = v_caller.id,
        verified_at = NOW()
    WHERE id = p_qp_id;

    PERFORM public.append_audit_log_entry(
        'qualification_packs', p_qp_id, 'VERIFY_QUALIFICATION_PACK',
        jsonb_build_object('status', v_qp.verification_status, 'provenance', v_qp.provenance),
        jsonb_build_object('status', 'verified', 'provenance', 'verified_official', 'source_reference', p_source_reference),
        NOW(), NULL, NULL
    );

    RETURN jsonb_build_object('status', 'success', 'qp_id', p_qp_id, 'provenance', 'verified_official');
END;
$$ LANGUAGE plpgsql;

REVOKE EXECUTE ON FUNCTION public.verify_qualification_pack FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_qualification_pack TO authenticated;

-- 6. Cancel Assessment RPC
CREATE OR REPLACE FUNCTION public.cancel_assessment(
    p_assessment_id UUID,
    p_cancellation_reason TEXT
) RETURNS JSONB
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller RECORD;
    v_assessment RECORD;
BEGIN
    v_caller := public.get_authenticated_active_profile();
    IF v_caller.role NOT IN ('reviewer', 'admin') THEN
        RAISE EXCEPTION 'Unauthorized: Only reviewers or admins can cancel assessments.' USING ERRCODE = '42501';
    END IF;

    IF p_cancellation_reason IS NULL OR length(trim(p_cancellation_reason)) < 10 THEN
        RAISE EXCEPTION 'Validation Failed: Explicit cancellation reason (min 10 chars) required.' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_assessment FROM public.assessments WHERE id = p_assessment_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Assessment not found: %', p_assessment_id USING ERRCODE = 'P0002';
    END IF;

    IF v_assessment.status IN ('finalized', 'cancelled') THEN
        RAISE EXCEPTION 'Cannot cancel assessment in status: %', v_assessment.status USING ERRCODE = '55000';
    END IF;

    UPDATE public.assessments SET status = 'cancelled', updated_at = NOW() WHERE id = p_assessment_id;

    PERFORM public.append_audit_log_entry(
        'assessments', p_assessment_id, 'CANCEL_ASSESSMENT',
        jsonb_build_object('status', v_assessment.status),
        jsonb_build_object('status', 'cancelled', 'reason', p_cancellation_reason),
        NOW(), NULL, NULL
    );

    RETURN jsonb_build_object('status', 'success', 'assessment_id', p_assessment_id, 'new_status', 'cancelled');
END;
$$ LANGUAGE plpgsql;

REVOKE EXECUTE ON FUNCTION public.cancel_assessment FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_assessment TO authenticated;

-- 7. Atomic Conflict Resolution RPC
CREATE OR REPLACE FUNCTION public.resolve_assessment_conflict(
    p_conflict_id UUID,
    p_chosen_payload JSONB,
    p_resolution_notes TEXT
) RETURNS JSONB
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller RECORD;
    v_conflict RECORD;
    v_assessment RECORD;
    v_rubric RECORD;
    v_item JSONB;
    v_pc RECORD;
    v_scale_multiplier NUMERIC;
    v_derived_points NUMERIC;
    v_new_version INTEGER;
    v_pc_ids UUID[] := '{}';
    v_cur_pc_id UUID;
BEGIN
    v_caller := public.get_authenticated_active_profile();
    
    -- 1. Lock conflict row
    SELECT * INTO v_conflict FROM public.assessment_conflicts WHERE id = p_conflict_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Conflict record not found: %', p_conflict_id USING ERRCODE = 'P0002';
    END IF;

    IF v_conflict.status != 'unresolved' THEN
        RAISE EXCEPTION 'Conflict already resolved or dismissed.' USING ERRCODE = '55000';
    END IF;

    -- 2. Lock assessment row
    SELECT * INTO v_assessment FROM public.assessments WHERE id = v_conflict.assessment_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Assessment not found: %', v_conflict.assessment_id USING ERRCODE = 'P0002';
    END IF;

    -- 3. Verify Authorization
    IF v_conflict.assessor_id != v_caller.id AND v_caller.role NOT IN ('reviewer', 'admin') THEN
        RAISE EXCEPTION 'Unauthorized: Caller cannot resolve this conflict.' USING ERRCODE = '42501';
    END IF;

    IF v_assessment.status != 'conflict_detected' THEN
        RAISE EXCEPTION 'Assessment must be in conflict_detected state. Current: %', v_assessment.status USING ERRCODE = '55000';
    END IF;

    -- Check for duplicate criterion in chosen payload
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_chosen_payload) LOOP
        v_cur_pc_id := (v_item->>'pc_id')::UUID;
        IF v_cur_pc_id = ANY(v_pc_ids) THEN
            RAISE EXCEPTION 'Malformed Payload: Duplicate criterion % in resolution batch.', v_cur_pc_id USING ERRCODE = '22023';
        END IF;
        v_pc_ids := array_append(v_pc_ids, v_cur_pc_id);
    END LOOP;

    SELECT * INTO v_rubric FROM public.rubric_configurations WHERE id = v_assessment.rubric_config_id;

    -- 4. Apply Chosen Payload Transactionally
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_chosen_payload) LOOP
        SELECT * INTO v_pc FROM public.performance_criteria 
        WHERE id = (v_item->>'pc_id')::UUID AND qp_id = v_assessment.qp_id;
        
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Integrity Error: Criterion % does not belong to Qualification Pack %', 
                v_item->>'pc_id', v_assessment.qp_id USING ERRCODE = '23503';
        END IF;

        SELECT (elem->>'scoreMultiplier')::NUMERIC INTO v_scale_multiplier
        FROM jsonb_array_elements(v_rubric.scoring_scale) elem
        WHERE (elem->>'level')::INTEGER = (v_item->>'score_level')::INTEGER;
        
        IF v_scale_multiplier IS NULL THEN
            RAISE EXCEPTION 'Invalid score level % for rubric %', v_item->>'score_level', v_rubric.id USING ERRCODE = '22023';
        END IF;
        
        v_derived_points := ROUND(v_scale_multiplier * v_pc.max_score, 2);
        
        INSERT INTO public.assessment_scores (
            assessment_id, qp_id, pc_id, score_level, points_derived, max_points,
            observable_notes, is_exception, exception_reason, scored_at
        ) VALUES (
            v_assessment.id, v_assessment.qp_id, v_pc.id, (v_item->>'score_level')::INTEGER,
            v_derived_points, v_pc.max_score, v_item->>'observable_notes',
            COALESCE((v_item->>'is_exception')::BOOLEAN, FALSE), v_item->>'exception_reason', NOW()
        )
        ON CONFLICT (assessment_id, pc_id) DO UPDATE SET
            score_level = EXCLUDED.score_level,
            points_derived = EXCLUDED.points_derived,
            max_points = EXCLUDED.max_points,
            observable_notes = EXCLUDED.observable_notes,
            is_exception = EXCLUDED.is_exception,
            exception_reason = EXCLUDED.exception_reason,
            scored_at = NOW();
    END LOOP;

    -- 5. Advance version and resolve atomically
    v_new_version := v_assessment.version + 1;
    UPDATE public.assessments 
    SET version = v_new_version, status = 'in_progress', updated_at = NOW() 
    WHERE id = v_assessment.id;

    UPDATE public.assessment_conflicts 
    SET status = 'resolved', resolved_by = v_caller.id, resolution_notes = p_resolution_notes, resolved_at = NOW() 
    WHERE id = p_conflict_id;

    PERFORM public.append_audit_log_entry(
        'assessment_conflicts', p_conflict_id, 'RESOLVE_CONFLICT',
        jsonb_build_object('status', 'unresolved'),
        jsonb_build_object('status', 'resolved', 'notes', p_resolution_notes, 'new_version', v_new_version),
        NOW(), NULL, NULL
    );

    RETURN jsonb_build_object(
        'status', 'success',
        'conflict_id', p_conflict_id,
        'assessment_id', v_assessment.id,
        'new_version', v_new_version
    );
END;
$$ LANGUAGE plpgsql;

REVOKE EXECUTE ON FUNCTION public.resolve_assessment_conflict FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_assessment_conflict TO authenticated;
