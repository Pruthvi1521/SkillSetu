-- Migration: 00005_rls_policies.sql
-- Description: Concrete Row-Level Security policies and explicit table privilege grants.

-- Enable RLS across all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE idempotency_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE qualification_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE rubric_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE national_occupational_standards ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_declarations ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_declaration_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE qp_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_conflicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE competency_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_trail ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_checkpoints ENABLE ROW LEVEL SECURITY;

-- Explicit Table-Level Privilege Grants
GRANT SELECT ON profiles TO authenticated;
GRANT UPDATE (full_name, phone_masked) ON profiles TO authenticated; -- Column-level grant prevents role escalation

GRANT SELECT ON qualification_packs, rubric_configurations, national_occupational_standards, performance_criteria TO authenticated;

-- Declarations: Workers can insert and update non-workflow fields only
GRANT SELECT, INSERT ON worker_declarations TO authenticated;
GRANT UPDATE (primary_trade, total_experience_months, work_history, tasks_performed, tools_mastered) ON worker_declarations TO authenticated;

-- Worker Evidence: Select, Insert, Delete granted explicitly
GRANT SELECT, INSERT, DELETE ON worker_declaration_evidence TO authenticated;

GRANT SELECT ON qp_matches TO authenticated;
GRANT SELECT ON assessments TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON assessments FROM authenticated; -- Direct writes revoked; managed via RPCs

GRANT SELECT ON assessment_scores TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON assessment_scores FROM authenticated; -- Direct writes revoked; managed via RPCs

GRANT SELECT, INSERT ON assessment_evidence TO authenticated;

GRANT SELECT ON assessment_conflicts TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON assessment_conflicts FROM authenticated; -- Direct writes revoked; managed via RPCs

GRANT SELECT ON competency_reports TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON competency_reports FROM authenticated; -- Direct writes revoked; managed via RPCs

GRANT SELECT ON audit_trail TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON audit_trail FROM authenticated;

GRANT SELECT ON audit_checkpoints TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON audit_checkpoints FROM authenticated;

GRANT SELECT ON idempotency_records TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON idempotency_records FROM authenticated;

-- Helper role resolver
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS user_role 
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid() AND is_active = TRUE;
$$ LANGUAGE sql STABLE;

REVOKE EXECUTE ON FUNCTION public.current_user_role FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_role TO authenticated, service_role;

-- 1. Profiles Policies
DROP POLICY IF EXISTS "profiles_select_policy" ON profiles;
CREATE POLICY "profiles_select_policy" ON profiles FOR SELECT TO authenticated
    USING (id = auth.uid() OR current_user_role() IN ('reviewer', 'admin'));

DROP POLICY IF EXISTS "profiles_update_policy" ON profiles;
CREATE POLICY "profiles_update_policy" ON profiles FOR UPDATE TO authenticated
    USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- 2. Master Catalog Policies
DROP POLICY IF EXISTS "qp_select_policy" ON qualification_packs;
CREATE POLICY "qp_select_policy" ON qualification_packs FOR SELECT TO authenticated
    USING (is_active = TRUE OR current_user_role() = 'admin');

DROP POLICY IF EXISTS "rubric_select_policy" ON rubric_configurations;
CREATE POLICY "rubric_select_policy" ON rubric_configurations FOR SELECT TO authenticated
    USING (TRUE);

DROP POLICY IF EXISTS "nos_select_policy" ON national_occupational_standards;
CREATE POLICY "nos_select_policy" ON national_occupational_standards FOR SELECT TO authenticated
    USING (TRUE);

DROP POLICY IF EXISTS "pc_select_policy" ON performance_criteria;
CREATE POLICY "pc_select_policy" ON performance_criteria FOR SELECT TO authenticated
    USING (TRUE);

-- 3. Worker Declarations & Evidence Policies (Assessor Access Scoped to Assigned Assessment)
DROP POLICY IF EXISTS "dec_select_policy" ON worker_declarations;
CREATE POLICY "dec_select_policy" ON worker_declarations FOR SELECT TO authenticated
    USING (
        worker_id = auth.uid() OR 
        current_user_role() IN ('reviewer', 'admin') OR
        (current_user_role() = 'assessor' AND EXISTS (
            SELECT 1 FROM assessments a 
            WHERE a.declaration_id = worker_declarations.id 
            AND a.assessor_id = auth.uid()
        ))
    );

DROP POLICY IF EXISTS "dec_insert_policy" ON worker_declarations;
CREATE POLICY "dec_insert_policy" ON worker_declarations FOR INSERT TO authenticated
    WITH CHECK (worker_id = auth.uid() AND status = 'draft');

DROP POLICY IF EXISTS "dec_update_policy" ON worker_declarations;
CREATE POLICY "dec_update_policy" ON worker_declarations FOR UPDATE TO authenticated
    USING (worker_id = auth.uid() AND status = 'draft')
    WITH CHECK (worker_id = auth.uid() AND status = 'draft');

DROP POLICY IF EXISTS "w_ev_select_policy" ON worker_declaration_evidence;
CREATE POLICY "w_ev_select_policy" ON worker_declaration_evidence FOR SELECT TO authenticated
    USING (
        worker_id = auth.uid() OR 
        current_user_role() IN ('reviewer', 'admin') OR
        (current_user_role() = 'assessor' AND EXISTS (
            SELECT 1 FROM assessments a 
            WHERE a.declaration_id = worker_declaration_evidence.declaration_id 
            AND a.assessor_id = auth.uid()
        ))
    );

