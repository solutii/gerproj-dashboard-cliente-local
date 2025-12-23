'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { ReactNode, useEffect } from 'react';
import { Sidebar } from '../utils/Sidebar';

interface LayoutProps {
  children: ReactNode;
  pageTitle: string;
}

// ===== CONFIGURAÇÃO DE ZOOM =====
const ZOOM_LEVEL = 0.67; // Mude apenas este valor
const ZOOM_COMPENSATION = 100 / ZOOM_LEVEL; // Calcula automaticamente (ex: 100 / 0.75 = 133.33)
// ================================

export function LayoutDashboard({ children }: LayoutProps) {
  const { isLoggedIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoggedIn) {
      router.replace('/paginas/login');
    }
  }, [isLoggedIn, router]);

  if (!isLoggedIn) {
    return null;
  }

  return (
    <div
      className="flex bg-white overflow-hidden"
      style={{
        zoom: ZOOM_LEVEL,
        minHeight: '100vh',
        height: `${ZOOM_COMPENSATION}vh`, // Compensa automaticamente
      }}
    >
      {/* ========== SIDEBAR ========== */}
      <div className="h-full pl-6 py-6">
        <Sidebar />
      </div>
      {/* ===== */}

      {/* ========== MAIN ========== */}
      <main className="flex-1 flex flex-col p-6 overflow-hidden">
        {children}
      </main>
      {/* ===== */}
    </div>
  );
}
