// src/components/shared/Filtros_Chamado.tsx - RECURSOS LOCAIS CORRIGIDO
'use client';

import { useQuery } from '@tanstack/react-query';
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { MdCalendarMonth, MdClose, MdFilterAlt, MdFilterAltOff } from 'react-icons/md';
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

// ==================== PROPS ADICIONAIS ====================
interface FiltrosChamadoProps {
    children?: ReactNode;
    dadosChamados?: Array<{
        COD_RECURSO?: number | null;
        NOME_RECURSO?: string | null;
        STATUS_CHAMADO?: string | null;
        [key: string]: any;
    }>;
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
export function FiltrosChamado({ children, dadosChamados = [] }: FiltrosChamadoProps) {
    const { isAdmin, codCliente } = useAuth();

    // ✅ Memoizar valores que não mudam durante a sessão
    const hoje = useMemo(() => new Date(), []);
    const anoAtual = useMemo(() => hoje.getFullYear(), [hoje]);
    const mesAtual = useMemo(() => hoje.getMonth() + 1, [hoje]);

    const valoresPadrao = {
        ano: isAdmin ? anoAtual : undefined,
        mes: isAdmin ? mesAtual : undefined,
    };

    const [anoTemp, setAnoTemp] = useState<number | undefined>(valoresPadrao.ano);
    const [mesTemp, setMesTemp] = useState<number | undefined>(valoresPadrao.mes);
    const [clienteTemp, setClienteTemp] = useState('');
    const [recursoTemp, setRecursoTemp] = useState('');
    const [statusTemp, setStatusTemp] = useState('');

    const [ano, setAno] = useState<number | undefined>(valoresPadrao.ano);
    const [mes, setMes] = useState<number | undefined>(valoresPadrao.mes);
    const [clienteSelecionado, setClienteSelecionado] = useState('');
    const [recursoSelecionado, setRecursoSelecionado] = useState('');
    const [statusSelecionado, setStatusSelecionado] = useState('');

    const [isInitialized, setIsInitialized] = useState(false);
    const [filtrosForamAlterados, setFiltrosForamAlterados] = useState(false);

    useEffect(() => {
        setIsInitialized(true);
        console.log('🚀 Componente inicializado:', {
            isAdmin,
            codCliente,
            totalChamados: dadosChamados.length,
        });
    }, [isAdmin, codCliente, dadosChamados.length]);

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

    // ==================== CÁLCULO DE MESES DISPONÍVEIS ====================
    const mesesDisponiveis = useMemo(() => {
        const todosOsMeses = [
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

        if (!anoTemp) return [];

        if (anoTemp < anoAtual) {
            return todosOsMeses.map((m, i) => ({ value: i + 1, label: m }));
        }

        if (anoTemp === anoAtual) {
            return todosOsMeses.slice(0, mesAtual).map((m, i) => ({ value: i + 1, label: m }));
        }

        if (anoTemp > anoAtual) {
            const diferencaAnos = anoTemp - anoAtual;
            if (diferencaAnos === 1) {
                const mesesFuturos = Math.max(0, mesAtual - 1);
                return todosOsMeses
                    .slice(0, mesesFuturos)
                    .map((m, i) => ({ value: i + 1, label: m }));
            }
            return [];
        }

        return todosOsMeses.map((m, i) => ({ value: i + 1, label: m }));
    }, [anoTemp, anoAtual, mesAtual]);

    const mesDesabilitado = !anoTemp || mesesDisponiveis.length === 0;

    useEffect(() => {
        if (mesTemp && anoTemp) {
            const mesDisponivel = mesesDisponiveis.some((m) => m.value === mesTemp);
            if (!mesDisponivel) {
                console.log('⚠️ Mês selecionado não disponível para o ano, limpando...');
                setMesTemp(undefined);
            }
        }
    }, [anoTemp, mesTemp, mesesDisponiveis]);

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

    const statusEhFinalizado = useMemo(() => {
        return statusSelecionado?.trim().toUpperCase() === 'FINALIZADO';
    }, [statusSelecionado]);

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
        enabled: !!(
            isInitialized &&
            statusEhFinalizado &&
            (isAdmin || codCliente || clienteSelecionado)
        ),
        staleTime: 1000 * 60 * 5,
        retry: 2,
    });

