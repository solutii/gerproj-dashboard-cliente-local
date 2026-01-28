// src/components/shared/Filtros_Chamado.tsx
'use client';

import { useQuery } from '@tanstack/react-query';
import {
    createContext,
    ReactNode,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from 'react';
import { MdCalendarMonth, MdClose, MdFilterAlt, MdFilterAltOff } from 'react-icons/md';
import { useAuth } from '../../context/AuthContext';
import { corrigirTextoCorrompido } from '../../formatters/formatar-texto-corrompido';
import { Relogio } from './Relogio';

// ==================== CONSTANTES ====================
const ANOS_DISPONIVEIS_FINALIZADOS = [2024, 2025, 2026];
const MESES_NOMES = [
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

interface FiltrosChamadoProps {
    children?: ReactNode;
    dadosChamados?: Array<{
        COD_RECURSO?: number | null;
        NOME_RECURSO?: string | null;
        STATUS_CHAMADO?: string | null;
        DATA_CHAMADO?: string | Date | number;
        [key: string]: any;
    }>;
}

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

function extrairAnoDeData(dataChamado: string | Date | number | null | undefined): number | null {
    if (!dataChamado) return null;

    let data: Date | null = null;

    if (typeof dataChamado === 'string') {
        data = new Date(dataChamado);
    } else if (dataChamado instanceof Date) {
        data = dataChamado;
    } else if (typeof dataChamado === 'number') {
        data = new Date(dataChamado);
    }

    if (!data || isNaN(data.getTime())) return null;

    const ano = data.getFullYear();
    return ano >= 2020 && ano <= 2030 ? ano : null;
}

function extrairMesDeData(dataChamado: string | Date | number | null | undefined): number | null {
    if (!dataChamado) return null;

    let data: Date | null = null;

    if (typeof dataChamado === 'string') {
        data = new Date(dataChamado);
    } else if (dataChamado instanceof Date) {
        data = dataChamado;
    } else if (typeof dataChamado === 'number') {
        data = new Date(dataChamado);
    }

    if (!data || isNaN(data.getTime())) return null;

    return data.getMonth() + 1;
}

// ==================== API FETCHERS ====================
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
    if (!isAdmin && codCliente) params.append('codCliente', codCliente);

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
    if (!isAdmin && codCliente) params.append('codCliente', codCliente);
    if (isAdmin && clienteSelecionado) params.append('cliente', clienteSelecionado);

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
    if (!isAdmin && codCliente) params.append('codCliente', codCliente);
    if (isAdmin && clienteSelecionado) params.append('cliente', clienteSelecionado);
    if (recursoSelecionado) params.append('recurso', recursoSelecionado);

    const response = await fetch(`/api/filtros/status?${params.toString()}`);
    if (!response.ok) throw new Error('Erro ao carregar status');
    return response.json();
};

// ==================== HOOKS CUSTOMIZADOS ====================
function useDataAtual() {
    return useMemo(() => {
        const hoje = new Date();
        return {
            hoje,
            anoAtual: hoje.getFullYear(),
            mesAtual: hoje.getMonth() + 1,
        };
    }, []);
}

function useAnosLocais(dadosChamados: FiltrosChamadoProps['dadosChamados']) {
    return useMemo(() => {
        if (!dadosChamados?.length) {
            return [];
        }

        const anosUnicos = new Set<number>();

        dadosChamados.forEach((chamado) => {
            const ano = extrairAnoDeData(chamado.DATA_CHAMADO);
            if (ano) anosUnicos.add(ano);
        });

        const anos = Array.from(anosUnicos).sort((a, b) => b - a);
        return anos;
    }, [dadosChamados]);
}

function useMesesDisponiveisNoAno(
    dadosChamados: FiltrosChamadoProps['dadosChamados'],
    anoTemp: number | undefined
) {
    return useMemo(() => {
        if (!anoTemp || !dadosChamados?.length) return [];

        const mesesUnicos = new Set<number>();

        dadosChamados.forEach((chamado) => {
            const ano = extrairAnoDeData(chamado.DATA_CHAMADO);
            const mes = extrairMesDeData(chamado.DATA_CHAMADO);

            if (ano === anoTemp && mes) {
                mesesUnicos.add(mes);
            }
        });

        const meses = Array.from(mesesUnicos).sort((a, b) => a - b);
        return meses;
    }, [dadosChamados, anoTemp]);
}

function useRecursosLocais(dadosChamados: FiltrosChamadoProps['dadosChamados']) {
    return useMemo(() => {
        if (!dadosChamados?.length) {
            return [];
        }

        const recursosUnicos = new Map<string, string>();

        dadosChamados.forEach((chamado, index) => {
            const nomeRecurso = chamado.NOME_RECURSO?.toString().trim();
            const codRecurso = chamado.COD_RECURSO?.toString().trim() || nomeRecurso;

            if (codRecurso && nomeRecurso && !recursosUnicos.has(codRecurso)) {
                recursosUnicos.set(codRecurso, nomeRecurso);
            }
        });

        const recursos = Array.from(recursosUnicos.entries())
            .map(([cod, nome]) => ({ cod, nome }))
            .sort((a, b) => a.nome.localeCompare(b.nome));

        return recursos;
    }, [dadosChamados]);
}

// ==================== COMPONENTE SELECT ====================
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
    const isDisabled = Boolean(disabled);
    const hasValue = value !== '' && value !== undefined && value !== 0;
    const isAplicado = valorAplicado !== '' && valorAplicado !== undefined && valorAplicado !== 0;

    return (
        <div className="relative">
            <select
                value={value ?? ''}
                onChange={(e) => onChange(e.target.value)}
                disabled={isDisabled}
                className={`${className} ${hasValue ? 'pr-12' : 'pr-8'} ${
                    hasValue && !isDisabled
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
                    const optLabel = typeof opt.label === 'string' ? opt.label : String(opt.label);

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

            {showClearButton && isAplicado && !isDisabled && (
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
                        className={`text-red-500 transition-all duration-200 hover:scale-125 hover:rotate-180 ${
                            hasValue ? '-translate-y-3' : ''
                        }`}
                        size={28}
                    />
                </button>
            )}
        </div>
    );
}

// ==================== COMPONENTE PRINCIPAL ====================
export function FiltrosChamado({ children, dadosChamados = [] }: FiltrosChamadoProps) {
    const { isAdmin, codCliente } = useAuth();
    const { hoje, anoAtual, mesAtual } = useDataAtual();

    // Estados temporários (antes de aplicar)
    const [anoTemp, setAnoTemp] = useState<number | undefined>(isAdmin ? anoAtual : undefined);
    const [mesTemp, setMesTemp] = useState<number | undefined>(isAdmin ? mesAtual : undefined);
    const [clienteTemp, setClienteTemp] = useState('');
    const [recursoTemp, setRecursoTemp] = useState('');
    const [statusTemp, setStatusTemp] = useState('');

    // Estados aplicados
    const [ano, setAno] = useState<number | undefined>(isAdmin ? anoAtual : undefined);
    const [mes, setMes] = useState<number | undefined>(isAdmin ? mesAtual : undefined);
    const [clienteSelecionado, setClienteSelecionado] = useState('');
    const [recursoSelecionado, setRecursoSelecionado] = useState('');
    const [statusSelecionado, setStatusSelecionado] = useState('');

    const [isInitialized, setIsInitialized] = useState(false);
    const [filtrosForamAlterados, setFiltrosForamAlterados] = useState(false);

    // Dados extraídos localmente
    const anosLocais = useAnosLocais(dadosChamados);
    const mesesDisponiveisNoAno = useMesesDisponiveisNoAno(dadosChamados, anoTemp);
    const recursosLocais = useRecursosLocais(dadosChamados);

    // Valores padrão
    const valoresPadrao = useMemo(
        () => ({
            ano: isAdmin ? anoAtual : undefined,
            mes: isAdmin ? mesAtual : undefined,
        }),
        [isAdmin, anoAtual, mesAtual]
    );

    // Status é FINALIZADO?
    const statusEhFinalizado = useMemo(() => {
        return statusSelecionado?.trim().toUpperCase() === 'FINALIZADO';
    }, [statusSelecionado]);

    const usarAnosConfigurados = useMemo(() => {
        const statusParaVerificar = statusTemp || statusSelecionado;
        return statusParaVerificar?.trim().toUpperCase() === 'FINALIZADO';
    }, [statusTemp, statusSelecionado]);

    // Anos disponíveis
    const years = useMemo(() => {
        if (usarAnosConfigurados) {
            return ANOS_DISPONIVEIS_FINALIZADOS;
        }
        if (anosLocais.length === 0) {
            return [2024, 2025, 2026];
        }
        return anosLocais;
    }, [anosLocais, usarAnosConfigurados]);

    // Meses disponíveis
    const mesesDisponiveis = useMemo(() => {
        if (!anoTemp) return [];

        if (usarAnosConfigurados) {
            if (anoTemp < anoAtual) {
                return MESES_NOMES.map((m, i) => ({ value: i + 1, label: m }));
            }
            if (anoTemp === anoAtual) {
                return MESES_NOMES.slice(0, mesAtual).map((m, i) => ({ value: i + 1, label: m }));
            }
            if (anoTemp > anoAtual) {
                return [];
            }
        }

        if (mesesDisponiveisNoAno.length > 0) {
            return mesesDisponiveisNoAno.map((mesNum) => ({
                value: mesNum,
                label: MESES_NOMES[mesNum - 1],
            }));
        }

        // Fallback
        if (anoTemp < anoAtual) {
            return MESES_NOMES.map((m, i) => ({ value: i + 1, label: m }));
        }
        if (anoTemp === anoAtual) {
            return MESES_NOMES.slice(0, mesAtual).map((m, i) => ({ value: i + 1, label: m }));
        }
        if (anoTemp > anoAtual) {
            const diferencaAnos = anoTemp - anoAtual;
            if (diferencaAnos === 1) {
                const mesesFuturos = Math.max(0, mesAtual - 1);
                return MESES_NOMES.slice(0, mesesFuturos).map((m, i) => ({
                    value: i + 1,
                    label: m,
                }));
            }
            return [];
        }

        return MESES_NOMES.map((m, i) => ({ value: i + 1, label: m }));
    }, [anoTemp, anoAtual, mesAtual, mesesDisponiveisNoAno, usarAnosConfigurados]);

    // Estados de desabilitação
    const anoDesabilitado = useMemo(() => {
        const statusNaoFinalizado = statusTemp && statusTemp.trim().toUpperCase() !== 'FINALIZADO';
        const statusMudou = statusTemp !== statusSelecionado;
        return Boolean(statusNaoFinalizado && statusMudou);
    }, [statusTemp, statusSelecionado]);

    const mesDesabilitado = !anoTemp || mesesDisponiveis.length === 0 || anoDesabilitado;

    const recursoDesabilitadoPorStatus = statusTemp !== statusSelecionado && statusTemp !== '';
    const isLoadingRecursos = recursosLocais.length === 0 && dadosChamados.length > 0;
    const recursoDesabilitado =
        recursoDesabilitadoPorStatus || isLoadingRecursos || !recursosLocais.length;

    // Queries
    const { data: clientesData = [], isLoading: clientesLoading } = useQuery({
        queryKey: ['clientes', mes, ano, isAdmin, codCliente],
        queryFn: () => fetchClientes({ mes, ano, isAdmin, codCliente }),
        enabled: !!isInitialized,
        staleTime: 1000 * 60 * 5,
        retry: 2,
    });

    const { data: statusData = [], isLoading: statusLoading } = useQuery({
        queryKey: ['status', mes, ano, isAdmin, codCliente, clienteSelecionado, recursoSelecionado],
        queryFn: () =>
            fetchStatus({ mes, ano, isAdmin, codCliente, clienteSelecionado, recursoSelecionado }),
        enabled: !!(isInitialized && (isAdmin || codCliente)),
        staleTime: 1000 * 60 * 5,
        retry: 2,
    });

    // Contadores e flags
    const mudancasCount = useMemo(() => {
        return [
            anoTemp !== ano,
            mesTemp !== mes,
            ...(isAdmin ? [clienteTemp !== clienteSelecionado] : []),
            recursoTemp !== recursoSelecionado,
            statusTemp !== statusSelecionado,
        ].filter(Boolean).length;
    }, [
        anoTemp,
        ano,
        mesTemp,
        mes,
        clienteTemp,
        clienteSelecionado,
        recursoTemp,
        recursoSelecionado,
        statusTemp,
        statusSelecionado,
        isAdmin,
    ]);

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

    // Callbacks
    const aplicarFiltros = useCallback(() => {
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
    }, [anoTemp, mesTemp, clienteTemp, recursoTemp, statusTemp, valoresPadrao]);

    const limparAnoMes = useCallback(() => {
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
            setStatusTemp('');
            setStatusSelecionado('');
        }
    }, [isAdmin, valoresPadrao, statusSelecionado]);

    const limparFiltroIndividual = useCallback(
        (campo: 'ano' | 'mes' | 'cliente' | 'recurso' | 'status') => {
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
                    if (statusSelecionado === 'FINALIZADO') {
                        setRecursoTemp('');
                        setRecursoSelecionado('');
                    }
                    setStatusTemp('');
                    setStatusSelecionado('');
                    if (!isAdmin) {
                        setAnoTemp(undefined);
                        setMesTemp(undefined);
                        setAno(undefined);
                        setMes(undefined);
                    }
                    break;
            }

            const verificarFiltrosRestantes = () => {
                if (campo === 'status') {
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
                    return temAnoMes || recursoSelecionado || statusSelecionado;
                }
                if (campo === 'recurso') {
                    const temAnoMes =
                        (isAdmin && (ano !== valoresPadrao.ano || mes !== valoresPadrao.mes)) ||
                        (!isAdmin && (ano !== undefined || mes !== undefined));
                    const temCliente = isAdmin && clienteSelecionado;
                    return temAnoMes || temCliente || statusSelecionado;
                }
                if (campo === 'ano' || campo === 'mes') {
                    const temCliente = isAdmin && clienteSelecionado;
                    return temCliente || recursoSelecionado || statusSelecionado;
                }
                return false;
            };

            if (!verificarFiltrosRestantes()) {
                setFiltrosForamAlterados(false);
            }
        },
        [
            limparAnoMes,
            isAdmin,
            ano,
            mes,
            valoresPadrao,
            clienteSelecionado,
            recursoSelecionado,
            statusSelecionado,
        ]
    );

    const limparFiltros = useCallback(() => {
        setAnoTemp(valoresPadrao.ano);
        setMesTemp(valoresPadrao.mes);
        if (isAdmin) {
            setClienteTemp('');
            setClienteSelecionado('');
        }
        setRecursoTemp('');
        setStatusTemp('');
        setAno(valoresPadrao.ano);
        setMes(valoresPadrao.mes);
        if (isAdmin) setClienteSelecionado('');
        setRecursoSelecionado('');
        setStatusSelecionado('');
        setFiltrosForamAlterados(false);
    }, [valoresPadrao, isAdmin]);

    // Effects
    useEffect(() => {
        setIsInitialized(true);
    }, [isAdmin, codCliente, dadosChamados.length]);

    useEffect(() => {
        if (!isAdmin && statusTemp === 'FINALIZADO') {
            if (!anoTemp) setAnoTemp(anoAtual);
            if (!mesTemp) setMesTemp(mesAtual);
        }
    }, [statusTemp, isAdmin, anoTemp, mesTemp, anoAtual, mesAtual]);

    useEffect(() => {
        if (mesTemp && anoTemp && mesesDisponiveis.length > 0) {
            const mesDisponivel = mesesDisponiveis.some((m) => m.value === mesTemp);
            if (!mesDisponivel) {
                setMesTemp(undefined);
            }
        }
    }, [anoTemp, mesesDisponiveis, mesTemp]);

    useEffect(() => {
        if (!isInitialized || !codCliente || isAdmin || clientesData.length === 0) return;
        setClienteTemp(codCliente);
        setClienteSelecionado(codCliente);
    }, [isAdmin, codCliente, clientesData, isInitialized]);

    useEffect(() => {
        if (!recursoTemp) return;
        const recursoExiste = recursosLocais.some((r) => r.cod === recursoTemp);
        if (!recursoExiste) {
            setRecursoTemp('');
        }
    }, [recursosLocais, recursoTemp]);

    useEffect(() => {
        if (!anoTemp || years.length === 0) return;
        const anoExiste = years.includes(anoTemp);
        if (!anoExiste) {
            setAnoTemp(undefined);
            setMesTemp(undefined);
        }
    }, [anoTemp, years]);

    const filtrosAtuais: Filtros = useMemo(
        () => ({
            ano,
            mes,
            cliente: clienteSelecionado,
            recurso: recursoSelecionado,
            status: statusSelecionado,
        }),
        [ano, mes, clienteSelecionado, recursoSelecionado, statusSelecionado]
    );

    const selectClassName =
        'w-full cursor-pointer rounded-md p-2 text-base font-extrabold tracking-widest shadow-md shadow-black transition-all duration-200 select-none hover:shadow-lg hover:shadow-black focus:ring-2 focus:ring-purple-600 focus:outline-none disabled:cursor-not-allowed disabled:opacity-30';

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
                        onChange={(value) => setAnoTemp(value ? Number(value) : undefined)}
                        onClearImmediate={() => limparFiltroIndividual('ano')}
                        disabled={anoDesabilitado}
                        options={years.map((y) => ({ value: y, label: String(y) }))}
                        placeholder={
                            anoDesabilitado
                                ? 'Aplique o filtro p/ selecionar ano'
                                : 'Selecione o ano'
                        }
                        className={selectClassName}
                    />

                    <SelectWithClear
                        value={mesTemp}
                        valorAplicado={mes}
                        onChange={(value) => setMesTemp(value ? Number(value) : undefined)}
                        onClearImmediate={() => limparFiltroIndividual('mes')}
                        disabled={mesDesabilitado}
                        options={mesesDisponiveis}
                        placeholder={
                            anoDesabilitado
                                ? 'Aplique o filtro p/ selecionar mês'
                                : !anoTemp
                                  ? 'Selecione o ano p/ selecionar mês'
                                  : mesesDisponiveis.length === 0
                                    ? 'Nenhum mês disponível'
                                    : 'Selecione o mês'
                        }
                        className={selectClassName}
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
                        className={`${selectClassName} disabled:hover:scale-100 disabled:hover:shadow-md disabled:hover:shadow-black`}
                    />

                    <SelectWithClear
                        value={recursoTemp}
                        valorAplicado={recursoSelecionado}
                        onChange={setRecursoTemp}
                        onClearImmediate={() => limparFiltroIndividual('recurso')}
                        disabled={recursoDesabilitado}
                        options={recursosLocais.map((r) => ({ value: r.cod, label: r.nome }))}
                        placeholder={
                            recursoDesabilitadoPorStatus
                                ? 'Aplique o filtro p/ selecionar recurso'
                                : isLoadingRecursos
                                  ? 'Carregando...'
                                  : recursosLocais.length === 0
                                    ? 'Nenhum recurso disponível'
                                    : 'Selecione o recurso'
                        }
                        className={selectClassName}
                    />

                    <SelectWithClear
                        value={statusTemp}
                        valorAplicado={statusSelecionado}
                        onChange={setStatusTemp}
                        onClearImmediate={() => limparFiltroIndividual('status')}
                        disabled={!statusData.length || statusLoading}
                        options={statusData.map((s) => ({ value: s, label: s }))}
                        placeholder={statusLoading ? 'Carregando...' : 'Selecione o status'}
                        className={selectClassName}
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
