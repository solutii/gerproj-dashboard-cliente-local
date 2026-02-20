import { useQuery } from '@tanstack/react-query';
import React from 'react';
import { FaExclamationTriangle } from 'react-icons/fa';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    ComposedChart,
    Legend,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { useAuth } from '../../../../context/AuthContext';
import {
    formatarHorasArredondadas,
    formatarHorasTotaisSufixo,
} from '../../../../formatters/formatar-hora';
import { corrigirTextoCorrompido } from '../../../../formatters/formatar-texto-corrompido';
import {
    renderizarDoisPrimeirosNomes,
    renderizarPrimeiroNome,
} from '../../../../formatters/remover-acentuacao';

// ==================== Interfaces ====================
interface FilterProps {
    filters: {
        ano: number;
        mes: number;
        cliente: string;
        recurso: string;
        status: string;
    };
}

// ==================== Cores Padrão ====================
const COLORS = {
    primary: '#3b82f6',
    secondary: '#8b5cf6',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    info: '#06b6d4',
    gradient: '#f97316',
    pie: ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#6366f1'],
};

// ==================== Componente Tooltip customizado ====================
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
        <div className="rounded-md border bg-white px-4 py-2 shadow-xs shadow-black">
            <p className="mb-1 text-sm font-semibold tracking-widest text-black select-none">
                {labelFormatter ? labelFormatter(label) : label}
            </p>
            {payload.map((entry, index) => (
                <p
                    key={index}
                    className="mb-1 text-sm font-semibold tracking-widest select-none"
                    style={{ color: entry?.color || undefined }}
                >
                    {entry?.name}:{' '}
                    <span className="mb-1 text-sm font-semibold tracking-widest select-none">
                        {valueFormatter ? valueFormatter(entry?.value) : entry?.value}
                    </span>
                </p>
            ))}
        </div>
    );
};

// ==================== Componente Card para Gráficos ====================
type ChartCardProps = {
    title: string;
    children?: React.ReactNode;
    variant?: 'primary' | 'secondary' | 'tertiary' | 'quaternary' | 'quinary';
};

const borderColorClasses = {
    primary: 'border-l-orange-600',
    secondary: 'border-l-purple-600',
    tertiary: 'border-l-cyan-600',
    quaternary: 'border-l-blue-600',
    quinary: 'border-l-green-600',
};

const ChartCard: React.FC<ChartCardProps> = ({ title, children, variant = 'primary' }) => (
    <div
        className={`rounded-xl border border-l-8 ${borderColorClasses[variant]} bg-white p-4 shadow-md shadow-black`}
    >
        <h3 className="mb-2 text-base font-semibold tracking-widest text-black uppercase select-none">
            {title}
        </h3>
        {children}
    </div>
);