    // ✅ EXTRAÇÃO LOCAL DE RECURSOS - USA NOME_RECURSO COMO CHAVE
    const recursosLocais = useMemo(() => {
        if (!dadosChamados || dadosChamados.length === 0) {
            console.log('⚠️ Nenhum chamado disponível para extrair recursos locais');
            return [];
        }

        console.log('🔍 Extraindo recursos locais de', dadosChamados.length, 'chamados');

        const recursosUnicos = new Map<string, string>();

        dadosChamados.forEach((chamado, index) => {
            const nomeRecurso = chamado.NOME_RECURSO?.toString().trim();

            // ✅ Usa NOME_RECURSO como chave E valor quando COD_RECURSO não existe
            const codRecurso = chamado.COD_RECURSO?.toString().trim() || nomeRecurso;

            if (codRecurso && nomeRecurso && !recursosUnicos.has(codRecurso)) {
                recursosUnicos.set(codRecurso, nomeRecurso);
                console.log(`✅ Recurso ${index + 1} adicionado: ${codRecurso} - ${nomeRecurso}`);
            }
        });

        const recursos = Array.from(recursosUnicos.entries())
            .map(([cod, nome]) => ({ cod, nome }))
            .sort((a, b) => a.nome.localeCompare(b.nome));

        console.log('📋 Recursos únicos encontrados:', recursos.length);
        console.log('📋 Lista:', recursos.map((r) => r.nome).join(', '));

        return recursos;
    }, [dadosChamados]);

    const recursosFinais = useMemo(() => {
        // ✅ SEMPRE usa recursos locais extraídos dos chamados carregados
        console.log('💾 Usando recursos locais:', recursosLocais.length);
        return recursosLocais;
    }, [recursosLocais]);

    useEffect(() => {
        // ✅ Sempre valida se o recurso ainda existe nos recursos locais
        if (recursoTemp) {
            const recursoExiste = recursosLocais.some((r) => r.cod === recursoTemp);
            if (!recursoExiste) {
                console.log('⚠️ Recurso selecionado não existe mais, limpando...');
                setRecursoTemp('');
            }
        }
    }, [recursosLocais, recursoTemp]);

    const isLoadingRecursos = recursosLocais.length === 0 && dadosChamados.length > 0;

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

    const mudancasCount = [
        anoTemp !== ano,
        mesTemp !== mes,
        ...(isAdmin ? [clienteTemp !== clienteSelecionado] : []),
        recursoTemp !== recursoSelecionado,
        statusTemp !== statusSelecionado,
    ].filter(Boolean).length;

    const temMudancas = mudancasCount > 0;
    const temFiltrosAtivos = useMemo(() => {
        const temAnoMesDiferente = isAdmin
            ? ano !== valoresPadrao.ano || mes !== valoresPadrao.mes
            : ano !== undefined || mes !== undefined;

        const temCliente = isAdmin && clienteSelecionado;
        const temRecurso = recursoSelecionado;
        const temStatus = statusSelecionado;

        return temAnoMesDiferente || temCliente || temRecurso || temStatus;
    }, [
        ano,
        mes,
        clienteSelecionado,
        recursoSelecionado,
        statusSelecionado,
        isAdmin,
        valoresPadrao,
    ]);

    const recursoDesabilitadoPorStatus = statusTemp !== statusSelecionado && statusTemp !== '';

    const recursoDesabilitado = useMemo(() => {
        if (recursoDesabilitadoPorStatus) return true;
        if (isLoadingRecursos) return true;
        return !recursosFinais.length;
    }, [recursoDesabilitadoPorStatus, isLoadingRecursos, recursosFinais.length]);

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

    const limparAnoMes = () => {
        console.log('🧹 Limpando ano e mês:', { isAdmin, valoresPadrao, statusSelecionado });

        if (isAdmin) {
            setAnoTemp(valoresPadrao.ano);
            setMesTemp(valoresPadrao.mes);
            setAno(valoresPadrao.ano);
            setMes(valoresPadrao.mes);
        } else {
            setAnoTemp(undefined);
            setMesTemp(undefined);
            setAno(undefined);
            setMes(undefined);
        }

        if (statusSelecionado === 'FINALIZADO') {
            console.log('⚠️ Status FINALIZADO detectado, limpando status também');
            setStatusTemp('');
            setStatusSelecionado('');
        }
    };

