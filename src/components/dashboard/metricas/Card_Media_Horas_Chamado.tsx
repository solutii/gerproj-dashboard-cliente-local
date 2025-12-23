'use client';

import { useAuth } from '@/context/AuthContext';
import { formatarHorasTotaisSufixo } from '@/formatters/formatar-hora';
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

// ========== CARD 3: Média Horas por Chamado (SIMPLIFICADO) ==========
interface MediasResponse {
  MEDIA_HRS_POR_CHAMADO: number;
  MEDIA_HRS_POR_TAREFA: number;
  TOTAL_CHAMADOS_COM_HORAS: number;
  TOTAL_TAREFAS_COM_HORAS: number;
}

export function CardMediaHorasChamado({ filters }: FilterProps) {
  const { isAdmin, codCliente } = useAuth();

  const fetchData = async (): Promise<MediasResponse> => {
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
      `/api/cards-metricas/media-hrs-chamado-tarefa?${params.toString()}`,
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
        '❌ [CARD MÉDIAS] Erro na resposta:',
        response.status,
        errorText,
      );
      throw new Error(`Erro na requisição: ${response.status}`);
    }

    const data = await response.json();
    return data;
  };

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['mediasHoras', filters, isAdmin, codCliente],
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

  const mediaHorasChamado = data.MEDIA_HRS_POR_CHAMADO;

  return (
    <div className="relative flex h-36 flex-col items-center justify-center rounded-xl border bg-white shadow-md shadow-black overflow-hidden">
      {/* Conteúdo Centralizado */}
      <div className="flex flex-col gap-1 items-center">
        <span className="text-xs font-bold text-slate-800 tracking-widest select-none uppercase">
          Média por Chamado
        </span>
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-extrabold tracking-widest bg-gradient-to-r from-cyan-600 to-cyan-700 bg-clip-text text-transparent select-none">
            {mediaHorasChamado !== null && mediaHorasChamado !== undefined
              ? formatarHorasTotaisSufixo(mediaHorasChamado)
              : '--'}
          </span>
        </div>
      </div>
    </div>
  );
}