// ==================== Componente Skeleton de Loading ====================
const SkeletonLoadingCard = ({ variant = 'primary' }: { variant?: string }) => {
    const borderColorClasses: Record<string, string> = {
        primary: 'border-l-orange-600',
        secondary: 'border-l-purple-600',
        tertiary: 'border-l-cyan-600',
        quaternary: 'border-l-blue-600',
        quinary: 'border-l-green-600',
    };

    const spinnerColorClasses: Record<string, { outer: string; inner: string; center: string }> = {
        primary: {
            outer: 'border-t-orange-600 border-r-orange-400',
            inner: 'border-b-orange-600 border-l-orange-400',
            center: 'from-orange-100 to-orange-100 bg-gradient-to-br from-orange-500 to-orange-500',
        },
        secondary: {
            outer: 'border-t-purple-600 border-r-purple-400',
            inner: 'border-b-purple-600 border-l-purple-400',
            center: 'from-purple-100 to-purple-100 bg-gradient-to-br from-purple-500 to-purple-500',
        },
        tertiary: {
            outer: 'border-t-cyan-600 border-r-cyan-400',
            inner: 'border-b-cyan-600 border-l-cyan-400',
            center: 'from-cyan-100 to-cyan-100 bg-gradient-to-br from-cyan-500 to-cyan-500',
        },
        quaternary: {
            outer: 'border-t-blue-600 border-r-blue-400',
            inner: 'border-b-blue-600 border-l-blue-400',
            center: 'from-blue-100 to-blue-100 bg-gradient-to-br from-blue-500 to-blue-500',
        },
        quinary: {
            outer: 'border-t-green-600 border-r-green-400',
            inner: 'border-b-green-600 border-l-green-400',
            center: 'from-green-100 to-green-100 bg-gradient-to-br from-green-500 to-green-500',
        },
    };

    const colors = spinnerColorClasses[variant] || spinnerColorClasses.primary;

    return (
        <div
            className={`rounded-xl border border-l-8 ${borderColorClasses[variant]} bg-white p-4 shadow-md shadow-black`}
        >
            {/* Título Skeleton */}
            <div className="mb-4 h-6 w-3/4 animate-pulse rounded bg-gray-200"></div>

            {/* Container do Spinner */}
            <div className="flex h-[300px] items-center justify-center sm:h-[320px] lg:h-[350px]">
                <div className="relative h-20 w-20">
                    {/* Círculo externo girando no sentido horário */}
                    <div
                        className={`absolute inset-0 animate-spin rounded-full border-4 border-transparent ${colors.outer}`}
                    ></div>

                    {/* Círculo interno girando no sentido anti-horário */}
                    <div
                        className={`animate-spin-reverse absolute inset-2 rounded-full border-4 border-transparent ${colors.inner}`}
                    ></div>

                    {/* Círculo central estático */}
                    <div
                        className={`absolute inset-4 flex items-center justify-center rounded-full ${colors.center.split('bg-gradient-to-br')[0]} bg-gradient-to-br ${colors.center.split('bg-gradient-to-br')[1]}`}
                    >
                        <div
                            className={`h-6 w-6 animate-pulse rounded-full ${colors.center.split('from-')[1].split('to-')[0].includes('100') ? 'bg-gradient-to-br' : 'bg-gradient-to-br'} ${colors.center.split('from-')[2]}`}
                        ></div>
                    </div>
                </div>
            </div>

            {/* Footer Skeleton (opcional) */}
            <div className="mt-4 h-12 animate-pulse rounded-md bg-gray-100"></div>

            {/* Animação CSS personalizada */}
            <style jsx>{`
                @keyframes spin-reverse {
                    from {
                        transform: rotate(360deg);
                    }
                    to {
                        transform: rotate(0deg);
                    }
                }
                .animate-spin-reverse {
                    animation: spin-reverse 1s linear infinite;
                }
            `}</style>
        </div>
    );
};

// ==================== Funções de Fetch ====================
const fetchOrdensServico = async (
    filters: FilterProps['filters'],
    isAdmin: boolean,
    codCliente: string | null
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

    const response = await fetch(`/api/dashboard/graficos?${params.toString()}`);

    if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.status}`);
    }

    return response.json();
};

// Função para buscar dados do histórico de saldo
const fetchSaldoHistorico = async (
    codCliente: string,
    mes: number,
    ano: number,
    isAdmin: boolean
) => {
    const params = new URLSearchParams({
        codCliente: codCliente,
        mes: mes.toString(),
        ano: ano.toString(),
        mesesHistorico: '6',
        isAdmin: isAdmin.toString(),
    });

    const response = await fetch(`/api/saldo-horas?${params.toString()}`);

    if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.status}`);
    }

    return response.json();
};

