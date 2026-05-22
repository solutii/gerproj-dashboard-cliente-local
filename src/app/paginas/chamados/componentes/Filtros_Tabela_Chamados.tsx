// src/app/paginas/chamados/componentes/Filtros_Tabela_Chamados.tsx

'use client';

import { Relogio } from '@/components/Relogio';
import { corrigirTextoCorrompido } from '@/formatters/formatar-texto-corrompido';
import { useAuthStore } from '@/store/useAuthStore';
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
import {
    MdCalendarMonth,
    MdClose,
    MdExpandLess,
    MdExpandMore,
    MdFilterAlt,
    MdFilterAltOff,
} from 'react-icons/md';

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
    chamado: string;
    entrada: string;
    prioridade: string;
    classificacao: string;
    atribuicao: string;
    finalizacao: string;
    inicio: string;
}

interface FiltrosChamadoProps {
    children?: ReactNode;
    dadosChamados?: Array<{
        COD_CHAMADO?: number;
        COD_RECURSO?: number | null;
        NOME_RECURSO?: string | null;
        STATUS_CHAMADO?: string | null;
        DATA_CHAMADO?: string | Date | number;
        HORA_CHAMADO?: string;
        PRIOR_CHAMADO?: number;
        NOME_CLASSIFICACAO?: string | null;
        DTENVIO_CHAMADO?: string | null;
        DATA_HISTCHAMADO?: string | null;
        HORA_HISTCHAMADO?: string | null;
        DTINI_CHAMADO?: string | null;
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
    if (typeof dataChamado === 'string') data = new Date(dataChamado);
    else if (dataChamado instanceof Date) data = dataChamado;
    else if (typeof dataChamado === 'number') data = new Date(dataChamado);
    if (!data || isNaN(data.getTime())) return null;
    const ano = data.getFullYear();
    return ano >= 2020 && ano <= 2030 ? ano : null;
}

function extrairMesDeData(dataChamado: string | Date | number | null | undefined): number | null {
    if (!dataChamado) return null;
    let data: Date | null = null;
    if (typeof dataChamado === 'string') data = new Date(dataChamado);
    else if (dataChamado instanceof Date) data = dataChamado;
    else if (typeof dataChamado === 'number') data = new Date(dataChamado);
    if (!data || isNaN(data.getTime())) return null;
    return data.getMonth() + 1;
}

function formatarData(data: string | Date | number | null | undefined): string | null {
    if (!data) return null;
    try {
        if (typeof data === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(data)) return data;
        if (typeof data === 'string' && /^\d{2}\/\d{2}\/\d{4} - \d{2}:\d{2}$/.test(data))
            return data.split(' - ')[0];
        if (typeof data === 'string' && /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}/.test(data))
            return data.split(' ')[0];
        if (typeof data === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(data)) {
            const dataObj = new Date(data);
            if (isNaN(dataObj.getTime())) return null;
            return `${dataObj.getDate().toString().padStart(2, '0')}/${(dataObj.getMonth() + 1).toString().padStart(2, '0')}/${dataObj.getFullYear()}`;
        }
        if (typeof data === 'string') {
            const isoMatch = data.match(/^(\d{4})-(\d{2})-(\d{2})$/);
            if (isoMatch) return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
        }
        if (data instanceof Date) {
            if (isNaN(data.getTime())) return null;
            return `${data.getDate().toString().padStart(2, '0')}/${(data.getMonth() + 1).toString().padStart(2, '0')}/${data.getFullYear()}`;
        }
        if (typeof data === 'number') {
            const dataObj = new Date(data);
            if (isNaN(dataObj.getTime())) return null;
            return `${dataObj.getDate().toString().padStart(2, '0')}/${(dataObj.getMonth() + 1).toString().padStart(2, '0')}/${dataObj.getFullYear()}`;
        }
        return null;
    } catch {
        return null;
    }
}

// ==================== API FETCHERS ====================
const fetchClientes = async ({
    mes,
    ano,
    codCliente,
}: {
    mes?: number;
    ano?: number;
    codCliente: string | null;
}): Promise<Cliente[]> => {
    const params = new URLSearchParams();
    if (mes) params.append('mes', mes.toString());
    if (ano) params.append('ano', ano.toString());
    if (codCliente) params.append('codCliente', codCliente);
    const response = await fetch(`/api/filtros/clientes?${params.toString()}`);
    if (!response.ok) throw new Error('Erro ao carregar clientes');
    return response.json();
};

const fetchRecursos = async ({
    mes,
    ano,
    codCliente,
    clienteSelecionado,
}: {
    mes?: number;
    ano?: number;
    codCliente: string | null;
    clienteSelecionado: string;
}): Promise<Recurso[]> => {
    const params = new URLSearchParams();
    if (mes) params.append('mes', mes.toString());
    if (ano) params.append('ano', ano.toString());
    if (codCliente) params.append('codCliente', codCliente);
    const response = await fetch(`/api/filtros/recursos?${params.toString()}`);
    if (!response.ok) throw new Error('Erro ao carregar recursos');
    return response.json();
};

const fetchStatus = async ({
    mes,
    ano,
    codCliente,
    recursoSelecionado,
}: {
    mes?: number;
    ano?: number;
    codCliente: string | null;
    clienteSelecionado: string;
    recursoSelecionado: string;
}): Promise<string[]> => {
    const params = new URLSearchParams();
    if (mes) params.append('mes', mes.toString());
    if (ano) params.append('ano', ano.toString());
    if (codCliente) params.append('codCliente', codCliente);
    if (recursoSelecionado) params.append('recurso', recursoSelecionado);
    const response = await fetch(`/api/filtros/status?${params.toString()}`);
    if (!response.ok) throw new Error('Erro ao carregar status');
    return response.json();
};

// ==================== HOOKS CUSTOMIZADOS ====================
function useDataAtual() {
    return useMemo(() => {
        const hoje = new Date();
        return { hoje, anoAtual: hoje.getFullYear(), mesAtual: hoje.getMonth() + 1 };
    }, []);
}

