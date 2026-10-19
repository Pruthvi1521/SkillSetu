-- Migration: 00002_core_tables.sql
-- Description: Core normalized tables with composite keys, version pinning, and integrity constraints.

-- 1. Profiles Table
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role user_role NOT NULL DEFAULT 'worker',
    full_name TEXT NOT NULL,
    phone_masked TEXT,
    organization TEXT,
    assessor_accreditation_id TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Idempotency Records Table
-- Actor-bound, operation-bound, assessment-bound, and request-payload-bound
CREATE TABLE IF NOT EXISTS idempotency_records (
    client_sync_id UUID PRIMARY KEY,
    actor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    operation TEXT NOT NULL,
    assessment_id UUID, -- Bound to target assessment when applicable
    payload_hash TEXT NOT NULL,
    status idempotency_status NOT NULL DEFAULT 'in_progress',
    response_code INTEGER,
    response_body JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_idemp_actor_op ON idempotency_records(actor_id, operation);
CREATE INDEX IF NOT EXISTS idx_idemp_assessment ON idempotency_records(assessment_id);

-- 3. Qualification Packs (Master Repository)
CREATE TABLE IF NOT EXISTS qualification_packs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    qp_code TEXT NOT NULL,
    title TEXT NOT NULL,
    sector TEXT NOT NULL,
    sub_sector TEXT,
    nsqf_level INTEGER NOT NULL CHECK (nsqf_level BETWEEN 1 AND 10),
    version TEXT NOT NULL DEFAULT '1.0',
    provenance data_provenance NOT NULL DEFAULT 'synthetic_demo',
    verification_status qp_verification_status NOT NULL DEFAULT 'draft',
    source_url TEXT,
    source_reference TEXT,
    source_document_checksum TEXT,
    verified_by UUID REFERENCES profiles(id),
    verified_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_qp_code_version UNIQUE (qp_code, version),
    CONSTRAINT unique_qp_id_version UNIQUE (id, version)
);

-- 4. Rubric Configurations (Pinned to Exact QP Version)
CREATE TABLE IF NOT EXISTS rubric_configurations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    qp_id UUID NOT NULL,
    qp_version TEXT NOT NULL DEFAULT '1.0',
    version TEXT NOT NULL DEFAULT '1.0',
    overall_pass_threshold_percent NUMERIC(5,2) NOT NULL CHECK (overall_pass_threshold_percent BETWEEN 0 AND 100),
    nos_pass_threshold_percent NUMERIC(5,2) NOT NULL CHECK (nos_pass_threshold_percent BETWEEN 0 AND 100),
    mandatory_nos_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
    critical_pc_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
    scoring_scale JSONB NOT NULL,
    aggregation_method TEXT NOT NULL DEFAULT 'weighted_average',
    bridge_training_mapping JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_locked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_rubric_qp FOREIGN KEY (qp_id, qp_version) 
        REFERENCES qualification_packs(id, version) ON DELETE RESTRICT,
    CONSTRAINT unique_rubric_qp_version UNIQUE (qp_id, version),
    CONSTRAINT unique_rubric_id_qp_version UNIQUE (id, qp_id, version)
);

-- 5. National Occupational Standards (NOS)
CREATE TABLE IF NOT EXISTS national_occupational_standards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    qp_id UUID NOT NULL,
    qp_version TEXT NOT NULL DEFAULT '1.0',
    nos_code TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    nsqf_level INTEGER NOT NULL,
    weightage_percent NUMERIC(5,2) NOT NULL CHECK (weightage_percent >= 0 AND weightage_percent <= 100),
    is_mandatory BOOLEAN NOT NULL DEFAULT TRUE,
    custom_pass_threshold NUMERIC(5,2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_nos_qp FOREIGN KEY (qp_id, qp_version) 
        REFERENCES qualification_packs(id, version) ON DELETE RESTRICT,
    CONSTRAINT unique_qp_nos UNIQUE (qp_id, nos_code),
    CONSTRAINT unique_nos_id_qp UNIQUE (id, qp_id)
);

