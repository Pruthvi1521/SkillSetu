import { describe, it, expect } from 'vitest';
import {
  canonicalizeJson,
  computeReportHash,
  verifyReportHash,
  CanonicalReportPayload
} from '../../src/lib/security/canonical-report-hasher';

describe('Canonical Report Hasher', () => {
  const samplePayload: CanonicalReportPayload = {
    schema_version: '1.0.0',
    assessment_id: 'a0000000-0000-0000-0000-000000000001',
    worker_id: 'w0000000-0000-0000-0000-000000000001',
    assessor_id: 'e0000000-0000-0000-0000-000000000001',
    reviewer_id: 'r0000000-0000-0000-0000-000000000001',
    qualification_pack: {
      qp_code: 'ELE/Q5901',
      version: '1.0.0',
      provenance: 'synthetic_demo'
    },
    rubric: {
      rubric_id: 'rub-001',
      version: '1.0.0'
    },
    nos_results: [
      {
        nos_code: 'ELE/N5901',
        nos_name: 'Site Assessment',
        score: 85,
        weight: 50,
        passed: true
      },
      {
        nos_code: 'ELE/N5902',
        nos_name: 'Installation',
        score: 75,
        weight: 50,
        passed: true
      }
    ],
    criterion_scores: [
      {
        pc_id: 'pc-1',
        pc_code: 'PC1.1',
        score_level: 3,
        points: 30,
        max_score: 30,
        is_critical_safety: false
      }
    ],
    summary: {
      overall_score: 80,
      passed: true,
      critical_safety_failed: false,
      final_decision: 'recommended_full'
    },
    evidence_digests: [
      {
        evidence_id: 'ev-1',
        sha256_hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
      }
    ],
    generated_at: '2026-10-18T12:00:00.000Z'
  };

  it('produces identical hash regardless of input key insertion order', () => {
    // Permute keys in another object
    const permutedPayload: CanonicalReportPayload = {
      generated_at: '2026-10-18T12:00:00.000Z',
      summary: {
        final_decision: 'recommended_full',
        critical_safety_failed: false,
        passed: true,
        overall_score: 80
      },
      evidence_digests: [
        {
          sha256_hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          evidence_id: 'ev-1'
        }
      ],
      rubric: {
        version: '1.0.0',
        rubric_id: 'rub-001'
      },
      qualification_pack: {
        provenance: 'synthetic_demo',
        version: '1.0.0',
        qp_code: 'ELE/Q5901'
      },
      criterion_scores: [
        {
          max_score: 30,
          points: 30,
          is_critical_safety: false,
          score_level: 3,
          pc_code: 'PC1.1',
          pc_id: 'pc-1'
        }
      ],
      nos_results: [
        {
          passed: true,
          weight: 50,
          score: 85,
          nos_name: 'Site Assessment',
          nos_code: 'ELE/N5901'
        },
        {
          nos_name: 'Installation',
          nos_code: 'ELE/N5902',
          weight: 50,
          passed: true,
          score: 75
        }
      ],
      reviewer_id: 'r0000000-0000-0000-0000-000000000001',
      assessor_id: 'e0000000-0000-0000-0000-000000000001',
      worker_id: 'w0000000-0000-0000-0000-000000000001',
      assessment_id: 'a0000000-0000-0000-0000-000000000001',
      schema_version: '1.0.0'
    };

    const hash1 = computeReportHash(samplePayload);
    const hash2 = computeReportHash(permutedPayload);

    expect(hash1).toBe(hash2);
    expect(verifyReportHash(samplePayload, hash2)).toBe(true);
  });

  it('detects tampering with even a single character or score point', () => {
    const originalHash = computeReportHash(samplePayload);

    const tamperedPayload = JSON.parse(JSON.stringify(samplePayload)) as CanonicalReportPayload;
    // Alter score slightly
    tamperedPayload.summary.overall_score = 80.1;

    expect(verifyReportHash(tamperedPayload, originalHash)).toBe(false);
  });

  it('detects truncation or deletion of nested criteria and evidence digests', () => {
    const originalHash = computeReportHash(samplePayload);

    // Case A: Truncate criterion_scores
    const truncatedCriteria = JSON.parse(JSON.stringify(samplePayload)) as CanonicalReportPayload;
    truncatedCriteria.criterion_scores = [];
    expect(verifyReportHash(truncatedCriteria, originalHash)).toBe(false);

    // Case B: Truncate evidence_digests
    const truncatedEvidence = JSON.parse(JSON.stringify(samplePayload)) as CanonicalReportPayload;
    truncatedEvidence.evidence_digests = [];
    expect(verifyReportHash(truncatedEvidence, originalHash)).toBe(false);

    // Case C: Alter qualification pack version
    const alteredVersion = JSON.parse(JSON.stringify(samplePayload)) as CanonicalReportPayload;
    alteredVersion.qualification_pack.version = '1.0.1';
    expect(verifyReportHash(alteredVersion, originalHash)).toBe(false);
  });
});
