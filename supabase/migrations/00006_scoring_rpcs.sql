-- Migration: 00006_scoring_rpcs.sql
-- Description: Server-authoritative scoring engine, admin override, assessment submission, reviewer sign-off, and report verification.

-- 1. Helper function: Compute authoritative scores and thresholds
CREATE OR REPLACE FUNCTION public.calculate_authoritative_assessment_results(
    p_assessment_id UUID,
    p_qp_id UUID,
    p_rubric_config_id UUID
) RETURNS JSONB
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_rubric RECORD;
    v_nos RECORD;
    v_pc RECORD;
    v_nos_earned NUMERIC;
    v_nos_possible NUMERIC;
    v_nos_score NUMERIC;
    v_overall_score NUMERIC := 0.0;
    v_nos_scores JSONB := '[]'::jsonb;
    v_demonstrated_nos JSONB := '[]'::jsonb;
    v_competency_gaps JSONB := '[]'::jsonb;
    v_passed_overall BOOLEAN := TRUE;
    v_critical_failures INTEGER := 0;
    v_mandatory_nos_failures INTEGER := 0;
BEGIN
    SELECT * INTO v_rubric FROM public.rubric_configurations WHERE id = p_rubric_config_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Rubric configuration % not found', p_rubric_config_id USING ERRCODE = 'P0002';
    END IF;

    -- Evaluate each NOS
    FOR v_nos IN SELECT * FROM public.national_occupational_standards WHERE qp_id = p_qp_id ORDER BY nos_code LOOP
        v_nos_earned := 0.0;
        v_nos_possible := 0.0;
        
        FOR v_pc IN SELECT pc.*, COALESCE(s.points_derived, 0.0) as earned, COALESCE(s.score_level, 0) as level
                    FROM public.performance_criteria pc
                    LEFT JOIN public.assessment_scores s ON pc.id = s.pc_id AND s.assessment_id = p_assessment_id
                    WHERE pc.nos_id = v_nos.id ORDER BY pc.pc_code LOOP
                    
            v_nos_earned := v_nos_earned + v_pc.earned;
            v_nos_possible := v_nos_possible + v_pc.max_score;

            -- Check critical safety criterion failure (Level < 1 vetoes pass)
            IF v_pc.is_critical IS TRUE AND v_pc.level < 1 THEN
                v_critical_failures := v_critical_failures + 1;
            END IF;

            -- Itemize competency gap if score level < 2
            IF v_pc.level < 2 THEN
                v_competency_gaps := v_competency_gaps || jsonb_build_object(
                    'nos_code', v_nos.nos_code,
                    'pc_code', v_pc.pc_code,
                    'description', v_pc.description,
                    'score_level', v_pc.level
                );
            END IF;
        END LOOP;

        IF v_nos_possible > 0 THEN
            v_nos_score := ROUND((v_nos_earned / v_nos_possible) * 100.0, 2);
        ELSE
            v_nos_score := 0.0;
        END IF;

        -- Check mandatory NOS pass threshold
        IF v_nos.is_mandatory IS TRUE AND v_nos_score < v_rubric.nos_pass_threshold_percent THEN
            v_mandatory_nos_failures := v_mandatory_nos_failures + 1;
        END IF;

        IF v_nos_score >= v_rubric.nos_pass_threshold_percent THEN
            v_demonstrated_nos := v_demonstrated_nos || to_jsonb(v_nos.nos_code);
        END IF;

        v_overall_score := v_overall_score + ROUND((v_nos_score * (v_nos.weightage_percent / 100.0)), 2);

        v_nos_scores := v_nos_scores || jsonb_build_object(
            'nos_code', v_nos.nos_code,
            'title', v_nos.title,
            'score_percent', v_nos_score,
            'weightage_percent', v_nos.weightage_percent,
            'is_mandatory', v_nos.is_mandatory,
            'passed', (v_nos_score >= v_rubric.nos_pass_threshold_percent)
        );
    END LOOP;

    v_overall_score := ROUND(v_overall_score, 2);

    IF v_overall_score < v_rubric.overall_pass_threshold_percent OR 
       v_critical_failures > 0 OR 
       v_mandatory_nos_failures > 0 THEN
        v_passed_overall := FALSE;
    END IF;

    RETURN jsonb_build_object(
        'overall_score_percent', v_overall_score,
        'passed_overall', v_passed_overall,
        'critical_failures_count', v_critical_failures,
        'mandatory_nos_failures_count', v_mandatory_nos_failures,
        'nos_scores', v_nos_scores,
        'demonstrated_nos', v_demonstrated_nos,
        'competency_gaps', v_competency_gaps
    );
