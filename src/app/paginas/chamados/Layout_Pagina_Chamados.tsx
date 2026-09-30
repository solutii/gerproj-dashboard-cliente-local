// src/app/paginas/chamados/Layout_Pagina_Chamados.tsx

'use client';

import { ZOOM_PAGINAS } from '@/components/loading-titles';
import { ProtecaoRotas } from '@/components/ProtecaoRotas';
import { Sidebar } from '@/components/Sidebar';
import { useIsDesktop } from '@/hooks/useIsDesktop';
// =====================================================
import { ReactNode } from 'react';

interface LayoutProps {
    children: ReactNode;
    pageTitle: string;
}

// ===== CONFIGURAÇÃO DE ZOOM =====
const ZOOM_LEVEL = ZOOM_PAGINAS; // Mude o valor em components/loading-titles.ts
const ZOOM_COMPENSATION = 100 / ZOOM_LEVEL;
// ================================

export function LayoutPaginaChamados({ children }: LayoutProps) {
    const isDesktop = useIsDesktop();

    return (
        <ProtecaoRotas>
            <div
                className="flex overflow-hidden bg-stone-100"
                style={{
                    zoom: isDesktop ? ZOOM_LEVEL : 1,
                    minHeight: '100vh',
                    height: isDesktop ? `${ZOOM_COMPENSATION}vh` : '100vh',
                }}
            >
                {/* ========== SIDEBAR ========== */}
                <div className="h-full py-6 pl-6">
                    <Sidebar />
                </div>
                {/* ===== */}

                {/* ========== MAIN ========== */}
                <main
                    className="flex flex-1 flex-col overflow-hidden p-4 pt-20 lg:p-6"
                    style={{
                        // Quadriculado bem suave no fundo (teal, 7% de opacidade).
                        backgroundImage:
                            'linear-gradient(rgba(15,118,110,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(15,118,110,0.07) 1px, transparent 1px)',
                        backgroundSize: '48px 48px',
                    }}
                >
                    {children}
                </main>
                {/* ===== */}
            </div>
        </ProtecaoRotas>
    );
}
