// Location: tests/unit/stats-evaluation.test.ts
import { describe, it, expect } from 'vitest';
import {
  calculateCohensKappa,
  calculateQuadraticWeightedKappa,
  calculateFleissKappa,
  calculateICC21,
} from '@/lib/evaluation/stats';

describe('Inter-Assessor Statistical Reliability Unit Tests', () => {
  it('TEST-STATS-01: Cohen Unweighted Kappa matches known reference values', () => {
    // 10 subjects rated by 2 raters on pass/fail (1 or 0)
    // 8 agreements, 2 disagreements
    const raterA = [1, 1, 0, 1, 0, 1, 0, 1, 1, 0];
    const raterB = [1, 1, 0, 1, 1, 1, 0, 1, 0, 0];

    const res = calculateCohensKappa(raterA, raterB);
    expect(res.isUndefined).toBe(false);
    expect(res.observedAgreement).toBe(0.8);
    expect(res.kappa).toBeGreaterThan(0.5);
    expect(res.kappa).toBeLessThan(0.7);
  });

  it('TEST-STATS-02: Zero-variance rater ratings return undefined with diagnostic message', () => {
    // Both raters assign Level 2 to every candidate (Zero variance)
    const raterA = [2, 2, 2, 2, 2];
    const raterB = [2, 2, 2, 2, 2];

    const res = calculateCohensKappa(raterA, raterB);
    expect(res.isUndefined).toBe(true);
    expect(Number.isNaN(res.kappa)).toBe(true);
    expect(res.diagnosticReason).toMatch(/Zero variance/i);
  });

  it('TEST-STATS-03: Quadratic Weighted Kappa penalizes distant disagreements more heavily', () => {
    // Pair 1: Minor disagreement (Levels 1 and 2)
    const r1Minor = [1, 2, 2, 3];
    const r2Minor = [2, 2, 1, 3];
    const resMinor = calculateQuadraticWeightedKappa(r1Minor, r2Minor, 3);

    // Pair 2: Extreme disagreement (Levels 0 and 3)
    const r1Major = [0, 3, 0, 3];
    const r2Major = [3, 0, 3, 0];
    const resMajor = calculateQuadraticWeightedKappa(r1Major, r2Major, 3);

    expect(resMinor.kappa).toBeGreaterThan(resMajor.kappa);
    expect(resMajor.kappa).toBeLessThan(0); // Severe negative correlation
  });

  it('TEST-STATS-04: Fleiss Multi-Rater Kappa computes correct reliability across k >= 3 raters', () => {
    // 5 subjects evaluated by 3 raters on 3 categories (0, 1, 2)
    // Each row sum must equal 3
    const ratingsMatrix = [
      [3, 0, 0], // Subject 1: All 3 raters chose Cat 0
      [0, 3, 0], // Subject 2: All 3 raters chose Cat 1
      [0, 0, 3], // Subject 3: All 3 raters chose Cat 2
      [2, 1, 0], // Subject 4: 2 raters chose Cat 0, 1 chose Cat 1
      [1, 2, 0], // Subject 5: 1 rater chose Cat 0, 2 chose Cat 1
    ];

    const res = calculateFleissKappa(ratingsMatrix);
    expect(res.isUndefined).toBe(false);
    expect(res.overallObservedAgreement).toBeGreaterThan(0.7);
    expect(res.fleissKappa).toBeGreaterThan(0.5);
  });

  it('TEST-STATS-05: ICC(2,1) calculates absolute agreement on continuous scoring scales', () => {
    // 4 candidates scored by 3 independent raters on percentage (0..100) (Simulated trial dataset)
    const scores = [
      [75, 78, 76],
      [82, 80, 85],
      [60, 62, 59],
      [90, 92, 89],
    ];

    const res = calculateICC21(scores);
    expect(res.isUndefined).toBe(false);
    expect(res.icc).toBeGreaterThan(0.85); // High inter-rater agreement
    expect(res.dfSubjects).toBe(3);
    expect(res.dfRaters).toBe(2);
  });

  it('TEST-STATS-06: Handles empty vectors and mismatched lengths safely', () => {
    // Empty rating vector
    const emptyRes = calculateCohensKappa([], []);
    expect(emptyRes.isUndefined).toBe(true);
    expect(emptyRes.diagnosticReason).toMatch(/Empty rating vector/i);

    // Mismatched array lengths throws error
    expect(() => calculateCohensKappa([1, 0], [1])).toThrow(/equal length/i);
  });

  it('TEST-STATS-07: ICC returns undefined when samples or raters are insufficient (< 2)', () => {
    // Single subject (< 2)
    const singleSubject = [[75, 80, 85]];
    const resSubjects = calculateICC21(singleSubject);
    expect(resSubjects.isUndefined).toBe(true);
    expect(resSubjects.diagnosticReason).toMatch(/at least 2 subjects/i);

    // Single rater (< 2)
    const singleRater = [[75], [82], [60]];
    const resRaters = calculateICC21(singleRater);
    expect(resRaters.isUndefined).toBe(true);
    expect(resRaters.diagnosticReason).toMatch(/at least 2 raters/i);
  });

  it('TEST-STATS-08: Fleiss Kappa returns undefined for empty matrices or fewer than 2 raters', () => {
    // Empty matrix
    const emptyRes = calculateFleissKappa([]);
    expect(emptyRes.isUndefined).toBe(true);
    expect(emptyRes.diagnosticReason).toMatch(/Empty subject matrix/i);

    // Only 1 rater per subject (k = 1)
    const oneRater = [
      [1, 0, 0],
      [0, 1, 0],
    ];
    const oneRaterRes = calculateFleissKappa(oneRater);
    expect(oneRaterRes.isUndefined).toBe(true);
    expect(oneRaterRes.diagnosticReason).toMatch(/at least 2 raters per subject/i);
  });
});