END;
$$ LANGUAGE plpgsql;

REVOKE EXECUTE ON FUNCTION public.calculate_authoritative_assessment_results FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calculate_authoritative_assessment_results TO authenticated, service_role;

-- 2. Ordinary Assessor Scoring RPC (Strictly Assessor-Only, OCC Guarded, Zero Admin Bypass)
CREATE OR REPLACE FUNCTION public.commit_assessment_scores(
    p_assessment_id UUID,
    p_scores JSONB, -- Array of { pc_id: UUID, score_level: INT, observable_notes: TEXT, is_exception: BOOL, exception_reason: TEXT }
    p_client_sync_id UUID,
    p_client_version INTEGER
) RETURNS JSONB
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller RECORD;
    v_assessment RECORD;
    v_rubric RECORD;
    v_item JSONB;
    v_pc RECORD;
    v_scale_multiplier NUMERIC;
    v_derived_points NUMERIC;
    v_new_version INTEGER;
    v_pc_ids UUID[] := '{}';
    v_cur_pc_id UUID;
    v_payload_hash TEXT;
    v_idemp_res JSONB;
    v_result JSONB;
BEGIN
    v_caller := public.get_authenticated_active_profile();

    -- Idempotency Reservation: Scoped to actor, operation, assessment, and payload
    v_payload_hash := encode(digest(p_scores::text || '|' || p_client_version::text, 'sha256'), 'hex');
    v_idemp_res := public.reserve_idempotency_key(p_client_sync_id, 'COMMIT_SCORES', v_payload_hash, p_assessment_id);
    
    IF (v_idemp_res->>'action') = 'replay' THEN
        RETURN v_idemp_res->'response_body';
    END IF;

    IF p_scores IS NULL OR jsonb_array_length(p_scores) = 0 THEN
        RAISE EXCEPTION 'Malformed Request: Score batch cannot be empty.' USING ERRCODE = '22023';
    END IF;

    -- Duplicate Criterion Check within Batch
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_scores) LOOP
        v_cur_pc_id := (v_item->>'pc_id')::UUID;
        IF v_cur_pc_id = ANY(v_pc_ids) THEN
            RAISE EXCEPTION 'Malformed Request: Duplicate criterion % in batch.', v_cur_pc_id USING ERRCODE = '22023';
        END IF;
        v_pc_ids := array_append(v_pc_ids, v_cur_pc_id);
    END LOOP;

    -- Lock Assessment Row
    SELECT * INTO v_assessment FROM public.assessments WHERE id = p_assessment_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Assessment not found: %', p_assessment_id USING ERRCODE = 'P0002';
    END IF;

    -- Strict Assessor Ownership Enforcement (Zero Admin Bypass in ordinary scoring path)
    IF v_assessment.assessor_id != v_caller.id THEN
        RAISE EXCEPTION 'Unauthorized: Caller is not the assigned assessor.' USING ERRCODE = '42501';
    END IF;

    IF v_assessment.status NOT IN ('assigned', 'in_progress') THEN
        RAISE EXCEPTION 'Assessment cannot be scored in status: %', v_assessment.status USING ERRCODE = '55000';
    END IF;

    -- OCC Version Conflict Check
    IF v_assessment.version != p_client_version THEN
        INSERT INTO public.assessment_conflicts (
            assessment_id, client_sync_id, assessor_id, server_version, client_version,
            server_payload, client_payload
        ) VALUES (
            p_assessment_id, p_client_sync_id, v_caller.id, v_assessment.version, p_client_version,
            COALESCE((SELECT jsonb_agg(to_jsonb(s)) FROM public.assessment_scores s WHERE s.assessment_id = p_assessment_id), '[]'::jsonb),
            p_scores
        );
        
        UPDATE public.assessments SET status = 'conflict_detected', updated_at = NOW() WHERE id = p_assessment_id;
        
        PERFORM public.append_audit_log_entry(
            'assessments', p_assessment_id, 'CONFLICT_DETECTED',
            jsonb_build_object('server_version', v_assessment.version),
            jsonb_build_object('client_version', p_client_version, 'client_sync_id', p_client_sync_id),
            NOW(), NULL, NULL
        );

        v_result := jsonb_build_object(
            'status', 'conflict',
            'server_version', v_assessment.version,
            'client_version', p_client_version,
            'message', 'Version conflict detected. Preserved in conflict vault.'
        );
        PERFORM public.finalize_idempotency_record(p_client_sync_id, 409, v_result);
        RETURN v_result;
    END IF;

    SELECT * INTO v_rubric FROM public.rubric_configurations WHERE id = v_assessment.rubric_config_id;

    -- Validate Criteria and Calculate Points
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_scores) LOOP
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
            p_assessment_id, v_assessment.qp_id, v_pc.id, (v_item->>'score_level')::INTEGER,
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

    v_new_version := v_assessment.version + 1;
    UPDATE public.assessments 
    SET version = v_new_version, status = 'in_progress', updated_at = NOW() 
    WHERE id = p_assessment_id;

    PERFORM public.append_audit_log_entry(
        'assessments', p_assessment_id, 'COMMIT_SCORES',
        jsonb_build_object('version', v_assessment.version),
        jsonb_build_object('version', v_new_version, 'committed_count', jsonb_array_length(p_scores)),
        NOW(), NULL, NULL
    );

    v_result := jsonb_build_object(
        'status', 'success',
        'assessment_id', p_assessment_id,
        'new_version', v_new_version,
        'committed_count', jsonb_array_length(p_scores)
    );
    PERFORM public.finalize_idempotency_record(p_client_sync_id, 200, v_result);
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

