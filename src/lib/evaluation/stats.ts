// Location: src/lib/evaluation/stats.ts
// Pure TypeScript statistical reliability calculations for inter-assessor agreement under SIH26242.

export interface KappaCalculationResult {
  kappa: number;
  observedAgreement: number;
  expectedAgreement: number;
  isUndefined: boolean;
  diagnosticReason?: string;
}

export interface FleissKappaResult {
  fleissKappa: number;
  overallObservedAgreement: number;
  overallExpectedAgreement: number;
  isUndefined: boolean;
  diagnosticReason?: string;
}

export interface ICCResult {
  icc: number;
  fValue: number;
  dfRaters: number;
  dfSubjects: number;
  isUndefined: boolean;
  diagnosticReason?: string;
}

/**
 * Calculates unweighted Cohen's Kappa between two raters across N subjects on nominal categories.
 */
export function calculateCohensKappa(rater1: (number | string)[], rater2: (number | string)[]): KappaCalculationResult {
  if (rater1.length !== rater2.length) {
    throw new Error('Rater rating arrays must be of equal length.');
  }

  const n = rater1.length;
  if (n === 0) {
    return { kappa: NaN, observedAgreement: NaN, expectedAgreement: NaN, isUndefined: true, diagnosticReason: 'Empty rating vector.' };
  }

  // Find all unique categories
  const categories = Array.from(new Set([...rater1, ...rater2]));
  const k = categories.length;

  if (k <= 1) {
    return {
      kappa: NaN,
      observedAgreement: 1.0,
      expectedAgreement: 1.0,
      isUndefined: true,
      diagnosticReason: 'Zero variance: All ratings fall into a single category (Kappa is mathematically undefined).',
    };
  }

  // Build confusion matrix
  let agreeCount = 0;
  const count1 = new Map<any, number>();
  const count2 = new Map<any, number>();

  for (let i = 0; i < n; i++) {
    const val1 = rater1[i];
    const val2 = rater2[i];

    if (val1 === val2) {
      agreeCount++;
    }

    count1.set(val1, (count1.get(val1) || 0) + 1);
    count2.set(val2, (count2.get(val2) || 0) + 1);
  }

  const pO = agreeCount / n;

  // Expected chance agreement
  let pE = 0;
  for (const cat of categories) {
    const c1 = count1.get(cat) || 0;
    const c2 = count2.get(cat) || 0;
    pE += (c1 / n) * (c2 / n);
  }

  if (Math.abs(1 - pE) < 1e-9) {
    return {
      kappa: NaN,
      observedAgreement: pO,
      expectedAgreement: pE,
      isUndefined: true,
      diagnosticReason: 'Expected agreement equals 1.0 (Zero variance across raters).',
    };
  }

  const kappa = Math.round(((pO - pE) / (1 - pE)) * 1000) / 1000;
  return { kappa, observedAgreement: Math.round(pO * 1000) / 1000, expectedAgreement: Math.round(pE * 1000) / 1000, isUndefined: false };
}

/**
 * Calculates Quadratic Weighted Kappa on an ordinal scale (0..maxLevel, e.g. 0,1,2,3).
 */
export function calculateQuadraticWeightedKappa(
  rater1: number[],
  rater2: number[],
  maxLevel: number = 3
): KappaCalculationResult {
  if (rater1.length !== rater2.length) {
    throw new Error('Rater rating arrays must be of equal length.');
  }

  const n = rater1.length;
  if (n === 0) {
    return { kappa: NaN, observedAgreement: NaN, expectedAgreement: NaN, isUndefined: true, diagnosticReason: 'Empty rating vector.' };
  }

  // Weight penalty: w_ij = ((i - j) / (maxLevel))^2
  // We compute observed matrix O and expected matrix E
  const m = maxLevel + 1;
  const oMatrix: number[][] = Array.from({ length: m }, () => Array(m).fill(0));
  const rowTotals = Array(m).fill(0);
  const colTotals = Array(m).fill(0);

  for (let i = 0; i < n; i++) {
    const r1 = rater1[i];
    const r2 = rater2[i];

    if (r1 < 0 || r1 > maxLevel || r2 < 0 || r2 > maxLevel) {
      throw new Error(`Rating out of scale bounds [0..${maxLevel}]: ${r1}, ${r2}`);
    }

    oMatrix[r1][r2]++;
    rowTotals[r1]++;
    colTotals[r2]++;
  }

  // Check variance
  const nonZeroRows = rowTotals.filter((c) => c > 0).length;
  const nonZeroCols = colTotals.filter((c) => c > 0).length;
  if (nonZeroRows <= 1 && nonZeroCols <= 1) {
    return {
      kappa: NaN,
      observedAgreement: 1.0,
      expectedAgreement: 1.0,
      isUndefined: true,
      diagnosticReason: 'Zero variance across ordinal levels.',
    };
  }

  let observedWeightedDisagreement = 0;
  let expectedWeightedDisagreement = 0;

  for (let i = 0; i < m; i++) {
    for (let j = 0; j < m; j++) {
      const weight = Math.pow((i - j) / maxLevel, 2);
      observedWeightedDisagreement += weight * (oMatrix[i][j] / n);
      expectedWeightedDisagreement += weight * ((rowTotals[i] / n) * (colTotals[j] / n));
    }
  }

  if (expectedWeightedDisagreement === 0) {
    return {
      kappa: NaN,
      observedAgreement: 1.0,
      expectedAgreement: 1.0,
      isUndefined: true,
      diagnosticReason: 'Expected disagreement equals zero.',
    };
  }

  const kappa = Math.round((1 - observedWeightedDisagreement / expectedWeightedDisagreement) * 1000) / 1000;
  return {
    kappa,
    observedAgreement: Math.round((1 - observedWeightedDisagreement) * 1000) / 1000,
    expectedAgreement: Math.round((1 - expectedWeightedDisagreement) * 1000) / 1000,
    isUndefined: false,
  };
}

