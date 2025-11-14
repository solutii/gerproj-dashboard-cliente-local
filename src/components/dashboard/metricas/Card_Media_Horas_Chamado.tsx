'use client';

import { useAuth } from '@/context/AuthContext';
import { formatarHorasTotaisSufixo } from '../../../formatters/formatar-hora';
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

interface ApiResponse {
  ordensServico: any[];
  totalizadores: {
    TOTAL_OS: number;
    TOTAL_CHAMADOS: number;
    TOTAL_RECURSOS: number;
    TOTAL_HRS: number;
    TOTAL_HRS_CHAMADOS: number;
    TOTAL_HRS_TAREFAS: number;
    MEDIA_HRS_POR_CHAMADO: number;
    MEDIA_HRS_POR_TAREFA: number;
    TOTAL_CHAMADOS_COM_HORAS: number;
    TOTAL_TAREFAS_COM_HORAS: number;
  };
}

export function CardMediaHorasChamado({ filters }: FilterProps) {
  const { isAdmin, codCliente } = useAuth();

  const fetchData = async (): Promise<ApiResponse> => {
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
      `/api/ordens-servico?${params.toString()}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Erro na requisição: ${response.status}`);
    }

    return response.json();
  };

  const { data, isLoading, isError } = useQuery({
    queryKey: ['mediaHoraChamado', filters, isAdmin, codCliente],
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
        <div className="flex h-full flex-col items-center justify-center">
          <FaExclamationTriangle className=" text-red-500" size={20} />
          <span className="mt-3 tracking-widest font-semibold italic text-slate-600 select-none">
            Erro ao carregar os dados
          </span>
        </div>
      </div>
    );
  }

  const mediaHorasChamado = data.totalizadores.MEDIA_HRS_POR_CHAMADO;
  const mediaHorasTarefa = data.totalizadores.MEDIA_HRS_POR_TAREFA;

  return (
    <div className="relative flex h-54 flex-col rounded-xl border bg-gradient-to-br from-white via-cyan-100/30 to-indigo-100/30 shadow-md shadow-black overflow-hidden">
      {/* Linha decorativa diagonal */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-cyan-500/10 to-indigo-500/10 shadow-xs shadow-black/20 transform rotate-45 translate-x-16 -translate-y-16"></div>
      
      {/* Média por Chamado - Superior Esquerdo */}
      <div className="absolute top-6 left-6">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-bold text-slate-800 tracking-widest select-none uppercase">
            Média por Chamado
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-extrabold tracking-widest bg-gradient-to-r from-cyan-600 to-cyan-700 bg-clip-text text-transparent select-none">
              {mediaHorasChamado !== null && mediaHorasChamado !== undefined
                ? formatarHorasTotaisSufixo(mediaHorasChamado)
                : '--'}
            </span>
          </div>
        </div>
      </div>

      {/* Divisor visual */}
      <div className="absolute top-1/2 left-1/2 w-0.5 h-34 bg-gradient-to-b from-transparent via-slate-400 to-transparent transform -translate-x-1/2 -translate-y-1/2 rotate-45"></div>

      {/* Média por Tarefa - Inferior Direito */}
      <div className="absolute bottom-6 right-6 text-right">
        <div className="flex flex-col gap-1 items-end">
          <span className="text-sm font-bold text-slate-800 tracking-widest select-none uppercase">
            Média por Tarefa
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-extrabold tracking-widest bg-gradient-to-r from-cyan-600 to-cyan-700 bg-clip-text text-transparent select-none">
              {mediaHorasTarefa !== null && mediaHorasTarefa !== undefined
                ? formatarHorasTotaisSufixo(mediaHorasTarefa)
                : '--'}
            </span>
          </div>
        </div>
      </div>

      {/* Badge de status */}
      <div className="absolute top-3 right-3">
        <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse shadow-lg shadow-cyan-500/50"></div>
      </div>
    </div>
  );
}