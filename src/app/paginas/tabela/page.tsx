'use client';

import { LayoutTabela } from '@/components/tabela/Layout_Tabela';
import TabelaChamados from '@/components/tabela/Tabela_Chamados';
import { Filtros } from '@/components/utils/Filtros';
import { useAuth } from '@/context/AuthContext';
import { useFilters } from '@/context/FiltersContext';
import { useCallback } from 'react';

export default function TicketChamadoPage() {
  const { filters, setFilters } = useFilters();
  const { isAdmin, codCliente } = useAuth();

  const handleFiltersChange = useCallback(
    (newFilters: typeof filters) => {
      const updatedFilters = !isAdmin
        ? { ...newFilters, cliente: codCliente || '' }
        : newFilters;

      setFilters(updatedFilters);
    },
    [isAdmin, codCliente, setFilters],
  );

  return (
    <LayoutTabela pageTitle="Chamados">
      <div className="flex flex-col gap-10 h-full overflow-hidden">
        {/* Área fixa - sem scroll */}
        <div className="flex-shrink-0">
          <Filtros onFiltersChange={handleFiltersChange} showRefreshButton={false} />
        </div>
        <div className="flex-1 min-h-0">
          <TabelaChamados
            ano={filters.ano.toString()}
            mes={filters.mes.toString()}
            cliente={filters.cliente}
            recurso={filters.recurso}
            status={filters.status}
          />
        </div>
      </div>
    </LayoutTabela>
  );
}