/**
 * Calculates Fleiss' Multi-Rater Kappa across N subjects and k raters.
 * ratingsMatrix[i][j] = number of raters that assigned category j to subject i
 */
export function calculateFleissKappa(ratingsMatrix: number[][]): FleissKappaResult {
  const n = ratingsMatrix.length;
  if (n === 0) {
    return { fleissKappa: NaN, overallObservedAgreement: NaN, overallExpectedAgreement: NaN, isUndefined: true, diagnosticReason: 'Empty subject matrix.' };
  }

  const numCategories = ratingsMatrix[0].length;
  // Calculate k (number of raters per subject) from first row
  const k = ratingsMatrix[0].reduce((sum, count) => sum + count, 0);

  if (k < 2) {
    return { fleissKappa: NaN, overallObservedAgreement: NaN, overallExpectedAgreement: NaN, isUndefined: true, diagnosticReason: 'Requires at least 2 raters per subject.' };
  }

  // Calculate p_j (proportion of all assignments to category j)
  const pJ = Array(numCategories).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < numCategories; j++) {
      pJ[j] += ratingsMatrix[i][j];
    }
  }

  const totalAssignments = n * k;
  for (let j = 0; j < numCategories; j++) {
    pJ[j] /= totalAssignments;
  }

  // Calculate P_i (degree of agreement for the i-th subject)
  let sumPi = 0;
  for (let i = 0; i < n; i++) {
    let rowSumSq = 0;
    for (let j = 0; j < numCategories; j++) {
      rowSumSq += ratingsMatrix[i][j] * ratingsMatrix[i][j];
    }
    const pI = (rowSumSq - k) / (k * (k - 1));
    sumPi += pI;
  }

  const pBar = sumPi / n;

  // Calculate pBar_e (expected chance agreement)
  let pBarE = 0;
  for (let j = 0; j < numCategories; j++) {
    pBarE += pJ[j] * pJ[j];
  }

  if (Math.abs(1 - pBarE) < 1e-9) {
    return {
      fleissKappa: NaN,
      overallObservedAgreement: pBar,
      overallExpectedAgreement: pBarE,
      isUndefined: true,
      diagnosticReason: 'Zero variance across subjects (Fleiss Kappa undefined).',
    };
  }

  const kappa = Math.round(((pBar - pBarE) / (1 - pBarE)) * 1000) / 1000;
  return {
    fleissKappa: kappa,
    overallObservedAgreement: Math.round(pBar * 1000) / 1000,
    overallExpectedAgreement: Math.round(pBarE * 1000) / 1000,
    isUndefined: false,
  };
}

/**
 * Calculates Intraclass Correlation Coefficient ICC(2,1): Two-way random effects, absolute agreement.
 * scoreMatrix[i][j] = score assigned to candidate i by rater j
 */
export function calculateICC21(scoreMatrix: number[][]): ICCResult {
  const n = scoreMatrix.length; // Number of candidates
  if (n < 2) {
    return { icc: NaN, fValue: NaN, dfRaters: 0, dfSubjects: 0, isUndefined: true, diagnosticReason: 'Requires at least 2 subjects.' };
  }

  const k = scoreMatrix[0].length; // Number of raters
  if (k < 2) {
    return { icc: NaN, fValue: NaN, dfRaters: 0, dfSubjects: 0, isUndefined: true, diagnosticReason: 'Requires at least 2 raters.' };
  }

  // Compute Grand Mean
  let grandSum = 0;
  const rowSums = Array(n).fill(0);
  const colSums = Array(k).fill(0);

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < k; j++) {
      const val = scoreMatrix[i][j];
      grandSum += val;
      rowSums[i] += val;
      colSums[j] += val;
    }
  }

  const grandMean = grandSum / (n * k);

  // Sum of Squares: Total
  let ssTotal = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < k; j++) {
      ssTotal += Math.pow(scoreMatrix[i][j] - grandMean, 2);
    }
  }

  // Sum of Squares: Rows (Subjects / Candidates)
  let ssRows = 0;
  for (let i = 0; i < n; i++) {
    ssRows += Math.pow(rowSums[i] / k - grandMean, 2);
  }
  ssRows *= k;

  // Sum of Squares: Columns (Raters / Assessors)
  let ssCols = 0;
  for (let j = 0; j < k; j++) {
    ssCols += Math.pow(colSums[j] / n - grandMean, 2);
  }
  ssCols *= n;

  // Sum of Squares: Error (Residual)
  const ssError = Math.max(0, ssTotal - ssRows - ssCols);

  const dfRows = n - 1;
  const dfCols = k - 1;
  const dfError = (n - 1) * (k - 1);

  const msRows = ssRows / dfRows;
  const msCols = ssCols / dfCols;
  const msError = dfError > 0 ? ssError / dfError : 0;

  const denominator = msRows + (k - 1) * msError + (k / n) * (msCols - msError);

  if (denominator === 0 || isNaN(denominator)) {
    return { icc: NaN, fValue: NaN, dfRaters: dfCols, dfSubjects: dfRows, isUndefined: true, diagnosticReason: 'Zero variance in ANOVA table.' };
  }

  const icc = Math.round(((msRows - msError) / denominator) * 1000) / 1000;
  const fValue = msError > 0 ? Math.round((msRows / msError) * 100) / 100 : NaN;

  return { icc, fValue, dfRaters: dfCols, dfSubjects: dfRows, isUndefined: false };
}
