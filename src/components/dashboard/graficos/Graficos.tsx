import { useAuth } from '@/context/AuthContext';
import { formatarHorasTotaisSufixo } from '@/formatters/formatar-hora';
import { formatarNumeros } from '@/formatters/formatar-numeros';
import { corrigirTextoCorrompido } from '@/formatters/formatar-texto-corrompido';
import {
  renderizarDoisPrimeirosNomes,
  renderizarPrimeiroNome,
} from '@/formatters/remover-acentuacao';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import React from 'react';
import { FaChartBar } from 'react-icons/fa';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

// Cores para os gráficos
const COLORS = {
  primary: '#3b82f6',
  secondary: '#8b5cf6',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#06b6d4',
  gradient: '#f97316',
  pie: [
    '#3b82f6',
    '#8b5cf6',
    '#10b981',
    '#f59e0b',
    '#ef4444',
    '#06b6d4',
    '#ec4899',
    '#6366f1',
  ],
};

// Componente de Tooltip customizado
type CustomTooltipProps = {
  active?: boolean;
  payload?: Array<{ name?: string; value?: any; color?: string }>;
  label?: any;
  labelFormatter?: (label: any) => string;
  valueFormatter?: (value: any) => string;
};

const CustomTooltip: React.FC<CustomTooltipProps> = ({
  active,
  payload,
  label,
  labelFormatter,
  valueFormatter,
}) => {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-white p-3 rounded-md shadow-md shadow-black border">
      <p className="font-semibold text-slate-800 mb-2 tracking-widest select-none">
        {labelFormatter ? labelFormatter(label) : label}
      </p>
      {payload.map((entry, index) => (
        <p
          key={index}
          className="text-sm tracking-widest select-none"
          style={{ color: entry?.color || undefined }}
        >
          {entry?.name}:{' '}
          <span className="font-bold tracking-widest select-none">
            {valueFormatter ? valueFormatter(entry?.value) : entry?.value}
          </span>
        </p>
      ))}
    </div>
  );
};

// Componente de card para os gráficos
type ChartCardProps = {
  title: string;
  children?: React.ReactNode;
};

const ChartCard: React.FC<ChartCardProps> = ({ title, children }) => (
  <div className="bg-white rounded-xl shadow-md shadow-black p-6 border transition-all hover:shadow-xl hover:ring-2 hover:ring-pink-600 ">
    <h3 className="text-lg font-extrabold text-black mb-4 tracking-widest select-none uppercase">
      {title}
    </h3>
    {children}
  </div>
);

// Componente de Erro
type ErrorMessageProps = {
  message: string;
  onRetry?: () => void;
};
const ErrorMessage: React.FC<ErrorMessageProps> = ({ message, onRetry }) => (
  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
    <p className="text-red-800 mb-2">❌ {message}</p>
    {onRetry && (
      <button
        onClick={onRetry}
        className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-all"
      >
        Tentar Novamente
      </button>
    )}
  </div>
);

// Interface para os filtros recebidos via props
interface FilterProps {
  filters: {
    ano: number;
    mes: number;
    cliente: string;
    recurso: string;
    status: string;
  };
}

