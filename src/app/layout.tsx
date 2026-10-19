import './globals.css';
import type { Metadata } from 'next';
import { Header } from '@/components/common/Header';
import { SkillSetuEmblem } from '@/components/common/SkillSetuLogo';

export const metadata: Metadata = {
  title: 'SkillSetu — AI-Assisted Prior Learning Assessment (NSQF RPL)',
  description: 'Assistive RPL Assessment and Diagnostic Dossier System for SIH26242 under NSQF Guidelines',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[#F8FAFC] text-slate-900 antialiased min-h-screen flex flex-col selection:bg-indigo-100 selection:text-indigo-900">
        <Header />
        <main className="flex-1">
          {children}
        </main>
        <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500 no-print">
          <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 font-medium text-slate-700">
              <SkillSetuEmblem size="sm" className="w-5 h-5 rounded-md" />
              <strong>SkillSetu Platform</strong> • SIH26242 NSQF Recognition of Prior Learning
            </div>
            <div className="text-slate-500">
              Deterministic Scoring Engine • Advisory AI Mappings • Human Assessor Authority
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
