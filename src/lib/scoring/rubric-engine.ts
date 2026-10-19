// Location: src/lib/scoring/rubric-engine.ts
// Pure TypeScript Authoritative Scoring Engine matching PostgreSQL procedure calculate_authoritative_assessment_results exactly.

export interface RubricScaleLevel {
  level: number;
  name: string;
  scoreMultiplier: number;
}

export interface PerformanceCriterionDefinition {
  id: string;
  nosId: string;
  pcCode: string;
  description: string;
  category: 'practical' | 'knowledge' | 'core_skill';
  maxScore: number;
  isCritical: boolean;
  observableGuideline: string;
}

export interface NOSDefinition {
  id: string;
  nosCode: string;
  title: string;
  weightagePercent: number;
  isMandatory: boolean;
  customPassThreshold?: number;
}

export interface RubricConfigDefinition {
  id: string;
  qpId: string;
  version: string;
  overallPassThresholdPercent: number;
  nosPassThresholdPercent: number;
  mandatoryNosCodes: string[];
  criticalPcCodes: string[];
  scoringScale: RubricScaleLevel[];
  bridgeTrainingMapping: Record<string, { moduleCode: string; title: string; hours: number }>;
}

export interface CriterionScoreObservation {
  pcId: string;
  scoreLevel: number; // 0, 1, 2, 3
  observableNotes?: string;
  isException?: boolean;
  exceptionReason?: string;
}

export interface NOSScoreResult {
  nosCode: string;
  title: string;
  earnedPoints: number;
  maxPossiblePoints: number;
  scorePercent: number;
  weightagePercent: number;
  isMandatory: boolean;
  passed: boolean;
}

export interface CompetencyGapItem {
  nosCode: string;
  pcCode: string;
  description: string;
  scoreLevel: number;
}

export interface BridgeTrainingRecommendation {
  nosCode: string;
  moduleCode: string;
  title: string;
  hours: number;
}

export interface AuthoritativeScoringResult {
  overallScorePercent: number;
  passedOverall: boolean;
  criticalFailuresCount: number;
  mandatoryNosFailuresCount: number;
  nosScores: NOSScoreResult[];
  demonstratedNos: string[];
  competencyGaps: CompetencyGapItem[];
  recommendedBridgeTraining: BridgeTrainingRecommendation[];
}

export function calculateAuthoritativeScores(
  rubricConfig: RubricConfigDefinition,
  nosList: NOSDefinition[],
  criteriaList: PerformanceCriterionDefinition[],
  observations: CriterionScoreObservation[]
): AuthoritativeScoringResult {
  // Validate total weightage equals 100%
  const totalWeight = nosList.reduce((sum, nos) => sum + nos.weightagePercent, 0);
  if (Math.abs(totalWeight - 100.0) > 0.01) {
    throw new Error(`Invalid rubric configuration: NOS weights must sum to 100%, got ${totalWeight}%`);
  }

  // Create fast lookup for multipliers
  const scaleMap = new Map<number, number>();
  for (const s of rubricConfig.scoringScale) {
    scaleMap.set(s.level, s.scoreMultiplier);
  }

  // Create fast lookup for observations
  const obsMap = new Map<string, CriterionScoreObservation>();
  for (const obs of observations) {
    obsMap.set(obs.pcId, obs);
  }

  let overallScore = 0.0;
  let criticalFailuresCount = 0;
  let mandatoryNosFailuresCount = 0;
  const nosScores: NOSScoreResult[] = [];
  const demonstratedNos: string[] = [];
  const competencyGaps: CompetencyGapItem[] = [];

  for (const nos of nosList) {
    const nosCriteria = criteriaList.filter((pc) => pc.nosId === nos.id);
    let nosEarned = 0.0;
    let nosPossible = 0.0;

    for (const pc of nosCriteria) {
      nosPossible += pc.maxScore;
      const obs = obsMap.get(pc.id);
      const level = obs ? obs.scoreLevel : 0;
      const multiplier = scaleMap.get(level);

      if (multiplier === undefined) {
        throw new Error(`Invalid score level ${level} for criterion ${pc.pcCode}`);
      }

      const points = Math.round(multiplier * pc.maxScore * 100) / 100;
      nosEarned += points;

      // Check critical safety criterion failure (Level < 1 vetoes pass)
      if (pc.isCritical && level < 1) {
        criticalFailuresCount++;
      }

      // Record competency gap if score level < 2
      if (level < 2) {
        competencyGaps.push({
          nosCode: nos.nosCode,
          pcCode: pc.pcCode,
          description: pc.description,
          scoreLevel: level,
        });
      }
    }

    const nosScore = nosPossible > 0 ? Math.round((nosEarned / nosPossible) * 10000) / 100 : 0.0;
    const threshold = nos.customPassThreshold ?? rubricConfig.nosPassThresholdPercent;
    const passed = nosScore >= threshold;

    if (nos.isMandatory && !passed) {
      mandatoryNosFailuresCount++;
    }

    if (passed) {
      demonstratedNos.push(nos.nosCode);
    }

    const weightedContribution = Math.round(nosScore * (nos.weightagePercent / 100.0) * 100) / 100;
    overallScore += weightedContribution;

    nosScores.push({
      nosCode: nos.nosCode,
      title: nos.title,
      earnedPoints: nosEarned,
      maxPossiblePoints: nosPossible,
      scorePercent: nosScore,
      weightagePercent: nos.weightagePercent,
      isMandatory: nos.isMandatory,
      passed,
    });
  }

  overallScore = Math.round(overallScore * 100) / 100;

  // Candidate passes overall if:
  // 1. Overall Score >= overallPassThresholdPercent
  // 2. Zero critical criteria failures
  // 3. Zero mandatory NOS failures
  let passedOverall = true;
  if (
    overallScore < rubricConfig.overallPassThresholdPercent ||
    criticalFailuresCount > 0 ||
    mandatoryNosFailuresCount > 0
  ) {
    passedOverall = false;
  }

  // Derive bridge training recommendations for deficient NOS
  const recommendedBridgeTraining: BridgeTrainingRecommendation[] = [];
  for (const nosResult of nosScores) {
    if (!nosResult.passed) {
      const bridgeCourse = rubricConfig.bridgeTrainingMapping[nosResult.nosCode];
      if (bridgeCourse) {
        recommendedBridgeTraining.push({
          nosCode: nosResult.nosCode,
          moduleCode: bridgeCourse.moduleCode,
          title: bridgeCourse.title,
          hours: bridgeCourse.hours,
        });
      }
    }
  }

  return {
    overallScorePercent: overallScore,
    passedOverall,
    criticalFailuresCount,
    mandatoryNosFailuresCount,
    nosScores,
    demonstratedNos,
    competencyGaps,
    recommendedBridgeTraining,
  };
}

