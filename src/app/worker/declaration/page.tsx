'use client';

import React, { useState, useEffect } from 'react';
import { localDb } from '@/lib/db/idb';
import { syncEngine } from '@/lib/sync/sync-engine';
import { SAMPLE_SOLAR_QP } from '@/lib/data/sample-data';
import {
  FileText,
  Save,
  CheckCircle,
  AlertCircle,
  Wrench,
  Sparkles,
  ArrowRight,
  Clock,
  Briefcase,
  Languages,
  CheckCircle2,
  HelpCircle,
  ShieldAlert,
  Info
} from 'lucide-react';

export default function WorkerDeclarationPage() {
  const [selectedLanguage, setSelectedLanguage] = useState<'en' | 'hi' | 'mr'>('en');
  const [tradeCategory, setTradeCategory] = useState('Solar & Electrical');
  const [yearsExperience, setYearsExperience] = useState<number>(4);
  const [workHistory, setWorkHistory] = useState(
    '4 years installing rooftop solar PV arrays for residential homes and agricultural tube-well solar pumps in rural Maharashtra. Handling DC string wiring, inverter connections, and basic earthing pits.'
  );
  const [selectedTools, setSelectedTools] = useState<string[]>([
    'Multimeter / Clamp Meter',
    'MC4 Crimping Tool',
    'Insulated Torque Wrench',
    'Safety Harness / Lanyard',
    'Earth Resistance Tester'
  ]);
  const [newTool, setNewTool] = useState('');
  const [isSavedLocally, setIsSavedLocally] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState(false);

  // Load existing draft from IndexedDB
  useEffect(() => {
    async function loadDraft() {
      try {
        const drafts = await localDb.draft_declarations.toArray();
        if (drafts.length > 0) {
          const draft = drafts[0];
          setTradeCategory(draft.trade_category || 'Solar & Electrical');
          setYearsExperience(draft.years_experience || 4);
          setWorkHistory(draft.work_history || '');
          if (draft.tools_used && draft.tools_used.length > 0) {
            setSelectedTools(draft.tools_used);
          }
          setIsSavedLocally(true);
          if (draft.updated_at) {
            setLastSavedTime(new Date(draft.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
          }
        }
      } catch (err) {
        console.error('Failed to load draft from IndexedDB', err);
      }
    }
    loadDraft();
  }, []);

  // Auto-save to IndexedDB
  const handleAutoSave = async () => {
    try {
      const draftId = 'draft_worker_01';
      const now = new Date();
      await localDb.draft_declarations.put({
        id: draftId,
        trade_category: tradeCategory,
        years_experience: yearsExperience,
        work_history: workHistory,
        tools_used: selectedTools,
        tasks_performed: [
          'Rooftop solar module mounting',
          'DC array string cabling',
          'Earthing pit inspection'
        ],
        target_qp_code: SAMPLE_SOLAR_QP.qp_code,
        is_synced: false,
        updated_at: now.toISOString()
      });
      setIsSavedLocally(true);
      setLastSavedTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } catch (err) {
      console.error('Save failed', err);
    }
  };

  const handleAddTool = () => {
    if (newTool.trim() && !selectedTools.includes(newTool.trim())) {
      setSelectedTools([...selectedTools, newTool.trim()]);
      setNewTool('');
      setIsSavedLocally(false);
    }
  };

  const handleRemoveTool = (tool: string) => {
    setSelectedTools(selectedTools.filter(t => t !== tool));
    setIsSavedLocally(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Enqueue mutation via sync engine
      await syncEngine.enqueueMutation('submit_declaration', {
        trade_category: tradeCategory,
        years_experience: yearsExperience,
        work_history: workHistory,
        tools_used: selectedTools,
        suggested_qp_code: SAMPLE_SOLAR_QP.qp_code
      });

      // Update draft as synced
      await localDb.draft_declarations.update('draft_worker_01', {
        is_synced: true
      });

      setSubmissionSuccess(true);
    } catch (err) {
      console.error('Submission failed', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Header & Context */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <FileText className="w-3.5 h-3.5" />
            <span>Phase 1 • Candidate Intake & Self-Declaration</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-2 tracking-tight">
            Prior Learning Intake & Trade Declaration
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Capture your informal trade experience, tools mastered, and daily tasks for NSQF qualification mapping.
          </p>
        </div>

        {/* Language & Autosave Status */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Language selector */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg p-1 text-xs font-medium text-slate-600 shadow-xs">
            <Languages className="w-4 h-4 text-slate-500 ml-1" />
            <button
              type="button"
              onClick={() => setSelectedLanguage('en')}
              className={`px-2 py-1 rounded ${selectedLanguage === 'en' ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'hover:bg-slate-50'}`}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => setSelectedLanguage('hi')}
              className={`px-2 py-1 rounded ${selectedLanguage === 'hi' ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'hover:bg-slate-50'}`}
            >
              हिन्दी
            </button>
            <button
              type="button"
              onClick={() => setSelectedLanguage('mr')}
              className={`px-2 py-1 rounded ${selectedLanguage === 'mr' ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'hover:bg-slate-50'}`}
            >
              मराठी
            </button>
          </div>

          {/* Draft Save Button */}
          <button
            type="button"
            onClick={handleAutoSave}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold bg-white text-slate-700 hover:bg-slate-50 transition-colors border border-slate-300 shadow-xs"
          >
            <Save className={`w-3.5 h-3.5 ${isSavedLocally ? 'text-emerald-600' : 'text-slate-500'}`} />
            <span>{isSavedLocally ? `Saved Offline (${lastSavedTime || 'Cached'})` : 'Save Draft (Offline)'}</span>
          </button>
        </div>
      </div>

      {submissionSuccess ? (
        <div className="p-8 rounded-xl bg-white border border-emerald-200 shadow-sm text-center max-w-2xl mx-auto space-y-4">
          <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto">
            <CheckCircle className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Declaration Successfully Submitted</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Your trade declaration has been saved locally and queued for synchronization with the RPL Assessment Portal.
            An authorized Sector Skill Council assessor and reviewer will review your advisory qualification match.
          </p>
          <div className="pt-4 flex flex-wrap justify-center gap-3">
            <button
              onClick={() => setSubmissionSuccess(false)}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 transition-colors"
            >
              Edit Declaration
            </button>
            <a
              href="/assessor/assessments/a1000000-0000-0000-0000-000000000001"
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-700 text-white hover:bg-indigo-800 transition-colors flex items-center gap-1.5 shadow-xs"
            >
              Proceed to Assessor Rubric <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Intake Form Column */}
          <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-6">
            {/* Step 1: Vocation & Experience */}
            <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-sm space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-indigo-700" />
                  <span>1. Vocation & Experience Duration</span>
                </h3>
                <span className="text-xs font-semibold text-slate-400">Step 1 of 2</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Target Trade / Sector
                  </label>
                  <select
                    value={tradeCategory}
                    onChange={e => {
                      setTradeCategory(e.target.value);
                      setIsSavedLocally(false);
                    }}
                    className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 transition-shadow"
                  >
                    <option value="Solar & Electrical">Solar PV & Electrical Installations</option>
                    <option value="Automotive Services">Automotive Mechanic & Repair</option>
                    <option value="Plumbing & Sanitation">Plumbing & Pipefitting</option>
                    <option value="Construction & Masonry">Construction & Masonry</option>
                  </select>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-xs font-semibold text-slate-700">
                      Total Practical Experience
                    </label>
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                      {yearsExperience} Years
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="20"
                    value={yearsExperience}
                    onChange={e => {
                      setYearsExperience(Number(e.target.value));
                      setIsSavedLocally(false);
                    }}
                    className="w-full accent-indigo-700 h-2 bg-slate-200 rounded-lg cursor-pointer mt-2"
                  />
                  <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                    <span>1 yr (Entry)</span>
                    <span>5 yrs (Skilled)</span>
                    <span>10+ yrs (Master)</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Detailed Work History & On-Site Experience
                </label>
                <textarea
                  rows={4}
                  value={workHistory}
                  onChange={e => {
                    setWorkHistory(e.target.value);
                    setIsSavedLocally(false);
                  }}
                  className="w-full p-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 placeholder-slate-400 transition-shadow leading-relaxed"
                  placeholder="Describe the jobs you perform, sites worked, employers, apprenticeship, or informal contractor tasks..."
                />
              </div>
            </div>

            {/* Step 2: Tools & Equipment Mastered */}
            <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-sm space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-indigo-700" />
                  <span>2. Tools & Equipment Mastered</span>
                </h3>
                <span className="text-xs font-semibold text-slate-400">Step 2 of 2</span>
              </div>

              <p className="text-xs text-slate-500">
                Select or add tools you routinely handle safely on job sites. This evidence informs practical assessment assignment.
              </p>

              <div className="flex flex-wrap gap-2">
                {selectedTools.map(tool => (
                  <span
                    key={tool}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-800 border border-indigo-200"
                  >
                    <span>{tool}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveTool(tool)}
                      className="text-indigo-400 hover:text-red-700 font-bold ml-1 transition-colors"
                      title="Remove tool"
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>

              <div className="flex gap-2.5 pt-2">
                <input
                  type="text"
                  placeholder="Add another tool (e.g., Inclinometer, Wire Stripper, Megohmmeter)..."
                  value={newTool}
                  onChange={e => setNewTool(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTool();
                    }
                  }}
                  className="flex-1 px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 placeholder-slate-400 transition-shadow"
                />
                <button
                  type="button"
                  onClick={handleAddTool}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 transition-colors border border-slate-300 shadow-xs"
                >
                  Add Tool
                </button>
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              <div className="text-xs text-slate-500 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                <span>Drafts auto-persist in browser storage (IndexedDB) for offline field resilience.</span>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold bg-indigo-700 text-white hover:bg-indigo-800 transition-colors shadow-sm disabled:opacity-50"
              >
                <span>{isSubmitting ? 'Submitting...' : 'Submit Declaration for QP Mapping'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>

          {/* AI Advisory QP Match Preview Column */}
          <div className="space-y-6">
            <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-sm space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-700 uppercase tracking-wide">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  <span>AI Advisory Match</span>
                </div>
                {/* Provenance Badge */}
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-300">
                  {SAMPLE_SOLAR_QP.provenance === 'synthetic_demo' ? 'DEMO BENCHMARK DATA' : SAMPLE_SOLAR_QP.provenance}
                </span>
              </div>

              <div className="space-y-1.5">
                <h4 className="text-base font-bold text-slate-900 leading-snug">
                  {SAMPLE_SOLAR_QP.qp_name}
                </h4>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>Code: <strong className="font-semibold text-slate-800">{SAMPLE_SOLAR_QP.qp_code}</strong></span>
                  <span>•</span>
                  <span>NSQF Level: <strong className="font-bold text-indigo-700">{SAMPLE_SOLAR_QP.nsqf_level}</strong></span>
                </div>
              </div>

              {/* Match Meter */}
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-600">Advisory Competency Match</span>
                  <span className="text-indigo-700 font-bold">88% Estimated Fit</span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                  <div className="h-full bg-indigo-600 rounded-full" style={{ width: '88%' }} />
                </div>
              </div>

              {/* Matched NOS Standards */}
              <div className="space-y-2.5 pt-3 border-t border-slate-100">
                <div className="text-xs font-bold uppercase tracking-wide text-slate-700">
                  Covered Standards ({SAMPLE_SOLAR_QP.nos_list.length} NOS)
                </div>
                <div className="space-y-2">
                  {SAMPLE_SOLAR_QP.nos_list.map(nos => (
                    <div key={nos.nos_code} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1">
                      <div className="flex items-start justify-between gap-1">
                        <span className="font-semibold text-slate-900">{nos.nos_code}</span>
                        <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-100">
                          {nos.weightage}% Wt.
                        </span>
                      </div>
                      <div className="text-slate-600 text-[11px] leading-tight">{nos.nos_name}</div>
                      <div className="text-[10px] text-slate-400">Pass Threshold: {nos.pass_threshold_percent}%</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Assistive Boundary Notice */}
              <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-amber-900">
                  <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>Advisory Boundary Notice</span>
                </div>
                <p className="text-[11px] leading-relaxed text-amber-900">
                  This recommendation is purely advisory. Qualification Pack selection must be confirmed by an SSC reviewer before practical assessment begins.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