// ================================================================================
// COMPONENTE PRINCIPAL
// ================================================================================
export function Graficos({ filters }: FilterProps) {
    const { isAdmin, codCliente } = useAuth();

    const {
        data: dados,
        isLoading,
        isError,
        error,
        refetch,
    } = useQuery({
        queryKey: ['graficos', filters, isAdmin, codCliente],
        queryFn: () => fetchOrdensServico(filters, isAdmin, codCliente),
        staleTime: 1000 * 60 * 5,
        retry: 1,
    });

    // Query para buscar dados do saldo histórico
    const { data: dadosSaldo } = useQuery({
        queryKey: ['saldo-horas', filters.cliente, filters.mes, filters.ano, isAdmin],
        queryFn: () => {
            const clienteId = filters.cliente || codCliente;
            if (!clienteId) return Promise.resolve(null);
            return fetchSaldoHistorico(clienteId, filters.mes, filters.ano, isAdmin);
        },
        enabled: !!(filters.cliente || codCliente),
        staleTime: 1000 * 60 * 5,
        retry: 1,
    });

    if (isLoading) {
        return (
            <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2 lg:gap-10">
                <SkeletonLoadingCard variant="primary" />
                <SkeletonLoadingCard variant="secondary" />
                <SkeletonLoadingCard variant="tertiary" />
                <SkeletonLoadingCard variant="quaternary" />
                <SkeletonLoadingCard variant="quinary" />
            </div>
        );
    }

    if (isError || !dados || !dados.graficos) {
        return (
            <div>
                <div className="flex h-32 cursor-not-allowed flex-col items-center justify-center rounded-xl border border-red-400 bg-red-100 shadow-md shadow-black sm:h-36 lg:h-40">
                    <div className="flex flex-col items-center justify-center gap-2 p-2">
                        <FaExclamationTriangle className="text-red-500" size={24} />
                        <span className="text-center text-sm font-semibold tracking-widest text-red-700 select-none sm:text-sm">
                            Erro ao carregar os dados
                        </span>
                        {error && (
                            <span className="max-w-xs text-center text-sm font-semibold tracking-widest text-red-700 select-none sm:text-xs">
                                {error instanceof Error ? error.message : 'Erro desconhecido'}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    const { horasPorDia, horasPorRecurso, horasPorCliente, horasPorMes } = dados.graficos;
    const { totalizadores } = dados;

    // ================================================================================
    // RENDERIZAÇÃO PRINCIPAL
    // ================================================================================
    return (
        <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2 lg:gap-10">
            {/* Gráfico: Horas totais por Mês */}
            {horasPorMes && horasPorMes.length > 0 && (
                <ChartCard title={`Horas Totais por Mês - ${filters.ano}`} variant="primary">
                    <ResponsiveContainer
                        width="100%"
                        height={300}
                        className="sm:h-[320px] lg:h-[350px]"
                    >
                        <BarChart
                            data={horasPorMes}
                            margin={{ top: 20, right: 10, left: 10, bottom: 20 }}
                        >
                            <XAxis
                                dataKey="mes"
                                stroke="#000000"
                                tickLine={false}
                                axisLine={{ stroke: '#000000', strokeWidth: 1 }}
                                tick={{
                                    fill: '#000000',
                                    fontSize: 12,
                                    fontWeight: 800,
                                    letterSpacing: '0.2em',
                                    textAnchor: 'middle',
                                }}
                                interval={0}
                                height={60}
                            />
                            <YAxis
                                stroke="#000000"
                                tickLine={false}
                                axisLine={{ stroke: '#000000', strokeWidth: 1 }}
                                tick={{
                                    fill: '#000000',
                                    fontSize: 12,
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
                            <Legend
                                wrapperStyle={{
                                    fontSize: '14px',
                                    letterSpacing: '0.2em',
                                    fontWeight: '800',
                                }}
                            />
                            <Bar
                                dataKey="horas"
                                fill={COLORS.gradient}
                                radius={[8, 8, 0, 0]}
                                name="Total de Horas"
                                label={{
                                    position: 'top',
                                    fill: '#000000',
                                    fontSize: 12,
                                    fontWeight: 800,
                                    letterSpacing: '0.2em',
                                    formatter: (value: number) => formatarHorasArredondadas(value),
                                }}
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
                    <div className="mt-4 flex items-center justify-between rounded-md border bg-slate-100 px-4 py-2 text-base font-semibold tracking-widest text-black shadow-xs shadow-black select-none">
                        <div>
                            <span className="font-semibold">Total anual:</span>{' '}
                            {formatarHorasTotaisSufixo(
                                horasPorMes.reduce(
                                    (acc: number, m: { horas: number }) => acc + m.horas,
                                    0
                                )
                            )}
                        </div>
                        <div>
                            <span className="font-semibold">Média mensal:</span>{' '}
                            {formatarHorasTotaisSufixo(
                                horasPorMes.reduce(
                                    (acc: number, m: { horas: number }) => acc + m.horas,
                                    0
                                ) / 12
                            )}
                        </div>
                    </div>
                </ChartCard>
            )}

            {/* Gráfico: Evolução de Saldo */}
            {dadosSaldo && dadosSaldo.historico && dadosSaldo.historico.length > 0 && (
                <ChartCard
                    title={`Evolução de Saldo - ${dadosSaldo.nomeCliente}`}
                    variant="secondary"
                >
                    <ResponsiveContainer
                        width="100%"
                        height={300}
                        className="sm:h-[320px] lg:h-[350px]"
                    >
                        <ComposedChart
                            data={dadosSaldo.historico}
                            margin={{ top: 20, right: 10, left: 10, bottom: 20 }}
                        >
                            <XAxis
                                dataKey="mes"
                                stroke="#000000"
                                tickLine={false}
                                axisLine={{ stroke: '#000000', strokeWidth: 1 }}
                                tick={{
                                    fill: '#000000',
                                    fontSize: 12,
                                    fontWeight: 800,
                                    letterSpacing: '0.2em',
                                }}
                                tickFormatter={(value, index) => {
                                    const item = dadosSaldo.historico[index];
                                    return `${item.mes.toString().padStart(2, '0')}/${item.ano}`;
                                }}
                                angle={-35}
                                textAnchor="end"
                                height={80}
                            />
                            <YAxis
                                stroke="#000000"
                                tickLine={false}
                                axisLine={{ stroke: '#000000', strokeWidth: 1 }}
                                tick={{
                                    fill: '#000000',
                                    fontSize: 12,
                                    fontWeight: 800,
                                    letterSpacing: '0.2em',
                                }}
                            />
                            <Tooltip
                                content={({ active, payload }) => {
                                    if (!active || !payload || !payload.length) return null;

                                    const data = payload[0].payload;

                                    return (
                                        <div className="rounded-md border bg-white px-4 py-2 shadow-md shadow-black">
                                            <p className="mb-1 text-sm font-semibold tracking-widest text-black select-none">
                                                {data.mes.toString().padStart(2, '0')}/{data.ano}
                                            </p>
                                            <p className="mb-1 text-sm font-semibold tracking-widest text-blue-600 select-none">
                                                Contratadas:{' '}
                                                <span>
                                                    {formatarHorasTotaisSufixo(
                                                        data.horasContratadas
                                                    )}
                                                </span>
                                            </p>
                                            <p className="mb-1 text-sm font-semibold tracking-widest text-purple-600 select-none">
                                                Executadas:{' '}
                                                <span>
                                                    {formatarHorasTotaisSufixo(
                                                        data.horasExecutadas
                                                    )}
                                                </span>
                                            </p>
                                            <p
                                                className={`mb-1 text-sm font-semibold tracking-widest select-none ${
                                                    data.saldoLiquido > 0
                                                        ? 'text-green-600'
                                                        : data.saldoLiquido < 0
                                                          ? 'text-red-600'
                                                          : 'text-black'
                                                }`}
                                            >
                                                Saldo: {data.saldoLiquido > 0 ? '+' : ''}
                                                {formatarHorasTotaisSufixo(data.saldoLiquido)}
                                            </p>
                                            {data.compensacoes && data.compensacoes.length > 0 && (
                                                <p className="mb-1 text-sm font-semibold tracking-widest text-orange-600 select-none">
                                                    {data.compensacoes.length}{' '}
                                                    {data.compensacoes.length === 1
                                                        ? 'Compensação'
                                                        : 'Compensações'}
                                                </p>
                                            )}
                                            <p
                                                className="text-sm font-semibold tracking-widest select-none"
                                                style={{
                                                    color:
                                                        data.status === 'disponivel'
                                                            ? '#10b981'
                                                            : data.status === 'negativo'
                                                              ? '#ef4444'
                                                              : data.status === 'compensado'
                                                                ? '#3b82f6'
                                                                : data.status === 'expirado'
                                                                  ? '#9ca3af'
                                                                  : '#6b7280',
                                                }}
                                            >
                                                {data.status === 'disponivel'
                                                    ? '✓ Disponível'
                                                    : data.status === 'negativo'
                                                      ? '⚠ Débito'
                                                      : data.status === 'compensado'
                                                        ? '⇄ Compensado'
                                                        : data.status === 'expirado'
                                                          ? '✗ Expirado'
                                                          : '○ Zerado'}
                                            </p>
                                        </div>
                                    );
                                }}
                            />
                            <Legend
                                wrapperStyle={{
                                    fontSize: '14px',
                                    letterSpacing: '0.2em',
                                    fontWeight: '800',
                                }}
                                verticalAlign="top"
                                height={36}
                            />

                            <Bar
                                dataKey="horasContratadas"
                                fill={COLORS.primary}
                                name="Contratadas"
                                radius={[8, 8, 0, 0]}
                                label={{
                                    position: 'top',
                                    fill: '#000000',
                                    fontSize: 12,
                                    fontWeight: 800,
                                    letterSpacing: '0.2em',
                                    formatter: (value: number) => formatarHorasArredondadas(value),
                                }}
                            />
                            <Bar
                                dataKey="horasExecutadas"
                                fill={COLORS.secondary}
                                name="Executadas"
                                radius={[8, 8, 0, 0]}
                                label={{
                                    position: 'top',
                                    fill: '#000000',
                                    fontSize: 12,
                                    fontWeight: 800,
                                    letterSpacing: '0.2em',
                                    formatter: (value: number) => formatarHorasArredondadas(value),
                                }}
                            />

                            <Line
                                type="monotone"
                                dataKey="saldoLiquido"
                                stroke={COLORS.danger}
                                strokeWidth={3}
                                dot={(props: any) => {
                                    const { cx, cy, payload, index } = props;
                                    const color =
                                        payload.saldoLiquido > 0
                                            ? COLORS.success
                                            : payload.saldoLiquido < 0
                                              ? COLORS.danger
                                              : '#6b7280';
                                    return (
                                        <circle
                                            key={`dot-${index}`}
                                            cx={cx}
                                            cy={cy}
                                            r={5}
                                            fill={color}
                                            stroke="#fff"
                                            strokeWidth={2}
                                        />
                                    );
                                }}
                                name="Saldo Líquido"
                            />
                        </ComposedChart>
                    </ResponsiveContainer>

                    <div className="mt-4 grid grid-cols-4 gap-6">
                        <div className="flex items-center gap-2 rounded-md border bg-green-100 px-4 py-2 shadow-xs shadow-black">
                            <p className="text-semibold tracking-widest text-green-800 select-none">
                                Crédito =
                            </p>
                            <p className="text-semibold tracking-widest text-green-800 select-none">
                                {formatarHorasTotaisSufixo(dadosSaldo.saldoTotalDisponivel)}
                            </p>
                        </div>

                        <div className="flex items-center gap-2 rounded-md border bg-red-100 px-4 py-2 shadow-xs shadow-black">
                            <p className="text-semibold tracking-widest text-red-800 select-none">
                                Débito Total =
                            </p>
                            <p className="text-semibold tracking-widest text-red-800 select-none">
                                {formatarHorasTotaisSufixo(dadosSaldo.debitoTotal)}
                            </p>
                        </div>

                        <div
                            className={`flex items-center gap-2 rounded-md border ${
                                dadosSaldo.resumo.saldoGeral > 0
                                    ? 'bg-green-100 px-4 py-2 shadow-xs shadow-black'
                                    : dadosSaldo.resumo.saldoGeral < 0
                                      ? 'bg-red-100 px-4 py-2 shadow-xs shadow-black'
                                      : 'bg-gray-100 px-4 py-2 shadow-xs shadow-black'
                            }`}
                        >
                            <p
                                className={`text-semibold tracking-widest ${
                                    dadosSaldo.resumo.saldoGeral > 0
                                        ? 'text-green-700'
                                        : dadosSaldo.resumo.saldoGeral < 0
                                          ? 'text-red-700'
                                          : 'text-gray-700'
                                } select-none`}
                            >
                                Saldo Geral
                            </p>
                            <p
                                className={`text-semibold tracking-widest ${
                                    dadosSaldo.resumo.saldoGeral > 0
                                        ? 'text-green-700'
                                        : dadosSaldo.resumo.saldoGeral < 0
                                          ? 'text-red-700'
                                          : 'text-gray-700'
                                }`}
                            >
                                {dadosSaldo.resumo.saldoGeral > 0 ? '+' : ''}
                                {formatarHorasTotaisSufixo(dadosSaldo.resumo.saldoGeral)}
                            </p>
                        </div>

                        <div className="flex items-center gap-2 rounded-md border bg-yellow-100 px-4 py-2 shadow-xs shadow-black">
                            <p className="text-semibold tracking-widest text-yellow-800 select-none">
                                Compensações =
                            </p>
                            <p className="text-semibold tracking-widest text-yellow-800 select-none">
                                {dadosSaldo.resumo.mesesCompensados} meses
                            </p>
                        </div>
                    </div>
                </ChartCard>
            )}

            {/* Gráfico: Horas por Cliente */}
            {isAdmin && !filters.cliente && horasPorCliente && horasPorCliente.length > 0 && (
                <ChartCard
                    title={`Horas por Cliente - ${filters.mes}/${filters.ano}`}
                    variant="tertiary"
                >
                    <ResponsiveContainer
                        width="100%"
                        height={300}
                        className="sm:h-[320px] lg:h-[350px]"
                    >
                        <BarChart
                            data={horasPorCliente.slice(0, 10)}
                            margin={{ top: 20, right: 10, left: 10, bottom: 20 }}
                        >
                            <XAxis
                                dataKey="cliente"
                                stroke="#000000"
                                tickLine={false}
                                axisLine={{ stroke: '#000000', strokeWidth: 1 }}
                                tick={{
                                    fill: '#000000',
                                    fontSize: 12,
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
                                stroke="#000000"
                                tickLine={false}
                                axisLine={{ stroke: '#000000', strokeWidth: 1 }}
                                tick={{
                                    fill: '#000000',
                                    fontSize: 12,
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
                            <Legend
                                wrapperStyle={{
                                    fontSize: '14px',
                                    letterSpacing: '0.2em',
                                    fontWeight: 800,
                                }}
                            />
                            <Bar
                                dataKey="horas"
                                fill={COLORS.info}
                                radius={[8, 8, 0, 0]}
                                name="Horas"
                                label={{
                                    position: 'top',
                                    fill: '#000000',
                                    fontSize: 12,
                                    fontWeight: 800,
                                    letterSpacing: '0.2em',
                                    formatter: (value: number) => formatarHorasArredondadas(value),
                                }}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </ChartCard>
            )}

            {/* Gráfico: Evolução Diária de Horas */}
            {horasPorDia && horasPorDia.length > 0 && (
                <ChartCard
                    title={`Evolução Diária de Horas - ${filters.mes}/${filters.ano}`}
                    variant="quaternary"
                >
                    <ResponsiveContainer
                        width="100%"
                        height={300}
                        className="sm:h-[320px] lg:h-[350px]"
                    >
                        <LineChart
                            data={horasPorDia}
                            margin={{ top: 20, right: 10, left: 10, bottom: 20 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis
                                dataKey="data"
                                stroke="#000000"
                                tickLine={false}
                                axisLine={{ stroke: '#000000', strokeWidth: 1 }}
                                tick={{
                                    fill: '#000000',
                                    fontSize: 12,
                                    fontWeight: 800,
                                    letterSpacing: '0.2em',
                                    textAnchor: 'middle',
                                }}
                                tickFormatter={(value) => {
                                    const day = value.split(/[\/\-]/)[0];
                                    return day;
                                }}
                            />
                            <YAxis
                                stroke="#000000"
                                tickLine={false}
                                axisLine={{ stroke: '#000000', strokeWidth: 1 }}
                                tick={{
                                    fill: '#000000',
                                    fontSize: 12,
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
                            <Legend
                                wrapperStyle={{
                                    fontSize: '14px',
                                    letterSpacing: '0.2em',
                                    fontWeight: '800',
                                }}
                            />
                            <Line
                                type="monotone"
                                dataKey="horas"
                                stroke={COLORS.primary}
                                strokeWidth={2}
                                dot={{ fill: COLORS.primary, r: 3 }}
                                activeDot={{ r: 5 }}
                                name="Horas Trabalhadas"
                            />
                        </LineChart>
                    </ResponsiveContainer>
                    <div className="mt-4 rounded-md border bg-slate-100 px-4 py-2 shadow-xs shadow-black">
                        <p className="text-base font-semibold tracking-widest text-black select-none">
                            <span>Total no período:</span>{' '}
                            {formatarHorasTotaisSufixo(totalizadores?.TOTAL_HRS || 0)}
                        </p>
                    </div>
                </ChartCard>
            )}

            {/* Gráfico: Horas por Recurso */}
            {horasPorRecurso && horasPorRecurso.length > 0 && (
                <ChartCard
                    title={`Horas por Recurso - ${filters.mes}/${filters.ano}`}
                    variant="quinary"
                >
                    <ResponsiveContainer
                        width="100%"
                        height={300}
                        className="sm:h-[320px] lg:h-[350px]"
                    >
                        <BarChart
                            data={horasPorRecurso}
                            layout="vertical"
                            margin={{ top: 20, right: 10, left: 10, bottom: 20 }}
                        >
                            <XAxis
                                type="number"
                                stroke="#000000"
                                tickLine={false}
                                axisLine={{ stroke: '#000000', strokeWidth: 1 }}
                                tick={{
                                    fill: '#000000',
                                    fontSize: 12,
                                    fontWeight: 800,
                                    letterSpacing: '0.2em',
                                    textAnchor: 'middle',
                                }}
                            />
                            <YAxis
                                dataKey="recurso"
                                type="category"
                                width={120}
                                stroke="#000000"
                                tickLine={false}
                                axisLine={{ stroke: '#000000', strokeWidth: 1 }}
                                tick={{
                                    fill: '#000000',
                                    fontSize: 12,
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
                                                corrigirTextoCorrompido(label)
                                            )
                                        }
                                        valueFormatter={(value) =>
                                            `${formatarHorasTotaisSufixo(value)}`
                                        }
                                    />
                                }
                            />
                            <Legend
                                wrapperStyle={{
                                    fontSize: '14px',
                                    letterSpacing: '0.2em',
                                    fontWeight: 800,
                                }}
                            />
                            <Bar
                                dataKey="horas"
                                fill={COLORS.success}
                                radius={[0, 8, 8, 0]}
                                name="Horas Trabalhadas"
                                label={{
                                    position: 'right',
                                    fill: '#000000',
                                    fontSize: 12,
                                    fontWeight: 800,
                                    letterSpacing: '0.2em',
                                    formatter: (value: number) => formatarHorasTotaisSufixo(value),
                                }}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                    <div className="mt-4 rounded-md border bg-slate-100 px-4 py-2 shadow-xs shadow-black">
                        <p className="text-base font-semibold tracking-widest text-black select-none">
                            <span className="font-semibold">Média por recurso:</span>{' '}
                            {formatarHorasTotaisSufixo(
                                horasPorRecurso.reduce(
                                    (acc: number, r: { horas: number }) => acc + r.horas,
                                    0
                                ) / horasPorRecurso.length
                            )}
                        </p>
                    </div>
                </ChartCard>
            )}
        </div>
    );
}