    const limparFiltroIndividual = (campo: 'ano' | 'mes' | 'cliente' | 'recurso' | 'status') => {
        console.log('🧹 Limpando filtro individual:', campo);

        switch (campo) {
            case 'ano':
            case 'mes':
                limparAnoMes();
                break;
            case 'cliente':
                setClienteTemp('');
                setClienteSelecionado('');
                break;
            case 'recurso':
                setRecursoTemp('');
                setRecursoSelecionado('');
                break;
            case 'status':
                // ✅ Se está limpando status FINALIZADO, limpa recurso também
                if (statusSelecionado === 'FINALIZADO') {
                    console.log('🧹 Limpando recurso junto com status FINALIZADO');
                    setRecursoTemp('');
                    setRecursoSelecionado('');
                }
                setStatusTemp('');
                setStatusSelecionado('');
                if (!isAdmin) {
                    console.log('⚠️ Não-admin: limpando ano e mês também');
                    setAnoTemp(undefined);
                    setMesTemp(undefined);
                    setAno(undefined);
                    setMes(undefined);
                }
                break;
        }

        const verificarFiltrosRestantes = () => {
            if (campo === 'status') {
                // Após limpar status (e recurso se FINALIZADO)
                const temAnoMes =
                    (isAdmin && (ano !== valoresPadrao.ano || mes !== valoresPadrao.mes)) ||
                    (!isAdmin && (ano !== undefined || mes !== undefined));
                const temCliente = isAdmin && clienteSelecionado;
                return temAnoMes || temCliente;
            }
            if (campo === 'cliente') {
                const temAnoMes =
                    (isAdmin && (ano !== valoresPadrao.ano || mes !== valoresPadrao.mes)) ||
                    (!isAdmin && (ano !== undefined || mes !== undefined));
                const temRecurso = recursoSelecionado;
                const temStatus = statusSelecionado;
                return temAnoMes || temRecurso || temStatus;
            }
            if (campo === 'recurso') {
                const temAnoMes =
                    (isAdmin && (ano !== valoresPadrao.ano || mes !== valoresPadrao.mes)) ||
                    (!isAdmin && (ano !== undefined || mes !== undefined));
                const temCliente = isAdmin && clienteSelecionado;
                const temStatus = statusSelecionado;
                return temAnoMes || temCliente || temStatus;
            }
            if (campo === 'ano' || campo === 'mes') {
                const temCliente = isAdmin && clienteSelecionado;
                const temRecurso = recursoSelecionado;
                const temStatus = statusSelecionado;
                return temCliente || temRecurso || temStatus;
            }
            return false;
        };

        if (!verificarFiltrosRestantes()) {
            setFiltrosForamAlterados(false);
        }
    };

    const limparFiltros = () => {
        console.log('🧹 Limpando todos os filtros:', valoresPadrao);

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

        setFiltrosForamAlterados(false);
    };

    const filtrosAtuais: Filtros = {
        ano,
        mes,
        cliente: clienteSelecionado,
        recurso: recursoSelecionado,
        status: statusSelecionado,
    };

    const years = [2024, 2025, 2026];
    const isLoading = isLoadingRecursos || statusLoading;
    const desabilitarMesAno = false;

    // ==================== SELECT COM BOTÃO LIMPAR ====================
    interface SelectWithClearProps {
        value: string | number | undefined;
        valorAplicado: string | number | undefined;
        onChange: (value: string) => void;
        onClearImmediate: () => void;
        disabled?: boolean;
        options: Array<{ value: string | number; label: string }>;
        placeholder: string;
        className?: string;
        showClearButton?: boolean;
    }