-- 6. Performance Criteria (PC)
CREATE TABLE IF NOT EXISTS performance_criteria (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nos_id UUID NOT NULL REFERENCES national_occupational_standards(id) ON DELETE CASCADE,
    qp_id UUID NOT NULL,
    pc_code TEXT NOT NULL,
    description TEXT NOT NULL,
    category criteria_category NOT NULL DEFAULT 'practical',
    max_score NUMERIC(5,2) NOT NULL CHECK (max_score > 0),
    is_critical BOOLEAN NOT NULL DEFAULT FALSE,
    observable_guideline TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_pc_nos_qp FOREIGN KEY (nos_id, qp_id) 
        REFERENCES national_occupational_standards(id, qp_id) ON DELETE CASCADE,
    CONSTRAINT unique_nos_pc UNIQUE (nos_id, pc_code),
    CONSTRAINT unique_pc_id_qp UNIQUE (id, qp_id)
);

-- 7. Worker Declarations
CREATE TABLE IF NOT EXISTS worker_declarations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    worker_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    client_sync_id UUID NOT NULL UNIQUE,
    version INTEGER NOT NULL DEFAULT 1,
    status declaration_status NOT NULL DEFAULT 'draft',
    primary_trade TEXT NOT NULL,
    total_experience_months INTEGER NOT NULL DEFAULT 0,
    work_history JSONB NOT NULL DEFAULT '[]'::jsonb,
    tasks_performed JSONB NOT NULL DEFAULT '[]'::jsonb,
    tools_mastered JSONB NOT NULL DEFAULT '[]'::jsonb,
    completeness_score NUMERIC(5,2) DEFAULT 0.00,
    missing_elements JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_worker_declarations_worker ON worker_declarations(worker_id);

-- 8. Worker Declaration Evidence
CREATE TABLE IF NOT EXISTS worker_declaration_evidence (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    declaration_id UUID NOT NULL REFERENCES worker_declarations(id) ON DELETE CASCADE,
    worker_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    original_file_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL CHECK (file_size_bytes > 0 AND file_size_bytes <= 15728640), -- Max 15MB
    sha256_hash TEXT NOT NULL,
    evidence_category TEXT NOT NULL,
    description TEXT,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Qualification Pack Matches
CREATE TABLE IF NOT EXISTS qp_matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    declaration_id UUID NOT NULL REFERENCES worker_declarations(id) ON DELETE CASCADE,
    qp_id UUID NOT NULL REFERENCES qualification_packs(id) ON DELETE RESTRICT,
    heuristic_similarity_score NUMERIC(5,2) NOT NULL,
    is_heuristic BOOLEAN NOT NULL DEFAULT TRUE,
    matched_competencies JSONB NOT NULL,
    missing_competencies JSONB NOT NULL,
    alternative_matches JSONB NOT NULL,
    match_rationale TEXT NOT NULL,
    reviewer_status reviewer_decision_status NOT NULL DEFAULT 'suggested',
    reviewed_by UUID REFERENCES profiles(id),
    reviewer_justification TEXT,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. Practical Assessments (Pinned to Exact QP and Rubric Version)
CREATE TABLE IF NOT EXISTS assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    declaration_id UUID NOT NULL REFERENCES worker_declarations(id) ON DELETE RESTRICT,
    qp_id UUID NOT NULL,
    qp_version TEXT NOT NULL DEFAULT '1.0',
    rubric_config_id UUID NOT NULL,
    rubric_version TEXT NOT NULL DEFAULT '1.0',
    assessor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    client_sync_id UUID NOT NULL UNIQUE,
    version INTEGER NOT NULL DEFAULT 1,
    status assessment_lifecycle_status NOT NULL DEFAULT 'assigned',
    scheduled_date DATE NOT NULL,
    assessment_location TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_assessment_qp_rubric FOREIGN KEY (rubric_config_id, qp_id, rubric_version) 
        REFERENCES rubric_configurations(id, qp_id, version) ON DELETE RESTRICT,
    CONSTRAINT unique_assessment_id_qp UNIQUE (id, qp_id)
);

CREATE INDEX IF NOT EXISTS idx_assessments_assessor ON assessments(assessor_id);
CREATE INDEX IF NOT EXISTS idx_assessments_declaration ON assessments(declaration_id);