export function validateReviewerDecisionCompatibility(
  decision: 'recommended_full' | 'recommended_partial' | 'bridge_training_required' | 'not_recommended',
  scoringResult: AuthoritativeScoringResult
): { isValid: boolean; error?: string } {
  if (decision === 'recommended_full' && !scoringResult.passedOverall) {
    return {
      isValid: false,
      error: 'Decision Incompatibility: Cannot recommend full certification when candidate failed thresholds or critical criteria.',
    };
  }

  if (decision === 'recommended_partial' && scoringResult.demonstratedNos.length === 0) {
    return {
      isValid: false,
      error: 'Decision Incompatibility: Cannot recommend partial certification when zero NOS were demonstrated.',
    };
  }

  return { isValid: true };
}

export interface RubricConfig {
  rubric_id: string;
  version: string;
  level_multipliers: number[];
  descriptors: Record<number, string>;
}

export interface ScoreSubmissionItem {
  pc_id: string;
  score_level: number;
  notes?: string;
}

export interface AssessmentEvaluationResult {
  overall_score: number;
  passed: boolean;
  critical_safety_failed: boolean;
  nos_results: Array<{
    nos_code: string;
    nos_name: string;
    score: number;
    weight: number;
    passed: boolean;
  }>;
  gap_analysis: Array<{
    pc_id: string;
    pc_code: string;
    gap_severity: string;
    recommended_bridge_training: string;
  }>;
}

export function calculateAuthoritativeResults(
  qp: any,
  rubric: RubricConfig,
  submissions: ScoreSubmissionItem[]
): AssessmentEvaluationResult {
  const submissionMap = new Map(submissions.map(s => [s.pc_id, s.score_level]));
  let overallWeightedScore = 0;
  let criticalSafetyFailed = false;

  const nosResults = (qp.nos_list || []).map((nos: any) => {
    let earnedPoints = 0;
    let maxPoints = 0;

    for (const pc of nos.criteria || []) {
      const level = submissionMap.get(pc.id) ?? 0;
      const multiplier = rubric.level_multipliers[level] ?? 0;
      earnedPoints += multiplier * pc.max_score;
      maxPoints += pc.max_score;

      if (pc.is_critical_safety && level === 0) {
        criticalSafetyFailed = true;
      }
    }

    const nosScore = maxPoints > 0 ? (earnedPoints / maxPoints) * 100 : 0;
    const passed = nosScore >= (nos.pass_threshold_percent || 70);
    overallWeightedScore += nosScore * ((nos.weightage || 0) / 100);

    return {
      nos_code: nos.nos_code,
      nos_name: nos.nos_name,
      score: nosScore,
      weight: nos.weightage,
      passed
    };
  });

  const passedOverall = overallWeightedScore >= 70.0 && !criticalSafetyFailed && nosResults.every((n: any) => n.passed);

  const gapAnalysis: AssessmentEvaluationResult['gap_analysis'] = [];
  for (const nos of qp.nos_list || []) {
    for (const pc of nos.criteria || []) {
      const level = submissionMap.get(pc.id) ?? 0;
      if (level < 2) {
        gapAnalysis.push({
          pc_id: pc.id,
          pc_code: pc.pc_code,
          gap_severity: pc.is_critical_safety ? 'critical_safety_gap' : level === 0 ? 'high_gap' : 'moderate_gap',
          recommended_bridge_training: `Bridge Course: Module ${nos.nos_code} - Practical ${pc.pc_code}`
        });
      }
    }
  }

  return {
    overall_score: overallWeightedScore,
    passed: passedOverall,
    critical_safety_failed: criticalSafetyFailed,
    nos_results: nosResults,
    gap_analysis: gapAnalysis
  };
}