// Função para buscar os dados da API
const fetchOrdensServico = async (
  filters: FilterProps['filters'],
  isAdmin: boolean,
  codCliente: string | null,
) => {
  const params = new URLSearchParams({
    isAdmin: isAdmin.toString(),
    mes: filters.mes.toString(),
    ano: filters.ano.toString(),
  });

  if (!isAdmin && codCliente) {
    params.append('codCliente', codCliente);
  }
  if (filters.cliente) {
    params.append('codClienteFilter', filters.cliente);
  }
  if (filters.recurso) {
    params.append('codRecursoFilter', filters.recurso);
  }
  if (filters.status) {
    params.append('status', filters.status);
  }

  const response = await fetch(`/api/ordens-servico?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`Erro HTTP: ${response.status}`);
  }

  return response.json();
};

export function Graficos({ filters }: FilterProps) {
  const { isAdmin, codCliente } = useAuth();

  const {
    data: dados,
    isLoading: loading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['ordens-servico', filters, isAdmin, codCliente],
    queryFn: () => fetchOrdensServico(filters, isAdmin, codCliente),
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });

  if (loading) {
    return (
      <div className="py-60 border border-gray-200 bg-gradient-to-br from-white via-indigo-50/20 to-purple-50/30 min-h-screen rounded-xl shadow-md">
        <div className="flex flex-col items-center justify-center gap-6">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-200 via-blue-400 to-blue-600 opacity-20 blur-xl"></div>

            <div className="relative flex items-center justify-center">
              <Loader2 className="animate-spin text-blue-600" size={160} />

              <div className="absolute inset-0 flex items-center justify-center">
                <FaChartBar className="text-blue-600" size={60} />
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center gap-4">
            <h1 className="text-3xl font-extrabold tracking-widest text-black select-none">
              Aguarde, buscando dados no servidor...
            </h1>

            <div className="flex items-center justify-center gap-1">
              <span className="text-xl font-semibold tracking-widest text-slate-600 italic select-none">
                Carregando informações para os gráficos
              </span>
              <div className="flex items-center justify-center gap-1">
                <span className="h-2 w-2 animate-[bounce_1s_ease-in-out_infinite] rounded-full bg-slate-600"></span>
                <span className="h-2 w-2 animate-[bounce_1s_ease-in-out_0.2s_infinite] rounded-full bg-slate-600"></span>
                <span className="h-2 w-2 animate-[bounce_1s_ease-in-out_0.4s_infinite] rounded-full bg-slate-600"></span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 border border-gray-200 bg-gradient-to-br from-white via-indigo-50/20 to-purple-50/30 rounded-xl shadow-md">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          GRÁFICOS DE ANÁLISES
        </h1>
        <ErrorMessage
          message={
            error instanceof Error ? error.message : 'Erro ao buscar dados'
          }
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  if (!dados || !dados.graficos) {
    return (
      <div className="p-6 border border-gray-200 bg-gradient-to-br from-white via-indigo-50/20 to-purple-50/30 rounded-xl shadow-md">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          GRÁFICOS DE ANÁLISES
        </h1>
        <p className="text-gray-600">Nenhum dado disponível</p>
      </div>
    );
  }

  const {
    horasPorDia,
    topChamados,
    horasPorStatus,
    horasPorRecurso,
    horasPorCliente,
    horasPorMes,
  } = dados.graficos;
  const { totalizadores } = dados;

  return (
    <div className="h-full overflow-y-auto p-6 border bg-slate-50 border-b-slate-500">
      <div className="w-full flex flex-col gap-10">
        {/* Cabeçalho - fixo no topo */}
        <h1 className="text-3xl font-extrabold text-black tracking-widest select-none">
          GRÁFICOS DE ANÁLISES
        </h1>

        {/* Grid de gráficos - área com scroll */}
        <div className="grid grid-cols-2 gap-10">
          {/* Gráfico 1: Evolução Diária de Horas */}
          {horasPorDia && horasPorDia.length > 0 && (
            <ChartCard title="Evolução Diária de Horas">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={horasPorDia}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="data"
                    stroke="#6b7280"
                    tickLine={false}
                    axisLine={{ stroke: '#d1d5db', strokeWidth: 1 }}
                    tick={{
                      fill: '#111827',
                      fontSize: 13,
                      fontWeight: 800,
                      letterSpacing: '0.2em',
                      textAnchor: 'middle',
                    }}
                  />
                  <YAxis
                    stroke="#6b7280"
                    tickLine={false}
                    axisLine={{ stroke: '#d1d5db', strokeWidth: 1 }}
                    tick={{
                      fill: '#111827',
                      fontSize: 13,
                      fontWeight: 800,
                      letterSpacing: '0.2em',
                    }}
                  />
                  <Tooltip
                    content={
                      <CustomTooltip
                        labelFormatter={(label) => `Data: ${label}`}
                        valueFormatter={(value) =>
                          `${formatarHorasTotaisSufixo(value)}`
                        }
                      />
                    }
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="horas"
                    stroke={COLORS.primary}
                    strokeWidth={2}
                    dot={{ fill: COLORS.primary, r: 4 }}
                    activeDot={{ r: 6 }}
                    name="Horas Trabalhadas"
                  />
                </LineChart>
              </ResponsiveContainer>
              <div className="mt-4 p-3 bg-slate-100 rounded-md border shadow-xs shadow-black">
                <p className="text-base text-black tracking-widest select-none font-extrabold">
                  <span>Total no período:</span>{' '}
                  {formatarHorasTotaisSufixo(totalizadores?.TOTAL_HRS || 0)}
                </p>
              </div>
            </ChartCard>
          )}

          {/* Gráfico 2: Top Chamados */}
          {topChamados && topChamados.length > 0 && (
            <ChartCard title="Top 5 Chamados por Horas">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={topChamados.slice(0, 5)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="chamado"
                    stroke="#6b7280"
                    tickLine={false}
                    axisLine={{ stroke: '#d1d5db', strokeWidth: 1 }}
                    tick={{
                      fill: '#111827',
                      fontSize: 13,
                      fontWeight: 800,
                      letterSpacing: '0.2em',
                      textAnchor: 'middle',
                    }}
                    tickFormatter={formatarNumeros}
                    textAnchor="end"
                    interval={0}
                    height={60}
                  />
                  <YAxis
                    stroke="#6b7280"
                    tickLine={false}
                    axisLine={{ stroke: '#d1d5db', strokeWidth: 1 }}
                    tick={{
                      fill: '#111827',
                      fontSize: 13,
                      fontWeight: 800,
                      letterSpacing: '0.2em',
                    }}
                  />
                  <Tooltip
                    content={
                      <CustomTooltip
                        labelFormatter={(label) =>
                          `Chamado - ${formatarNumeros(label)}`
                        }
                        valueFormatter={(value) =>
                          `${formatarHorasTotaisSufixo(value)}`
                        }
                      />
                    }
                  />
                  <Legend />
                  <Bar
                    dataKey="horas"
                    fill={COLORS.secondary}
                    radius={[8, 8, 0, 0]}
                    name="Horas Consumidas"
                  />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-4 space-y-1">
                {topChamados.slice(0, 3).map(
                  (
                    chamado: {
                      chamado: string | number;
                      cliente: string;
                      horas: number;
                    },
                    index: number,
                  ) => (
                    <div
                      key={chamado.chamado}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-black tracking-widest select-none font-extrabold text-sm">
                        {index + 1} - {chamado.cliente}
                      </span>
                      <span className="font-extrabold text-black tracking-widest select-none text-sm">
                        {formatarHorasTotaisSufixo(chamado.horas)}
                      </span>
                    </div>
                  ),
                )}
              </div>
            </ChartCard>
          )}

          {/* Gráfico 3: Distribuição por Status */}
          {isAdmin && horasPorStatus && horasPorStatus.length > 0 && (
            <ChartCard title="Distribuição de Horas por Status">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={horasPorStatus}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry: { status?: string; percentual?: number }) =>
                      `${entry.status}: ${entry.percentual}%`
                    }
                    outerRadius={90}
                    fill="#8884d8"
                    dataKey="horas"
                  >
                    {horasPorStatus.map(
                      (
                        entry: {
                          status: string;
                          horas: number;
                          percentual?: number;
                        },
                        index: number,
                      ) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS.pie[index % COLORS.pie.length]}
                        />
                      ),
                    )}
                  </Pie>
                  <Tooltip
                    content={
                      <CustomTooltip
                        valueFormatter={(value) =>
                          `${formatarHorasTotaisSufixo(value)}`
                        }
                      />
                    }
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {horasPorStatus.map(
                  (
                    status: {
                      status: string;
                      horas: number;
                      percentual?: number;
                    },
                    index: number,
                  ) => (
                    <div
                      key={status.status}
                      className="flex items-center gap-2"
                    >
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{
                          backgroundColor:
                            COLORS.pie[index % COLORS.pie.length],
                        }}
                      />
                      <span className="text-sm text-slate-800 font-semibold select-none tracking-widest">
                        {status.status}
                      </span>
                    </div>
                  ),
                )}
              </div>
            </ChartCard>
          )}

          {/* Gráfico 4: Horas por Recurso */}
          {horasPorRecurso && horasPorRecurso.length > 0 && (
            <ChartCard title="Horas por Recurso">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={horasPorRecurso} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    type="number"
                    stroke="#6b7280"
                    tickLine={false}
                    axisLine={{ stroke: '#d1d5db', strokeWidth: 1 }}
                    tick={{
                      fill: '#111827',
                      fontSize: 13,
                      fontWeight: 800,
                      letterSpacing: '0.2em',
                      textAnchor: 'middle',
                    }}
                  />
                  <YAxis
                    dataKey="recurso"
                    type="category"
                    width={100}
                    stroke="#6b7280"
                    tickLine={false}
                    axisLine={{ stroke: '#d1d5db', strokeWidth: 1 }}
                    tick={{
                      fill: '#111827',
                      fontSize: 13,
                      fontWeight: 800,
                      letterSpacing: '0.2em',
                    }}
                    tickFormatter={renderizarPrimeiroNome}
                    interval={0}
                    height={60}
                  />
                  <Tooltip
                    content={
                      <CustomTooltip
                        labelFormatter={(label) =>
                          renderizarDoisPrimeirosNomes(
                            corrigirTextoCorrompido(label),
                          )
                        }
                        valueFormatter={(value) =>
                          `${formatarHorasTotaisSufixo(value)}`
                        }
                      />
                    }
                  />
                  <Legend />
                  <Bar
                    dataKey="horas"
                    fill={COLORS.success}
                    radius={[0, 8, 8, 0]}
                    name="Horas Trabalhadas"
                  />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-4 p-3 bg-slate-100 rounded-md border shadow-xs shadow-black">
                <p className="text-base text-black tracking-widest select-none font-extrabold">
                  <span className="font-semibold">Média por recurso:</span>{' '}
                  {formatarHorasTotaisSufixo(
                    horasPorRecurso.reduce(
                      (acc: number, r: { horas: number }) => acc + r.horas,
                      0,
                    ) / horasPorRecurso.length,
                  )}
                </p>
              </div>
            </ChartCard>
          )}

          {/* Gráfico 5: Horas por Cliente */}
          {isAdmin && horasPorCliente && horasPorCliente.length > 0 && (
            <ChartCard title="Horas por Cliente">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={horasPorCliente.slice(0, 10)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="cliente"
                    stroke="#6b7280"
                    tickLine={false}
                    axisLine={{ stroke: '#d1d5db', strokeWidth: 1 }}
                    tick={{
                      fill: '#111827',
                      fontSize: 13,
                      fontWeight: 800,
                      letterSpacing: '0.2em',
                    }}
                    tickFormatter={renderizarPrimeiroNome}
                    angle={-35}
                    textAnchor="end"
                    interval={0}
                    height={100}
                  />
                  <YAxis
                    stroke="#6b7280"
                    tickLine={false}
                    axisLine={{ stroke: '#d1d5db', strokeWidth: 1 }}
                    tick={{
                      fill: '#111827',
                      fontSize: 13,
                      fontWeight: 800,
                      letterSpacing: '0.2em',
                    }}
                  />
                  <Tooltip
                    content={
                      <CustomTooltip
                        valueFormatter={(value) =>
                          `${formatarHorasTotaisSufixo(value)}`
                        }
                      />
                    }
                  />
                  <Legend />
                  <Bar
                    dataKey="horas"
                    fill={COLORS.info}
                    radius={[8, 8, 0, 0]}
                    name="Horas"
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          )}

          {/* Gráfico 6: Horas por Mês */}
          {horasPorMes && horasPorMes.length > 0 && (
            <ChartCard title={`Horas Totais por Mês - ${filters.ano}`}>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={horasPorMes}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="mes"
                    stroke="#6b7280"
                    tickLine={false}
                    axisLine={{ stroke: '#d1d5db', strokeWidth: 1 }}
                    tick={{
                      fill: '#111827',
                      fontSize: 13,
                      fontWeight: 800,
                      letterSpacing: '0.2em',
                      textAnchor: 'middle',
                    }}
                    interval={0}
                    height={60}
                  />
                  <YAxis
                    stroke="#6b7280"
                    tickLine={false}
                    axisLine={{ stroke: '#d1d5db', strokeWidth: 1 }}
                    tick={{
                      fill: '#111827',
                      fontSize: 13,
                      fontWeight: 800,
                      letterSpacing: '0.2em',
                    }}
                  />
                  <Tooltip
                    content={
                      <CustomTooltip
                        labelFormatter={(label) => label}
                        valueFormatter={(value) =>
                          `${formatarHorasTotaisSufixo(value)}`
                        }
                      />
                    }
                  />
                  <Legend />
                  <Bar
                    dataKey="horas"
                    fill={COLORS.gradient}
                    radius={[8, 8, 0, 0]}
                    name="Total de Horas"
                  >
                    {horasPorMes.map((entry: any, index: number) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={
                          entry.mesNum === filters.mes
                            ? COLORS.danger
                            : COLORS.gradient
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="flex items-center justify-between mt-4 p-3 bg-slate-100 rounded-md border shadow-xs shadow-black text-base text-black tracking-widest select-none font-extrabold">
                <div>
                  <span className="font-semibold">Total anual:</span>{' '}
                  {formatarHorasTotaisSufixo(
                    horasPorMes.reduce(
                      (acc: number, m: { horas: number }) => acc + m.horas,
                      0,
                    ),
                  )}
                </div>
                <div>
                  <span className="ml-3 font-semibold">Média mensal:</span>{' '}
                  {formatarHorasTotaisSufixo(
                    horasPorMes.reduce(
                      (acc: number, m: { horas: number }) => acc + m.horas,
                      0,
                    ) / 12,
                  )}
                </div>
              </div>
            </ChartCard>
          )}
        </div>

        {/* Resumo Estatístico */}
        {totalizadores && (
          <div className="bg-white rounded-xl shadow-md shadow-black p-6 border flex flex-col gap-6">
            <h3 className="text-lg font-extrabold text-black tracking-widest select-none">
              RESUMO DAS MÉTRICAS
            </h3>
            <div className="grid grid-cols-4 gap-6">
              <div className="text-center p-4 bg-orange-100 rounded-md shadow-xs shadow-black border">
                <p className="text-sm text-orange-600 font-semibold tracking-widest select-none mb-2">
                  CHAMADOS
                </p>
                <p className="text-2xl font-bold text-orange-700 tracking-widest select-none">
                  {totalizadores.TOTAL_CHAMADOS}
                </p>
              </div>
              <div className="text-center p-4 bg-pink-100 rounded-md shadow-xs shadow-black border">
                <p className="text-sm text-pink-600 font-semibold tracking-widest select-none mb-2">
                  ORDENS DE SERVIÇO
                </p>
                <p className="text-2xl font-bold text-pink-700 tracking-widest select-none">
                  {totalizadores.TOTAL_OS}
                </p>
              </div>
              <div className="text-center p-4 bg-blue-100 rounded-md shadow-xs shadow-black border">
                <p className="text-sm text-blue-600 font-semibold tracking-widest select-none mb-2">
                  TOTAL DE HORAS
                </p>
                <p className="text-2xl font-bold text-blue-700 tracking-widest select-none">
                  {formatarHorasTotaisSufixo(totalizadores.TOTAL_HRS)}
                </p>
              </div>
              <div className="text-center p-4 bg-green-100 rounded-md shadow-xs shadow-black border">
                <p className="text-sm text-green-600 font-semibold tracking-widest select-none mb-2">
                  CONSULTORES
                </p>
                <p className="text-2xl font-bold text-green-700 tracking-widest select-none">
                  {formatarHorasTotaisSufixo(totalizadores.TOTAL_RECURSOS)}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