REVOKE EXECUTE ON FUNCTION public.commit_assessment_scores FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.commit_assessment_scores TO authenticated;

-- 3. Administrative Scoring Override RPC (Explicit, Audited, Does NOT require admin to be assigned assessor)
CREATE OR REPLACE FUNCTION public.admin_override_assessment_scores(
    p_assessment_id UUID,
    p_scores JSONB,
    p_override_reason TEXT,
    p_client_sync_id UUID
) RETURNS JSONB
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller RECORD;
    v_assessment RECORD;
    v_rubric RECORD;
    v_item JSONB;
    v_pc RECORD;
    v_scale_multiplier NUMERIC;
    v_derived_points NUMERIC;
    v_new_version INTEGER;
    v_result JSONB;
BEGIN
    v_caller := public.get_authenticated_active_profile();
    IF v_caller.role != 'admin' THEN
        RAISE EXCEPTION 'Unauthorized: Only system administrators can execute administrative scoring overrides.' USING ERRCODE = '42501';
    END IF;

    IF p_override_reason IS NULL OR length(trim(p_override_reason)) < 10 THEN
        RAISE EXCEPTION 'Validation Failed: Explicit override reason (minimum 10 characters) required.' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_assessment FROM public.assessments WHERE id = p_assessment_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Assessment not found: %', p_assessment_id USING ERRCODE = 'P0002';
    END IF;

    IF v_assessment.status IN ('finalized', 'cancelled') THEN
        RAISE EXCEPTION 'Cannot override assessment in status: %', v_assessment.status USING ERRCODE = '55000';
    END IF;

    SELECT * INTO v_rubric FROM public.rubric_configurations WHERE id = v_assessment.rubric_config_id;

    -- Apply criteria scores directly without assessor ownership check
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_scores) LOOP
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
            p_assessment_id, v_assessment.qp_id, v_pc.id, (v_item->>'score_level')::INTEGER,
            v_derived_points, v_pc.max_score, v_item->>'observable_notes',
            TRUE, 'ADMIN_OVERRIDE: ' || p_override_reason, NOW()
        )
        ON CONFLICT (assessment_id, pc_id) DO UPDATE SET
            score_level = EXCLUDED.score_level,
            points_derived = EXCLUDED.points_derived,
            max_points = EXCLUDED.max_points,
            observable_notes = EXCLUDED.observable_notes,
            is_exception = TRUE,
            exception_reason = EXCLUDED.exception_reason,
            scored_at = NOW();
    END LOOP;

    v_new_version := v_assessment.version + 1;
    UPDATE public.assessments 
    SET version = v_new_version, status = 'in_progress', updated_at = NOW() 
    WHERE id = p_assessment_id;

    PERFORM public.append_audit_log_entry(
        'assessments', p_assessment_id, 'ADMIN_SCORING_OVERRIDE',
        jsonb_build_object('version', v_assessment.version, 'assessor_id', v_assessment.assessor_id),
        jsonb_build_object('version', v_new_version, 'override_reason', p_override_reason, 'override_by', v_caller.id),
        NOW(), NULL, NULL
    );

    v_result := jsonb_build_object(
        'status', 'success',
        'assessment_id', p_assessment_id,
        'new_version', v_new_version,
        'override_by', v_caller.id
    );
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