DROP POLICY IF EXISTS "w_ev_insert_policy" ON worker_declaration_evidence;
CREATE POLICY "w_ev_insert_policy" ON worker_declaration_evidence FOR INSERT TO authenticated
    WITH CHECK (
        worker_id = auth.uid() AND 
        EXISTS (
            SELECT 1 FROM worker_declarations d 
            WHERE d.id = declaration_id AND d.worker_id = auth.uid() AND d.status = 'draft'
        )
    );

DROP POLICY IF EXISTS "w_ev_delete_policy" ON worker_declaration_evidence;
CREATE POLICY "w_ev_delete_policy" ON worker_declaration_evidence FOR DELETE TO authenticated
    USING (
        worker_id = auth.uid() AND 
        EXISTS (
            SELECT 1 FROM worker_declarations d 
            WHERE d.id = declaration_id AND d.worker_id = auth.uid() AND d.status = 'draft'
        )
    );

-- 4. QP Matches Policies
DROP POLICY IF EXISTS "qp_matches_select_policy" ON qp_matches;
CREATE POLICY "qp_matches_select_policy" ON qp_matches FOR SELECT TO authenticated
    USING (
        EXISTS (SELECT 1 FROM worker_declarations d WHERE d.id = qp_matches.declaration_id AND d.worker_id = auth.uid()) OR
        current_user_role() IN ('reviewer', 'admin')
    );

-- 5. Assessments & Evidence Policies
DROP POLICY IF EXISTS "assess_select_policy" ON assessments;
CREATE POLICY "assess_select_policy" ON assessments FOR SELECT TO authenticated
    USING (
        assessor_id = auth.uid() OR 
        current_user_role() IN ('reviewer', 'admin') OR
        EXISTS (SELECT 1 FROM worker_declarations d WHERE d.id = assessments.declaration_id AND d.worker_id = auth.uid())
    );

DROP POLICY IF EXISTS "scores_select_policy" ON assessment_scores;
CREATE POLICY "scores_select_policy" ON assessment_scores FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM assessments a 
            WHERE a.id = assessment_scores.assessment_id AND (
                a.assessor_id = auth.uid() OR 
                current_user_role() IN ('reviewer', 'admin') OR
                EXISTS (SELECT 1 FROM worker_declarations d WHERE d.id = a.declaration_id AND d.worker_id = auth.uid())
            )
        )
    );

DROP POLICY IF EXISTS "a_ev_select_policy" ON assessment_evidence;
CREATE POLICY "a_ev_select_policy" ON assessment_evidence FOR SELECT TO authenticated
    USING (
        assessor_id = auth.uid() OR 
        current_user_role() IN ('reviewer', 'admin') OR
        EXISTS (
            SELECT 1 FROM assessments a 
            JOIN worker_declarations d ON a.declaration_id = d.id 
            WHERE a.id = assessment_evidence.assessment_id AND d.worker_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "a_ev_insert_policy" ON assessment_evidence;
CREATE POLICY "a_ev_insert_policy" ON assessment_evidence FOR INSERT TO authenticated
    WITH CHECK (
        assessor_id = auth.uid() AND 
        EXISTS (
            SELECT 1 FROM assessments a 
            WHERE a.id = assessment_id AND a.assessor_id = auth.uid() AND a.status IN ('assigned', 'in_progress')
        )
    );

-- 6. Conflicts Policies
DROP POLICY IF EXISTS "conflicts_select_policy" ON assessment_conflicts;
CREATE POLICY "conflicts_select_policy" ON assessment_conflicts FOR SELECT TO authenticated
    USING (assessor_id = auth.uid() OR current_user_role() IN ('reviewer', 'admin'));

-- 7. Competency Reports Policies (Scoped to Worker and Authorized Assessment Participants)
DROP POLICY IF EXISTS "reports_select_policy" ON competency_reports;
CREATE POLICY "reports_select_policy" ON competency_reports FOR SELECT TO authenticated
    USING (
        worker_id = auth.uid() OR 
        signed_off_by = auth.uid() OR 
        current_user_role() = 'admin' OR 
        EXISTS (
            SELECT 1 FROM assessments a 
            WHERE a.id = competency_reports.assessment_id 
            AND a.assessor_id = auth.uid()
        )
    );

-- 8. Audit Trail Policies
DROP POLICY IF EXISTS "audit_select_policy" ON audit_trail;
CREATE POLICY "audit_select_policy" ON audit_trail FOR SELECT TO authenticated
    USING (current_user_role() = 'admin');

DROP POLICY IF EXISTS "checkpoints_select_policy" ON audit_checkpoints;
CREATE POLICY "checkpoints_select_policy" ON audit_checkpoints FOR SELECT TO authenticated
    USING (current_user_role() = 'admin');

-- 9. Idempotency Records Policy
DROP POLICY IF EXISTS "idemp_select_policy" ON idempotency_records;
CREATE POLICY "idemp_select_policy" ON idempotency_records FOR SELECT TO authenticated
    USING (actor_id = auth.uid());