-- 11. Assessment Scores (Server-Authoritative)
CREATE TABLE IF NOT EXISTS assessment_scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assessment_id UUID NOT NULL,
    qp_id UUID NOT NULL,
    pc_id UUID NOT NULL,
    score_level INTEGER NOT NULL CHECK (score_level BETWEEN 0 AND 3),
    points_derived NUMERIC(5,2) NOT NULL,
    max_points NUMERIC(5,2) NOT NULL,
    observable_notes TEXT,
    is_exception BOOLEAN NOT NULL DEFAULT FALSE,
    exception_reason TEXT,
    scored_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_score_assessment_qp FOREIGN KEY (assessment_id, qp_id)
        REFERENCES assessments(id, qp_id) ON DELETE CASCADE,
    CONSTRAINT fk_score_pc_qp FOREIGN KEY (pc_id, qp_id)
        REFERENCES performance_criteria(id, qp_id) ON DELETE RESTRICT,
    CONSTRAINT unique_assessment_pc UNIQUE (assessment_id, pc_id)
);

-- 12. Assessment Evidence (Assessor Field Capture)
CREATE TABLE IF NOT EXISTS assessment_evidence (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assessment_id UUID NOT NULL,
    qp_id UUID NOT NULL,
    pc_id UUID REFERENCES performance_criteria(id) ON DELETE SET NULL,
    assessor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    storage_path TEXT NOT NULL,
    original_file_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL CHECK (file_size_bytes > 0 AND file_size_bytes <= 31457280), -- Max 30MB
    sha256_hash TEXT NOT NULL,
    observation_context TEXT,
    captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_evidence_assessment_qp FOREIGN KEY (assessment_id, qp_id)
        REFERENCES assessments(id, qp_id) ON DELETE CASCADE
);

-- 13. Assessment Conflicts Vault
CREATE TABLE IF NOT EXISTS assessment_conflicts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
    client_sync_id UUID NOT NULL,
    assessor_id UUID NOT NULL REFERENCES profiles(id),
    server_version INTEGER NOT NULL,
    client_version INTEGER NOT NULL,
    server_payload JSONB NOT NULL,
    client_payload JSONB NOT NULL,
    conflict_detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_by UUID REFERENCES profiles(id),
    resolution_notes TEXT,
    resolved_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'unresolved' CHECK (status IN ('unresolved', 'resolved', 'dismissed'))
);

-- 14. Competency Reports (Immutable Diagnostic Dossiers)
CREATE TABLE IF NOT EXISTS competency_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assessment_id UUID NOT NULL UNIQUE REFERENCES assessments(id) ON DELETE RESTRICT,
    worker_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    rubric_config_id UUID NOT NULL REFERENCES rubric_configurations(id) ON DELETE RESTRICT,
    aggregate_score_percent NUMERIC(5,2) NOT NULL,
    passed_overall BOOLEAN NOT NULL,
    demonstrated_nos JSONB NOT NULL,
    competency_gaps JSONB NOT NULL,
    recommended_bridge_training JSONB NOT NULL,
    assessor_summary_notes TEXT NOT NULL,
    final_decision final_signoff_decision NOT NULL,
    report_content_hash TEXT NOT NULL,
    canonical_payload JSONB NOT NULL,
    signed_off_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    signed_off_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    signoff_statement TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 15. Append-Only Tamper-Evident Hash-Chained Audit Trail
CREATE TABLE IF NOT EXISTS audit_trail (
    id BIGSERIAL PRIMARY KEY,
    entity_name TEXT NOT NULL,
    entity_id UUID NOT NULL,
    action TEXT NOT NULL,
    actor_id UUID REFERENCES profiles(id),
    old_state JSONB,
    new_state JSONB,
    client_timestamp TIMESTAMPTZ,
    server_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip_address TEXT,
    user_agent TEXT,
    prev_record_hash TEXT,
    record_hash TEXT NOT NULL
);

REVOKE UPDATE, DELETE ON audit_trail FROM PUBLIC, authenticated, anon;

-- 16. Checkpoint anchor table for external WORM verification
CREATE TABLE IF NOT EXISTS audit_checkpoints (
    id BIGSERIAL PRIMARY KEY,
    checkpoint_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_audit_id BIGINT NOT NULL REFERENCES audit_trail(id),
    last_record_hash TEXT NOT NULL,
    signed_digest TEXT,
    created_by UUID REFERENCES profiles(id)
);
