'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';

// components
import { Graficos } from '../../../components/dashboard/Graficos';
import { LayoutDashboard } from '../../../components/dashboard/Layout_Dashboard';
import { Filtros } from '../../../components/shared/Filtros';
import { useFilters } from '../../../context/FiltersContext';

export default function DashboardPage() {
    const { isLoggedIn } = useAuth();
    const { filters } = useFilters();
    const router = useRouter();

    // Redireciona para a página de login se o usuário não estiver logado
    useEffect(() => {
        if (!isLoggedIn) {
            router.push('/paginas/login');
        }
    }, [isLoggedIn, router]);

    // Se o usuário não estiver logado, não renderiza nada
    if (!isLoggedIn) return null;

    return (
        <LayoutDashboard pageTitle="Dashboard">
            <div className="flex h-full flex-col gap-10 overflow-hidden">
                {/* Área fixa - sem scroll */}
                <div className="flex-shrink-0">
                    <Filtros />
                </div>

                {/* Área com scroll - gráficos */}
                <div className="min-h-0 flex-1">
                    <Graficos
                        filters={{
                            ano: filters.ano,
                            mes: filters.mes,
                            cliente: filters.cliente,
                            recurso: filters.recurso,
                            status: filters.status,
                        }}
                    />
                </div>
            </div>
        </LayoutDashboard>
    );
}