REVOKE EXECUTE ON FUNCTION public.admin_override_assessment_scores FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_override_assessment_scores TO authenticated;

-- 4. Assessment Submission RPC (Completeness & OCC Version Check Enforced)
CREATE OR REPLACE FUNCTION public.submit_assessment(
    p_assessment_id UUID,
    p_client_sync_id UUID,
    p_client_version INTEGER
) RETURNS JSONB
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller RECORD;
    v_assessment RECORD;
    v_total_criteria INTEGER;
    v_scored_criteria INTEGER;
    v_new_version INTEGER;
    v_result JSONB;
BEGIN
    v_caller := public.get_authenticated_active_profile();

    SELECT * INTO v_assessment FROM public.assessments WHERE id = p_assessment_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Assessment not found: %', p_assessment_id USING ERRCODE = 'P0002';
    END IF;

    IF v_assessment.assessor_id != v_caller.id THEN
        RAISE EXCEPTION 'Unauthorized: Caller is not the assigned assessor.' USING ERRCODE = '42501';
    END IF;

    -- Strict OCC Version Check
    IF v_assessment.version != p_client_version THEN
        RAISE EXCEPTION 'Conflict: Stale assessment version. Current server version: %, Expected: %', 
            v_assessment.version, p_client_version USING ERRCODE = '40900';
    END IF;

    IF v_assessment.status != 'in_progress' THEN
        RAISE EXCEPTION 'Assessment cannot be submitted from status: %', v_assessment.status USING ERRCODE = '55000';
    END IF;

    -- Completeness Validation: 100% of Pinned Criteria Scored
    SELECT COUNT(*) INTO v_total_criteria FROM public.performance_criteria WHERE qp_id = v_assessment.qp_id;
    SELECT COUNT(*) INTO v_scored_criteria FROM public.assessment_scores WHERE assessment_id = p_assessment_id;

    IF v_scored_criteria < v_total_criteria THEN
        RAISE EXCEPTION 'Precondition Failed: Incomplete evaluation. Scored % of % criteria.',
            v_scored_criteria, v_total_criteria USING ERRCODE = '55000';
    END IF;

    v_new_version := v_assessment.version + 1;
    UPDATE public.assessments 
    SET status = 'submitted', version = v_new_version, completed_at = NOW(), updated_at = NOW() 
    WHERE id = p_assessment_id;

    PERFORM public.append_audit_log_entry(
        'assessments', p_assessment_id, 'SUBMIT_ASSESSMENT',
        jsonb_build_object('status', 'in_progress', 'version', v_assessment.version),
        jsonb_build_object('status', 'submitted', 'version', v_new_version),
        NOW(), NULL, NULL
    );

    v_result := jsonb_build_object('status', 'success', 'assessment_id', p_assessment_id, 'new_status', 'submitted', 'version', v_new_version);
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

