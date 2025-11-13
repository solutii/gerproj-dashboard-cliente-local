'use client';

import { useAuth } from '@/context/AuthContext';
import { formatarHorasTotaisSufixo } from '../../../formatters/formatar-hora';
import { useQuery } from '@tanstack/react-query';
import { Minus } from 'lucide-react';
import { IoIosTrendingDown, IoIosTrendingUp } from "react-icons/io";

interface FiltersProps {
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

export function CardHorasContratadasHorasExecutadas({
  filters,
}: FiltersProps) {
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
      `/api/hrs-contratadas-hrs-executadas?${params.toString()}`,
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
    queryKey: ['horasContratadasExecutadas', filters, isAdmin, codCliente],
    queryFn: fetchData,
    enabled: !!filters && (isAdmin || codCliente !== null),
  });

  if (isLoading) {
    return (
      <div className="flex h-48 cursor-pointer flex-col items-center justify-center rounded-xl border border-gray-300 bg-gradient-to-br from-white to-gray-50 shadow-md shadow-black/20 transition-all duration-300 hover:shadow-lg">
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
      <div className="flex h-48 flex-col items-center justify-center rounded-xl border border-red-300 bg-gradient-to-br from-white to-red-50 shadow-md shadow-black/20">
        <span className="text-red-600 font-semibold">Erro ao carregar dados</span>
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

  const getStatusIcon = () => {
    if (diferenca > 0.5) return <IoIosTrendingUp className="text-red-500" size={22} />;
    if (diferenca < -0.5) return <IoIosTrendingDown className="text-emerald-500" size={22}/>;
    return <Minus className="text-blue-500" size={22} />;
  };

  const getStatusConfig = () => {
    if (diferenca > 0.5) return {
      color: 'text-red-700',
      bg: 'bg-red-50',
      border: 'border-red-200',
      gradient: 'from-red-50 to-red-100/50'
    };
    if (diferenca < -0.5) return {
      color: 'text-emerald-700',
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      gradient: 'from-emerald-50 to-emerald-100/50'
    };
    return {
      color: 'text-blue-700',
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      gradient: 'from-blue-50 to-blue-100/50'
    };
  };

  const getBarColor = () => {
    if (diferenca > 0.5) return 'bg-gradient-to-r from-red-500 to-red-600';
    if (diferenca < -0.5) return 'bg-gradient-to-r from-emerald-500 to-emerald-600';
    return 'bg-gradient-to-r from-blue-500 to-blue-600';
  };

  const statusConfig = getStatusConfig();

  return (
    <div className="relative flex h-48 cursor-pointer flex-col justify-center rounded-xl border border-gray-200 bg-gradient-to-br from-white via-indigo-50/20 to-purple-50/30 px-6 py-4 shadow-md shadow-black/20 transition-all duration-300 hover:shadow-xl hover:border-purple-300 overflow-hidden">
      {/* Elemento decorativo */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-400/10 to-indigo-400/10 transform rotate-45 translate-x-16 -translate-y-16"></div>
      
      {/* Título */}
      <div className="mb-4 text-center relative z-10">
        <span className="text-sm font-semibold text-gray-600 tracking-wide select-none uppercase">
          Horas Contratadas × Executadas
        </span>
      </div>

      <div className="w-full space-y-3 relative z-10">
        {/* Contratadas */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wide select-none text-gray-600 uppercase">
              Contratadas
            </span>
            <span className="text-sm font-bold text-amber-600 tracking-wide select-none">
              {formatarHorasTotaisSufixo(totalHorasContratadas)}
            </span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-gray-200 shadow-inner overflow-hidden">
            <div
              className="h-2.5 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 shadow-sm"
              style={{ width: '100%' }}
            />
          </div>
        </div>

        {/* Executadas */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wide select-none text-gray-600 uppercase">
              Executadas
            </span>
            <span className={`text-sm font-bold tracking-wide select-none ${
              diferenca > 0.5 ? 'text-red-600' : diferenca < -0.5 ? 'text-emerald-600' : 'text-blue-600'
            }`}>
              {formatarHorasTotaisSufixo(totalHorasExecutadas)}
            </span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-gray-200 shadow-inner overflow-hidden relative">
            <div
              className={`h-2.5 rounded-full ${getBarColor()} shadow-sm transition-all duration-500 ${
                percentual > 100 ? 'animate-pulse' : ''
              }`}
              style={{ width: `${Math.min(percentual, 100)}%` }}
            />
            {percentual > 100 && (
              <div className="absolute inset-0 border-2 border-red-400 rounded-full animate-pulse"></div>
            )}
          </div>
        </div>

        {/* Status */}
        <div
          className={`flex items-center justify-center gap-2.5 rounded-lg border ${statusConfig.border} ${statusConfig.bg} bg-gradient-to-r ${statusConfig.gradient} px-3 py-2 text-sm font-bold tracking-wide select-none transition-all duration-300 shadow-sm backdrop-blur-sm`}
        >
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-white/80 shadow-sm">
            {getStatusIcon()}
          </div>
          <span className={statusConfig.color}>
            {Math.abs(diferenca) < 0.5
              ? 'No prazo'
              : diferenca > 0
                ? `+${diferenca.toFixed(1)}h`
                : `${diferenca.toFixed(1)}h`}
            <span className="ml-1.5 opacity-75">({percentual.toFixed(0)}%)</span>
          </span>
        </div>
      </div>

      {/* Badge de status */}
      <div className="absolute top-3 right-3">
        <div className={`w-2 h-2 rounded-full shadow-lg ${
          diferenca > 0.5 ? 'bg-red-400 animate-pulse shadow-red-400/50' :
          diferenca < -0.5 ? 'bg-emerald-400 shadow-emerald-400/50' :
          'bg-blue-400 shadow-blue-400/50'
        }`}></div>
      </div>
    </div>
  );
}