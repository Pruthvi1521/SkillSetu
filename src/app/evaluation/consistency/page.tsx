'use client';

import React, { useState, useMemo } from 'react';
import {
  calculateCohensKappa,
  calculateQuadraticWeightedKappa,
  calculateFleissKappa,
  calculateICC21
} from '@/lib/evaluation/stats';
import {
  BarChart3,
  ShieldCheck,
  Info,
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Users,
  HelpCircle,
  Activity
} from 'lucide-react';

interface CandidateObservation {
  id: string;
  candidate_name: string;
  rater1: number; // 0, 1, 2, 3
  rater2: number;
  rater3: number;
}

const INITIAL_OBSERVATIONS: CandidateObservation[] = [
  { id: '1', candidate_name: 'Candidate #101 (Solar Rooftop)', rater1: 2, rater2: 2, rater3: 2 },
  { id: '2', candidate_name: 'Candidate #102 (Grid Sync Voc)', rater1: 3, rater2: 3, rater3: 2 },
  { id: '3', candidate_name: 'Candidate #103 (MC4 Crimping)', rater1: 1, rater2: 1, rater3: 1 },
  { id: '4', candidate_name: 'Candidate #104 (Earth Pit)', rater1: 2, rater2: 2, rater3: 2 },
  { id: '5', candidate_name: 'Candidate #105 (Inverter Wiring)', rater1: 0, rater2: 0, rater3: 1 },
  { id: '6', candidate_name: 'Candidate #106 (Safety Harness)', rater1: 2, rater2: 2, rater3: 2 },
  { id: '7', candidate_name: 'Candidate #107 (Conduit Route)', rater1: 3, rater2: 2, rater3: 3 },
  { id: '8', candidate_name: 'Candidate #108 (Load Check)', rater1: 1, rater2: 2, rater3: 1 }
];

