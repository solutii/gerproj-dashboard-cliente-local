'use client';

import { useAuth } from '@/context/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { FaExclamationTriangle } from 'react-icons/fa';

interface FilterProps {
  filters: {
    ano: number;
    mes: number;
    cliente: string;
    recurso: string;
    status: string;
  };
}

interface TotalizadoresResponse {
  TOTAL_CHAMADOS: number;
  TOTAL_OS: number;
}

export function CardTotalChamadosOS({ filters }: FilterProps) {
  const { isAdmin, codCliente } = useAuth();

  const fetchData = async (): Promise<TotalizadoresResponse> => {
    const params = new URLSearchParams();
    params.append('mes', filters.mes.toString());
    params.append('ano', filters.ano.toString());
    params.append('isAdmin', isAdmin.toString());

    if (!isAdmin && codCliente) {
      params.append('codCliente', codCliente);
    }

    if (filters.cliente) params.append('codClienteFilter', filters.cliente);
    if (filters.recurso) params.append('codRecursoFilter', filters.recurso);
    if (filters.status) params.append('status', filters.status);

    const response = await fetch(
      `/api/cards-metricas/total-chamados-os?${params.toString()}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        '❌ [CARD TOTALIZADORES] Erro na resposta:',
        response.status,
        errorText,
      );
      throw new Error(`Erro na requisição: ${response.status}`);
    }

    const data = await response.json();

    return data;
  };

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['totalizadoresChamados', filters, isAdmin, codCliente],
    queryFn: fetchData,
    enabled: !!filters && (isAdmin || codCliente !== null),
  });

  if (isLoading) {
    return (
      <div className="flex h-54 cursor-pointer flex-col items-center justify-center rounded-xl border bg-gradient-to-br from-white to-gray-50 shadow-md shadow-black">
        <div className="flex h-full flex-col items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-purple-200 border-t-purple-600"></div>
          <span className="mt-3 tracking-widest font-semibold italic text-slate-600 select-none">
            Carregando...
          </span>
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex h-54 cursor-pointer flex-col items-center justify-center rounded-xl border bg-gradient-to-br from-white to-gray-50 shadow-md shadow-black">
        <div className="flex h-full flex-col items-center justify-center gap-2">
          <FaExclamationTriangle className="text-red-500" size={20} />
          <span className="mt-3 tracking-widest font-semibold italic text-slate-600 select-none">
            Erro ao carregar os dados
          </span>
          {error && (
            <span className="text-xs text-red-500 select-none">
              {error instanceof Error ? error.message : 'Erro desconhecido'}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-54 flex-col rounded-xl border bg-gradient-to-br from-white via-purple-100/30 to-indigo-100/30 shadow-md shadow-black overflow-hidden">
      {/* Linha decorativa diagonal */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-500/10 to-indigo-500/10 shadow-xs shadow-black/20 transform rotate-45 translate-x-16 -translate-y-16"></div>

      {/* Total de Chamados - Superior Esquerdo */}
      <div className="absolute top-6 left-6">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-bold text-slate-800 tracking-widest select-none uppercase">
            QTD. CHAMADOS
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-extrabold tracking-widest bg-gradient-to-r from-purple-600 to-purple-700 bg-clip-text text-transparent select-none">
              {data.TOTAL_CHAMADOS ?? 0}
            </span>
          </div>
        </div>
      </div>

      {/* Divisor visual */}
      <div className="absolute top-1/2 left-1/2 w-0.5 h-34 bg-gradient-to-b from-transparent via-slate-400 to-transparent transform -translate-x-1/2 -translate-y-1/2 rotate-45"></div>

      {/* Total de OS's - Inferior Direito */}
      <div className="absolute bottom-6 right-6 text-right">
        <div className="flex flex-col gap-1 items-end">
          <span className="text-sm font-bold text-slate-800 tracking-widest select-none">
            TOTAL OS's
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-extrabold tracking-widest bg-gradient-to-r from-purple-600 to-purple-700 bg-clip-text text-transparent select-none">
              {data.TOTAL_OS ?? 0}
            </span>
          </div>
        </div>
      </div>

      {/* Badge de status */}
      <div className="absolute top-3 right-3">
        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-lg shadow-green-500/50"></div>
      </div>
    </div>
  );
}
