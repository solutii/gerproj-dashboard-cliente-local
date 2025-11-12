'use client';

import { ReactNode, useEffect, useState } from 'react';
import MobileHeader from '../utils/Mobile_Header';
import ProtecaoRotas from '../utils/ProtecaoRotas';
import {Sidebar} from '../utils/Sidebar';

// Define as props esperadas pelo componente LayoutTabela.
interface LayoutProps {
  children: ReactNode;
  pageTitle: string;
}

// Componente principal que define o layout da tabela.
export default function LayoutTabela({ children, pageTitle }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false); // Estado para controlar se a sidebar está aberta.

  // Fecha a sidebar ao clicar fora dela quando está aberta.
  useEffect(() => {
    if (sidebarOpen) {
      const handleClickOutside = () => setSidebarOpen(false);
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [sidebarOpen]);

  return (
    // Garante que a rota está protegida (usuário autenticado).
    <ProtecaoRotas>
      {/* Estrutura principal do layout, com flexbox e estilos responsivos */}
      <div className="kodchasan flex h-screen text-black lg:overflow-hidden">
        {/* Cabeçalho para dispositivos móveis, controla a sidebar */}
        <MobileHeader
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          pageTitle={pageTitle}
        />

        {/* Overlay escuro ao abrir a sidebar no mobile, fecha ao clicar */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar lateral, com animação de transição */}
        <div
          className={`fixed top-0 left-0 z-50 h-full transform transition-transform duration-300 ease-in-out lg:relative lg:flex-shrink-0 lg:transform-none lg:p-4 ${sidebarOpen ? 'translate-x-0 p-4' : '-translate-x-full lg:translate-x-0'} `}
        >
          <Sidebar setSidebarOpen={setSidebarOpen} />
        </div>

        {/* Conteúdo principal da página */}
        <main className="flex-1 overflow-y-auto p-4 pt-20 lg:flex lg:h-full lg:flex-col lg:overflow-hidden lg:p-6 lg:pt-6">
          {children}
        </main>
      </div>
    </ProtecaoRotas>
  );
}
