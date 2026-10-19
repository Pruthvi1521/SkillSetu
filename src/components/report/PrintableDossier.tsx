'use client';

import React from 'react';
import { CanonicalReportPayload } from '@/lib/security/canonical-report-hasher';
import { ShieldCheck, AlertTriangle, Printer, CheckCircle, FileText, Info } from 'lucide-react';
import { SkillSetuEmblem } from '@/components/common/SkillSetuLogo';

export interface PrintableDossierProps {
  payload: CanonicalReportPayload;
  reportHash: string;
  candidateName: string;
  assessorName: string;
  reviewerName: string;
  reviewerComments: string;
}

export function PrintableDossier({
  payload,
  reportHash,
  candidateName,
  assessorName,
  reviewerName,
  reviewerComments
}: PrintableDossierProps) {
  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  return (
    <div className="space-y-6">
      {/* Screen Action Bar */}
      <div className="flex items-center justify-between no-print p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 text-sm text-slate-700 font-medium">
          <FileText className="w-4 h-4 text-indigo-700" />
          <span>Verifiable Canonical Dossier Ready for Review</span>
        </div>
        <button
          onClick={handlePrint}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-700 text-white hover:bg-indigo-800 transition-colors shadow-sm"
        >
          <Printer className="w-4 h-4" />
          <span>Print / Export PDF Dossier</span>
        </button>
      </div>

      {/* Official NSQF Printable Sheet Container */}
      <div className="dossier-card bg-white border border-slate-200 rounded-2xl p-8 sm:p-12 space-y-8 text-slate-800 shadow-sm">
        {/* Document Header */}
        <div className="border-b-2 border-slate-200 pb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <SkillSetuEmblem size="lg" className="mt-1 shadow-sm shrink-0" />
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-indigo-700">
                National Skills Qualification Framework (NSQF) • RPL Protocol
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 mt-1">
                Prior Learning Assessment & Competency Diagnostic Dossier
              </h1>
              <div className="text-xs text-slate-500 mt-1 font-mono">
                Assessment ID: <span className="text-slate-800 font-semibold">{payload.assessment_id}</span>
              </div>
            </div>
          </div>

          <div className="text-left sm:text-right">
            <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase bg-amber-50 text-amber-800 border border-amber-300">
              {payload.qualification_pack.provenance === 'synthetic_demo' ? 'DEMO BENCHMARK DATA' : payload.qualification_pack.provenance}
            </span>
            <div className="text-xs text-slate-500 mt-1.5 font-medium">
              Issued: {new Date(payload.generated_at).toLocaleDateString()}
            </div>
          </div>
        </div>

        {/* Statutory RPL Notice */}
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 space-y-1">
          <div className="font-bold flex items-center gap-1.5 text-amber-900">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
            <span>STATUTORY RPL NOTICE & ASSISTIVE GOVERNANCE BOUNDARY</span>
          </div>
          <p className="text-[11px] text-amber-900 leading-relaxed font-normal">
            This document records prior learning assessment observations conducted under authorized Sector Skill Council protocols.
            SkillSetu provides advisory gap diagnostic tools and scoring assistance. 
            All official vocational certifications remain strictly subject to human assessor verification and formal Council sign-off.
          </p>
        </div>

        {/* Candidate & Assessment Metadata */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
          <div>
            <span className="text-slate-500 block text-[11px] font-medium">Candidate Name</span>
            <strong className="text-slate-900 text-sm font-bold">{candidateName}</strong>
          </div>
          <div>
            <span className="text-slate-500 block text-[11px] font-medium">Qualification Pack</span>
            <strong className="text-slate-900 text-sm font-bold">{payload.qualification_pack.qp_code} v{payload.qualification_pack.version}</strong>
          </div>
          <div>
            <span className="text-slate-500 block text-[11px] font-medium">Lead Assessor</span>
            <strong className="text-slate-900 text-sm font-bold">{assessorName}</strong>
          </div>
          <div>
            <span className="text-slate-500 block text-[11px] font-medium">Reviewer Sign-Off</span>
            <strong className="text-slate-900 text-sm font-bold">{reviewerName}</strong>
          </div>
        </div>

        {/* Executive Summary */}
        <div className="p-6 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Executive Competency Determination
          </h3>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="text-3xl font-black text-slate-900">
                {payload.summary.overall_score.toFixed(1)}%
              </div>
              <div className="text-xs text-slate-500 mt-0.5 font-medium">
                Authoritative Weighted NOS Score (Threshold: 70.0%)
              </div>
            </div>

            <div>
              <div className="text-xs text-slate-500 font-medium">Final Decision:</div>
              <div className="text-base font-bold text-emerald-700 uppercase tracking-wide">
                {payload.summary.final_decision.replace(/_/g, ' ')}
              </div>
            </div>

            <div>
              <div className="text-xs text-slate-500 font-medium">Safety Standard:</div>
              <div className={`text-sm font-bold uppercase ${
                payload.summary.critical_safety_failed ? 'text-red-700' : 'text-emerald-700'
              }`}>
                {payload.summary.critical_safety_failed ? 'Safety Veto Failed' : 'Compliant'}
              </div>
            </div>
          </div>
        </div>

        {/* NOS Results Table */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            National Occupational Standard (NOS) Evaluation Breakdown
          </h3>
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 font-semibold">
                <tr>
                  <th className="p-3">NOS Code</th>
                  <th className="p-3">Occupational Standard Description</th>
                  <th className="p-3 text-center">Weight</th>
                  <th className="p-3 text-center">Score</th>
                  <th className="p-3 text-right">Outcome</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {payload.nos_results.map(nos => (
                  <tr key={nos.nos_code} className="hover:bg-slate-50/50">
                    <td className="p-3 font-mono text-indigo-700 font-bold">{nos.nos_code}</td>
                    <td className="p-3 text-slate-900 font-medium">{nos.nos_name}</td>
                    <td className="p-3 text-center text-slate-600">{nos.weight}%</td>
                    <td className="p-3 text-center font-bold text-slate-900">{nos.score.toFixed(1)}%</td>
                    <td className="p-3 text-right">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        nos.passed ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
                      }`}>
                        {nos.passed ? 'Pass' : 'Fail'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Criterion Breakdown */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Performance Criteria Observations & Scoring
          </h3>
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 font-semibold">
                <tr>
                  <th className="p-3">PC Code</th>
                  <th className="p-3 text-center">Rubric Level</th>
                  <th className="p-3 text-center">Points Awarded</th>
                  <th className="p-3 text-center">Max Points</th>
                  <th className="p-3 text-right">Safety Standard</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {payload.criterion_scores.map(pc => (
                  <tr key={pc.pc_id} className="hover:bg-slate-50/50">
                    <td className="p-3 font-mono font-medium text-slate-800">{pc.pc_code}</td>
                    <td className="p-3 text-center font-bold text-slate-900">Level {pc.score_level}</td>
                    <td className="p-3 text-center text-indigo-700 font-bold">{pc.points.toFixed(1)}</td>
                    <td className="p-3 text-center text-slate-600">{pc.max_score}</td>
                    <td className="p-3 text-right">
                      {pc.is_critical_safety ? (
                        <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-red-50 text-red-700 border border-red-200">
                          Critical Safety
                        </span>
                      ) : (
                        <span className="text-slate-500 text-[11px]">Standard</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Reviewer Comments */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
          <div className="font-bold text-slate-900">Authorized Reviewer Formal Remarks:</div>
          <p className="text-slate-700 italic leading-relaxed">
            &ldquo;{reviewerComments || 'Candidate demonstrated consistent compliance with NSQF level 4 standards in solar PV array assembly and electrical safety tests. Fully approved for RPL certification.'}&rdquo;
          </p>
        </div>

        {/* Digital Signature & Integrity Block */}
        <div className="border-t border-slate-200 pt-6 space-y-3 font-mono text-xs text-slate-600">
          <div className="flex items-center gap-2 text-indigo-700 font-sans font-bold">
            <ShieldCheck className="w-4 h-4 text-indigo-700" />
            <span>Cryptographic SHA-256 Audit Seal</span>
          </div>
          <div className="break-all bg-slate-50 p-3.5 rounded-lg border border-slate-300 text-slate-800 text-[11px] font-mono select-all">
            {reportHash}
          </div>
          <div className="text-[11px] text-slate-500 font-sans leading-normal">
            <strong>Authenticity & Integrity Notice:</strong> This canonical SHA-256 digest is calculated deterministically from RFC 8785 canonical JSON keys.
            The hash guarantees data immutability and report tamper-detection; independent verification of physical evidence documents remains with authorized human assessors.
          </div>
        </div>
      </div>
    </div>
  );
}
