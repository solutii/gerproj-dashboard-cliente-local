'use client';

import { ReactNode } from 'react';
import { ProtecaoRotas } from '../utils/ProtecaoRotas';
import { Sidebar } from '../utils/Sidebar';

interface LayoutProps {
  children: ReactNode;
  pageTitle: string;
}

export function LayoutTabela({ children }: LayoutProps) {
  return (
    <ProtecaoRotas>
    <div className="flex h-screen bg-white overflow-hidden">
      {/* ========== SIDEBAR ========== */}
      <div className="top-0 left-0 z-50 h-full relative p-6">
        <Sidebar />
      </div>
      {/* ===== */}

      {/* ========== MAIN ========== */}
      <main className="flex h-full flex-col pr-6 pt-6 pb-6 flex-1 overflow-hidden">
        {children}
      </main>
      {/* ===== */}
    </div>
    </ProtecaoRotas>
  );
}