// ==================== CORREÇÃO 5: MEMOIZAÇÃO ESTÁVEL DA ENTRADA DOS HOOKS LOCAIS ====================
//
// Problema anterior: cada hook (useChamadosLocais, useEntradasLocais, etc.) recebia
// `dadosChamados` diretamente e recalculava a cada render, mesmo sem mudanças reais
// nos dados. Com 10 hooks e 500 chamados, isso era 5.000 iterações por render.
//
// Solução: extrair os campos necessários em arrays primitivos memoizados por uma
// chave estável (IDs dos chamados). Os hooks individuais recebem apenas o que
// precisam e só recomputam quando os dados realmente mudam.

function useDadosMemoizados(dadosChamados: FiltrosChamadoProps['dadosChamados']) {
    // Chave estável baseada nos IDs — muda só quando a lista de chamados muda
    const idsKey = useMemo(
        () => (dadosChamados ?? []).map((c) => c.COD_CHAMADO).join(','),
        [dadosChamados]
    );

    return useMemo(() => {
        const dados = dadosChamados ?? [];
        return {
            anos: dados.map((c) => extrairAnoDeData(c.DATA_CHAMADO)).filter(Boolean) as number[],
            meses: dados
                .map((c) => ({
                    ano: extrairAnoDeData(c.DATA_CHAMADO),
                    mes: extrairMesDeData(c.DATA_CHAMADO),
                }))
                .filter((x) => x.ano && x.mes) as { ano: number; mes: number }[],
            recursos: dados
                .map((c) => ({
                    cod: c.COD_RECURSO?.toString().trim() ?? '',
                    nome: c.NOME_RECURSO?.toString().trim() ?? '',
                }))
                .filter((r) => r.cod && r.nome),
            chamados: dados.map((c) => c.COD_CHAMADO).filter(Boolean) as number[],
            datasEntrada: dados
                .map((c) => formatarData(c.DATA_CHAMADO))
                .filter(Boolean) as string[],
            datasInicio: dados
                .map((c) => formatarData(c.DTINI_CHAMADO))
                .filter(Boolean) as string[],
            prioridades: dados
                .map((c) => c.PRIOR_CHAMADO)
                .filter((p) => p !== undefined && p !== null) as number[],
            classificacoes: dados
                .map((c) => c.NOME_CLASSIFICACAO?.toString().trim() ?? '')
                .filter(Boolean) as string[],
            datasAtribuicao: dados
                .map((c) => formatarData(c.DTENVIO_CHAMADO))
                .filter(Boolean) as string[],
            datasFinalizacao: dados
                .map((c) => formatarData(c.DATA_HISTCHAMADO))
                .filter(Boolean) as string[],
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [idsKey]); // ← depende só da chave, não do array inteiro
}

function useAnosLocais(dados: ReturnType<typeof useDadosMemoizados>) {
    return useMemo(() => {
        const anosUnicos = new Set(dados.anos);
        return Array.from(anosUnicos).sort((a, b) => b - a);
    }, [dados.anos]);
}

function useMesesDisponiveisNoAno(
    dados: ReturnType<typeof useDadosMemoizados>,
    anoTemp: number | undefined
) {
    return useMemo(() => {
        if (!anoTemp) return [];
        const mesesUnicos = new Set(dados.meses.filter((x) => x.ano === anoTemp).map((x) => x.mes));
        return Array.from(mesesUnicos).sort((a, b) => a - b);
    }, [dados.meses, anoTemp]);
}

function useRecursosLocais(dados: ReturnType<typeof useDadosMemoizados>) {
    return useMemo(() => {
        const recursosUnicos = new Map<string, string>();
        for (const r of dados.recursos) {
            if (!recursosUnicos.has(r.cod)) recursosUnicos.set(r.cod, r.nome);
        }
        return Array.from(recursosUnicos.entries())
            .map(([cod, nome]) => ({ cod, nome }))
            .sort((a, b) => a.nome.localeCompare(b.nome));
    }, [dados.recursos]);
}

function useChamadosLocais(dados: ReturnType<typeof useDadosMemoizados>) {
    return useMemo(() => {
        const unicos = [...new Set(dados.chamados)].sort((a, b) => b - a);
        return unicos.map((cod) => ({ value: cod, label: cod.toString() }));
    }, [dados.chamados]);
}

function useEntradasLocais(dados: ReturnType<typeof useDadosMemoizados>) {
    return useMemo(() => {
        return [...new Set(dados.datasEntrada)]
            .sort((a, b) => sortDataDesc(a, b))
            .map((d) => ({ value: d, label: d }));
    }, [dados.datasEntrada]);
}

function useIniciosLocais(dados: ReturnType<typeof useDadosMemoizados>) {
    return useMemo(() => {
        return [...new Set(dados.datasInicio)]
            .sort((a, b) => sortDataDesc(a, b))
            .map((d) => ({ value: d, label: d }));
    }, [dados.datasInicio]);
}

function usePrioridadesLocais(dados: ReturnType<typeof useDadosMemoizados>) {
    const prioridadeLabels: Record<number, string> = {
        1: '1 - Urgente',
        2: '2 - Alta',
        3: '3 - Normal',
        4: '4 - Baixa',
        100: '100 - Sem Prioridade',
    };
    return useMemo(() => {
        return [...new Set(dados.prioridades)]
            .sort((a, b) => a - b)
            .map((p) => ({ value: p, label: prioridadeLabels[p] || `${p}` }));
    }, [dados.prioridades]);
}

function useClassificacoesLocais(dados: ReturnType<typeof useDadosMemoizados>) {
    return useMemo(() => {
        return [...new Set(dados.classificacoes)]
            .sort()
            .map((nome) => ({ value: nome, label: nome }));
    }, [dados.classificacoes]);
}

function useAtribuicoesLocais(dados: ReturnType<typeof useDadosMemoizados>) {
    return useMemo(() => {
        return [...new Set(dados.datasAtribuicao)]
            .sort((a, b) => sortDataDesc(a, b))
            .map((d) => ({ value: d, label: d }));
    }, [dados.datasAtribuicao]);
}

function useFinalizacoesLocais(dados: ReturnType<typeof useDadosMemoizados>) {
    return useMemo(() => {
        return [...new Set(dados.datasFinalizacao)]
            .sort((a, b) => sortDataDesc(a, b))
            .map((d) => ({ value: d, label: d }));
    }, [dados.datasFinalizacao]);
}

// Helper de ordenação desc para strings "dd/mm/yyyy"
function sortDataDesc(a: string, b: string): number {
    const [dA, mA, yA] = a.split('/').map(Number);
    const [dB, mB, yB] = b.split('/').map(Number);
    return new Date(yB, mB - 1, dB).getTime() - new Date(yA, mA - 1, dA).getTime();
}

// ==================== COMPONENTE SELECT ====================
function SelectWithClear({
    value,
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

    return (
        <div className="relative">
            <select
                value={value ?? ''}
                onChange={(e) => onChange(e.target.value)}
                disabled={isDisabled}
                className={`${className} ${hasValue ? 'pr-12' : 'pr-8'} ${
                    hasValue && !isDisabled ? 'border-t border-purple-300 bg-purple-100' : 'border'
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
                            {processarNome(optLabel, 3)}
                        </option>
                    );
                })}
            </select>

            {showClearButton && hasValue && !isDisabled && (
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
                        className="text-red-500 transition-all duration-200 hover:scale-125 hover:rotate-180"
                        size={28}
                    />
                </button>
            )}
        </div>
    );
}

// ==================== COMPONENTE PRINCIPAL ====================
export function FiltrosTabelaChamados({ children, dadosChamados = [] }: FiltrosChamadoProps) {
    const { codCliente } = useAuthStore();
    const { hoje, anoAtual, mesAtual } = useDataAtual();

    const [dropdownAberto, setDropdownAberto] = useState(false);

    // Estados temporários (antes de aplicar)
    const [anoTemp, setAnoTemp] = useState<number | undefined>(undefined);
    const [mesTemp, setMesTemp] = useState<number | undefined>(undefined);
    const [clienteTemp, setClienteTemp] = useState('');
    const [recursoTemp, setRecursoTemp] = useState('');
    const [statusTemp, setStatusTemp] = useState('');
    const [chamadoTemp, setChamadoTemp] = useState('');
    const [entradaTemp, setEntradaTemp] = useState('');
    const [prioridadeTemp, setPrioridadeTemp] = useState('');
    const [classificacaoTemp, setClassificacaoTemp] = useState('');
    const [atribuicaoTemp, setAtribuicaoTemp] = useState('');
    const [finalizacaoTemp, setFinalizacaoTemp] = useState('');
    const [inicioTemp, setInicioTemp] = useState('');

    // Estados aplicados
    const [ano, setAno] = useState<number | undefined>(undefined);
    const [mes, setMes] = useState<number | undefined>(undefined);
    const [clienteSelecionado, setClienteSelecionado] = useState('');
    const [recursoSelecionado, setRecursoSelecionado] = useState('');
    const [statusSelecionado, setStatusSelecionado] = useState('');
    const [chamadoSelecionado, setChamadoSelecionado] = useState('');
    const [entradaSelecionada, setEntradaSelecionada] = useState('');
    const [prioridadeSelecionada, setPrioridadeSelecionada] = useState('');
    const [classificacaoSelecionada, setClassificacaoSelecionada] = useState('');
    const [atribuicaoSelecionada, setAtribuicaoSelecionada] = useState('');
    const [finalizacaoSelecionada, setFinalizacaoSelecionada] = useState('');
    const [inicioSelecionado, setInicioSelecionado] = useState('');

    // ✅ CORREÇÃO 2: isInitialized sem dependências dinâmicas
    //
    // Problema anterior: o useEffect tinha [isAdmin, codCliente, dadosChamados.length]
    // como dependências, fazendo setIsInitialized(true) re-disparar a cada atualização
    // dos dados da tabela, o que forçava re-execução de todas as queries do useQuery.
    //
    // Correção: array vazio [] — inicializa apenas uma vez na montagem do componente,
    // que é a intenção original.
    const [isInitialized, setIsInitialized] = useState(false);

    const [filtrosForamAlterados, setFiltrosForamAlterados] = useState(false);

    // ✅ CORREÇÃO 5: dados memoizados com chave estável — entrada dos hooks locais
    const dadosMemo = useDadosMemoizados(dadosChamados);

    const anosLocais = useAnosLocais(dadosMemo);
    const mesesDisponiveisNoAno = useMesesDisponiveisNoAno(dadosMemo, anoTemp);
    const recursosLocais = useRecursosLocais(dadosMemo);
    const chamadosLocais = useChamadosLocais(dadosMemo);
    const entradasLocais = useEntradasLocais(dadosMemo);
    const prioridadesLocais = usePrioridadesLocais(dadosMemo);
    const classificacoesLocais = useClassificacoesLocais(dadosMemo);
    const atribuicoesLocais = useAtribuicoesLocais(dadosMemo);
    const finalizacoesLocais = useFinalizacoesLocais(dadosMemo);
    const iniciosLocais = useIniciosLocais(dadosMemo);

    const valoresPadrao = useMemo(() => ({ ano: undefined, mes: undefined }), [anoAtual, mesAtual]);

    const usarAnosConfigurados = useMemo(() => {
        const statusParaVerificar = statusTemp || statusSelecionado;
        const upper = statusParaVerificar?.trim().toUpperCase();
        return upper === 'FINALIZADO' || upper === 'TODOS';
    }, [statusTemp, statusSelecionado]);

    const years = useMemo(() => {
        if (usarAnosConfigurados) return ANOS_DISPONIVEIS_FINALIZADOS;
        if (anosLocais.length === 0) return [2024, 2025, 2026];
        return anosLocais;
    }, [anosLocais, usarAnosConfigurados]);

    const mesesDisponiveis = useMemo(() => {
        if (!anoTemp) return [];
        if (usarAnosConfigurados) {
            if (anoTemp < anoAtual) return MESES_NOMES.map((m, i) => ({ value: i + 1, label: m }));
            if (anoTemp === anoAtual)
                return MESES_NOMES.slice(0, mesAtual).map((m, i) => ({ value: i + 1, label: m }));
            return [];
        }
        if (mesesDisponiveisNoAno.length > 0)
            return mesesDisponiveisNoAno.map((mesNum) => ({
                value: mesNum,
                label: MESES_NOMES[mesNum - 1],
            }));
        if (anoTemp < anoAtual) return MESES_NOMES.map((m, i) => ({ value: i + 1, label: m }));
        if (anoTemp === anoAtual)
            return MESES_NOMES.slice(0, mesAtual).map((m, i) => ({ value: i + 1, label: m }));
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

    const anoDesabilitado = useMemo(() => {
        const upper = statusTemp?.trim().toUpperCase();
        const statusNaoPermiteData = statusTemp && upper !== 'FINALIZADO' && upper !== 'TODOS';
        const statusMudou = statusTemp !== statusSelecionado;
        return Boolean(statusNaoPermiteData && statusMudou);
    }, [statusTemp, statusSelecionado]);

    const mesDesabilitado = !anoTemp || mesesDisponiveis.length === 0 || anoDesabilitado;

    const recursoDesabilitadoPorStatus = statusTemp !== statusSelecionado && statusTemp !== '';
    const isLoadingRecursos = recursosLocais.length === 0 && dadosChamados.length > 0;
    const recursoDesabilitado =
        recursoDesabilitadoPorStatus || isLoadingRecursos || !recursosLocais.length;

    const { data: clientesData = [] } = useQuery({
        queryKey: ['clientes', mes, ano, codCliente],
        queryFn: () => fetchClientes({ mes, ano, codCliente }),
        enabled: !!isInitialized,
        staleTime: 1000 * 60 * 5,
        retry: 2,
    });

    const { data: statusData = [], isLoading: statusLoading } = useQuery({
        queryKey: ['status', mes, ano, codCliente, clienteSelecionado, recursoSelecionado],
        queryFn: () =>
            fetchStatus({ mes, ano, codCliente, clienteSelecionado, recursoSelecionado }),
        enabled: !!(isInitialized && codCliente),
        staleTime: 1000 * 60 * 5,
        retry: 2,
    });

    const obterLabelFiltro = useCallback(
        (campo: string, valor: string | number | undefined) => {
            if (!valor) return '';
            switch (campo) {
                case 'ano':
                    return `Ano: ${valor}`;
                case 'mes':
                    return `Mês: ${MESES_NOMES[Number(valor) - 1]}`;
                case 'cliente': {
                    const cliente = clientesData.find((c) => c.cod === valor);
                    return `Cliente: ${processarNome(cliente?.nome || String(valor), 3)}`;
                }
                case 'recurso': {
                    const recurso = recursosLocais.find((r) => r.cod === valor);
                    return `Consultor: ${processarNome(recurso?.nome || String(valor), 2)}`;
                }
                case 'status':
                    return `Status: ${valor}`;
                case 'chamado':
                    return `Chamado: ${valor}`;
                case 'entrada':
                    return `Entrada: ${valor}`;
                case 'inicio':
                    return `Início: ${valor}`;
                case 'atribuicao':
                    return `Atribuição: ${valor}`;
                case 'prioridade': {
                    const prioridade = prioridadesLocais.find((p) => p.value === Number(valor));
                    return `Prioridade: ${prioridade?.label || valor}`;
                }
                case 'classificacao':
                    return `Classificação: ${processarNome(String(valor), 2)}`;
                case 'finalizacao':
                    return `Finalização: ${valor}`;
                default:
                    return '';
            }
        },
        [clientesData, recursosLocais, prioridadesLocais]
    );

    const filtrosAplicados = useMemo(() => {
        const tags: Array<{ campo: string; valor: string | number; label: string }> = [];
        if (ano !== undefined)
            tags.push({ campo: 'ano', valor: ano, label: obterLabelFiltro('ano', ano) });
        if (mes !== undefined)
            tags.push({ campo: 'mes', valor: mes, label: obterLabelFiltro('mes', mes) });
        if (recursoSelecionado)
            tags.push({
                campo: 'recurso',
                valor: recursoSelecionado,
                label: obterLabelFiltro('recurso', recursoSelecionado),
            });
        if (statusSelecionado)
            tags.push({
                campo: 'status',
                valor: statusSelecionado,
                label: obterLabelFiltro('status', statusSelecionado),
            });
        if (chamadoSelecionado)
            tags.push({
                campo: 'chamado',
                valor: chamadoSelecionado,
                label: obterLabelFiltro('chamado', chamadoSelecionado),
            });
        if (entradaSelecionada)
            tags.push({
                campo: 'entrada',
                valor: entradaSelecionada,
                label: obterLabelFiltro('entrada', entradaSelecionada),
            });
        if (inicioSelecionado)
            tags.push({
                campo: 'inicio',
                valor: inicioSelecionado,
                label: obterLabelFiltro('inicio', inicioSelecionado),
            });
        if (atribuicaoSelecionada)
            tags.push({
                campo: 'atribuicao',
                valor: atribuicaoSelecionada,
                label: obterLabelFiltro('atribuicao', atribuicaoSelecionada),
            });
        if (prioridadeSelecionada)
            tags.push({
                campo: 'prioridade',
                valor: prioridadeSelecionada,
                label: obterLabelFiltro('prioridade', prioridadeSelecionada),
            });
        if (classificacaoSelecionada)
            tags.push({
                campo: 'classificacao',
                valor: classificacaoSelecionada,
                label: obterLabelFiltro('classificacao', classificacaoSelecionada),
            });
        if (finalizacaoSelecionada)
            tags.push({
                campo: 'finalizacao',
                valor: finalizacaoSelecionada,
                label: obterLabelFiltro('finalizacao', finalizacaoSelecionada),
            });
        return tags;
    }, [
        ano,
        mes,
        clienteSelecionado,
        recursoSelecionado,
        statusSelecionado,
        chamadoSelecionado,
        entradaSelecionada,
        inicioSelecionado,
        atribuicaoSelecionada,
        prioridadeSelecionada,
        classificacaoSelecionada,
        finalizacaoSelecionada,
        valoresPadrao,
        obterLabelFiltro,
    ]);

    const mudancasCount = useMemo(() => {
        return [
            anoTemp !== ano,
            mesTemp !== mes,
            clienteTemp !== clienteSelecionado,
            recursoTemp !== recursoSelecionado,
            statusTemp !== statusSelecionado,
            chamadoTemp !== chamadoSelecionado,
            entradaTemp !== entradaSelecionada,
            prioridadeTemp !== prioridadeSelecionada,
            classificacaoTemp !== classificacaoSelecionada,
            atribuicaoTemp !== atribuicaoSelecionada,
            finalizacaoTemp !== finalizacaoSelecionada,
            inicioTemp !== inicioSelecionado,
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
        chamadoTemp,
        chamadoSelecionado,
        entradaTemp,
        entradaSelecionada,
        prioridadeTemp,
        prioridadeSelecionada,
        classificacaoTemp,
        classificacaoSelecionada,
        atribuicaoTemp,
        atribuicaoSelecionada,
        finalizacaoTemp,
        finalizacaoSelecionada,
        inicioTemp,
        inicioSelecionado,
    ]);

    const temMudancas = mudancasCount > 0;
    const temfiltrosAplicados = filtrosAplicados.length > 0;

    const aplicarFiltros = useCallback(() => {
        setAno(anoTemp);
        setMes(mesTemp);
        setClienteSelecionado(clienteTemp);
        setRecursoSelecionado(recursoTemp);
        setStatusSelecionado(statusTemp);
        setChamadoSelecionado(chamadoTemp);
        setEntradaSelecionada(entradaTemp);
        setPrioridadeSelecionada(prioridadeTemp);
        setClassificacaoSelecionada(classificacaoTemp);
        setAtribuicaoSelecionada(atribuicaoTemp);
        setFinalizacaoSelecionada(finalizacaoTemp);
        setInicioSelecionado(inicioTemp);
        if (
            anoTemp !== valoresPadrao.ano ||
            mesTemp !== valoresPadrao.mes ||
            clienteTemp ||
            recursoTemp ||
            statusTemp ||
            chamadoTemp ||
            entradaTemp ||
            prioridadeTemp ||
            classificacaoTemp ||
            atribuicaoTemp ||
            finalizacaoTemp ||
            inicioTemp
        )
            setFiltrosForamAlterados(true);
        setDropdownAberto(false);
    }, [
        anoTemp,
        mesTemp,
        clienteTemp,
        recursoTemp,
        statusTemp,
        chamadoTemp,
        entradaTemp,
        prioridadeTemp,
        classificacaoTemp,
        atribuicaoTemp,
        finalizacaoTemp,
        inicioTemp,
        valoresPadrao,
    ]);

    const limparAnoMes = useCallback(() => {
        setAnoTemp(undefined);
        setMesTemp(undefined);
        setAno(undefined);
        setMes(undefined);
        if (statusSelecionado === 'FINALIZADO') {
            setStatusTemp('');
            setStatusSelecionado('');
        }
    }, [valoresPadrao, statusSelecionado]);

    const limparFiltroIndividual = useCallback(
        (
            campo:
                | 'ano'
                | 'mes'
                | 'cliente'
                | 'recurso'
                | 'status'
                | 'chamado'
                | 'entrada'
                | 'prioridade'
                | 'classificacao'
                | 'atribuicao'
                | 'finalizacao'
                | 'inicio'
        ) => {
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
                case 'status': {
                    const upper = statusSelecionado?.trim().toUpperCase();
                    if (upper === 'FINALIZADO' || upper === 'TODOS') {
                        setRecursoTemp('');
                        setRecursoSelecionado('');
                    }
                    setStatusTemp('');
                    setStatusSelecionado('');
                    setAnoTemp(undefined);
                    setMesTemp(undefined);
                    setAno(undefined);
                    setMes(undefined);
                    break;
                }
                case 'chamado':
                    setChamadoTemp('');
                    setChamadoSelecionado('');
                    break;
                case 'entrada':
                    setEntradaTemp('');
                    setEntradaSelecionada('');
                    break;
                case 'prioridade':
                    setPrioridadeTemp('');
                    setPrioridadeSelecionada('');
                    break;
                case 'classificacao':
                    setClassificacaoTemp('');
                    setClassificacaoSelecionada('');
                    break;
                case 'atribuicao':
                    setAtribuicaoTemp('');
                    setAtribuicaoSelecionada('');
                    break;
                case 'finalizacao':
                    setFinalizacaoTemp('');
                    setFinalizacaoSelecionada('');
                    break;
                case 'inicio':
                    setInicioTemp('');
                    setInicioSelecionado('');
                    break;
            }

            const verificarFiltrosRestantes = () => {
                const temAnoMes = ano !== undefined || mes !== undefined;
                if (campo === 'status') return temAnoMes;
                if (campo === 'cliente')
                    return (
                        temAnoMes ||
                        recursoSelecionado ||
                        statusSelecionado ||
                        chamadoSelecionado ||
                        entradaSelecionada ||
                        prioridadeSelecionada ||
                        classificacaoSelecionada ||
                        atribuicaoSelecionada ||
                        finalizacaoSelecionada ||
                        inicioSelecionado
                    );
                if (campo === 'recurso')
                    return (
                        temAnoMes ||
                        statusSelecionado ||
                        chamadoSelecionado ||
                        entradaSelecionada ||
                        prioridadeSelecionada ||
                        classificacaoSelecionada ||
                        atribuicaoSelecionada ||
                        finalizacaoSelecionada ||
                        inicioSelecionado
                    );
                if (campo === 'ano' || campo === 'mes')
                    return (
                        recursoSelecionado ||
                        statusSelecionado ||
                        chamadoSelecionado ||
                        entradaSelecionada ||
                        prioridadeSelecionada ||
                        classificacaoSelecionada ||
                        atribuicaoSelecionada ||
                        finalizacaoSelecionada ||
                        inicioSelecionado
                    );
                return false;
            };

            if (!verificarFiltrosRestantes()) setFiltrosForamAlterados(false);
        },
        [
            limparAnoMes,
            ano,
            mes,
            valoresPadrao,
            clienteSelecionado,
            recursoSelecionado,
            statusSelecionado,
            chamadoSelecionado,
            entradaSelecionada,
            prioridadeSelecionada,
            classificacaoSelecionada,
            atribuicaoSelecionada,
            finalizacaoSelecionada,
            inicioSelecionado,
        ]
    );

    const limparFiltros = useCallback(() => {
        setAnoTemp(undefined);
        setMesTemp(undefined);
        setClienteTemp('');
        setClienteSelecionado('');
        setRecursoTemp('');
        setStatusTemp('');
        setChamadoTemp('');
        setEntradaTemp('');
        setPrioridadeTemp('');
        setClassificacaoTemp('');
        setAtribuicaoTemp('');
        setFinalizacaoTemp('');
        setInicioTemp('');
        setAno(undefined);
        setMes(undefined);
        setRecursoSelecionado('');
        setStatusSelecionado('');
        setChamadoSelecionado('');
        setEntradaSelecionada('');
        setPrioridadeSelecionada('');
        setClassificacaoSelecionada('');
        setAtribuicaoSelecionada('');
        setFinalizacaoSelecionada('');
        setInicioSelecionado('');
        setFiltrosForamAlterados(false);
    }, [valoresPadrao]);

    // ✅ CORREÇÃO 2: array vazio — inicializa apenas uma vez na montagem
    useEffect(() => {
        setIsInitialized(true);
    }, []); // ← era [isAdmin, codCliente, dadosChamados.length]

    useEffect(() => {
        const upper = statusTemp?.trim().toUpperCase();
        if (upper === 'FINALIZADO' || upper === 'TODOS') {
            if (!anoTemp) setAnoTemp(anoAtual);
            if (!mesTemp) setMesTemp(mesAtual);
        }
    }, [statusTemp, anoTemp, mesTemp, anoAtual, mesAtual]);

    useEffect(() => {
        if (mesTemp && anoTemp && mesesDisponiveis.length > 0) {
            const mesDisponivel = mesesDisponiveis.some((m) => m.value === mesTemp);
            if (!mesDisponivel) setMesTemp(undefined);
        }
    }, [anoTemp, mesesDisponiveis, mesTemp]);

    useEffect(() => {
        if (!isInitialized || !codCliente || clientesData.length === 0) return;
        setClienteTemp(codCliente);
        setClienteSelecionado(codCliente);
    }, [codCliente, clientesData, isInitialized]);

    useEffect(() => {
        if (!recursoTemp) return;
        const recursoExiste = recursosLocais.some((r) => r.cod === recursoTemp);
        if (!recursoExiste) setRecursoTemp('');
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
            chamado: chamadoSelecionado,
            entrada: entradaSelecionada,
            prioridade: prioridadeSelecionada,
            classificacao: classificacaoSelecionada,
            atribuicao: atribuicaoSelecionada,
            finalizacao: finalizacaoSelecionada,
            inicio: inicioSelecionado,
        }),
        [
            ano,
            mes,
            clienteSelecionado,
            recursoSelecionado,
            statusSelecionado,
            chamadoSelecionado,
            entradaSelecionada,
            prioridadeSelecionada,
            classificacaoSelecionada,
            atribuicaoSelecionada,
            finalizacaoSelecionada,
            inicioSelecionado,
        ]
    );

    const selectClassName =
        'w-full cursor-pointer rounded-md bg-white p-1.5 text-sm font-bold tracking-widest shadow-xs shadow-black transition-all duration-200 select-none hover:shadow-md hover:shadow-black focus:ring-2 focus:ring-purple-600 focus:outline-none disabled:cursor-not-allowed disabled:opacity-30';

    return (
        <FiltrosContext.Provider value={filtrosAtuais}>
            <div className="flex flex-col gap-10">
                <header className="flex items-center justify-between px-4">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-6">
                            <button
                                onClick={() => setDropdownAberto(!dropdownAberto)}
                                className="flex cursor-pointer items-center gap-10 rounded-md border-t border-gray-300 bg-teal-600 px-6 py-1 text-lg font-extrabold tracking-widest text-white shadow-md shadow-black transition-all duration-200 hover:bg-teal-500 hover:shadow-lg hover:shadow-black active:scale-95"
                            >
                                <MdFilterAlt size={24} />
                                <span>FILTROS</span>
                                {dropdownAberto ? (
                                    <MdExpandLess size={40} />
                                ) : (
                                    <MdExpandMore size={40} />
                                )}
                            </button>
                        </div>

                        {filtrosAplicados.length > 0 && (
                            <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-2">
                                {filtrosAplicados.map((filtro, index) => (
                                    <div
                                        key={`${filtro.campo}-${index}`}
                                        className="group flex items-center gap-4 rounded-full border-t border-purple-300 bg-purple-100 px-6 py-1 text-sm font-extrabold tracking-widest text-black shadow-sm shadow-black"
                                    >
                                        <span>{filtro.label}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {filtrosAplicados.length > 1 && (
                            <button
                                onClick={limparFiltros}
                                className="flex cursor-pointer items-center justify-center gap-2 rounded-md border-t border-red-700 bg-gradient-to-br from-red-600 to-red-700 px-6 py-1 text-lg font-extrabold tracking-widest text-white shadow-md shadow-black transition-all duration-200 hover:from-red-500 hover:to-red-600 hover:shadow-lg hover:shadow-black active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <MdFilterAltOff size={20} />
                                <span>Limpar Filtros</span>
                            </button>
                        )}
                    </div>

                    <div className="mr-2 flex items-center justify-center gap-6">
                        <div className="flex items-center gap-2 text-lg font-extrabold tracking-widest text-black select-none">
                            <MdCalendarMonth className="text-black" size={28} />
                            {hoje.toLocaleString('pt-BR', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                            })}
                        </div>
                        <Relogio />
                    </div>
                </header>

                {dropdownAberto && (
                    <div className="mx-4 rounded-md border-t border-gray-300 bg-white p-6 shadow-md shadow-black">
                        <div className="grid grid-cols-3 gap-6">
                            {/* COLUNA 1 */}
                            <div className="flex flex-col gap-1">
                                <h3 className="mb-4 flex items-center gap-2 text-lg font-extrabold tracking-widest text-black select-none">
                                    PERÍODO / CONSULTOR / STATUS
                                </h3>
                                <div className="flex flex-col gap-4">
                                    <div className="flex flex-col gap-1">
                                        <label className="ml-4 text-sm font-semibold tracking-widest select-none">
                                            Ano
                                        </label>
                                        <SelectWithClear
                                            value={anoTemp}
                                            valorAplicado={ano}
                                            onChange={(v) => setAnoTemp(v ? Number(v) : undefined)}
                                            onClearImmediate={() => limparFiltroIndividual('ano')}
                                            disabled={anoDesabilitado}
                                            options={years.map((y) => ({
                                                value: y,
                                                label: String(y),
                                            }))}
                                            placeholder={
                                                anoDesabilitado
                                                    ? 'Aplique o status'
                                                    : 'Selecione um ano'
                                            }
                                            className={selectClassName}
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="ml-4 text-sm font-semibold tracking-widest select-none">
                                            Mês
                                        </label>
                                        <SelectWithClear
                                            value={mesTemp}
                                            valorAplicado={mes}
                                            onChange={(v) => setMesTemp(v ? Number(v) : undefined)}
                                            onClearImmediate={() => limparFiltroIndividual('mes')}
                                            disabled={mesDesabilitado}
                                            options={mesesDisponiveis}
                                            placeholder={
                                                !anoTemp
                                                    ? 'Selecione um ano, para selecionar um mês'
                                                    : mesesDisponiveis.length === 0
                                                      ? 'Nenhum mês disponível'
                                                      : 'Mês'
                                            }
                                            className={selectClassName}
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="ml-4 text-sm font-semibold tracking-widest select-none">
                                            Consultor
                                        </label>
                                        <SelectWithClear
                                            value={recursoTemp}
                                            valorAplicado={recursoSelecionado}
                                            onChange={setRecursoTemp}
                                            onClearImmediate={() =>
                                                limparFiltroIndividual('recurso')
                                            }
                                            disabled={recursoDesabilitado}
                                            options={recursosLocais.map((r) => ({
                                                value: r.cod,
                                                label: r.nome,
                                            }))}
                                            placeholder={
                                                recursoDesabilitadoPorStatus
                                                    ? 'Aplique o status'
                                                    : isLoadingRecursos
                                                      ? 'Carregando...'
                                                      : recursosLocais.length === 0
                                                        ? 'Nenhum recurso disponível'
                                                        : 'Selecione um consultor'
                                            }
                                            className={selectClassName}
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="ml-4 text-sm font-semibold tracking-widest select-none">
                                            Status
                                        </label>
                                        <SelectWithClear
                                            value={statusTemp}
                                            valorAplicado={statusSelecionado}
                                            onChange={setStatusTemp}
                                            onClearImmediate={() =>
                                                limparFiltroIndividual('status')
                                            }
                                            disabled={!statusData.length || statusLoading}
                                            options={[
                                                { value: 'TODOS', label: 'Chamados - TODOS' },
                                                ...statusData.map((s) => ({
                                                    value: s,
                                                    label: `Chamados - ${s}`,
                                                })),
                                            ]}
                                            placeholder={
                                                statusLoading
                                                    ? 'Carregando...'
                                                    : 'Chamados - ATIVOS'
                                            }
                                            className={selectClassName}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* COLUNA 2 */}
                            <div className="flex flex-col gap-1">
                                <h3 className="mb-4 flex items-center gap-2 text-lg font-extrabold tracking-widest text-black select-none">
                                    DADOS DO CHAMADO
                                </h3>
                                <div className="flex flex-col gap-4">
                                    <div className="flex flex-col gap-1">
                                        <label className="ml-4 text-sm font-semibold tracking-widest select-none">
                                            Nº Chamado
                                        </label>
                                        <SelectWithClear
                                            value={chamadoTemp}
                                            valorAplicado={chamadoSelecionado}
                                            onChange={setChamadoTemp}
                                            onClearImmediate={() =>
                                                limparFiltroIndividual('chamado')
                                            }
                                            disabled={chamadosLocais.length === 0}
                                            options={chamadosLocais}
                                            placeholder={
                                                chamadosLocais.length === 0
                                                    ? 'Nenhum chamado disponível'
                                                    : 'Selecione um chamado'
                                            }
                                            className={selectClassName}
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="ml-4 text-sm font-semibold tracking-widest select-none">
                                            Data de Entrada
                                        </label>
                                        <SelectWithClear
                                            value={entradaTemp}
                                            valorAplicado={entradaSelecionada}
                                            onChange={setEntradaTemp}
                                            onClearImmediate={() =>
                                                limparFiltroIndividual('entrada')
                                            }
                                            disabled={entradasLocais.length === 0}
                                            options={entradasLocais}
                                            placeholder={
                                                entradasLocais.length === 0
                                                    ? 'Nenhuma data de entrada disponível'
                                                    : 'Selecione uma data'
                                            }
                                            className={selectClassName}
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="ml-4 text-sm font-semibold tracking-widest select-none">
                                            Data de Atribuição
                                        </label>
                                        <SelectWithClear
                                            value={atribuicaoTemp}
                                            valorAplicado={atribuicaoSelecionada}
                                            onChange={setAtribuicaoTemp}
                                            onClearImmediate={() =>
                                                limparFiltroIndividual('atribuicao')
                                            }
                                            disabled={atribuicoesLocais.length === 0}
                                            options={atribuicoesLocais}
                                            placeholder={
                                                atribuicoesLocais.length === 0
                                                    ? 'Nenhuma data de atribuição disponível'
                                                    : 'Selecione uma data'
                                            }
                                            className={selectClassName}
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="ml-4 text-sm font-semibold tracking-widest select-none">
                                            Data de Início
                                        </label>
                                        <SelectWithClear
                                            value={inicioTemp}
                                            valorAplicado={inicioSelecionado}
                                            onChange={setInicioTemp}
                                            onClearImmediate={() =>
                                                limparFiltroIndividual('inicio')
                                            }
                                            disabled={iniciosLocais.length === 0}
                                            options={iniciosLocais}
                                            placeholder={
                                                iniciosLocais.length === 0
                                                    ? 'Nenhuma data de início disponível'
                                                    : 'Selecione uma data'
                                            }
                                            className={selectClassName}
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="ml-4 text-sm font-semibold tracking-widest select-none">
                                            Data de Finalização
                                        </label>
                                        <SelectWithClear
                                            value={finalizacaoTemp}
                                            valorAplicado={finalizacaoSelecionada}
                                            onChange={setFinalizacaoTemp}
                                            onClearImmediate={() =>
                                                limparFiltroIndividual('finalizacao')
                                            }
                                            disabled={finalizacoesLocais.length === 0}
                                            options={finalizacoesLocais}
                                            placeholder={
                                                finalizacoesLocais.length === 0
                                                    ? 'Selecione o Status FINALIZADO, para selecionar uma data'
                                                    : 'Selecione uma data'
                                            }
                                            className={selectClassName}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* COLUNA 3 */}
                            <div className="flex flex-col gap-1">
                                <h3 className="mb-4 flex items-center gap-2 text-lg font-extrabold tracking-widest text-black select-none">
                                    CARACTERÍSTICAS DO CHAMADO
                                </h3>
                                <div className="flex h-full flex-col">
                                    <div className="flex flex-col gap-4">
                                        <div className="flex flex-col gap-1">
                                            <label className="ml-4 text-sm font-semibold tracking-widest select-none">
                                                Prioridade
                                            </label>
                                            <SelectWithClear
                                                value={prioridadeTemp}
                                                valorAplicado={prioridadeSelecionada}
                                                onChange={setPrioridadeTemp}
                                                onClearImmediate={() =>
                                                    limparFiltroIndividual('prioridade')
                                                }
                                                disabled={prioridadesLocais.length === 0}
                                                options={prioridadesLocais}
                                                placeholder={
                                                    prioridadesLocais.length === 0
                                                        ? 'Nenhuma prioridade disponível'
                                                        : 'Selecione uma prioridade'
                                                }
                                                className={selectClassName}
                                            />
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <label className="ml-4 text-sm font-semibold tracking-widest select-none">
                                                Classificação
                                            </label>
                                            <SelectWithClear
                                                value={classificacaoTemp}
                                                valorAplicado={classificacaoSelecionada}
                                                onChange={setClassificacaoTemp}
                                                onClearImmediate={() =>
                                                    limparFiltroIndividual('classificacao')
                                                }
                                                disabled={classificacoesLocais.length === 0}
                                                options={classificacoesLocais}
                                                placeholder={
                                                    classificacoesLocais.length === 0
                                                        ? 'Nenhuma classificação disponível'
                                                        : 'Selecione uma classificação'
                                                }
                                                className={selectClassName}
                                            />
                                        </div>
                                    </div>
                                    <div className="mt-auto flex items-center justify-end gap-6 pt-4">
                                        <button
                                            onClick={limparFiltros}
                                            disabled={!temfiltrosAplicados}
                                            className={`flex cursor-pointer items-center justify-center gap-2 rounded-md px-6 py-2 text-lg font-extrabold tracking-widest shadow-md shadow-black transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${temfiltrosAplicados ? 'cursor-pointer border-t border-red-700 bg-gradient-to-br from-red-600 to-red-700 text-white hover:from-red-500 hover:to-red-600 hover:shadow-lg hover:shadow-black active:scale-95' : 'cursor-not-allowed border-t border-gray-300 bg-gray-300 text-gray-700'}`}
                                        >
                                            {temfiltrosAplicados && <MdFilterAltOff size={24} />}
                                            <span>Limpar</span>
                                        </button>
                                        <button
                                            onClick={aplicarFiltros}
                                            disabled={!temMudancas}
                                            className={`flex cursor-pointer items-center justify-center gap-2 rounded-md px-6 py-2 text-lg font-extrabold tracking-widest shadow-md shadow-black transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${temMudancas ? 'cursor-pointer border-t border-blue-700 bg-gradient-to-br from-blue-600 to-blue-700 text-white hover:from-blue-500 hover:to-blue-600 hover:shadow-lg hover:shadow-black active:scale-95' : 'cursor-not-allowed border-t border-gray-300 bg-gray-300 text-gray-700'}`}
                                        >
                                            {temMudancas && <MdFilterAlt size={24} />}
                                            <span>
                                                {mudancasCount > 1
                                                    ? 'Aplicar Filtros'
                                                    : mudancasCount === 1
                                                      ? 'Aplicar Filtro'
                                                      : 'Aplicar'}
                                            </span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            {children}
        </FiltrosContext.Provider>
    );
}
