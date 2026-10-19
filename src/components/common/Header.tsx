'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { syncEngine, SyncEngineStatus } from '@/lib/sync/sync-engine';
import {
  Wifi,
  WifiOff,
  RefreshCw,
  AlertTriangle,
  Menu,
  X,
  FileText,
  ClipboardCheck,
  Award,
  BarChart3
} from 'lucide-react';
import { SkillSetuLogo } from './SkillSetuLogo';

export function Header() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncEngineStatus>({
    isOnline: true,
    isSyncing: false,
    pendingCount: 0,
    conflictCount: 0,
    lastSyncAt: null
  });

  useEffect(() => {
    return syncEngine.subscribe(status => {
      setSyncStatus(status);
    });
  }, []);

  const navLinks = [
    {
      href: '/worker/declaration',
      label: 'Worker Intake',
      icon: FileText,
      active: pathname?.startsWith('/worker')
    },
    {
      href: '/assessor/assessments/a1000000-0000-0000-0000-000000000001',
      label: 'Assessor Rubric',
      icon: ClipboardCheck,
      active: pathname?.startsWith('/assessor')
    },
    {
      href: '/reviewer/dashboard',
      label: 'Reviewer & Dossier',
      icon: Award,
      active: pathname?.startsWith('/reviewer')
    },
    {
      href: '/evaluation/consistency',
      label: 'Kappa Harness',
      icon: BarChart3,
      active: pathname?.startsWith('/evaluation')
    }
  ];

  return (
    <header className="border-b border-slate-200 bg-white sticky top-0 z-50 shadow-sm">
      {/* Statutory RPL Assistive Banner */}
      <div className="bg-amber-50/90 border-b border-amber-200/80 px-4 py-1.5 text-xs text-amber-900 flex items-center justify-between">
        <div className="flex items-center gap-2 max-w-7xl mx-auto w-full">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span className="leading-snug">
            <strong className="font-semibold text-amber-800">STATUTORY RPL NOTICE:</strong> SkillSetu provides AI-assisted qualification mapping, gap diagnostics, and offline assessment capture. 
            All official competency determinations and certifications are strictly issued by authorized human assessors and reviewers under NSQF guidelines.
          </span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <Link href="/" className="group flex items-center transition-opacity hover:opacity-95" aria-label="SkillSetu Home">
            <SkillSetuLogo size="md" />
          </Link>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden lg:flex items-center gap-1.5">
          {navLinks.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                  item.active
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className={`w-4 h-4 ${item.active ? 'text-indigo-700' : 'text-slate-500'}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Sync & Network Status Badges */}
        <div className="flex items-center gap-2.5">
          {/* Network status */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
              syncStatus.isOnline
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse'
            }`}
            title={syncStatus.isOnline ? 'Online - Supabase Realtime Active' : 'Offline - Local IndexedDB Active'}
          >
            {syncStatus.isOnline ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                <span className="font-semibold hidden sm:inline">Online</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-rose-600" />
                <span className="font-semibold">Offline</span>
              </>
            )}
          </div>

          {/* Pending Sync Queue */}
          {syncStatus.pendingCount > 0 && (
            <button
              onClick={() => syncEngine.triggerSync()}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100 transition-colors shadow-xs"
            >
              <RefreshCw className={`w-3 h-3 text-amber-700 ${syncStatus.isSyncing ? 'animate-spin' : ''}`} />
              <span>{syncStatus.pendingCount} Pending</span>
            </button>
          )}

          {/* Conflict Alert */}
          {syncStatus.conflictCount > 0 && (
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
              <span>{syncStatus.conflictCount} Conflict</span>
            </div>
          )}

          {/* Mobile Menu Toggle Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-colors"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-1 shadow-lg">
          {navLinks.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  item.active
                    ? 'bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Icon className={`w-4 h-4 ${item.active ? 'text-indigo-700' : 'text-slate-500'}`} />
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </header>
  );
}
