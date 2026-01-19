'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { ContainerDashboard } from '../../../components/dashboard/Container_Dashboard';
import { LayoutDashboard } from '../../../components/dashboard/Layout_Dashboard';
import { Filtros } from '../../../components/shared/Filtros';
import { useAuth } from '../../../context/AuthContext';
import { useFiltersStore } from '../../../store/useFiltersStore';

export default function DashboardPage() {
    const { isLoggedIn } = useAuth();
    const filters = useFiltersStore((state) => state.filters);
    const router = useRouter();

    useEffect(() => {
        if (!isLoggedIn) {
            router.push('/paginas/login');
        }
    }, [isLoggedIn, router]);

    if (!isLoggedIn) return null;

    return (
        <LayoutDashboard pageTitle="Dashboard">
            <div className="flex h-full flex-col gap-10 overflow-hidden">
                {/* Área fixa - sem scroll */}
                <div className="flex-shrink-0">
                    <Filtros />
                </div>

                {/* Área com scroll - cards e gráficos */}
                <div className="min-h-0 flex-1">
                    <ContainerDashboard
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
