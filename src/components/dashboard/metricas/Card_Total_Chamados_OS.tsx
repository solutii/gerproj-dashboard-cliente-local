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

// ========== CARD 1: Total Chamados OS ==========
interface TotalizadoresResponse {
  TOTAL_CHAMADOS: number;
  TOTAL_OS: number;
  CHAMADOS_FINALIZADO: number;
  CHAMADOS_STANDBY: number;
  CHAMADOS_EM_ATENDIMENTO: number;
  CHAMADOS_AGUARDANDO_VALIDACAO: number;
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
      <div className="flex h-36 cursor-pointer flex-col items-center justify-center rounded-xl border bg-gradient-to-br from-white to-gray-50 shadow-md shadow-black">
        <div className="flex h-full flex-col items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-200 border-t-purple-600"></div>
          <span className="mt-2 text-xs tracking-widest font-semibold italic text-slate-600 select-none">
            Carregando...
          </span>
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex h-36 cursor-pointer flex-col items-center justify-center rounded-xl border bg-gradient-to-br from-white to-gray-50 shadow-md shadow-black">
        <div className="flex h-full flex-col items-center justify-center gap-2">
          <FaExclamationTriangle className="text-red-500" size={16} />
          <span className="mt-2 text-xs tracking-widest font-semibold italic text-slate-600 select-none">
            Erro ao carregar os dados
          </span>
          {error && (
            <span className="text-[10px] text-red-500 select-none">
              {error instanceof Error ? error.message : 'Erro desconhecido'}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-36 flex-col rounded-xl border bg-white shadow-md shadow-black overflow-hidden">
      {/* Chamados Finalizados - Superior Esquerdo */}
      <div className="absolute top-2 left-2">
        <div className="flex flex-col gap-0">
          <span className="text-[9px] font-bold text-slate-600 tracking-wide select-none uppercase">
            Finalizados
          </span>
          <span className="text-lg font-extrabold tracking-wide bg-gradient-to-r from-green-600 to-green-700 bg-clip-text text-transparent select-none">
            {data.CHAMADOS_FINALIZADO ?? 0}
          </span>
        </div>
      </div>

      {/* Chamados Em Atendimento - Superior Direito */}
      <div className="absolute top-2 right-2 text-right">
        <div className="flex flex-col gap-0 items-end">
          <span className="text-[9px] font-bold text-slate-600 tracking-wide select-none uppercase">
            Em Atendimento
          </span>
          <span className="text-lg font-extrabold tracking-wide bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent select-none">
            {data.CHAMADOS_EM_ATENDIMENTO ?? 0}
          </span>
        </div>
      </div>

      {/* Total de Chamados - Centro */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="flex flex-col gap-0.5 items-center">
          <span className="text-xs font-bold text-slate-800 tracking-widest select-none uppercase">
            Total Chamados
          </span>
          <span className="text-3xl font-extrabold tracking-widest bg-gradient-to-r from-purple-600 to-purple-700 bg-clip-text text-transparent select-none">
            {data.TOTAL_CHAMADOS ?? 0}
          </span>
        </div>
      </div>

      {/* Chamados Standby - Inferior Esquerdo */}
      <div className="absolute bottom-2 left-2">
        <div className="flex flex-col gap-0">
          <span className="text-[9px] font-bold text-slate-600 tracking-wide select-none uppercase">
            Standby
          </span>
          <span className="text-lg font-extrabold tracking-wide bg-gradient-to-r from-yellow-600 to-yellow-700 bg-clip-text text-transparent select-none">
            {data.CHAMADOS_STANDBY ?? 0}
          </span>
        </div>
      </div>

      {/* Chamados Aguardando Validação - Inferior Direito */}
      <div className="absolute bottom-2 right-2 text-right">
        <div className="flex flex-col gap-0 items-end">
          <span className="text-[9px] font-bold text-slate-600 tracking-wide select-none uppercase">
            Aguard. Validação
          </span>
          <span className="text-lg font-extrabold tracking-wide bg-gradient-to-r from-orange-600 to-orange-700 bg-clip-text text-transparent select-none">
            {data.CHAMADOS_AGUARDANDO_VALIDACAO ?? 0}
          </span>
        </div>
      </div>
    </div>
  );
}
