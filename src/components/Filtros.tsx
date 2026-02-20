import { useAuthStore } from '@/store/useAuthStore';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { IoClose } from 'react-icons/io5';
import { MdCalendarMonth, MdFilterAlt } from 'react-icons/md';
import { useDebounce } from 'use-debounce';
import { corrigirTextoCorrompido } from '../formatters/formatar-texto-corrompido';
import { useFiltersStore } from '../store/useFiltersStore';
import { Relogio } from './Relogio';

// ==================== INTERFACES ====================

interface Cliente {
    cod: string;
    nome: string;
}

interface Recurso {
    cod: string;
    nome: string;
}

// ==================== FUNÇÕES AUXILIARES ====================
// Limita o nome a um número máximo de palavras
function limitarNome(nome: string, maxPalavras: number = 2): string {
    if (!nome || typeof nome !== 'string') return '';
    const palavras = nome.trim().split(/\s+/);
    return palavras.slice(0, maxPalavras).join(' ');
}

// Processa o nome corrigindo texto corrompido e limitando palavras
function processarNome(nome: string, maxPalavras: number = 2): string {
    if (!nome || typeof nome !== 'string') return '';
    const nomeCorrigido = corrigirTextoCorrompido(nome);
    return limitarNome(nomeCorrigido, maxPalavras);
}

// ==================== FUNÇÕES DE FETCH ====================
const fetchClientes = async ({
    mes,
    ano,
    isAdmin,
    codCliente,
}: {
    mes: number;
    ano: number;
    isAdmin: boolean;
    codCliente: string | null;
}): Promise<Cliente[]> => {
    const params = new URLSearchParams();
    params.append('mes', mes.toString());
    params.append('ano', ano.toString());
    params.append('isAdmin', isAdmin.toString());

    if (!isAdmin && codCliente) {
        params.append('codCliente', codCliente);
    }

    const response = await fetch(`/api/filtros/clientes?${params.toString()}`);

    if (!response.ok) {
        throw new Error('Erro ao carregar clientes');
    }

    return response.json();
};

const fetchRecursos = async ({
    mes,
    ano,
    isAdmin,
    codCliente,
    clienteSelecionado,
}: {
    mes: number;
    ano: number;
    isAdmin: boolean;
    codCliente: string | null;
    clienteSelecionado: string;
}): Promise<Recurso[]> => {
    const params = new URLSearchParams();
    params.append('mes', mes.toString());
    params.append('ano', ano.toString());
    params.append('isAdmin', isAdmin.toString());

    if (!isAdmin && codCliente) {
        params.append('codCliente', codCliente);
    }

    if (isAdmin && clienteSelecionado) {
        params.append('cliente', clienteSelecionado);
    }

    const response = await fetch(`/api/filtros/recursos?${params.toString()}`);

    if (!response.ok) {
        throw new Error('Erro ao carregar recursos');
    }

    return response.json();
};

const fetchStatus = async ({
    mes,
    ano,
    isAdmin,
    codCliente,
    clienteSelecionado,
    recursoSelecionado,
}: {
    mes: number;
    ano: number;
    isAdmin: boolean;
    codCliente: string | null;
    clienteSelecionado: string;
    recursoSelecionado: string;
}): Promise<string[]> => {
    const params = new URLSearchParams();
    params.append('mes', mes.toString());
    params.append('ano', ano.toString());
    params.append('isAdmin', isAdmin.toString());

    if (!isAdmin && codCliente) {
        params.append('codCliente', codCliente);
    }

    if (isAdmin && clienteSelecionado) {
        params.append('cliente', clienteSelecionado);
    }

    if (recursoSelecionado) {
        params.append('recurso', recursoSelecionado);
    }

    const response = await fetch(`/api/filtros/status?${params.toString()}`);

    if (!response.ok) {
        throw new Error('Erro ao carregar status');
    }

    return response.json();
};

