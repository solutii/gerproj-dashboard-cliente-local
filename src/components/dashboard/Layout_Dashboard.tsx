// components/DashboardLayout.tsx
'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';
import { Sidebar } from '../utils/Sidebar';

interface LayoutProps {
  children: ReactNode;
  pageTitle: string; // Adiciona uma prop opcional para o título da página
}

export function DashboardLayout({ children, pageTitle }: LayoutProps) {
  // Estado para controlar a abertura do sidebar
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();
  // Obtém o estado de autenticação do usuário
  const { isLoggedIn } = useAuth();

  // Redireciona para login se o usuário não estiver autenticado
  useEffect(() => {
    if (!isLoggedIn) {
      router.replace('/login');
    }
  }, [isLoggedIn, router]);

  // Fecha o sidebar ao clicar fora dele (modo mobile)
  useEffect(() => {
    if (sidebarOpen) {
      const handleClickOutside = () => setSidebarOpen(false);
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [sidebarOpen]);

  // Não renderiza nada se o usuário não estiver autenticado
  if (!isLoggedIn) {
    return null;
  }

  return (
    // Container principal do layout do dashboard
    <div className="kodchasan flex h-screen text-black lg:overflow-hidden">
      {/* Overlay do sidebar (aparece no mobile quando o sidebar está aberto) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar lateral (fixo no desktop, deslizante no mobile) */}
      <div
        className={`fixed top-0 left-0 z-50 h-full transform transition-transform duration-300 ease-in-out lg:relative lg:flex-shrink-0 lg:transform-none lg:p-4 ${sidebarOpen ? 'translate-x-0 p-4' : '-translate-x-full lg:translate-x-0'} `}
      >
        <Sidebar setSidebarOpen={setSidebarOpen} />
      </div>

      {/* Conteúdo principal do dashboard */}
      <main className="flex-1 overflow-y-scroll p-4 pt-20 lg:flex lg:h-full lg:flex-col lg:p-6 lg:pt-6">
        {children}
      </main>
    </div>
  );
}
