'use client';

import { useRouter } from 'next/navigation';
import { ReactNode, useEffect } from 'react';
import { Sidebar } from '../../../components/Sidebar';
import { useAuth } from '../../../context/AuthContext';
import { CardHrsContratadasHrsExecutadas } from './cards/Card_Hrs_Contratadas_Hrs_Executadas';
import { CardTotalChamadosOS } from './cards/Card_Total_Chamados_OS';
import { CardMediaHrsChamadoTarefa } from './cards/CardMediaHrsChamadoTarefa';
import { Graficos } from './graficos/Graficos';

interface LayoutProps {
    filters: {
        ano: number;
        mes: number;
        cliente: string;
        recurso: string;
        status: string;
    };
    children?: ReactNode;
}

// ===== CONFIGURAÇÃO DE ZOOM =====
const ZOOM_LEVEL = 0.67; // Mude apenas este valor
const ZOOM_COMPENSATION = 100 / ZOOM_LEVEL; // Calcula automaticamente (ex: 100 / 0.75 = 133.33)
// ================================

export function LayoutDashboard({ filters, children }: LayoutProps) {
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
            className="flex overflow-hidden bg-white"
            style={{
                zoom: ZOOM_LEVEL,
                minHeight: '100vh',
                height: `${ZOOM_COMPENSATION}vh`, // Compensa automaticamente
            }}
        >
            {/* ========== SIDEBAR ========== */}
            <div className="h-full py-6 pl-6">
                <Sidebar />
            </div>
            {/* ===== */}

            {/* ========== MAIN ========== */}
            <main className="flex flex-1 flex-col overflow-hidden p-6">
                <div className="flex h-full flex-col gap-10 overflow-hidden">
                    {/* Área fixa - children (ex: Filtros) sem scroll */}
                    {children && <div className="flex-shrink-0">{children}</div>}

                    {/* Área com scroll - cards e gráficos */}
                    <div className="min-h-0 flex-1">
                        <div className="h-full overflow-y-auto border-b-slate-500 px-3 pb-4 sm:px-4 sm:pb-6">
                            <div className="flex w-full flex-col gap-6 sm:gap-8 lg:gap-10">
                                {/* Cards de métricas */}
                                <div className="flex flex-col gap-2">
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 lg:gap-10">
                                        <CardTotalChamadosOS filters={filters} />
                                        <CardHrsContratadasHrsExecutadas filters={filters} />
                                        <CardMediaHrsChamadoTarefa filters={filters} />
                                    </div>
                                </div>

                                {/* Gráficos */}
                                <Graficos filters={filters} />
                            </div>
                        </div>
                    </div>
                </div>
            </main>
            {/* ===== */}
        </div>
    );
}