// ================================================================================
// COMPONENTE PRINCIPAL
// ================================================================================
export function Filtros() {
    const hoje = new Date();
    const anoAtual = hoje.getFullYear();
    const mesAtual = hoje.getMonth() + 1;

    const filters = useFiltersStore((state) => state.filters);
    const setFilters = useFiltersStore((state) => state.setFilters);

    const { isAdmin, codCliente } = useAuthStore();

    const [ano, setAno] = useState(filters.ano);
    const [mes, setMes] = useState(filters.mes);
    const [clienteSelecionado, setClienteSelecionado] = useState(filters.cliente);
    const [recursoSelecionado, setRecursoSelecionado] = useState(filters.recurso);
    const [statusSelecionado, setStatusSelecionado] = useState(filters.status);
    const [isInitialized, setIsInitialized] = useState(false);

    useEffect(() => {
        setAno(filters.ano);
        setMes(filters.mes);
        setClienteSelecionado(filters.cliente);
        setRecursoSelecionado(filters.recurso);
        setStatusSelecionado(filters.status);
        setIsInitialized(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const [debouncedClienteSelecionado] = useDebounce(clienteSelecionado, 300);
    const [debouncedRecursoSelecionado] = useDebounce(recursoSelecionado, 300);
    const [debouncedStatusSelecionado] = useDebounce(statusSelecionado, 300);

    const { data: clientesData = [], isLoading: clientesLoading } = useQuery({
        queryKey: ['clientes', mes, ano, isAdmin, codCliente],
        queryFn: () => fetchClientes({ mes, ano, isAdmin, codCliente }),
        enabled: !!(mes && ano && isInitialized),
        staleTime: 1000 * 60 * 5,
        retry: 2,
    });

    const { data: recursosData = [], isLoading: recursosLoading } = useQuery({
        queryKey: ['recursos', mes, ano, isAdmin, codCliente, debouncedClienteSelecionado],
        queryFn: () =>
            fetchRecursos({
                mes,
                ano,
                isAdmin,
                codCliente,
                clienteSelecionado: debouncedClienteSelecionado,
            }),
        enabled: !!(mes && ano && (isAdmin || codCliente) && isInitialized),
        staleTime: 1000 * 60 * 5,
        retry: 2,
    });

    const { data: statusData = [], isLoading: statusLoading } = useQuery({
        queryKey: [
            'status',
            mes,
            ano,
            isAdmin,
            codCliente,
            debouncedClienteSelecionado,
            debouncedRecursoSelecionado,
        ],
        queryFn: () =>
            fetchStatus({
                mes,
                ano,
                isAdmin,
                codCliente,
                clienteSelecionado: debouncedClienteSelecionado,
                recursoSelecionado: debouncedRecursoSelecionado,
            }),
        enabled: !!(mes && ano && isInitialized && (isAdmin || codCliente)),
        staleTime: 1000 * 60 * 5,
        retry: 2,
    });

    useEffect(() => {
        if (!isInitialized) return;

        setFilters({
            ano,
            mes,
            cliente: debouncedClienteSelecionado,
            recurso: debouncedRecursoSelecionado,
            status: debouncedStatusSelecionado,
        });
    }, [
        ano,
        mes,
        debouncedClienteSelecionado,
        debouncedRecursoSelecionado,
        debouncedStatusSelecionado,
        isInitialized,
        setFilters,
    ]);

    useEffect(() => {
        if (!isInitialized) return;
        if (clienteSelecionado && clientesData.length > 0) {
            const clienteExiste = clientesData.some((c) => c.cod === clienteSelecionado);
            if (!clienteExiste) {
                setClienteSelecionado('');
                setRecursoSelecionado('');
                setStatusSelecionado('');
            }
        }
    }, [clientesData, clienteSelecionado, isInitialized]);

    useEffect(() => {
        if (!isInitialized) return;
        if (!isAdmin && codCliente && clientesData.length > 0) {
            setClienteSelecionado(codCliente);
        }
    }, [isAdmin, codCliente, clientesData, isInitialized]);

    useEffect(() => {
        if (!isInitialized) return;
        if (recursoSelecionado && recursosData.length > 0) {
            const recursoExiste = recursosData.some((r) => r.cod === recursoSelecionado);
            if (!recursoExiste) {
                setRecursoSelecionado('');
                setStatusSelecionado('');
            }
        }
    }, [recursosData, recursoSelecionado, isInitialized]);

    useEffect(() => {
        if (!isInitialized) return;
        if (statusSelecionado && statusData.length > 0) {
            const statusExiste = statusData.includes(statusSelecionado);
            if (!statusExiste) {
                setStatusSelecionado('');
            }
        }
    }, [statusData, statusSelecionado, isInitialized]);

    // ==================== CONSTANTES ====================
    const years = [2024, 2025, 2026];
    const months = [
        'Janeiro',
        'Fevereiro',
        'Março',
        'Abril',
        'Maio',
        'Junho',
        'Julho',
        'Agosto',
        'Setembro',
        'Outubro',
        'Novembro',
        'Dezembro',
    ];

    const isLoading = recursosLoading || statusLoading;

    // ==================== VERIFICAÇÃO DE FILTROS ATIVOS ====================
    const isAnoAtivo = ano !== anoAtual;
    const isMesAtivo = mes !== mesAtual;
    const isClienteAtivo = clienteSelecionado !== '';
    const isRecursoAtivo = recursoSelecionado !== '';
    const isStatusAtivo = statusSelecionado !== '';

    // ==================== COMPONENTE SELECT COM CLEAR ====================
    interface SelectWithClearProps {
        value: string | number;
        onChange: (value: string) => void;
        onClear: () => void;
        disabled?: boolean;
        options: Array<{ value: string | number; label: string }>;
        placeholder: string;
        className?: string;
        showClear?: boolean;
        isActive?: boolean;
    }

    function SelectWithClear({
        value,
        onChange,
        onClear,
        disabled,
        options,
        placeholder,
        className,
        showClear = true,
        isActive = false,
    }: SelectWithClearProps) {
        const hasValue = value !== '' && value !== 0;

        return (
            <div className="relative">
                <select
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    disabled={disabled}
                    className={`${className} ${hasValue && !disabled && showClear ? 'pr-12' : 'pr-8'} ${
                        isActive ? 'ring-4 ring-purple-600' : ''
                    }`}
                    style={{
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                    }}
                >
                    <option
                        value=""
                        key="placeholder-option"
                        className="text-base font-semibold tracking-widest select-none"
                    >
                        {placeholder}
                    </option>
                    {options.map((opt, index) => {
                        const optValue =
                            typeof opt.value === 'object'
                                ? JSON.stringify(opt.value)
                                : String(opt.value);

                        const optLabel =
                            typeof opt.label === 'string' ? opt.label : String(opt.label);

                        return (
                            <option
                                key={`option-${optValue}-${index}`}
                                value={optValue}
                                className="text-base font-semibold tracking-widest select-none"
                                title={optLabel}
                            >
                                {processarNome(optLabel, 2)}
                            </option>
                        );
                    })}
                </select>

                {showClear && hasValue && !disabled && (
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            onClear();
                        }}
                        className="group absolute top-1/2 right-8 z-10 -translate-y-1/2 cursor-pointer rounded-full bg-red-500 p-0.5 shadow-sm shadow-black transition-all hover:scale-110 active:scale-95"
                        title="Limpar filtro"
                    >
                        <IoClose
                            size={16}
                            className="text-white transition-all group-hover:scale-110 group-active:scale-95"
                        />
                    </button>
                )}
            </div>
        );
    }

    // ================================================================================
    // RENDERIZAÇÃO PRINCIPAL
    // ================================================================================
    return (
        <div className="flex flex-col gap-2">
            {/* Cabeçalho compacto */}
            <header className="flex items-center justify-between px-4">
                <div className="flex items-center gap-3">
                    <MdFilterAlt className="text-black" size={24} />
                    <h1 className="text-xl font-extrabold tracking-widest text-black select-none">
                        FILTROS
                    </h1>
                </div>

                <div className="mr-2 flex items-center gap-6">
                    <div className="flex items-center gap-2 text-base font-extrabold tracking-widest text-black select-none">
                        <MdCalendarMonth className="text-black" size={24} />
                        {hoje.toLocaleString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                        })}
                    </div>
                    <Relogio />
                </div>
            </header>

            {/* Filtros compactos */}
            <div className="grid grid-cols-5 gap-6 px-4">
                {/* Ano */}
                <select
                    value={ano}
                    onChange={(e) => setAno(Number(e.target.value))}
                    className={`w-full cursor-pointer rounded-md border p-2 text-base font-extrabold tracking-widest shadow-md shadow-black transition-all duration-200 select-none hover:shadow-xl hover:shadow-black focus:ring-2 focus:ring-purple-600 focus:outline-none ${
                        isAnoAtivo ? 'ring-4 ring-purple-600' : ''
                    }`}
                >
                    {years.map((yearOption) => (
                        <option
                            key={yearOption}
                            value={yearOption}
                            className="font-semibold tracking-widest select-none"
                        >
                            {yearOption}
                        </option>
                    ))}
                </select>

                {/* Mês */}
                <select
                    value={mes}
                    onChange={(e) => setMes(Number(e.target.value))}
                    className={`w-full cursor-pointer rounded-md border p-2 text-base font-extrabold tracking-widest shadow-md shadow-black transition-all duration-200 select-none hover:shadow-xl hover:shadow-black focus:ring-2 focus:ring-purple-600 focus:outline-none ${
                        isMesAtivo ? 'ring-4 ring-purple-600' : ''
                    }`}
                >
                    {months.map((monthName, i) => (
                        <option
                            key={i}
                            value={i + 1}
                            className="font-semibold tracking-widest select-none"
                        >
                            {monthName}
                        </option>
                    ))}
                </select>

                {/* Cliente */}
                <SelectWithClear
                    value={clienteSelecionado}
                    onChange={setClienteSelecionado}
                    onClear={() => setClienteSelecionado('')}
                    disabled={!clientesData.length || !!codCliente || clientesLoading}
                    options={clientesData.map((c) => ({ value: c.cod, label: c.nome }))}
                    placeholder={clientesLoading ? 'Carregando...' : 'Selecione o cliente'}
                    showClear={!codCliente}
                    isActive={isClienteAtivo}
                    className="w-full cursor-pointer rounded-md border p-2 text-base font-extrabold tracking-widest shadow-md shadow-black transition-all duration-200 select-none hover:shadow-xl hover:shadow-black focus:ring-2 focus:ring-purple-600 focus:outline-none disabled:cursor-not-allowed disabled:opacity-30"
                />

                {/* Recurso */}
                <SelectWithClear
                    value={recursoSelecionado}
                    onChange={setRecursoSelecionado}
                    onClear={() => setRecursoSelecionado('')}
                    disabled={!recursosData.length || isLoading}
                    options={recursosData.map((r) => ({ value: r.cod, label: r.nome }))}
                    placeholder={isLoading ? 'Carregando...' : 'Selecione o recurso'}
                    isActive={isRecursoAtivo}
                    className="w-full cursor-pointer rounded-md border p-2 text-base font-extrabold tracking-widest shadow-md shadow-black transition-all duration-200 select-none hover:shadow-xl hover:shadow-black focus:ring-2 focus:ring-purple-600 focus:outline-none"
                />

                {/* Status */}
                <SelectWithClear
                    value={statusSelecionado}
                    onChange={setStatusSelecionado}
                    onClear={() => setStatusSelecionado('')}
                    disabled={!statusData.length || isLoading}
                    options={statusData.map((s) => ({ value: s, label: s }))}
                    placeholder={isLoading ? 'Carregando...' : 'Selecione o status'}
                    isActive={isStatusAtivo}
                    className="w-full cursor-pointer rounded-md border p-2 text-base font-extrabold tracking-widest shadow-md shadow-black transition-all duration-200 select-none hover:shadow-xl hover:shadow-black focus:ring-2 focus:ring-purple-600 focus:outline-none"
                />
            </div>
        </div>
    );
}
