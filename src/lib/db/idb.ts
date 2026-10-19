import Dexie, { Table } from 'dexie';

export interface LocalDraftDeclaration {
  id: string; // client uuid
  trade_category: string;
  years_experience: number;
  work_history: string;
  tools_used: string[];
  tasks_performed: string[];
  target_qp_code?: string;
  is_synced: boolean;
  updated_at: string;
}

export interface LocalAssessment {
  id: string;
  worker_id: string;
  worker_name?: string;
  qp_id: string;
  qp_code: string;
  qp_version: string;
  rubric_id: string;
  rubric_version: string;
  status: string;
  version: number;
  overall_score?: number;
  synced_at: string;
}

export interface LocalScoreRecord {
  id?: number;
  assessment_id: string;
  pc_id: string;
  score_level: number;
  notes?: string;
  exception_reason?: string;
  client_timestamp: string;
}

export interface MutationQueueItem {
  id?: number;
  client_sync_id: string;
  idempotency_key: string;
  operation: 'submit_scores' | 'submit_declaration' | 'signoff_assessment';
  assessment_id?: string;
  payload: Record<string, unknown>;
  status: 'pending' | 'in_flight' | 'synced' | 'conflict' | 'failed';
  retry_count: number;
  error_message?: string;
  created_at: string;
}

export interface CachedQP {
  id: string;
  qp_code: string;
  qp_name: string;
  nsqf_level: number;
  version: string;
  provenance: string;
  nos_list: Array<{
    nos_code: string;
    nos_name: string;
    weightage: number;
    pass_threshold_percent: number;
    criteria: Array<{
      id: string;
      pc_code: string;
      pc_description: string;
      max_score: number;
      is_critical_safety: boolean;
    }>;
  }>;
}

export class SkillSetuDatabase extends Dexie {
  draft_declarations!: Table<LocalDraftDeclaration, string>;
  offline_assessments!: Table<LocalAssessment, string>;
  offline_scores!: Table<LocalScoreRecord, number>;
  mutation_queue!: Table<MutationQueueItem, number>;
  cached_qps!: Table<CachedQP, string>;

  constructor() {
    super('SkillSetuLocalDB');
    this.version(1).stores({
      draft_declarations: 'id, trade_category, is_synced, updated_at',
      offline_assessments: 'id, worker_id, qp_code, status',
      offline_scores: '++id, [assessment_id+pc_id], assessment_id',
      mutation_queue: '++id, client_sync_id, idempotency_key, status, operation',
      cached_qps: 'id, qp_code, nsqf_level'
    });
  }
}

export const localDb = new SkillSetuDatabase();
