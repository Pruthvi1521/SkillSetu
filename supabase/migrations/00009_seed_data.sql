-- Migration: 00009_seed_data.sql
-- Description: Deterministic synthetic demonstration seed data explicitly watermarked as SYNTHETIC_DEMO.

-- 1. Seed Synthetic Qualification Pack: Solar PV System Installation Technician
INSERT INTO qualification_packs (
    id, qp_code, title, sector, sub_sector, nsqf_level, version, provenance, verification_status, is_active
) VALUES (
    '550e8400-e29b-41d4-a716-446655440001',
    'ELE/Q5901',
    'Solar PV System Installation Technician',
    'Green Jobs',
    'Renewable Energy',
    4,
    '1.0',
    'synthetic_demo',
    'draft',
    TRUE
) ON CONFLICT (id) DO NOTHING;

-- 2. Seed Rubric Configuration for ELE/Q5901
INSERT INTO rubric_configurations (
    id, qp_id, qp_version, version, overall_pass_threshold_percent, nos_pass_threshold_percent,
    mandatory_nos_codes, critical_pc_codes, scoring_scale, aggregation_method, bridge_training_mapping, is_locked
) VALUES (
    'a1b2c3d4-0001-4000-8000-000000000001',
    '550e8400-e29b-41d4-a716-446655440001',
    '1.0',
    '1.0',
    70.00,
    60.00,
    '["SGJ/N0101", "SGJ/N0102"]'::jsonb,
    '["PC1.2"]'::jsonb,
    '[
      {"level": 0, "name": "Not Demonstrated", "scoreMultiplier": 0.00},
      {"level": 1, "name": "Partially Demonstrated", "scoreMultiplier": 0.40},
      {"level": 2, "name": "Competent", "scoreMultiplier": 0.80},
      {"level": 3, "name": "Mastered", "scoreMultiplier": 1.00}
    ]'::jsonb,
    'weighted_average',
    '{
      "SGJ/N0101": {"module_code": "SGJ/M0101", "title": "Site Survey Refresher", "hours": 12},
      "SGJ/N0102": {"module_code": "SGJ/M0102", "title": "Safety & Electrical Mounting Refresher", "hours": 16}
    }'::jsonb,
    FALSE
) ON CONFLICT (id) DO NOTHING;

-- 3. Seed NOS records for ELE/Q5901
INSERT INTO national_occupational_standards (
    id, qp_id, qp_version, nos_code, title, description, nsqf_level, weightage_percent, is_mandatory
) VALUES 
(
    'b1b2c3d4-0001-4000-8000-000000000001',
    '550e8400-e29b-41d4-a716-446655440001',
    '1.0',
    'SGJ/N0101',
    'Site Survey for Installation of Solar PV System',
    'Assessing roof layout, shadow cast, and structural integrity for mounting',
    4,
    40.00,
    TRUE
),
(
    'b1b2c3d4-0002-4000-8000-000000000002',
    '550e8400-e29b-41d4-a716-446655440001',
    '1.0',
    'SGJ/N0102',
    'Installation of Civil and Mechanical Components',
    'Mounting aluminum rails, module fixing, and cable management',
    4,
    60.00,
    TRUE
) ON CONFLICT (id) DO NOTHING;

-- 4. Seed Performance Criteria for ELE/Q5901
INSERT INTO performance_criteria (
    id, nos_id, qp_id, pc_code, description, category, max_score, is_critical, observable_guideline
) VALUES 
(
    'c1b2c3d4-0001-4000-8000-000000000001',
    'b1b2c3d4-0001-4000-8000-000000000001',
    '550e8400-e29b-41d4-a716-446655440001',
    'PC1.1',
    'Inspect roof orientation and measure tilt angle with inclinometer',
    'practical',
    10.00,
    FALSE,
    'Candidate independently locates true south and verifies tilt angle within +/- 2 degrees.'
),
(
    'c1b2c3d4-0002-4000-8000-000000000002',
    'b1b2c3d4-0001-4000-8000-000000000001',
    '550e8400-e29b-41d4-a716-446655440001',
    'PC1.2',
    'Inspect and verify full-body safety harness and fall protection rigging',
    'practical',
    10.00,
    TRUE, -- Critical safety criterion
    'Candidate verifies harness lanyard, anchor point, and shock absorber before ascending roof.'
),
(
    'c1b2c3d4-0003-4000-8000-000000000003',
    'b1b2c3d4-0002-4000-8000-000000000002',
    '550e8400-e29b-41d4-a716-446655440001',
    'PC2.1',
    'Mount aluminum rails to purlins using calibrated torque wrench',
    'practical',
    10.00,
    FALSE,
    'Candidate applies specified manufacturer torque rating (15 Nm) on all fastening hardware.'
),
(
    'c1b2c3d4-0004-4000-8000-000000000004',
    'b1b2c3d4-0002-4000-8000-000000000002',
    '550e8400-e29b-41d4-a716-446655440001',
    'PC2.2',
    'Crimp MC4 DC connectors and verify electrical polarity and continuity',
    'practical',
    10.00,
    FALSE,
    'Candidate verifies correct positive/negative connector assembly and continuity with multimeter.'
) ON CONFLICT (id) DO NOTHING;
