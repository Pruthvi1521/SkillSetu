'use client';

import React, { useState } from 'react';
import { SAMPLE_ASSESSMENT, SAMPLE_SOLAR_QP, SAMPLE_RUBRIC } from '@/lib/data/sample-data';
import { PrintableDossier } from '@/components/report/PrintableDossier';
import { computeReportHash, CanonicalReportPayload } from '@/lib/security/canonical-report-hasher';
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Award,
  FileCheck,
  ArrowRight,
  UserCheck,
  Sparkles,
  HelpCircle,
  FileText
} from 'lucide-react';

export default function ReviewerDashboardPage() {
  const [selectedDecision, setSelectedDecision] = useState<'recommended_full' | 'recommended_bridge_training' | 'not_recommended'>('recommended_full');
  const [reviewerRemarks, setReviewerRemarks] = useState(
    'Candidate demonstrated thorough adherence to safety disconnect rules, MC4 crimping tolerances, and Voc measurements. Recommended for official NSQF Level 4 certification.'
  );
  const [signedDossier, setSignedDossier] = useState<{
    payload: CanonicalReportPayload;
    reportHash: string;
  } | null>(null);

  // Sample assessment evaluation stats
  const overallScore = 80.5;
  const criticalSafetyFailed = false;

  // Decision compatibility rules
  const canRecommendFull = overallScore >= 70.0 && !criticalSafetyFailed;

  const handleSignOff = () => {
    if (selectedDecision === 'recommended_full' && !canRecommendFull) {
      alert('Cannot recommend full certification: overall score is below 70% or critical safety standard failed.');
      return;
    }

    const payload: CanonicalReportPayload = {
      schema_version: '1.0.0',
      assessment_id: SAMPLE_ASSESSMENT.id,
      worker_id: SAMPLE_ASSESSMENT.worker_id,
      assessor_id: 'e1000000-0000-0000-0000-000000000001',
      reviewer_id: 'r1000000-0000-0000-0000-000000000001',
      qualification_pack: {
        qp_code: SAMPLE_SOLAR_QP.qp_code,
        version: SAMPLE_SOLAR_QP.version,
        provenance: SAMPLE_SOLAR_QP.provenance
      },
      rubric: {
        rubric_id: SAMPLE_RUBRIC.rubric_id,
        version: SAMPLE_RUBRIC.version
      },
      nos_results: [
        {
          nos_code: 'ELE/N5901',
          nos_name: 'Site Survey and Planning',
          score: 83.3,
          weight: 30,
          passed: true
        },
        {
          nos_code: 'ELE/N5902',
          nos_name: 'Panel Mounting and Electrical Cabling',
          score: 80.0,
          weight: 40,
          passed: true
        },
        {
          nos_code: 'ELE/N5903',
          nos_name: 'Testing, Commissioning and Grid Sync',
          score: 78.5,
          weight: 30,
          passed: true
        }
      ],
      criterion_scores: [
        { pc_id: 'pc-1', pc_code: 'PC1.1', score_level: 2, points: 20.1, max_score: 30, is_critical_safety: false },
        { pc_id: 'pc-2', pc_code: 'PC1.2', score_level: 2, points: 13.4, max_score: 20, is_critical_safety: false },
        { pc_id: 'pc-3', pc_code: 'PC2.1', score_level: 3, points: 25.0, max_score: 25, is_critical_safety: false },
        { pc_id: 'pc-4', pc_code: 'PC2.2', score_level: 2, points: 16.75, max_score: 25, is_critical_safety: true },
        { pc_id: 'pc-5', pc_code: 'PC3.1', score_level: 2, points: 16.75, max_score: 25, is_critical_safety: true },
        { pc_id: 'pc-6', pc_code: 'PC3.2', score_level: 2, points: 16.75, max_score: 25, is_critical_safety: false }
      ],
      summary: {
        overall_score: overallScore,
        passed: true,
        critical_safety_failed: false,
        final_decision: selectedDecision
      },
      evidence_digests: [
        {
          evidence_id: 'ev-photo-01',
          sha256_hash: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08'
        }
      ],
      generated_at: new Date().toISOString()
    };

    const hash = computeReportHash(payload);
    setSignedDossier({
      payload,
      reportHash: hash
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 no-print">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <UserCheck className="w-3.5 h-3.5" />
            <span>Phase 4 • Reviewer Verification & Diagnostic Dossier</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-2 tracking-tight">
            Sector Skill Council Reviewer Workspace
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Validate assessor scoring, enforce decision compatibility, and issue verifiable diagnostic dossiers.
          </p>
        </div>
      </div>

      {signedDossier ? (
        <div className="space-y-6">
          <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs flex items-center justify-between no-print shadow-xs">
            <div className="flex items-center gap-2 font-medium">
              <CheckCircle2 className="w-4 h-4 text-indigo-600" />
              <span>Dossier successfully signed by Lead Reviewer with cryptographic SHA-256 seal.</span>
            </div>
            <button
              onClick={() => setSignedDossier(null)}
              className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold border border-slate-300 shadow-xs transition-colors"
            >
              Modify Review Remarks
            </button>
          </div>

          <PrintableDossier
            payload={signedDossier.payload}
            reportHash={signedDossier.reportHash}
            candidateName={SAMPLE_ASSESSMENT.worker_name}
            assessorName={SAMPLE_ASSESSMENT.assessor_name}
            reviewerName={SAMPLE_ASSESSMENT.reviewer_name}
            reviewerComments={reviewerRemarks}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Assessment Review Summary */}
          <div className="lg:col-span-2 space-y-6">
            <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wide">Candidate Evaluation File</div>
                  <h3 className="text-xl font-bold text-slate-900 mt-0.5">
                    {SAMPLE_ASSESSMENT.worker_name}
                  </h3>
                </div>
                <div className="text-left sm:text-right">
                  <div className="text-2xl font-black text-indigo-700">
                    {overallScore}%
                  </div>
                  <div className="text-xs text-slate-500 font-medium">Authoritative Score</div>
                </div>
              </div>

              {/* Assessment Metadata Details */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-500 block text-[11px] font-medium">Qualification Pack</span>
                  <span className="text-slate-900 font-semibold">{SAMPLE_ASSESSMENT.qp_name}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px] font-medium">QP Code / Level</span>
                  <span className="text-slate-900 font-semibold">{SAMPLE_ASSESSMENT.qp_code} (Level {SAMPLE_ASSESSMENT.nsqf_level})</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px] font-medium">Lead Assessor</span>
                  <span className="text-slate-900 font-semibold">{SAMPLE_ASSESSMENT.assessor_name}</span>
                </div>
              </div>

              {/* Reviewer Sign-off Form */}
              <div className="space-y-4 pt-2 border-t border-slate-100">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-indigo-700" />
                  <span>Reviewer Decision Sign-Off</span>
                </h4>

                {/* Decision Radio Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      selectedDecision === 'recommended_full'
                        ? 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-500/20 text-slate-900 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="decision"
                      value="recommended_full"
                      checked={selectedDecision === 'recommended_full'}
                      onChange={() => setSelectedDecision('recommended_full')}
                      className="sr-only"
                    />
                    <div className="font-bold text-xs flex items-center gap-1.5 text-emerald-800">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Recommended Full</span>
                    </div>
                    <div className="text-[11px] text-slate-600 mt-1 leading-normal font-normal">
                      Score &ge; 70%, all NOS passed, zero critical safety flags.
                    </div>
                  </label>

                  <label
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      selectedDecision === 'recommended_bridge_training'
                        ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-500/20 text-slate-900 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="decision"
                      value="recommended_bridge_training"
                      checked={selectedDecision === 'recommended_bridge_training'}
                      onChange={() => setSelectedDecision('recommended_bridge_training')}
                      className="sr-only"
                    />
                    <div className="font-bold text-xs flex items-center gap-1.5 text-amber-900">
                      <Award className="w-4 h-4 text-amber-700" />
                      <span>Bridge Training</span>
                    </div>
                    <div className="text-[11px] text-slate-600 mt-1 leading-normal font-normal">
                      Targeted 2-4 week bridge training course for partial competency gaps.
                    </div>
                  </label>

                  <label
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      selectedDecision === 'not_recommended'
                        ? 'bg-red-50 border-red-400 ring-2 ring-red-500/20 text-slate-900 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="decision"
                      value="not_recommended"
                      checked={selectedDecision === 'not_recommended'}
                      onChange={() => setSelectedDecision('not_recommended')}
                      className="sr-only"
                    />
                    <div className="font-bold text-xs flex items-center gap-1.5 text-red-900">
                      <AlertTriangle className="w-4 h-4 text-red-700" />
                      <span>Not Recommended</span>
                    </div>
                    <div className="text-[11px] text-slate-600 mt-1 leading-normal font-normal">
                      Critical safety failure or overall score below threshold.
                    </div>
                  </label>
                </div>

                {/* Formal Remarks */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Formal Reviewer Assessment Remarks & Evidence Verification
                  </label>
                  <textarea
                    rows={3}
                    value={reviewerRemarks}
                    onChange={e => setReviewerRemarks(e.target.value)}
                    className="w-full p-3 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 transition-shadow leading-relaxed"
                  />
                </div>

                {/* Sign and Seal Button */}
                <div className="pt-2 flex justify-end">
                  <button
                    onClick={handleSignOff}
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold bg-indigo-700 hover:bg-indigo-800 text-white transition-colors shadow-sm"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Sign & Seal Verifiable Diagnostic Dossier</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Decision Compatibility Rules Sidebar */}
          <div className="space-y-6">
            <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-sm space-y-4">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-indigo-700" />
                <span>Decision Compatibility Matrix</span>
              </h4>

              <div className="space-y-3 text-xs text-slate-700">
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 space-y-1">
                  <div className="font-bold text-emerald-900">Rule 1: Full Qualification</div>
                  <p className="text-[11px] text-emerald-800 leading-normal">
                    Allowed only when score &ge; 70.0%, all mandatory NOS pass, and zero critical safety failures occurred.
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 space-y-1">
                  <div className="font-bold text-amber-950">Rule 2: Bridge Training</div>
                  <p className="text-[11px] text-amber-900 leading-normal">
                    Recommended when candidate has overall 50.0%-69.9% or passed core NOS but requires refresher modules.
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-red-50 border border-red-200 space-y-1">
                  <div className="font-bold text-red-950">Rule 3: Safety Veto</div>
                  <p className="text-[11px] text-red-900 leading-normal">
                    If any critical safety criterion is Level 0, &ldquo;Not Recommended&rdquo; is strictly enforced by the database.
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-500 space-y-1">
                <div className="font-semibold text-slate-700">Assistive Authority Notice:</div>
                <p className="text-[11px] leading-relaxed">
                  The decision matrix is enforced server-side. Reviewers cannot grant full certification to non-compliant candidates.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
