import Link from 'next/link';
import {
  FileText,
  ClipboardCheck,
  Award,
  BarChart3,
  ShieldCheck,
  ArrowRight,
  WifiOff,
  Scale,
  BrainCircuit,
  Lock,
  CheckCircle2,
  Users
} from 'lucide-react';

export default function HomePage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-200/90 p-8 sm:p-12 shadow-sm">
        <div className="relative z-10 max-w-3xl space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <ShieldCheck className="w-4 h-4 text-indigo-700" />
            <span>SIH26242 • NSQF-Aligned RPL Framework</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight">
            AI-Assisted Prior Learning Assessment for Informal Workers
          </h1>

          <p className="text-base sm:text-lg text-slate-600 leading-relaxed font-normal">
            SkillSetu bridges informal trade experience to formal National Skills Qualification Framework (NSQF)
            qualifications. Standardizing practical evaluations, preventing assessor drift, and generating tamper-evident
            diagnostic dossiers under strict human-in-the-loop governance.
          </p>

          {/* Regulatory Boundary Note */}
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
            <Scale className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <strong className="font-semibold text-amber-950">Statutory Assistant Boundary:</strong> AI generates advisory qualification matches and gap diagnostics. 
              Only certified human assessors and Sector Skill Council (SSC) reviewers can grade candidates and finalize qualification outcomes.
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3.5 pt-2">
            <Link
              href="/worker/declaration"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold bg-indigo-700 text-white hover:bg-indigo-800 transition-colors shadow-sm"
            >
              <FileText className="w-4 h-4" />
              <span>Start Worker Intake</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </Link>

            <Link
              href="/assessor/assessments/a1000000-0000-0000-0000-000000000001"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors border border-slate-300 shadow-xs"
            >
              <ClipboardCheck className="w-4 h-4 text-indigo-700" />
              <span>Open Assessor Rubric</span>
            </Link>

            <Link
              href="/evaluation/consistency"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold bg-slate-50 text-slate-700 hover:bg-slate-100 transition-colors border border-slate-200"
            >
              <BarChart3 className="w-4 h-4 text-slate-600" />
              <span>Consistency Testbed</span>
            </Link>
          </div>
        </div>

        {/* Decorative Light Radial Glow */}
        <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-50/80 rounded-full blur-3xl -z-0 pointer-events-none" />
      </div>

      {/* Core Workflow Pillars */}
      <div>
        <div className="mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            End-to-End RPL Assessment Lifecycle
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Structured 4-stage assessment process enforcing National Skills Qualification Framework protocols
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Step 1 */}
          <div className="p-6 rounded-xl bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700 font-bold text-sm">
                01
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                Worker Intake
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed font-normal">
                Multilingual trade experience capture, tools mastered, and informal work history. Auto-saves locally in IndexedDB to support field operations without cellular data.
              </p>
            </div>
            <div className="pt-2">
              <Link
                href="/worker/declaration"
                className="text-xs font-semibold text-indigo-700 hover:text-indigo-800 flex items-center gap-1 group"
              >
                <span>Launch Intake Portal</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </div>

          {/* Step 2 */}
          <div className="p-6 rounded-xl bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700 font-bold text-sm">
                02
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                Advisory QP Match
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed font-normal">
                AI suggests relevant Qualification Packs with confidence scores and gap analysis. Reviewer confirms pack before assessment is unlocked for scoring.
              </p>
            </div>
            <div className="pt-2">
              <span className="text-xs font-medium text-slate-500 inline-flex items-center gap-1">
                <BrainCircuit className="w-3.5 h-3.5 text-indigo-600" />
                Human Confirmed Mapping
              </span>
            </div>
          </div>

          {/* Step 3 */}
          <div className="p-6 rounded-xl bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700 font-bold text-sm">
                03
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                Assessor Rubrics
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed font-normal">
                Standardized 4-level rubric scoring sheet with mandatory critical-safety vetoes. Offline score caching and tamper-evident submission queue.
              </p>
            </div>
            <div className="pt-2">
              <Link
                href="/assessor/assessments/a1000000-0000-0000-0000-000000000001"
                className="text-xs font-semibold text-indigo-700 hover:text-indigo-800 flex items-center gap-1 group"
              >
                <span>Open Scoring Sheet</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </div>

          {/* Step 4 */}
          <div className="p-6 rounded-xl bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700 font-bold text-sm">
                04
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                Verified Dossier
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed font-normal">
                Reviewer signs off with decision-matrix enforcement. Generates canonical SHA-256 verifiable diagnostic dossier with skill gap bridge training paths.
              </p>
            </div>
            <div className="pt-2">
              <Link
                href="/reviewer/dashboard"
                className="text-xs font-semibold text-indigo-700 hover:text-indigo-800 flex items-center gap-1 group"
              >
                <span>Reviewer Portal</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Governance & Integrity Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
        <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-indigo-700 font-semibold text-sm">
            <ShieldCheck className="w-5 h-5 text-indigo-700" />
            <span>Server-Authoritative Math</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Zero client-controlled scores or points. Exact NOS-weighted formula:
            <code className="block mt-2 p-2.5 bg-slate-50 border border-slate-200 rounded text-indigo-800 font-mono text-[11px]">
              Overall = Σ(NOS_Score × Weight/100)
            </code>
            Any critical safety failure instantly vetoes overall pass regardless of numerical average.
          </p>
        </div>

        <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-indigo-700 font-semibold text-sm">
            <WifiOff className="w-5 h-5 text-indigo-700" />
            <span>Offline-First Reliability</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            IndexedDB storage via Dexie.js for rural assessment centers. Idempotent sync queue with Optimistic Concurrency Control (OCC) versioning prevents concurrent overwrites.
          </p>
        </div>

        <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-indigo-700 font-semibold text-sm">
            <BarChart3 className="w-5 h-5 text-indigo-700" />
            <span>Scientific Consistency Harness</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Reproducible statistical testbed computing Cohen&apos;s Kappa, Quadratic Weighted Kappa, Fleiss&apos; Kappa, and ICC(2,1) across simulated multi-rater evaluation trials.
          </p>
        </div>
      </div>
    </div>
  );
}
