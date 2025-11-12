'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect } from 'react';

// components
import { Graficos } from '@/components/dashboard/graficos/Graficos';
import { useFilters } from '@/context/FiltersContext';
import { DashboardLayout } from '../../../components/dashboard/Layout_Dashboard';
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
    <DashboardLayout pageTitle="Dashboard">
      <Filtros onFiltersChange={handleFiltersChange} />
      <ContainerCardsMetricas filters={filters} />
      <div>
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
    </DashboardLayout>
  );
}