export default function ConsistencyEvaluationPage() {
  const [observations, setObservations] = useState<CandidateObservation[]>(INITIAL_OBSERVATIONS);

  // Compute stats dynamically from the actual data
  const stats = useMemo(() => {
    const r1 = observations.map(o => o.rater1);
    const r2 = observations.map(o => o.rater2);
    const r3 = observations.map(o => o.rater3);

    // Cohen's Kappa between Rater 1 & Rater 2
    const unweighted = calculateCohensKappa(r1, r2);
    const quadratic = calculateQuadraticWeightedKappa(r1, r2, 3);

    // Fleiss' Kappa: convert raw levels to category-count matrix
    const NUM_CATEGORIES = 4;
    const fleissMatrix = observations.map(o => {
      const row = Array(NUM_CATEGORIES).fill(0);
      [o.rater1, o.rater2, o.rater3].forEach(level => { row[level]++; });
      return row;
    });
    const fleiss = calculateFleissKappa(fleissMatrix);

    // ICC(2,1): scoreMatrix[subject][rater]
    const iccMatrix = observations.map(o => [o.rater1, o.rater2, o.rater3]);
    const icc = calculateICC21(iccMatrix);

    // Distribution calculation across all ratings
    const counts = [0, 0, 0, 0];
    observations.forEach(o => {
      counts[o.rater1]++;
      counts[o.rater2]++;
      counts[o.rater3]++;
    });
    const totalRatings = observations.length * 3;

    return {
      unweighted,
      quadratic,
      fleiss,
      icc,
      sampleSize: observations.length,
      distribution: counts.map(c => ({ count: c, percent: Math.round((c / totalRatings) * 100) }))
    };
  }, [observations]);

  const handleRatingChange = (id: string, raterKey: 'rater1' | 'rater2' | 'rater3', val: number) => {
    setObservations(prev =>
      prev.map(item => (item.id === id ? { ...item, [raterKey]: val } : item))
    );
  };

  const getKappaInterpretation = (kappa: number | null | undefined): { text: string; bg: string; textCol: string } => {
    if (kappa === null || kappa === undefined || isNaN(kappa)) return { text: 'Undefined (Zero Variance)', bg: 'bg-amber-50 border-amber-200', textCol: 'text-amber-800' };
    if (kappa < 0.2) return { text: 'Slight Agreement', bg: 'bg-red-50 border-red-200', textCol: 'text-red-700' };
    if (kappa < 0.4) return { text: 'Fair Agreement', bg: 'bg-amber-50 border-amber-200', textCol: 'text-amber-800' };
    if (kappa < 0.6) return { text: 'Moderate Agreement', bg: 'bg-indigo-50 border-indigo-200', textCol: 'text-indigo-700' };
    if (kappa < 0.8) return { text: 'Substantial Agreement', bg: 'bg-emerald-50 border-emerald-200', textCol: 'text-emerald-700' };
    return { text: 'Almost Perfect Agreement', bg: 'bg-emerald-100 border-emerald-300', textCol: 'text-emerald-900' };
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Empirical Statistical Harness • Zero Hardcoded Claims</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-2 tracking-tight">
            Inter-Rater Reliability & Consistency Testbed
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Compute empirical Cohen&apos;s Kappa, Quadratic Weighted Kappa, Fleiss&apos; Kappa, and ICC(2,1) directly from multi-rater observation trials.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="px-3 py-1 rounded-full text-[10px] uppercase font-bold tracking-wider bg-amber-50 text-amber-800 border border-amber-300">
            SYNTHETIC BENCHMARK TRIAL DATA
          </span>
          <button
            onClick={() => setObservations(INITIAL_OBSERVATIONS)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold bg-white text-slate-700 hover:bg-slate-50 transition-colors border border-slate-300 shadow-xs"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
            <span>Reset Baseline Trials</span>
          </button>
        </div>
      </div>

      {/* Scientific Integrity Notice */}
      <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 space-y-1">
        <div className="font-bold text-amber-900 flex items-center gap-1.5">
          <Info className="w-4 h-4 text-amber-700 shrink-0" />
          <span>SCIENTIFIC INTEGRITY ENFORCEMENT</span>
        </div>
        <p className="text-[11px] text-amber-900 leading-relaxed font-normal">
          In strict compliance with NSQF evaluation rules, all predetermined or illustrative kappa claims have been eliminated from SkillSetu.
          Every metric below is computed dynamically using pure matrix mathematics from the active trial observation matrix (Sample Size N = {stats.sampleSize}).
        </p>
      </div>

      {/* Live Calculated Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Cohen's Unweighted Kappa */}
        <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-sm space-y-3 flex flex-col justify-between">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Cohen&apos;s Kappa</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Unweighted</span>
            </div>
            <div className="text-3xl font-black text-slate-900">
              {!stats.unweighted.isUndefined ? stats.unweighted.kappa.toFixed(3) : 'Undefined'}
            </div>
          </div>
          <div>
            <div className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${getKappaInterpretation(stats.unweighted.kappa).bg} ${getKappaInterpretation(stats.unweighted.kappa).textCol}`}>
              {getKappaInterpretation(stats.unweighted.kappa).text}
            </div>
            <div className="text-[11px] text-slate-500 pt-2 font-medium">
              Observed $P_o$: {!stats.unweighted.isUndefined ? (stats.unweighted.observedAgreement * 100).toFixed(1) : 'N/A'}% • Chance $P_e$: {!stats.unweighted.isUndefined ? (stats.unweighted.expectedAgreement * 100).toFixed(1) : 'N/A'}%
            </div>
          </div>
        </div>

        {/* Quadratic Weighted Kappa */}
        <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-sm space-y-3 flex flex-col justify-between">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Quadratic Weighted</span>
              <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-100 uppercase">
                $\kappa_w$ Ordinal
              </span>
            </div>
            <div className="text-3xl font-black text-indigo-700">
              {!stats.quadratic.isUndefined ? stats.quadratic.kappa.toFixed(3) : 'Undefined'}
            </div>
          </div>
          <div>
            <div className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${getKappaInterpretation(stats.quadratic.kappa).bg} ${getKappaInterpretation(stats.quadratic.kappa).textCol}`}>
              {getKappaInterpretation(stats.quadratic.kappa).text}
            </div>
            <div className="text-[11px] text-slate-500 pt-2 font-medium">
              Penalizes distance squared for 4-level ordinal rubric drift.
            </div>
          </div>
        </div>

        {/* Fleiss' Multi-Rater Kappa */}
        <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-sm space-y-3 flex flex-col justify-between">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Fleiss&apos; Kappa</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">3 Raters</span>
            </div>
            <div className="text-3xl font-black text-slate-900">
              {!stats.fleiss.isUndefined ? stats.fleiss.fleissKappa.toFixed(3) : 'Undefined'}
            </div>
          </div>
          <div>
            <div className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${getKappaInterpretation(stats.fleiss.fleissKappa).bg} ${getKappaInterpretation(stats.fleiss.fleissKappa).textCol}`}>
              {getKappaInterpretation(stats.fleiss.fleissKappa).text}
            </div>
            <div className="text-[11px] text-slate-500 pt-2 font-medium">
              Inter-rater consistency across all 3 independent assessors.
            </div>
          </div>
        </div>

        {/* Intraclass Correlation Coefficient ICC(2,1) */}
        <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-sm space-y-3 flex flex-col justify-between">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Two-Way Random ICC</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">ICC(2,1)</span>
            </div>
            <div className="text-3xl font-black text-indigo-700">
              {!stats.icc.isUndefined ? stats.icc.icc.toFixed(3) : 'Undefined'}
            </div>
          </div>
          <div>
            <div className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-50 text-slate-700 border border-slate-200">
              F-Ratio: {!stats.icc.isUndefined && !isNaN(stats.icc.fValue) ? stats.icc.fValue.toFixed(2) : 'N/A'} (df: {stats.icc.dfSubjects}/{stats.icc.dfRaters})
            </div>
            <div className="text-[11px] text-slate-500 pt-2 font-medium">
              Continuous score reliability index for practical tests.
            </div>
          </div>
        </div>
      </div>

      {/* Visual Rating Distribution */}
      <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-indigo-700" />
            <h3 className="text-sm font-bold text-slate-900">
              Trial Score Distribution Across All Evaluators
            </h3>
          </div>
          <span className="text-xs text-slate-500">Total Observations: {observations.length * 3}</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { level: 0, label: 'Level 0: Unsatisfactory', color: 'bg-red-500' },
            { level: 1, label: 'Level 1: Developing', color: 'bg-amber-500' },
            { level: 2, label: 'Level 2: Competent', color: 'bg-indigo-600' },
            { level: 3, label: 'Level 3: Mastered', color: 'bg-emerald-600' }
          ].map((item) => {
            const dist = stats.distribution[item.level];
            return (
              <div key={item.level} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-700">Level {item.level}</span>
                  <span className="font-bold text-slate-900">{dist.count} ({dist.percent}%)</span>
                </div>
                <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                  <div className={`h-full ${item.color} rounded-full transition-all`} style={{ width: `${dist.percent}%` }} />
                </div>
                <div className="text-[11px] text-slate-500 truncate">{item.label}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Observation Matrix Editor */}
      <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-700" />
              <span>Blind Multi-Rater Assessment Trials</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Modify candidate score levels below (0 to 3) to test real-time statistical recalculation, variance drift, or boundary edge cases.
            </p>
          </div>
          <div className="text-xs font-semibold text-slate-600">
            Sample Size: <strong className="text-slate-900">{stats.sampleSize} Subjects</strong>
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 font-semibold">
              <tr>
                <th className="p-3.5">Candidate / Subject</th>
                <th className="p-3.5 text-center">Rater 1 (Primary)</th>
                <th className="p-3.5 text-center">Rater 2 (Blind)</th>
                <th className="p-3.5 text-center">Rater 3 (Auditor)</th>
                <th className="p-3.5 text-center">Trial Agreement Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {observations.map(obs => {
                const isConsensus = obs.rater1 === obs.rater2 && obs.rater2 === obs.rater3;
                const maxDiff = Math.max(
                  Math.abs(obs.rater1 - obs.rater2),
                  Math.abs(obs.rater2 - obs.rater3),
                  Math.abs(obs.rater1 - obs.rater3)
                );

                return (
                  <tr key={obs.id} className="hover:bg-slate-50/60">
                    <td className="p-3.5 font-medium text-slate-900">
                      {obs.candidate_name}
                    </td>

                    {/* Rater 1 */}
                    <td className="p-3.5 text-center">
                      <select
                        value={obs.rater1}
                        onChange={e => handleRatingChange(obs.id, 'rater1', Number(e.target.value))}
                        className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 shadow-xs"
                      >
                        {[0, 1, 2, 3].map(l => (
                          <option key={l} value={l}>Level {l}</option>
                        ))}
                      </select>
                    </td>

                    {/* Rater 2 */}
                    <td className="p-3.5 text-center">
                      <select
                        value={obs.rater2}
                        onChange={e => handleRatingChange(obs.id, 'rater2', Number(e.target.value))}
                        className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 shadow-xs"
                      >
                        {[0, 1, 2, 3].map(l => (
                          <option key={l} value={l}>Level {l}</option>
                        ))}
                      </select>
                    </td>

                    {/* Rater 3 */}
                    <td className="p-3.5 text-center">
                      <select
                        value={obs.rater3}
                        onChange={e => handleRatingChange(obs.id, 'rater3', Number(e.target.value))}
                        className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 shadow-xs"
                      >
                        {[0, 1, 2, 3].map(l => (
                          <option key={l} value={l}>Level {l}</option>
                        ))}
                      </select>
                    </td>

                    {/* Status */}
                    <td className="p-3.5 text-center">
                      {isConsensus ? (
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Consensus
                        </span>
                      ) : maxDiff === 1 ? (
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200">
                          1-Level Variance
                        </span>
                      ) : (
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-50 text-red-700 border border-red-200">
                          High Variance
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
