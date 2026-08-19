// src/app/paginas/ia/Layout_Pagina_IA.tsx

'use client';

import { ProtecaoRotas } from '@/components/ProtecaoRotas';
import { Sidebar } from '@/components/Sidebar';
// =====================================================
import { ReactNode } from 'react';

interface LayoutProps {
    children: ReactNode;
}

// ===== CONFIGURAÇÃO DE ZOOM =====
const ZOOM_LEVEL = 0.67; // Mude apenas este valor
const ZOOM_COMPENSATION = 100 / ZOOM_LEVEL;
// ================================

export function LayoutPaginaIA({ children }: LayoutProps) {
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
