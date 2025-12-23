'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect } from 'react';

// components
import { Graficos } from '@/components/dashboard/graficos/Graficos';
import { useFilters } from '@/context/FiltersContext';
import { LayoutDashboard } from '../../../components/dashboard/Layout_Dashboard';
import { ContainerCardsMetricas } from '../../../components/dashboard/metricas/Container_Cards_Metricas';
import { Filtros } from '../../../components/utils/Filtros';

export default function DashboardPage() {
  const { isLoggedIn, isAdmin, codCliente } = useAuth();
  const { filters, setFilters } = useFilters();
  const router = useRouter();

  // Redireciona para a página de login se o usuário não estiver logado
  useEffect(() => {
    if (!isLoggedIn) {
      router.push('/paginas/login');
    }
  }, [isLoggedIn, router]);

  // Atualiza os filtros com o código do cliente se não for admin
  const handleFiltersChange = useCallback(
    (newFilters: typeof filters) => {
      const updatedFilters = !isAdmin
        ? { ...newFilters, cliente: codCliente || '' }
        : newFilters;

      setFilters(updatedFilters);
    },
    [isAdmin, codCliente, setFilters],
  );

  // Se o usuário não estiver logado, não renderiza nada
  if (!isLoggedIn) return null;

  return (
    <LayoutDashboard pageTitle="Dashboard">
      <div className="flex flex-col gap-10 h-full overflow-hidden">
        {/* Área fixa - sem scroll */}
        <div className="flex-shrink-0">
          <Filtros showRefreshButton={true} />
        </div>
        
        {/* <div className="flex-shrink-0">
          <ContainerCardsMetricas filters={filters} />
        </div> */}

        {/* Área com scroll - gráficos */}
        <div className="flex-1 min-h-0">
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