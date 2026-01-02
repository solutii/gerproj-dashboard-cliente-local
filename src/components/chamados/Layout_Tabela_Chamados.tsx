// src/components/chamados/Layout_Tabela_Chamados.tsx
'use client';

import { ReactNode } from 'react';
import { ProtecaoRotas } from '../shared/ProtecaoRotas';
import { Sidebar } from '../shared/Sidebar';

interface LayoutProps {
    children: ReactNode;
    pageTitle: string;
}

// ===== CONFIGURAÇÃO DE ZOOM =====
const ZOOM_LEVEL = 0.67; // Mude apenas este valor
const ZOOM_COMPENSATION = 100 / ZOOM_LEVEL;
// ================================

export function LayoutTabelaChamados({ children }: LayoutProps) {
    return (
        <ProtecaoRotas>
            <div
                className="flex overflow-hidden bg-white"
                style={{
                    zoom: ZOOM_LEVEL,
                    minHeight: '100vh',
                    height: `${ZOOM_COMPENSATION}vh`,
                }}
            >
                {/* ========== SIDEBAR ========== */}
                <div className="h-full py-6 pl-6">
                    <Sidebar />
                </div>
                {/* ===== */}

                {/* ========== MAIN ========== */}
                <main className="flex flex-1 flex-col overflow-hidden p-6">{children}</main>
                {/* ===== */}
            </div>
        </ProtecaoRotas>
    );
}
