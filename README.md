# SkillSetu (कौशल सेतु)
### AI-Assisted Prior Learning Assessment & Diagnostic Dossier Platform for Informal Workers
**Smart India Hackathon (SIH26242) • NSQF-Aligned RPL Framework**

---

## 🌟 Executive Summary

SkillSetu bridges informal trade experience to formal National Skills Qualification Framework (NSQF) qualifications. It transforms unstandardized, subjective RPL (Recognition of Prior Learning) practical evaluations into objective, verifiable assessments with:
1. **Multilingual Worker Intake:** Offline-first trade background and tool declaration with automatic local caching.
2. **Advisory AI QP Matching:** Evidence-based qualification pack mapping with confidence scoring, explainability, and strict human reviewer confirmation.
3. **Standardized 4-Level Assessor Rubrics:** Criterion-by-criterion observation scoring with mandatory safety veto rules and server-side point derivation.
4. **Verifiable Tamper-Evident Diagnostic Dossier:** SHA-256 canonical hash verification, gap diagnostic radar, and bridging training module recommendations.
5. **Scientific Assessor Consistency Testbed:** Live inter-rater reliability engine computing Cohen's Kappa, Quadratic Weighted Kappa, Fleiss' Kappa, and ICC(2,1).

---

## 🏗️ Architecture & Technology Stack

| Layer | Technology | Key Responsibility |
|---|---|---|
| **Frontend Framework** | Next.js 14 (App Router) + React 18 | High-performance PWA with SSR/SSG and responsive client views |
| **Styling & Icons** | Tailwind CSS + Lucide Icons | Clean modern dark-mode UI with high-contrast NSQF badging |
| **Offline Storage** | Dexie.js (IndexedDB wrapper) | Field-ready offline intake drafts, rubrics caching, and sync queue |
| **Backend & Database** | Supabase / PostgreSQL 15 | Row-Level Security (RLS), OCC version locking, triggers, and RPCs |
| **Hashing & Integrity** | Pure-JS Canonical RFC 8785 + SHA-256 | Deterministic audit hash chains and tamper-evident PDF dossiers |
| **Statistical Harness** | Custom TypeScript Math Engine | Cohen's Kappa, Fleiss' Kappa, and two-way random ICC(2,1) |
| **Testing** | Vitest + TypeScript (`tsc`) | Unit, statistical, and idempotency regression testing |

---

## 🛡️ Core Governance & Integrity Rules

- **Assistive-Only Boundary:** AI recommendations are strictly advisory. No QP is locked and no score is finalized without explicit assessor and reviewer signatures.
- **Server-Authoritative Scoring:** Clients send only discrete rubric levels (`0`, `1`, `2`, `3`). Points, percentages, NOS aggregations, and pass/fail verdicts are derived exclusively in server-side transactions (`submit_assessment_scores`).
- **Critical Safety Veto:** Any failed critical criterion (e.g., live electrical isolation, PPE non-compliance) instantly vetoes the entire assessment, regardless of aggregate score.
- **Optimistic Concurrency Control (OCC):** Prevents lost updates when synchronizing offline queues via version increment checks (`SELECT ... FOR UPDATE`).
- **Cryptographic Hash Chain:** All assessment state transitions log into an append-only audit trail anchored by previous-block SHA-256 hashes.

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- Node.js 18.x or 20.x
- npm 9.x or higher

### 2. Installation
```bash
git clone <repository-url>
cd SkillSetu
npm install
```

### 3. Environment Variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

### 4. Running Verification Commands
- **Unit & Integration Tests:**
  ```bash
  npm run test
  ```
- **TypeScript Typecheck:**
  ```bash
  npm run typecheck
  ```
- **Linting:**
  ```bash
  npm run lint
  ```
- **Production Build:**
  ```bash
  npm run build
  ```

### 5. Running the Dev Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📂 Project Directory Structure

```
SkillSetu/
├── src/
│   ├── app/
│   │   ├── assessor/assessments/[id]/page.tsx  # Practical scoring rubric
│   │   ├── evaluation/consistency/page.tsx      # Statistical consistency testbed
│   │   ├── reviewer/dashboard/page.tsx          # Reviewer sign-off & dossier portal
│   │   ├── worker/declaration/page.tsx          # Worker multilingual intake
│   │   ├── api/sync/dispatch/route.ts           # Offline sync dispatch endpoint
│   │   ├── layout.tsx & page.tsx                # App navigation & hero landing
│   ├── lib/
│   │   ├── db/dexie.ts                          # IndexedDB client database
│   │   ├── db/idempotency.ts                    # Replay-safe mutation records
│   │   ├── evaluation/stats.ts                  # Kappa & ICC statistical formulas
│   │   ├── provenance/validator.ts              # NSQF Qualification Pack validator
│   │   ├── scoring/engine.ts                    # Pure deterministic scoring math
│   │   └── security/canonical-report-hasher.ts  # RFC 8785 canonical SHA-256 hasher
├── supabase/
│   └── migrations/                              # Complete DDL, RLS, triggers & RPCs (00001 - 00009)
├── tests/
│   └── unit/                                    # 20+ unit tests across all engines
└── implementation_plan.md                       # Comprehensive Master Implementation Plan
```

---

## ⚖️ License & Accreditation

SkillSetu is designed in compliance with the **National Skill Development Corporation (NSDC)** and **National Council for Vocational Education and Training (NCVET)** RPL assessment protocols.