REVOKE EXECUTE ON FUNCTION public.submit_assessment FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_assessment TO authenticated;

-- 5. Reviewer Sign-Off RPC (Decision Compatibility Matrix & Canonical Hashing)
CREATE OR REPLACE FUNCTION public.execute_reviewer_signoff(
    p_assessment_id UUID,
    p_final_decision final_signoff_decision,
    p_assessor_summary_notes TEXT,
    p_signoff_statement TEXT,
    p_client_sync_id UUID
) RETURNS JSONB
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller RECORD;
    v_assessment RECORD;
    v_rubric RECORD;
    v_calc JSONB;
    v_canonical_report JSONB;
    v_report_hash TEXT;
    v_report_id UUID;
    v_idemp_res JSONB;
    v_result JSONB;
BEGIN
    v_caller := public.get_authenticated_active_profile();
    IF v_caller.role NOT IN ('reviewer', 'admin') THEN
        RAISE EXCEPTION 'Unauthorized: Only reviewers or administrators can execute final sign-off.' USING ERRCODE = '42501';
    END IF;

    -- Idempotency Check
    v_idemp_res := public.reserve_idempotency_key(
        p_client_sync_id, 'SIGNOFF', 
        encode(digest(p_assessment_id::text || '|' || p_final_decision::text, 'sha256'), 'hex'),
        p_assessment_id
    );
    IF (v_idemp_res->>'action') = 'replay' THEN
        RETURN v_idemp_res->'response_body';
    END IF;

    SELECT * INTO v_assessment FROM public.assessments WHERE id = p_assessment_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Assessment not found: %', p_assessment_id USING ERRCODE = 'P0002';
    END IF;

    IF v_assessment.status != 'submitted' THEN
        RAISE EXCEPTION 'Assessment must be in submitted state for sign-off. Current: %', v_assessment.status USING ERRCODE = '55000';
    END IF;

    SELECT * INTO v_rubric FROM public.rubric_configurations WHERE id = v_assessment.rubric_config_id;

    -- Authoritative Calculation
    v_calc := public.calculate_authoritative_assessment_results(p_assessment_id, v_assessment.qp_id, v_assessment.rubric_config_id);

    -- Decision Compatibility Matrix Enforcement
    IF p_final_decision = 'recommended_full' AND (v_calc->>'passed_overall')::BOOLEAN IS FALSE THEN
        RAISE EXCEPTION 'Decision Incompatibility: Cannot recommend full certification when candidate failed criteria or thresholds.' USING ERRCODE = '22023';
    END IF;

    -- Construct Canonical Report Payload
    v_canonical_report := jsonb_build_object(
        'aggregate_score_percent', v_calc->'overall_score_percent',
        'assessment_id', p_assessment_id,
        'competency_gaps', v_calc->'competency_gaps',
        'declaration_id', v_assessment.declaration_id,
        'demonstrated_nos', v_calc->'demonstrated_nos',
        'disclaimer', 'This diagnostic dossier does not constitute official qualification issuance.',
        'final_decision', p_final_decision,
        'nos_scores', v_calc->'nos_scores',
        'overall_score_percent', v_calc->'overall_score_percent',
        'passed_overall', v_calc->'passed_overall',
        'qp_id', v_assessment.qp_id,
        'qp_version', v_assessment.qp_version,
        'recommended_bridge_training', COALESCE(v_rubric.bridge_training_mapping, '{}'::jsonb),
        'report_schema_version', '1.0',
        'rubric_config_id', v_assessment.rubric_config_id,
        'rubric_version', v_assessment.rubric_version,
        'signed_off_at', NOW(),
        'signed_off_by', v_caller.id,
        'signoff_statement', p_signoff_statement
    );

    v_report_hash := encode(digest(v_canonical_report::text, 'sha256'), 'hex');

    INSERT INTO public.competency_reports (
        assessment_id, worker_id, rubric_config_id, aggregate_score_percent,
        passed_overall, demonstrated_nos, competency_gaps, recommended_bridge_training,
        assessor_summary_notes, final_decision, report_content_hash, canonical_payload,
        signed_off_by, signed_off_at, signoff_statement
    ) VALUES (
        p_assessment_id, 
        (SELECT worker_id FROM public.worker_declarations WHERE id = v_assessment.declaration_id),
        v_assessment.rubric_config_id, (v_calc->>'overall_score_percent')::NUMERIC, (v_calc->>'passed_overall')::BOOLEAN,
        v_calc->'demonstrated_nos', v_calc->'competency_gaps',
        COALESCE(v_rubric.bridge_training_mapping, '{}'::jsonb),
        p_assessor_summary_notes, p_final_decision, v_report_hash, v_canonical_report,
        v_caller.id, NOW(), p_signoff_statement
    ) RETURNING id INTO v_report_id;

    UPDATE public.assessments 
    SET status = 'finalized', completed_at = NOW(), updated_at = NOW() 
    WHERE id = p_assessment_id;

    UPDATE public.worker_declarations 
    SET status = 'completed', updated_at = NOW() 
    WHERE id = v_assessment.declaration_id;

    PERFORM public.append_audit_log_entry(
        'assessments', p_assessment_id, 'FINALIZE_AND_SIGNOFF',
        jsonb_build_object('status', 'submitted'),
        jsonb_build_object('status', 'finalized', 'report_id', v_report_id, 'report_hash', v_report_hash),
        NOW(), NULL, NULL
    );

    v_result := jsonb_build_object(
        'status', 'success',
        'report_id', v_report_id,
        'assessment_id', p_assessment_id,
        'overall_score_percent', v_calc->'overall_score_percent',
        'passed_overall', v_calc->'passed_overall',
        'report_content_hash', v_report_hash
    );

    PERFORM public.finalize_idempotency_record(p_client_sync_id, 200, v_result);
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

