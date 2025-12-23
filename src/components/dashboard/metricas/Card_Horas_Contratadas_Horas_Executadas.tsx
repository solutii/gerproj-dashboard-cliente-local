// ========== Card_Horas_Contratadas_Horas_Executadas.tsx ==========
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

interface ApiResponse {
  totalHorasContratadas: number;
  totalHorasExecutadas: number;
  detalhes: any[];
}


export function CardHorasContratadasHorasExecutadas({ filters }: FilterProps) {
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
      `/api/cards-metricas/hrs-contratadas-hrs-executadas?${params.toString()}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Erro na requisição: ${response.status}`);
    }

    return response.json();
  };

  const { data, isLoading, isError } = useQuery({
    queryKey: ['horasContratadasExecutadas', filters, isAdmin, codCliente],
    queryFn: fetchData,
    enabled: !!filters && (isAdmin || codCliente !== null),
  });

  if (isLoading) {
    return (
      <div className="flex h-32 sm:h-36 lg:h-40 cursor-pointer flex-col items-center justify-center rounded-lg sm:rounded-xl border bg-gradient-to-br from-white to-gray-50 shadow-md shadow-black">
        <div className="flex h-full flex-col items-center justify-center">
          <div className="h-6 w-6 sm:h-8 sm:w-8 animate-spin rounded-full border-3 sm:border-4 border-purple-200 border-t-purple-600"></div>
          <span className="mt-1.5 sm:mt-2 text-xs tracking-widest font-semibold italic text-slate-600 select-none">
            Carregando...
          </span>
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex h-32 sm:h-36 lg:h-40 cursor-pointer flex-col items-center justify-center rounded-lg sm:rounded-xl border bg-gradient-to-br from-white to-gray-50 shadow-md shadow-black">
        <div className="flex h-full flex-col items-center justify-center">
          <FaExclamationTriangle className="text-red-500" size={14} />
          <span className="mt-1.5 sm:mt-2 text-xs tracking-widest font-semibold italic text-slate-600 select-none text-center px-2">
            Erro ao carregar os dados
          </span>
        </div>
      </div>
    );
  }

  const totalHorasContratadas = data.totalHorasContratadas;
  const totalHorasExecutadas = data.totalHorasExecutadas;
  const percentual =
    totalHorasContratadas > 0
      ? (totalHorasExecutadas / totalHorasContratadas) * 100
      : 0;
  const diferenca = totalHorasExecutadas - totalHorasContratadas;

  const getBarColor = () => {
    if (diferenca > 0.5) return 'bg-gradient-to-r from-red-500 to-red-600';
    if (diferenca < -0.5)
      return 'bg-gradient-to-r from-emerald-500 to-emerald-600';
    return 'bg-gradient-to-r from-blue-500 to-blue-600';
  };

  return (
    <div className="relative flex h-32 sm:h-36 lg:h-40 flex-col justify-center rounded-lg sm:rounded-xl border bg-white px-3 sm:px-4 shadow-md shadow-black overflow-hidden">
      {/* Título */}
      <div className="text-center mb-1.5 sm:mb-2 relative z-10">
        <span className="text-[10px] sm:text-sm font-bold text-slate-800 tracking-widest select-none uppercase">
          Horas Contratadas × Executadas
        </span>
      </div>

      {/* Barras de progresso e status */}
      <div className="w-full flex flex-col gap-1.5 sm:gap-2 lg:gap-2.5 relative z-10">
        {/* Contratadas */}
        <div>
          <div className="mb-0.5 sm:mb-1 flex items-center justify-between">
            <span className="text-[9px] sm:text-[12px] font-bold text-slate-800 tracking-widest select-none uppercase">
              Contratadas
            </span>
            <span className="text-[10px] sm:text-sm font-bold text-blue-600 tracking-widest select-none">
              {formatarHorasTotaisSufixo(totalHorasContratadas)}
            </span>
          </div>
          <div className="h-1.5 sm:h-2 w-full rounded-full bg-gray-200 overflow-hidden shadow-xs shadow-black">
            <div
              className="h-1.5 sm:h-2 rounded-full bg-gradient-to-r from-blue-400 to-blue-500"
              style={{ width: '100%' }}
            />
          </div>
        </div>

        {/* Executadas */}
        <div>
          <div className="mb-0.5 sm:mb-1 flex items-center justify-between">
            <span className="text-[9px] sm:text-[12px] font-bold text-slate-800 tracking-widest select-none uppercase">
              Executadas
            </span>
            <span
              className={`text-[10px] sm:text-sm font-bold tracking-widest select-none ${
                diferenca > 0.5
                  ? 'text-red-600'
                  : diferenca < -0.5
                    ? 'text-emerald-600'
                    : 'text-blue-600'
              }`}
            >
              {formatarHorasTotaisSufixo(totalHorasExecutadas)}
            </span>
          </div>
          <div className="h-1.5 sm:h-2 w-full rounded-full bg-gray-200 overflow-hidden relative shadow-black shadow-xs">
            <div
              className={`h-1.5 sm:h-2 rounded-full ${getBarColor()} shadow-sm transition-all duration-500 ${
                percentual > 100 ? 'animate-pulse' : ''
              }`}
              style={{ width: `${Math.min(percentual, 100)}%` }}
            />
            {percentual > 100 && (
              <div className="absolute inset-0 border-2 border-red-400 rounded-full animate-pulse"></div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}