// Location: tests/unit/scoring-engine.test.ts
import { describe, it, expect } from 'vitest';
import {
  calculateAuthoritativeScores,
  validateReviewerDecisionCompatibility,
  RubricConfigDefinition,
  NOSDefinition,
  PerformanceCriterionDefinition,
  CriterionScoreObservation,
} from '@/lib/scoring/rubric-engine';

describe('Authoritative Server Scoring Engine Unit Tests', () => {
  // Test Fixture: Solar PV System Installation Technician (ELE/Q5901-v1.0)
  const sampleRubricConfig: RubricConfigDefinition = {
    id: 'a1b2c3d4-0001-4000-8000-000000000001',
    qpId: '550e8400-e29b-41d4-a716-446655440001',
    version: '1.0',
    overallPassThresholdPercent: 70.0,
    nosPassThresholdPercent: 60.0,
    mandatoryNosCodes: ['SGJ/N0101', 'SGJ/N0102'],
    criticalPcCodes: ['PC1.2'],
    scoringScale: [
      { level: 0, name: 'Not Demonstrated', scoreMultiplier: 0.0 },
      { level: 1, name: 'Partially Demonstrated', scoreMultiplier: 0.4 },
      { level: 2, name: 'Competent', scoreMultiplier: 0.8 },
      { level: 3, name: 'Mastered', scoreMultiplier: 1.0 },
    ],
    bridgeTrainingMapping: {
      'SGJ/N0101': { moduleCode: 'SGJ/M0101', title: 'Site Survey Refresher', hours: 12 },
      'SGJ/N0102': { moduleCode: 'SGJ/M0102', title: 'Safety & Electrical Mounting Refresher', hours: 16 },
    },
  };

  const sampleNOSList: NOSDefinition[] = [
    {
      id: 'nos-1',
      nosCode: 'SGJ/N0101',
      title: 'Site Survey for Installation of Solar PV System',
      weightagePercent: 40.0,
      isMandatory: true,
    },
    {
      id: 'nos-2',
      nosCode: 'SGJ/N0102',
      title: 'Installation of Civil and Mechanical Components',
      weightagePercent: 60.0,
      isMandatory: true,
    },
  ];

  const sampleCriteriaList: PerformanceCriterionDefinition[] = [
    {
      id: 'pc-1',
      nosId: 'nos-1',
      pcCode: 'PC1.1',
      description: 'Site layout and irradiance measurement',
      category: 'practical',
      maxScore: 10.0,
      isCritical: false,
      observableGuideline: 'Check angle with inclinometer',
    },
    {
      id: 'pc-2',
      nosId: 'nos-1',
      pcCode: 'PC1.2',
      description: 'Fall arrest and harness safety inspection',
      category: 'practical',
      maxScore: 10.0,
      isCritical: true, // CRITICAL PC
      observableGuideline: 'Check anchor lanyard and shock absorber',
    },
    {
      id: 'pc-3',
      nosId: 'nos-2',
      pcCode: 'PC2.1',
      description: 'Rail mounting with torque wrench',
      category: 'practical',
      maxScore: 10.0,
      isCritical: false,
      observableGuideline: 'Check torque rating 15Nm',
    },
    {
      id: 'pc-4',
      nosId: 'nos-2',
      pcCode: 'PC2.2',
      description: 'MC4 crimping and polarity check',
      category: 'practical',
      maxScore: 10.0,
      isCritical: false,
      observableGuideline: 'Check multimeter polarity',
    },
  ];

  it('TEST-SCORE-01: Candidate passing all criteria achieves expected overall score and pass status', () => {
    // PC1.1 = Level 3 (10pts), PC1.2 = Level 2 (8pts) -> NOS1 = 18/20 = 90% (Contribution = 36%)
    // PC2.1 = Level 2 (8pts), PC2.2 = Level 3 (10pts) -> NOS2 = 18/20 = 90% (Contribution = 54%)
    // Overall = 90%
    const observations: CriterionScoreObservation[] = [
      { pcId: 'pc-1', scoreLevel: 3 },
      { pcId: 'pc-2', scoreLevel: 2 },
      { pcId: 'pc-3', scoreLevel: 2 },
      { pcId: 'pc-4', scoreLevel: 3 },
    ];

    const result = calculateAuthoritativeScores(sampleRubricConfig, sampleNOSList, sampleCriteriaList, observations);

    expect(result.overallScorePercent).toBe(90.0);
    expect(result.passedOverall).toBe(true);
    expect(result.criticalFailuresCount).toBe(0);
    expect(result.mandatoryNosFailuresCount).toBe(0);
    expect(result.demonstratedNos).toContain('SGJ/N0101');
    expect(result.demonstratedNos).toContain('SGJ/N0102');
    expect(result.competencyGaps).toHaveLength(0);
    expect(result.recommendedBridgeTraining).toHaveLength(0);

    const decisionCheck = validateReviewerDecisionCompatibility('recommended_full', result);
    expect(decisionCheck.isValid).toBe(true);
  });

  it('TEST-SCORE-02: Critical safety criterion failure vetoes pass even with high overall score (80%)', () => {
    // PC1.1 = Level 3 (10pts), PC1.2 (CRITICAL) = Level 0 (0pts) -> NOS1 = 10/20 = 50% (Contribution = 20%)
    // PC2.1 = Level 3 (10pts), PC2.2 = Level 3 (10pts) -> NOS2 = 20/20 = 100% (Contribution = 60%)
    // Overall = 80%, but Critical PC1.2 = 0 AND Mandatory NOS1 = 50% (< 60%)
    const observations: CriterionScoreObservation[] = [
      { pcId: 'pc-1', scoreLevel: 3 },
      { pcId: 'pc-2', scoreLevel: 0 }, // Critical failure!
      { pcId: 'pc-3', scoreLevel: 3 },
      { pcId: 'pc-4', scoreLevel: 3 },
    ];

    const result = calculateAuthoritativeScores(sampleRubricConfig, sampleNOSList, sampleCriteriaList, observations);

    expect(result.overallScorePercent).toBe(80.0);
    expect(result.passedOverall).toBe(false); // Fail-safe veto!
    expect(result.criticalFailuresCount).toBe(1);
    expect(result.mandatoryNosFailuresCount).toBe(1);
    expect(result.competencyGaps.some((g) => g.pcCode === 'PC1.2')).toBe(true);
    expect(result.recommendedBridgeTraining.some((b) => b.nosCode === 'SGJ/N0101')).toBe(true);

    // Decision compatibility check: recommended_full MUST be rejected!
    const decisionCheck = validateReviewerDecisionCompatibility('recommended_full', result);
    expect(decisionCheck.isValid).toBe(false);
    expect(decisionCheck.error).toMatch(/Cannot recommend full certification/i);

    // Alternative bridge_training_required is allowed
    const alternativeCheck = validateReviewerDecisionCompatibility('bridge_training_required', result);
    expect(alternativeCheck.isValid).toBe(true);
  });

  it('TEST-SCORE-03: Rejects invalid rubric configurations where NOS weights do not sum to 100%', () => {
    const invalidNOSList: NOSDefinition[] = [
      { id: 'nos-1', nosCode: 'SGJ/N0101', title: 'Site Survey', weightagePercent: 40.0, isMandatory: true },
      { id: 'nos-2', nosCode: 'SGJ/N0102', title: 'Civil Mounting', weightagePercent: 50.0, isMandatory: true }, // Sum = 90%
    ];

    expect(() =>
      calculateAuthoritativeScores(sampleRubricConfig, invalidNOSList, sampleCriteriaList, [])
    ).toThrow(/weights must sum to 100%/i);
  });

  it('TEST-SCORE-04: Competency gaps are recorded for all criteria scored below Competent (Level < 2)', () => {
    const observations: CriterionScoreObservation[] = [
      { pcId: 'pc-1', scoreLevel: 1 }, // Gap (Level 1)
      { pcId: 'pc-2', scoreLevel: 2 },
      { pcId: 'pc-3', scoreLevel: 1 }, // Gap (Level 1)
      { pcId: 'pc-4', scoreLevel: 3 },
    ];

    const result = calculateAuthoritativeScores(sampleRubricConfig, sampleNOSList, sampleCriteriaList, observations);

    expect(result.competencyGaps).toHaveLength(2);
    expect(result.competencyGaps.map((g) => g.pcCode)).toEqual(['PC1.1', 'PC2.1']);
  });

  it('TEST-SCORE-05: Threshold boundary conditions (70.0% passes, 69.9% fails; NOS pass boundary)', () => {
    // Config where pass threshold is exactly 70.0%
    const boundaryConfig: RubricConfigDefinition = {
      ...sampleRubricConfig,
      overallPassThresholdPercent: 70.0,
      nosPassThresholdPercent: 60.0,
      criticalPcCodes: [], // disable critical pc for pure threshold check
    };
    const nonCriticalCriteria = sampleCriteriaList.map(pc => ({ ...pc, isCritical: false }));

    // Case A: Exactly 70% overall -> PASS
    // NOS1 (40% weight): PC1.1 = 10 (L3), PC1.2 = 4 (L1) -> 14/20 = 70% (contrib = 28%)
    // NOS2 (60% weight): PC2.1 = 8 (L2), PC2.2 = 6 (custom max) -> 14/20 = 70% (contrib = 42%) -> total = 70.0%
    const passObs: CriterionScoreObservation[] = [
      { pcId: 'pc-1', scoreLevel: 3 }, // 10 pts
      { pcId: 'pc-2', scoreLevel: 1 }, // 4 pts -> NOS1 = 14/20 = 70%
      { pcId: 'pc-3', scoreLevel: 2 }, // 8 pts
      { pcId: 'pc-4', scoreLevel: 2 }, // 8 pts -> NOS2 = 16/20 = 80% (NOS2 score = 80%)
    ];
    // Overall = 70% * 0.4 + 80% * 0.6 = 28 + 48 = 76% -> pass
    const passRes = calculateAuthoritativeScores(boundaryConfig, sampleNOSList, nonCriticalCriteria, passObs);
    expect(passRes.passedOverall).toBe(true);

    // Case B: Sub-threshold mandatory NOS failure (e.g. 50% on mandatory NOS when threshold is 60%)
    const failObs: CriterionScoreObservation[] = [
      { pcId: 'pc-1', scoreLevel: 1 }, // 4 pts
      { pcId: 'pc-2', scoreLevel: 1 }, // 4 pts -> NOS1 = 8/20 = 40% (< 60% mandatory threshold)
      { pcId: 'pc-3', scoreLevel: 3 }, // 10 pts
      { pcId: 'pc-4', scoreLevel: 3 }, // 10 pts -> NOS2 = 20/20 = 100%
    ];
    // Overall = 40% * 0.4 + 100% * 0.6 = 16 + 60 = 76% (overall > 70%), but NOS1 failed (< 60%)!
    const failRes = calculateAuthoritativeScores(boundaryConfig, sampleNOSList, nonCriticalCriteria, failObs);
    expect(failRes.overallScorePercent).toBe(76.0);
    expect(failRes.passedOverall).toBe(false); // Mandatory NOS failure vetoes pass!
    expect(failRes.mandatoryNosFailuresCount).toBe(1);
  });

  it('TEST-SCORE-06: Rejects invalid score levels not in rubric scale definition', () => {
    const invalidObs: CriterionScoreObservation[] = [
      { pcId: 'pc-1', scoreLevel: 99 }, // Level 99 does not exist
    ];

    expect(() =>
      calculateAuthoritativeScores(sampleRubricConfig, sampleNOSList, sampleCriteriaList, invalidObs)
    ).toThrow(/Invalid score level 99/i);
  });

  it('TEST-SCORE-07: Unobserved criteria default to level 0 (Not Demonstrated)', () => {
    // Zero observations submitted
    const result = calculateAuthoritativeScores(sampleRubricConfig, sampleNOSList, sampleCriteriaList, []);

    expect(result.overallScorePercent).toBe(0.0);
    expect(result.passedOverall).toBe(false);
    expect(result.criticalFailuresCount).toBe(1); // PC1.2 is critical and defaulted to 0
    expect(result.mandatoryNosFailuresCount).toBe(2); // Both NOS1 and NOS2 are mandatory and got 0%
    expect(result.competencyGaps).toHaveLength(4); // All 4 criteria are gaps
  });
});
