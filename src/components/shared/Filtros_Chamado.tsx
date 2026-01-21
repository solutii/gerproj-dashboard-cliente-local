// src/components/shared/Filtros_Chamado.tsx - CORREÇÃO BOTÃO LIMPAR + DESABILITAR RECURSO
'use client';

import { useQuery } from '@tanstack/react-query';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { MdCalendarMonth, MdFilterAlt, MdFilterAltOff } from 'react-icons/md';
import { useAuth } from '../../context/AuthContext';
import { corrigirTextoCorrompido } from '../../formatters/formatar-texto-corrompido';
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

interface Filtros {
    ano?: number;
    mes?: number;
    cliente: string;
    recurso: string;
    status: string;
}

// ==================== CONTEXT ====================
const FiltrosContext = createContext<Filtros | null>(null);

export function useFiltrosChamado() {
    const context = useContext(FiltrosContext);
    if (!context) {
        throw new Error('useFiltrosChamado deve ser usado dentro de FiltrosChamado');
    }
    return context;
}

// ==================== FUNÇÕES AUXILIARES ====================
function limitarNome(nome: string, maxPalavras: number = 2): string {
    if (!nome || typeof nome !== 'string') return '';
    const palavras = nome.trim().split(/\s+/);
    return palavras.slice(0, maxPalavras).join(' ');
}

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
    mes?: number;
    ano?: number;
    isAdmin: boolean;
    codCliente: string | null;
}): Promise<Cliente[]> => {
    const params = new URLSearchParams();

    if (mes) params.append('mes', mes.toString());
    if (ano) params.append('ano', ano.toString());

    params.append('isAdmin', isAdmin.toString());

    if (!isAdmin && codCliente) {
        params.append('codCliente', codCliente);
    }

    const response = await fetch(`/api/filtros/clientes?${params.toString()}`);
    if (!response.ok) throw new Error('Erro ao carregar clientes');
    return response.json();
};

const fetchRecursos = async ({
    mes,
    ano,
    isAdmin,
    codCliente,
    clienteSelecionado,
}: {
    mes?: number;
    ano?: number;
    isAdmin: boolean;
    codCliente: string | null;
    clienteSelecionado: string;
}): Promise<Recurso[]> => {
    const params = new URLSearchParams();

    if (mes) params.append('mes', mes.toString());
    if (ano) params.append('ano', ano.toString());

    params.append('isAdmin', isAdmin.toString());

    if (!isAdmin && codCliente) {
        params.append('codCliente', codCliente);
    }
    if (isAdmin && clienteSelecionado) {
        params.append('cliente', clienteSelecionado);
    }

    const response = await fetch(`/api/filtros/recursos?${params.toString()}`);
    if (!response.ok) throw new Error('Erro ao carregar recursos');
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
    mes?: number;
    ano?: number;
    isAdmin: boolean;
    codCliente: string | null;
    clienteSelecionado: string;
    recursoSelecionado: string;
}): Promise<string[]> => {
    const params = new URLSearchParams();

    if (mes) params.append('mes', mes.toString());
    if (ano) params.append('ano', ano.toString());

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
    if (!response.ok) throw new Error('Erro ao carregar status');
    return response.json();
};

