import { z } from 'zod';

export const PerformanceCriterionSchema = z.object({
  id: z.string().uuid().optional(),
  pc_code: z.string().min(2),
  pc_description: z.string().min(5),
  max_score: z.number().positive(),
  is_critical_safety: z.boolean().default(false),
  mandatory: z.boolean().default(true)
});

export const NationalOccupationalStandardSchema = z.object({
  id: z.string().uuid().optional(),
  nos_code: z.string().min(3),
  nos_name: z.string().min(3),
  nos_type: z.enum(['core', 'non_core', 'generic']),
  weightage: z.number().positive().max(100),
  pass_threshold_percent: z.number().min(0).max(100).default(70),
  criteria: z.array(PerformanceCriterionSchema).min(1, 'NOS must have at least one performance criterion')
});

export const QualificationPackSchema = z.object({
  id: z.string().uuid().optional(),
  qp_code: z.string().regex(/^[A-Z]{3}\/Q[0-9]{4}$/, 'Invalid QP code format (e.g., ELE/Q5901)'),
  qp_name: z.string().min(3),
  nsqf_level: z.number().int().min(1).max(8),
  version: z.string().regex(/^\d+\.\d+(\.\d+)?$/, 'Version must be semver or x.y (e.g. 1.0)'),
  provenance: z.enum(['official_gazetted', 'synthetic_demo']),
  gazette_notification_number: z.string().optional().nullable(),
  official_source_url: z.string().url().optional().nullable(),
  nos_list: z.array(NationalOccupationalStandardSchema).min(1, 'Qualification pack must have at least one NOS')
}).refine(data => {
  if (data.provenance === 'official_gazetted') {
    return !!data.gazette_notification_number && !!data.official_source_url;
  }
  return true;
}, {
  message: 'Official gazetted QPs must have gazette_notification_number and valid official_source_url',
  path: ['provenance']
}).refine(data => {
  const totalWeight = data.nos_list.reduce((sum, nos) => sum + nos.weightage, 0);
  return Math.abs(totalWeight - 100) < 0.001;
}, {
  message: 'Sum of all NOS weightages must equal exactly 100%',
  path: ['nos_list']
});

export type QualificationPackInput = z.infer<typeof QualificationPackSchema>;

export function validateQualificationPack(qp: unknown): {
  success: boolean;
  errors?: string[];
  data?: QualificationPackInput;
} {
  const result = QualificationPackSchema.safeParse(qp);
  if (!result.success) {
    return {
      success: false,
      errors: result.error.errors.map(err => `${err.path.join('.')}: ${err.message}`)
    };
  }
  return {
    success: true,
    data: result.data
  };
}
