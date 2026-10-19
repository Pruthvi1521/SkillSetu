-- Migration: 00001_extensions_and_types.sql
-- Description: Enables required cryptographic and UUID extensions, and defines custom PostgreSQL enum types.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Custom Domain Enumerations
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('worker', 'assessor', 'reviewer', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE data_provenance AS ENUM ('verified_official', 'synthetic_demo');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE qp_verification_status AS ENUM ('draft', 'pending_verification', 'verified', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE criteria_category AS ENUM ('practical', 'knowledge', 'core_skill');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE declaration_status AS ENUM (
        'draft', 'submitted', 'under_review', 'mapped', 'assessment_scheduled', 'completed', 'archived'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE reviewer_decision_status AS ENUM ('suggested', 'confirmed', 'overridden');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE assessment_lifecycle_status AS ENUM (
        'assigned', 'in_progress', 'submitted', 'conflict_detected', 'finalized', 'cancelled'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE final_signoff_decision AS ENUM (
        'recommended_full', 'recommended_partial', 'bridge_training_required', 'not_recommended'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE idempotency_status AS ENUM ('in_progress', 'completed', 'failed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