// ================================================================================
// COMPONENTE PRINCIPAL
// ================================================================================
export function FiltrosChamado({ children }: { children?: ReactNode }) {
    const hoje = new Date();
    const anoAtual = hoje.getFullYear();
    const mesAtual = hoje.getMonth() + 1;

    const { isAdmin, codCliente } = useAuth();

    // Valores padrão iniciais
    const valoresPadrao = {
        ano: isAdmin ? anoAtual : undefined,
        mes: isAdmin ? mesAtual : undefined,
    };

    // Estados temporários (preview)
    const [anoTemp, setAnoTemp] = useState<number | undefined>(valoresPadrao.ano);
    const [mesTemp, setMesTemp] = useState<number | undefined>(valoresPadrao.mes);
    const [clienteTemp, setClienteTemp] = useState('');
    const [recursoTemp, setRecursoTemp] = useState('');
    const [statusTemp, setStatusTemp] = useState('');

    // Estados aplicados
    const [ano, setAno] = useState<number | undefined>(valoresPadrao.ano);
    const [mes, setMes] = useState<number | undefined>(valoresPadrao.mes);
    const [clienteSelecionado, setClienteSelecionado] = useState('');
    const [recursoSelecionado, setRecursoSelecionado] = useState('');
    const [statusSelecionado, setStatusSelecionado] = useState('');

    const [isInitialized, setIsInitialized] = useState(false);

    // Rastreia se houve interação do usuário
    const [filtrosForamAlterados, setFiltrosForamAlterados] = useState(false);

    useEffect(() => {
        setIsInitialized(true);
        console.log('🚀 Componente inicializado:', { isAdmin, codCliente });
    }, [isAdmin, codCliente]);

    useEffect(() => {
        console.log('📊 Filtros Aplicados:', {
            ano,
            mes,
            cliente: clienteSelecionado,
            recurso: recursoSelecionado,
            status: statusSelecionado,
        });
    }, [ano, mes, clienteSelecionado, recursoSelecionado, statusSelecionado]);

    useEffect(() => {
        if (!isAdmin && statusTemp === 'FINALIZADO') {
            if (!anoTemp) setAnoTemp(anoAtual);
            if (!mesTemp) setMesTemp(mesAtual);
        }
    }, [statusTemp, isAdmin, anoTemp, mesTemp, anoAtual, mesAtual]);

    // ==================== QUERIES ====================
    const { data: clientesData = [], isLoading: clientesLoading } = useQuery({
        queryKey: ['clientes', mes, ano, isAdmin, codCliente],
        queryFn: () => fetchClientes({ mes, ano, isAdmin, codCliente }),
        enabled: !!isInitialized,
        staleTime: 1000 * 60 * 5,
        retry: 2,
    });

    const { data: recursosData = [], isLoading: recursosLoading } = useQuery({
        queryKey: ['recursos', mes, ano, isAdmin, codCliente, clienteSelecionado],
        queryFn: () =>
            fetchRecursos({
                mes,
                ano,
                isAdmin,
                codCliente,
                clienteSelecionado,
            }),
        enabled: !!(isInitialized && (isAdmin || codCliente || clienteSelecionado)),
        staleTime: 1000 * 60 * 5,
        retry: 2,
    });

    const { data: statusData = [], isLoading: statusLoading } = useQuery({
        queryKey: ['status', mes, ano, isAdmin, codCliente, clienteSelecionado, recursoSelecionado],
        queryFn: () =>
            fetchStatus({
                mes,
                ano,
                isAdmin,
                codCliente,
                clienteSelecionado,
                recursoSelecionado,
            }),
        enabled: !!(isInitialized && (isAdmin || codCliente)),
        staleTime: 1000 * 60 * 5,
        retry: 2,
    });

    useEffect(() => {
        if (!isInitialized) return;
        if (!isAdmin && codCliente && clientesData.length > 0) {
            setClienteTemp(codCliente);
            setClienteSelecionado(codCliente);
        }
    }, [isAdmin, codCliente, clientesData, isInitialized]);

    // Conta mudanças pendentes
    const mudancasCount = [
        anoTemp !== ano,
        mesTemp !== mes,
        ...(isAdmin ? [clienteTemp !== clienteSelecionado] : []),
        recursoTemp !== recursoSelecionado,
        statusTemp !== statusSelecionado,
    ].filter(Boolean).length;

    const temMudancas = mudancasCount > 0;

    // Verifica se há filtros aplicados diferentes dos valores padrão
    const temFiltrosAtivos =
        (isAdmin && clienteSelecionado) ||
        recursoSelecionado ||
        statusSelecionado ||
        filtrosForamAlterados;

    // ✨ NOVA LÓGICA: Verifica se o recurso deve ser desabilitado
    const recursoDesabilitadoPorStatus =
        statusTemp === 'FINALIZADO' && statusSelecionado !== 'FINALIZADO';

    const aplicarFiltros = () => {
        console.log('🎯 Aplicando filtros:', {
            anoTemp,
            mesTemp,
            clienteTemp,
            recursoTemp,
            statusTemp,
        });

        setAno(anoTemp);
        setMes(mesTemp);
        setClienteSelecionado(clienteTemp);
        setRecursoSelecionado(recursoTemp);
        setStatusSelecionado(statusTemp);

        // Marca que houve alteração se os valores são diferentes dos padrões
        if (
            anoTemp !== valoresPadrao.ano ||
            mesTemp !== valoresPadrao.mes ||
            clienteTemp ||
            recursoTemp ||
            statusTemp
        ) {
            setFiltrosForamAlterados(true);
        }
    };

    const limparFiltros = () => {
        console.log('🧹 Limpando filtros:', valoresPadrao);

        setAnoTemp(valoresPadrao.ano);
        setMesTemp(valoresPadrao.mes);
        setClienteTemp('');
        setRecursoTemp('');
        setStatusTemp('');

        setAno(valoresPadrao.ano);
        setMes(valoresPadrao.mes);
        setClienteSelecionado('');
        setRecursoSelecionado('');
        setStatusSelecionado('');

        // Reseta o flag de alteração
        setFiltrosForamAlterados(false);
    };

    const filtrosAtuais: Filtros = {
        ano,
        mes,
        cliente: clienteSelecionado,
        recurso: recursoSelecionado,
        status: statusSelecionado,
    };

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
    const desabilitarMesAno = false;

    // ==================== SELECT COM CLEAR E INDICADOR VISUAL ====================
    interface SelectWithClearProps {
        value: string | number | undefined;
        onChange: (value: string) => void;
        onClear: () => void;
        disabled?: boolean;
        options: Array<{ value: string | number; label: string }>;
        placeholder: string;
        className?: string;
        showClear?: boolean;
    }

    function SelectWithClear({
        value,
        onChange,
        disabled,
        options,
        placeholder,
        className,
        showClear = true,
    }: SelectWithClearProps) {
        const hasValue = value !== '' && value !== undefined && value !== 0;

        return (
            <div className="relative">
                <select
                    value={value ?? ''}
                    onChange={(e) => onChange(e.target.value)}
                    disabled={disabled}
                    className={`${className} ${hasValue && !disabled && showClear ? 'pr-12' : 'pr-8'} ${
                        hasValue && !disabled
                            ? 'border-2 border-purple-600 bg-purple-50 ring-2 ring-purple-200'
                            : 'border'
                    }`}
                >
                    <option
                        value=""
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
            </div>
        );
    }

    // ================================================================================
    // RENDERIZAÇÃO
    // ================================================================================
    return (
        <FiltrosContext.Provider value={filtrosAtuais}>
            <div className="flex flex-col gap-4">
                {/* Cabeçalho */}
                <header className="flex items-center justify-between px-4">
                    <div className="flex items-center gap-2">
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

                {/* Filtros */}
                <div className="grid grid-cols-6 gap-6 px-4">
                    {/* Ano */}
                    <SelectWithClear
                        value={anoTemp}
                        onChange={(value) => {
                            const novoAno = value ? Number(value) : undefined;
                            console.log('📅 Ano selecionado:', novoAno);
                            setAnoTemp(novoAno);
                        }}
                        onClear={() => {
                            console.log('🧹 Limpando ano');
                            setAnoTemp(undefined);
                        }}
                        disabled={desabilitarMesAno}
                        options={years.map((y) => ({ value: y, label: String(y) }))}
                        placeholder="Selecione o ano"
                        className="w-full cursor-pointer rounded-md p-2 text-base font-extrabold tracking-widest shadow-md shadow-black transition-all duration-200 select-none hover:shadow-xl hover:shadow-black focus:ring-2 focus:ring-purple-600 focus:outline-none disabled:cursor-not-allowed disabled:opacity-30"
                    />

                    {/* Mês */}
                    <SelectWithClear
                        value={mesTemp}
                        onChange={(value) => {
                            const novoMes = value ? Number(value) : undefined;
                            console.log('📅 Mês selecionado:', novoMes);
                            setMesTemp(novoMes);
                        }}
                        onClear={() => {
                            console.log('🧹 Limpando mês');
                            setMesTemp(undefined);
                        }}
                        disabled={desabilitarMesAno}
                        options={months.map((m, i) => ({ value: i + 1, label: m }))}
                        placeholder="Selecione o mês"
                        className="w-full cursor-pointer rounded-md p-2 text-base font-extrabold tracking-widest shadow-md shadow-black transition-all duration-200 select-none hover:shadow-xl hover:shadow-black focus:ring-2 focus:ring-purple-600 focus:outline-none disabled:cursor-not-allowed disabled:opacity-30"
                    />

                    {/* Cliente */}
                    <SelectWithClear
                        value={clienteTemp}
                        onChange={setClienteTemp}
                        onClear={() => setClienteTemp('')}
                        disabled={!clientesData.length || !!codCliente || clientesLoading}
                        options={clientesData.map((c) => ({ value: c.cod, label: c.nome }))}
                        placeholder={clientesLoading ? 'Carregando...' : 'Selecione o cliente'}
                        showClear={!codCliente}
                        className="w-full cursor-pointer rounded-md p-2 text-base font-extrabold tracking-widest shadow-md shadow-black transition-all duration-200 select-none hover:shadow-xl hover:shadow-black focus:ring-2 focus:ring-purple-600 focus:outline-none disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:scale-100 disabled:hover:shadow-md disabled:hover:shadow-black"
                    />

                    {/* Recurso - ✨ MODIFICADO */}
                    <SelectWithClear
                        value={recursoTemp}
                        onChange={setRecursoTemp}
                        onClear={() => setRecursoTemp('')}
                        disabled={!recursosData.length || isLoading || recursoDesabilitadoPorStatus}
                        options={recursosData.map((r) => ({ value: r.cod, label: r.nome }))}
                        placeholder={
                            recursoDesabilitadoPorStatus
                                ? 'Aplique o filtro primeiro'
                                : isLoading
                                  ? 'Carregando...'
                                  : 'Selecione o recurso'
                        }
                        className="w-full cursor-pointer rounded-md p-2 text-base font-extrabold tracking-widest shadow-md shadow-black transition-all duration-200 select-none hover:shadow-xl hover:shadow-black focus:ring-2 focus:ring-purple-600 focus:outline-none disabled:cursor-not-allowed disabled:opacity-30"
                    />

                    {/* Status */}
                    <SelectWithClear
                        value={statusTemp}
                        onChange={setStatusTemp}
                        onClear={() => {
                            setStatusTemp('');
                            if (!isAdmin) {
                                setAnoTemp(undefined);
                                setMesTemp(undefined);
                            }
                        }}
                        disabled={!statusData.length || isLoading}
                        options={statusData.map((s) => ({ value: s, label: s }))}
                        placeholder={isLoading ? 'Carregando...' : 'Selecione o status'}
                        className="w-full cursor-pointer rounded-md p-2 text-base font-extrabold tracking-widest shadow-md shadow-black transition-all duration-200 select-none hover:shadow-xl hover:shadow-black focus:ring-2 focus:ring-purple-600 focus:outline-none"
                    />

                    {/* Botões de Ação */}
                    <div className="flex items-center justify-end gap-6">
                        <button
                            onClick={limparFiltros}
                            disabled={!temFiltrosAtivos && mudancasCount === 0}
                            className={`flex w-[160px] items-center justify-center gap-2 rounded-md px-6 py-2 text-base font-bold tracking-widest shadow-md shadow-black transition-all duration-200 ${
                                temFiltrosAtivos || mudancasCount > 0
                                    ? '-translate-y-2 cursor-pointer border border-red-900 bg-red-600 text-white hover:scale-105 active:scale-95'
                                    : 'cursor-not-allowed border-t border-gray-400 bg-gray-300 text-gray-700'
                            }`}
                            title={
                                temFiltrosAtivos || mudancasCount > 0
                                    ? 'Limpar filtros aplicados'
                                    : 'Nenhum filtro para limpar'
                            }
                        >
                            {(temFiltrosAtivos || mudancasCount > 0) && (
                                <MdFilterAltOff size={24} />
                            )}
                            Limpar
                        </button>

                        <button
                            onClick={aplicarFiltros}
                            disabled={!temMudancas}
                            className={`flex w-[220px] items-center justify-center gap-2 rounded-md px-6 py-2 text-base font-bold tracking-widest shadow-md shadow-black transition-all duration-200 ${
                                temMudancas
                                    ? '-translate-y-2 cursor-pointer border border-purple-900 bg-purple-600 text-white hover:scale-105 active:scale-95'
                                    : 'cursor-not-allowed border-t border-gray-400 bg-gray-300 text-gray-700'
                            }`}
                            title={
                                temMudancas
                                    ? 'Aplicar filtros selecionados'
                                    : 'Nenhuma alteração para aplicar'
                            }
                        >
                            {temMudancas && <MdFilterAlt size={24} />}
                            {temMudancas && mudancasCount > 1
                                ? 'Aplicar Filtros'
                                : temMudancas
                                  ? 'Aplicar Filtro'
                                  : 'Aplicar'}
                        </button>
                    </div>
                </div>
            </div>
            {children}
        </FiltrosContext.Provider>
    );
}