REVOKE EXECUTE ON FUNCTION public.execute_reviewer_signoff FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.execute_reviewer_signoff TO authenticated;

-- 6. Report Verification Procedure
CREATE OR REPLACE FUNCTION public.verify_competency_report_integrity(
    p_report_id UUID
) RETURNS TABLE (
    is_valid BOOLEAN,
    calculated_hash TEXT,
    stored_hash TEXT,
    error_message TEXT
)
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_report RECORD;
    v_calculated TEXT;
BEGIN
    SELECT * INTO v_report FROM public.competency_reports WHERE id = p_report_id;
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, NULL::TEXT, NULL::TEXT, 'Competency report not found'::TEXT;
        RETURN;
    END IF;

    v_calculated := encode(digest(v_report.canonical_payload::text, 'sha256'), 'hex');

    IF v_calculated != v_report.report_content_hash THEN
        RETURN QUERY SELECT FALSE, v_calculated, v_report.report_content_hash, 'Tampering detected: Payload digest does not match stored hash'::TEXT;
    ELSE
        RETURN QUERY SELECT TRUE, v_calculated, v_report.report_content_hash, 'Integrity verified: Report matches exact sign-off digest'::TEXT;
    END IF;
END;
$$ LANGUAGE plpgsql;

REVOKE EXECUTE ON FUNCTION public.verify_competency_report_integrity FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_competency_report_integrity TO authenticated;