    function SelectWithClear({
        value,
        valorAplicado,
        onChange,
        onClearImmediate,
        disabled,
        options,
        placeholder,
        className,
        showClearButton = true,
    }: SelectWithClearProps) {
        const hasValue = value !== '' && value !== undefined && value !== 0;
        const isAplicado =
            valorAplicado !== '' && valorAplicado !== undefined && valorAplicado !== 0;

        return (
            <div className="relative">
                <select
                    value={value ?? ''}
                    onChange={(e) => onChange(e.target.value)}
                    disabled={disabled}
                    className={`${className} ${hasValue ? 'pr-12' : 'pr-8'} ${
                        hasValue && !disabled
                            ? '-translate-y-3 border-t border-purple-300 bg-purple-100'
                            : 'border'
                    }`}
                >
                    <option
                        value=""
                        className="text-base font-semibold tracking-widest text-black select-none"
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
                                className="text-base font-semibold tracking-widest text-black select-none"
                                title={optLabel}
                            >
                                {processarNome(optLabel, 2)}
                            </option>
                        );
                    })}
                </select>

                {showClearButton && isAplicado && !disabled && (
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onClearImmediate();
                        }}
                        className="absolute top-1/2 right-8 flex -translate-y-1/2 cursor-pointer"
                        title="Limpar este filtro"
                        type="button"
                    >
                        <MdClose
                            className={`text-red-500 transition-all duration-200 hover:scale-125 hover:rotate-180 ${hasValue ? '-translate-y-3' : ''}`}
                            size={28}
                        />
                    </button>
                )}
            </div>
        );
    }

    // ================================================================================
    // RENDERIZAÇÃO
    // ================================================================================
    return (
        <FiltrosContext.Provider value={filtrosAtuais}>
            <div className="flex flex-col gap-4">
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

                <div className="grid grid-cols-6 gap-6 px-4">
                    <SelectWithClear
                        value={anoTemp}
                        valorAplicado={ano}
                        onChange={(value) => {
                            const novoAno = value ? Number(value) : undefined;
                            console.log('📅 Ano selecionado:', novoAno);
                            setAnoTemp(novoAno);
                        }}
                        onClearImmediate={() => limparFiltroIndividual('ano')}
                        disabled={desabilitarMesAno}
                        options={years.map((y) => ({ value: y, label: String(y) }))}
                        placeholder="Selecione o ano"
                        className="w-full cursor-pointer rounded-md p-2 text-base font-extrabold tracking-widest shadow-md shadow-black transition-all duration-200 select-none hover:shadow-lg hover:shadow-black focus:ring-2 focus:ring-purple-600 focus:outline-none disabled:cursor-not-allowed disabled:opacity-30"
                    />

                    <SelectWithClear
                        value={mesTemp}
                        valorAplicado={mes}
                        onChange={(value) => {
                            const novoMes = value ? Number(value) : undefined;
                            console.log('📅 Mês selecionado:', novoMes);
                            setMesTemp(novoMes);
                        }}
                        onClearImmediate={() => limparFiltroIndividual('mes')}
                        disabled={mesDesabilitado || desabilitarMesAno}
                        options={mesesDisponiveis}
                        placeholder={
                            !anoTemp
                                ? 'Selecione o ano primeiro'
                                : mesesDisponiveis.length === 0
                                  ? 'Nenhum mês disponível'
                                  : 'Selecione o mês'
                        }
                        className="w-full cursor-pointer rounded-md p-2 text-base font-extrabold tracking-widest shadow-md shadow-black transition-all duration-200 select-none hover:shadow-lg hover:shadow-black focus:ring-2 focus:ring-purple-600 focus:outline-none disabled:cursor-not-allowed disabled:opacity-30"
                    />

                    <SelectWithClear
                        value={clienteTemp}
                        valorAplicado={clienteSelecionado}
                        onChange={setClienteTemp}
                        onClearImmediate={() => limparFiltroIndividual('cliente')}
                        disabled={!clientesData.length || !!codCliente || clientesLoading}
                        options={clientesData.map((c) => ({ value: c.cod, label: c.nome }))}
                        placeholder={clientesLoading ? 'Carregando...' : 'Selecione o cliente'}
                        showClearButton={!codCliente}
                        className="w-full cursor-pointer rounded-md p-2 text-base font-extrabold tracking-widest shadow-md shadow-black transition-all duration-200 select-none hover:shadow-lg hover:shadow-black focus:ring-2 focus:ring-purple-600 focus:outline-none disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:scale-100 disabled:hover:shadow-md disabled:hover:shadow-black"
                    />

                    <SelectWithClear
                        value={recursoTemp}
                        valorAplicado={recursoSelecionado}
                        onChange={setRecursoTemp}
                        onClearImmediate={() => limparFiltroIndividual('recurso')}
                        disabled={recursoDesabilitado}
                        options={recursosFinais.map((r) => ({ value: r.cod, label: r.nome }))}
                        placeholder={
                            recursoDesabilitadoPorStatus
                                ? 'Aplique o filtro primeiro'
                                : isLoadingRecursos
                                  ? 'Carregando...'
                                  : recursosFinais.length === 0
                                    ? 'Nenhum recurso disponível'
                                    : 'Selecione o recurso'
                        }
                        className="w-full cursor-pointer rounded-md p-2 text-base font-extrabold tracking-widest shadow-md shadow-black transition-all duration-200 select-none hover:shadow-lg hover:shadow-black focus:ring-2 focus:ring-purple-600 focus:outline-none disabled:cursor-not-allowed disabled:opacity-30"
                    />

                    <SelectWithClear
                        value={statusTemp}
                        valorAplicado={statusSelecionado}
                        onChange={setStatusTemp}
                        onClearImmediate={() => limparFiltroIndividual('status')}
                        disabled={!statusData.length || isLoading}
                        options={statusData.map((s) => ({ value: s, label: s }))}
                        placeholder={isLoading ? 'Carregando...' : 'Selecione o status'}
                        className="w-full cursor-pointer rounded-md p-2 text-base font-extrabold tracking-widest shadow-md shadow-black transition-all duration-200 select-none hover:shadow-lg hover:shadow-black focus:ring-2 focus:ring-purple-600 focus:outline-none"
                    />

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
