'use client';

import React, { useState, useEffect } from 'react';
import { SAMPLE_SOLAR_QP, SAMPLE_RUBRIC, SAMPLE_ASSESSMENT } from '@/lib/data/sample-data';
import { calculateAuthoritativeResults, ScoreSubmissionItem, AssessmentEvaluationResult } from '@/lib/scoring/rubric-engine';
import { localDb } from '@/lib/db/idb';
import { syncEngine } from '@/lib/sync/sync-engine';
import {
  ClipboardCheck,
  AlertTriangle,
  CheckCircle2,
  Save,
  Send,
  ShieldAlert,
  Info,
  Camera,
  FileCheck,
  User,
  ArrowRight,
  ShieldCheck,
  Clock,
  Sparkles
} from 'lucide-react';

export default function AssessorRubricPage({ params }: { params: { id: string } }) {
  // Extract all criteria into a flat array for iteration
  const allCriteria = SAMPLE_SOLAR_QP.nos_list.flatMap(nos =>
    nos.criteria.map(pc => ({
      ...pc,
      nos_code: nos.nos_code,
      nos_name: nos.nos_name,
      nos_weight: nos.weightage,
      nos_pass_threshold: nos.pass_threshold_percent
    }))
  );

  // Score states: pc_id -> { score_level: number, notes: string }
  const [scores, setScores] = useState<Record<string, { score_level: number; notes: string }>>({
    'p0000000-0000-0000-0000-000000000001': { score_level: 2, notes: 'Followed safety ladder setup; good roof load estimation.' },
    'p0000000-0000-0000-0000-000000000002': { score_level: 2, notes: 'Accurate DC conduit routing layout.' },
    'p0000000-0000-0000-0000-000000000003': { score_level: 3, notes: 'Fast and compliant torque wrench execution.' },
    'p0000000-0000-0000-0000-000000000004': { score_level: 2, notes: 'Correct MC4 crimp and polarity inspection.' },
    'p0000000-0000-0000-0000-000000000005': { score_level: 2, notes: 'Voc and Isc measured within 5% tolerance.' },
    'p0000000-0000-0000-0000-000000000006': { score_level: 2, notes: 'Earth fault indicator light verified.' }
  });

  const [evaluation, setEvaluation] = useState<AssessmentEvaluationResult | null>(null);
  const [isSavedLocally, setIsSavedLocally] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedStatus, setSubmittedStatus] = useState<string | null>(null);

  // Compute live score evaluation whenever scores change
  useEffect(() => {
    const submissionList: ScoreSubmissionItem[] = Object.entries(scores).map(([pc_id, val]) => ({
      pc_id,
      score_level: val.score_level,
      notes: val.notes
    }));

    try {
      const res = calculateAuthoritativeResults(SAMPLE_SOLAR_QP, SAMPLE_RUBRIC, submissionList);
      setEvaluation(res);
    } catch (e) {
      console.error('Calculation error', e);
    }
  }, [scores]);

  const handleLevelSelect = (pcId: string, level: number) => {
    setScores(prev => ({
      ...prev,
      [pcId]: {
        score_level: level,
        notes: prev[pcId]?.notes || ''
      }
    }));
    setIsSavedLocally(false);
  };

  const handleNotesChange = (pcId: string, notes: string) => {
    setScores(prev => ({
      ...prev,
      [pcId]: {
        score_level: prev[pcId]?.score_level ?? 2,
        notes
      }
    }));
    setIsSavedLocally(false);
  };

  const handleSaveDraft = async () => {
    try {
      for (const [pcId, val] of Object.entries(scores)) {
        await localDb.offline_scores.put({
          assessment_id: SAMPLE_ASSESSMENT.id,
          pc_id: pcId,
          score_level: val.score_level,
          notes: val.notes,
          client_timestamp: new Date().toISOString()
        });
      }
      setIsSavedLocally(true);
    } catch (err) {
      console.error('Failed to save scores locally', err);
    }
  };

  const handleSubmitAssessment = async () => {
    if (!evaluation) return;
    setIsSubmitting(true);

    try {
      const payload = {
        assessment_id: SAMPLE_ASSESSMENT.id,
        version: SAMPLE_ASSESSMENT.version,
        scores: Object.entries(scores).map(([pc_id, val]) => ({
          pc_id,
          score_level: val.score_level,
          notes: val.notes
        })),
        summary: {
          overall_score: evaluation.overall_score,
          passed: evaluation.passed,
          critical_safety_failed: evaluation.critical_safety_failed
        }
      };

      await syncEngine.enqueueMutation('submit_scores', payload, SAMPLE_ASSESSMENT.id);
      setSubmittedStatus('Assessment submitted successfully to Reviewer Portal.');
    } catch (err) {
      console.error('Submission failed', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const completedCount = Object.keys(scores).length;
  const totalCount = allCriteria.length;
  const isComplete = completedCount === totalCount;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header & Meta */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <ClipboardCheck className="w-3.5 h-3.5" />
            <span>Phase 3 • Standardized Practical Assessment</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-2 tracking-tight">
            Assessor Practical Scoring Sheet
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-2">
            <span>Candidate: <strong className="font-semibold text-slate-800">{SAMPLE_ASSESSMENT.worker_name}</strong></span>
            <span>•</span>
            <span>Qualification: <strong className="font-semibold text-slate-800">{SAMPLE_ASSESSMENT.qp_name} ({SAMPLE_ASSESSMENT.qp_code})</strong></span>
            <span>•</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-300">
              {SAMPLE_SOLAR_QP.provenance === 'synthetic_demo' ? 'DEMO BENCHMARK DATA' : SAMPLE_SOLAR_QP.provenance}
            </span>
            <span>•</span>
            <span>Assessor: <strong className="font-semibold text-slate-800">{SAMPLE_ASSESSMENT.assessor_name}</strong></span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleSaveDraft}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold bg-white text-slate-700 hover:bg-slate-50 transition-colors border border-slate-300 shadow-xs"
          >
            <Save className={`w-3.5 h-3.5 ${isSavedLocally ? 'text-emerald-600' : 'text-slate-500'}`} />
            <span>{isSavedLocally ? 'Scores Cached Offline' : 'Cache Scores (Offline)'}</span>
          </button>

          <button
            type="button"
            disabled={!isComplete || isSubmitting}
            onClick={handleSubmitAssessment}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-700 text-white hover:bg-indigo-800 transition-colors disabled:opacity-50 shadow-sm"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{isSubmitting ? 'Submitting...' : 'Submit to Reviewer'}</span>
          </button>
        </div>
      </div>

      {submittedStatus && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span>{submittedStatus}</span>
          </div>
          <a
            href="/reviewer/dashboard"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-700 text-white hover:bg-emerald-800 transition-colors shadow-xs"
          >
            <span>Go to Reviewer Sign-Off</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </a>
        </div>
      )}

      {/* Critical Safety Veto Banner */}
      {evaluation?.critical_safety_failed && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 text-sm flex items-start gap-3 shadow-xs">
          <ShieldAlert className="w-5 h-5 text-red-700 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-red-950 uppercase tracking-wide text-xs">
              MANDATORY STATUTORY SAFETY VETO TRIGGERED
            </div>
            <div className="text-xs text-red-800 mt-1 leading-relaxed">
              One or more Critical Safety Criteria have been scored at Level 0 (Unsatisfactory / Danger).
              Under NSQF Section 4.2 guidelines, this constitutes an absolute veto on certification regardless of overall percentage.
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
        {/* Rubric Evaluation List */}
        <div className="lg:col-span-3 space-y-6">
          {SAMPLE_SOLAR_QP.nos_list.map((nos, nIndex) => (
            <div key={nos.nos_code} className="p-6 rounded-xl bg-white border border-slate-200 shadow-sm space-y-6">
              {/* NOS Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
                <div>
                  <div className="text-xs font-bold text-indigo-700 uppercase tracking-wide">
                    NOS {nIndex + 1}: {nos.nos_code}
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mt-0.5">
                    {nos.nos_name}
                  </h3>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2.5 py-1 rounded bg-slate-100 text-slate-700 font-semibold border border-slate-200">
                    Weight: {nos.weightage}%
                  </span>
                  <span className="px-2.5 py-1 rounded bg-slate-100 text-slate-700 font-semibold border border-slate-200">
                    Pass Threshold: {nos.pass_threshold_percent}%
                  </span>
                </div>
              </div>

              {/* Performance Criteria in this NOS */}
              <div className="space-y-5">
                {nos.criteria.map(pc => {
                  const currentScore = scores[pc.id]?.score_level ?? 2;
                  const currentNotes = scores[pc.id]?.notes ?? '';

                  return (
                    <div
                      key={pc.id}
                      className={`p-4 rounded-xl border transition-all ${
                        pc.is_critical_safety && currentScore === 0
                          ? 'bg-red-50/60 border-red-300'
                          : 'bg-slate-50/60 border-slate-200'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-3">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-white text-indigo-700 border border-slate-200">
                              {pc.pc_code}
                            </span>
                            {pc.is_critical_safety && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] uppercase font-bold bg-red-100 text-red-800 border border-red-300">
                                Critical Safety Criterion
                              </span>
                            )}
                            <span className="text-xs text-slate-500 font-medium">
                              Max Points: {pc.max_score}
                            </span>
                          </div>
                          <p className="text-sm font-medium text-slate-900 leading-snug pt-1">
                            {pc.pc_description}
                          </p>
                        </div>
                      </div>

                      {/* 4-Level Standardized Rubric Buttons */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                        {[0, 1, 2, 3].map(level => {
                          const isSelected = currentScore === level;
                          const descriptor = SAMPLE_RUBRIC.descriptors[level];

                          let buttonStyle = 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300';
                          if (isSelected) {
                            if (level === 0) {
                              buttonStyle = 'bg-red-50 border-red-400 text-red-900 ring-2 ring-red-500/20 shadow-xs';
                            } else if (level === 1) {
                              buttonStyle = 'bg-amber-50 border-amber-400 text-amber-900 ring-2 ring-amber-500/20 shadow-xs';
                            } else if (level === 2) {
                              buttonStyle = 'bg-indigo-50 border-indigo-400 text-indigo-950 ring-2 ring-indigo-500/20 shadow-xs';
                            } else {
                              buttonStyle = 'bg-emerald-50 border-emerald-400 text-emerald-950 ring-2 ring-emerald-500/20 shadow-xs';
                            }
                          }

                          return (
                            <button
                              key={level}
                              type="button"
                              onClick={() => handleLevelSelect(pc.id, level)}
                              className={`p-3 rounded-lg text-left border transition-all ${buttonStyle}`}
                            >
                              <div className="flex items-center justify-between font-bold text-xs">
                                <span>Level {level}</span>
                                <span className="text-[11px] font-semibold opacity-75">{SAMPLE_RUBRIC.level_multipliers[level] * 100}%</span>
                              </div>
                              <div className="text-[11px] opacity-80 mt-1 line-clamp-2 leading-tight">
                                {descriptor}
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {/* Assessor Observation / Evidence Notes */}
                      <div className="mt-3 pt-3 border-t border-slate-200/80 flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Observation notes, measurements, or safety deviation..."
                          value={currentNotes}
                          onChange={e => handleNotesChange(pc.id, e.target.value)}
                          className="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 placeholder-slate-400 transition-shadow"
                        />
                        <button
                          type="button"
                          title="Attach Photo/Video Evidence"
                          className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-600 border border-slate-300 text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
                        >
                          <Camera className="w-3.5 h-3.5 text-slate-500" />
                          <span>Attach</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Live Authoritative Score Calculation Sidebar */}
        <div className="space-y-6">
          <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-sm sticky top-24 space-y-6">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-indigo-700" />
                <span>Advisory Score Preview</span>
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Client preview • Official calculation derived server-side
              </p>
            </div>

            {/* Overall Score Meter */}
            <div className="space-y-2">
              <div className="flex justify-between items-baseline">
                <span className="text-xs font-medium text-slate-600">Calculated Score</span>
                <span className={`text-2xl font-black ${
                  evaluation?.passed ? 'text-emerald-700' : 'text-red-700'
                }`}>
                  {evaluation ? evaluation.overall_score.toFixed(1) : 0}%
                </span>
              </div>
              <div className="h-2.5 w-full bg-slate-100 border border-slate-200 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 rounded-full ${
                    evaluation?.passed ? 'bg-emerald-600' : 'bg-red-600'
                  }`}
                  style={{ width: `${Math.min(100, evaluation?.overall_score || 0)}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-slate-500 font-medium">
                <span>Threshold: 70%</span>
                <span className={`font-bold ${evaluation?.passed ? 'text-emerald-700' : 'text-red-700'}`}>
                  {evaluation?.passed ? 'QUALIFIED' : 'NEEDS TRAINING'}
                </span>
              </div>
            </div>

            {/* NOS Breakdown */}
            <div className="space-y-3 pt-3 border-t border-slate-100">
              <div className="text-xs font-bold uppercase tracking-wide text-slate-700">
                NOS Breakdown
              </div>
              {evaluation?.nos_results.map(nos => (
                <div key={nos.nos_code} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-800 font-mono font-medium">{nos.nos_code}</span>
                    <span className={`font-bold ${nos.passed ? 'text-emerald-700' : 'text-red-700'}`}>
                      {nos.score.toFixed(1)}% ({nos.passed ? 'Pass' : 'Fail'})
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 border border-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${nos.passed ? 'bg-emerald-600' : 'bg-red-600'}`}
                      style={{ width: `${Math.min(100, nos.score)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Diagnostic Gap Detection */}
            <div className="space-y-2 pt-3 border-t border-slate-100">
              <div className="text-xs font-bold uppercase tracking-wide text-slate-700">
                Identified Skill Gaps ({evaluation?.gap_analysis.length || 0})
              </div>
              {evaluation?.gap_analysis.length === 0 ? (
                <div className="text-xs text-emerald-700 font-medium flex items-center gap-1.5 p-2 rounded-lg bg-emerald-50 border border-emerald-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>No competence gaps detected.</span>
                </div>
              ) : (
                <ul className="text-xs space-y-2 text-slate-600">
                  {evaluation?.gap_analysis.map(gap => (
                    <li key={gap.pc_id} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-mono font-bold text-slate-900">{gap.pc_code}</span>
                        <span className="uppercase text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-200">
                          {gap.gap_severity}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-snug">{gap.recommended_bridge_training}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Submission Progress */}
            <div className="pt-3 text-xs text-slate-500 border-t border-slate-100 flex justify-between items-center">
              <span>Criteria Evaluated:</span>
              <strong className="text-slate-900 font-bold">{completedCount} of {totalCount}</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
