// src/app/paginas/chamados/componentes/Filtros_Tabela_Chamados.tsx

'use client';

import { Relogio } from '@/components/Relogio';
import { useAuth } from '@/context/AuthContext';
import { corrigirTextoCorrompido } from '@/formatters/formatar-texto-corrompido';
import { useQuery } from '@tanstack/react-query';
// =====================================================
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

function formatarData(data: string | Date | number | null | undefined): string | null {
    if (!data) return null;

    try {
        // Tipo 1: String já formatada dd/mm/yyyy
        if (typeof data === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(data)) {
            return data;
        }

        // Tipo 2: String com traço dd/mm/yyyy - hh:mm
        if (typeof data === 'string' && /^\d{2}\/\d{2}\/\d{4} - \d{2}:\d{2}$/.test(data)) {
            return data.split(' - ')[0];
        }

        // Tipo 3: String com espaço dd/mm/yyyy hh:mm:ss ou dd/mm/yyyy hh:mm
        if (typeof data === 'string' && /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}/.test(data)) {
            return data.split(' ')[0];
        }

        // Tipo 4: String ISO completa (yyyy-mm-ddThh:mm:ss.sssZ) - USAR HORA LOCAL
        if (typeof data === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(data)) {
            const dataObj = new Date(data);
            if (isNaN(dataObj.getTime())) return null;
            const dia = dataObj.getDate().toString().padStart(2, '0');
            const mes = (dataObj.getMonth() + 1).toString().padStart(2, '0');
            const ano = dataObj.getFullYear();
            return `${dia}/${mes}/${ano}`;
        }

        // Tipo 5: String ISO simples (yyyy-mm-dd sem hora)
        if (typeof data === 'string') {
            const isoMatch = data.match(/^(\d{4})-(\d{2})-(\d{2})$/);
            if (isoMatch) {
                const [, ano, mes, dia] = isoMatch;
                return `${dia}/${mes}/${ano}`;
            }
        }

        // Tipo 6: Date object - USAR HORA LOCAL
        if (data instanceof Date) {
            if (isNaN(data.getTime())) return null;
            const dia = data.getDate().toString().padStart(2, '0');
            const mes = (data.getMonth() + 1).toString().padStart(2, '0');
            const ano = data.getFullYear();
            return `${dia}/${mes}/${ano}`;
        }

        // Tipo 7: Timestamp - USAR HORA LOCAL
        if (typeof data === 'number') {
            const dataObj = new Date(data);
            if (isNaN(dataObj.getTime())) return null;
            const dia = dataObj.getDate().toString().padStart(2, '0');
            const mes = (dataObj.getMonth() + 1).toString().padStart(2, '0');
            const ano = dataObj.getFullYear();
            return `${dia}/${mes}/${ano}`;
        }

        return null;
    } catch (error) {
        console.error('Erro ao formatar data:', error);
        return null;
    }
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

        dadosChamados.forEach((chamado) => {
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

// ==================== NOVOS HOOKS PARA FILTROS LOCAIS ====================
function useChamadosLocais(dadosChamados: FiltrosChamadoProps['dadosChamados']) {
    return useMemo(() => {
        if (!dadosChamados?.length) return [];

        const chamadosUnicos = new Set<number>();
        dadosChamados.forEach((chamado) => {
            if (chamado.COD_CHAMADO) {
                chamadosUnicos.add(chamado.COD_CHAMADO);
            }
        });

        return Array.from(chamadosUnicos)
            .sort((a, b) => b - a)
            .map((cod) => ({ value: cod, label: cod.toString() }));
    }, [dadosChamados]);
}

function useEntradasLocais(dadosChamados: FiltrosChamadoProps['dadosChamados']) {
    return useMemo(() => {
        if (!dadosChamados?.length) return [];

        const datasUnicas = new Set<string>();
        dadosChamados.forEach((chamado) => {
            const dataFormatada = formatarData(chamado.DATA_CHAMADO);
            if (dataFormatada) {
                datasUnicas.add(dataFormatada);
            }
        });

        return Array.from(datasUnicas)
            .sort((a, b) => {
                const [diaA, mesA, anoA] = a.split('/').map(Number);
                const [diaB, mesB, anoB] = b.split('/').map(Number);
                const dataA = new Date(anoA, mesA - 1, diaA);
                const dataB = new Date(anoB, mesB - 1, diaB);
                return dataB.getTime() - dataA.getTime();
            })
            .map((data) => ({ value: data, label: data }));
    }, [dadosChamados]);
}

function useIniciosLocais(dadosChamados: FiltrosChamadoProps['dadosChamados']) {
    return useMemo(() => {
        if (!dadosChamados?.length) return [];

        const datasUnicas = new Set<string>();
        dadosChamados.forEach((chamado) => {
            const dataFormatada = formatarData(chamado.DTINI_CHAMADO);
            if (dataFormatada) {
                datasUnicas.add(dataFormatada);
            }
        });

        return Array.from(datasUnicas)
            .sort((a, b) => {
                const [diaA, mesA, anoA] = a.split('/').map(Number);
                const [diaB, mesB, anoB] = b.split('/').map(Number);
                const dataA = new Date(anoA, mesA - 1, diaA);
                const dataB = new Date(anoB, mesB - 1, diaB);
                return dataB.getTime() - dataA.getTime();
            })
            .map((data) => ({ value: data, label: data }));
    }, [dadosChamados]);
}

function usePrioridadesLocais(dadosChamados: FiltrosChamadoProps['dadosChamados']) {
    return useMemo(() => {
        if (!dadosChamados?.length) return [];

        const prioridadesUnicas = new Set<number>();
        dadosChamados.forEach((chamado) => {
            if (chamado.PRIOR_CHAMADO !== undefined && chamado.PRIOR_CHAMADO !== null) {
                prioridadesUnicas.add(chamado.PRIOR_CHAMADO);
            }
        });

        const prioridadeLabels: Record<number, string> = {
            1: '1 - Urgente',
            2: '2 - Alta',
            3: '3 - Normal',
            4: '4 - Baixa',
            100: '100 - Sem Prioridade',
        };

        return Array.from(prioridadesUnicas)
            .sort((a, b) => a - b)
            .map((prior) => ({
                value: prior,
                label: prioridadeLabels[prior] || `${prior}`,
            }));
    }, [dadosChamados]);
}

function useClassificacoesLocais(dadosChamados: FiltrosChamadoProps['dadosChamados']) {
    return useMemo(() => {
        if (!dadosChamados?.length) return [];

        const classificacoesUnicas = new Map<string, string>();
        dadosChamados.forEach((chamado) => {
            const nome = chamado.NOME_CLASSIFICACAO?.toString().trim();
            if (nome && !classificacoesUnicas.has(nome)) {
                classificacoesUnicas.set(nome, nome);
            }
        });

        return Array.from(classificacoesUnicas.keys())
            .sort()
            .map((nome) => ({ value: nome, label: nome }));
    }, [dadosChamados]);
}

function useAtribuicoesLocais(dadosChamados: FiltrosChamadoProps['dadosChamados']) {
    return useMemo(() => {
        if (!dadosChamados?.length) return [];

        const datasUnicas = new Set<string>();
        dadosChamados.forEach((chamado) => {
            const dataFormatada = formatarData(chamado.DTENVIO_CHAMADO);
            if (dataFormatada) {
                datasUnicas.add(dataFormatada);
            }
        });

        return Array.from(datasUnicas)
            .sort((a, b) => {
                const [diaA, mesA, anoA] = a.split('/').map(Number);
                const [diaB, mesB, anoB] = b.split('/').map(Number);
                const dataA = new Date(anoA, mesA - 1, diaA);
                const dataB = new Date(anoB, mesB - 1, diaB);
                return dataB.getTime() - dataA.getTime();
            })
            .map((data) => ({ value: data, label: data }));
    }, [dadosChamados]);
}

function useFinalizacoesLocais(dadosChamados: FiltrosChamadoProps['dadosChamados']) {
    return useMemo(() => {
        if (!dadosChamados?.length) return [];

        const datasUnicas = new Set<string>();
        dadosChamados.forEach((chamado) => {
            const dataFormatada = formatarData(chamado.DATA_HISTCHAMADO);
            if (dataFormatada) {
                datasUnicas.add(dataFormatada);
            }
        });

        return Array.from(datasUnicas)
            .sort((a, b) => {
                const [diaA, mesA, anoA] = a.split('/').map(Number);
                const [diaB, mesB, anoB] = b.split('/').map(Number);
                const dataA = new Date(anoA, mesA - 1, diaA);
                const dataB = new Date(anoB, mesB - 1, diaB);
                return dataB.getTime() - dataA.getTime();
            })
            .map((data) => ({ value: data, label: data }));
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
                            {processarNome(optLabel, 2)}
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
    const { isAdmin, codCliente } = useAuth();
    const { hoje, anoAtual, mesAtual } = useDataAtual();

    // Estado para controlar expansão do dropdown
    const [dropdownAberto, setDropdownAberto] = useState(false);

    // Estados temporários (antes de aplicar)
    const [anoTemp, setAnoTemp] = useState<number | undefined>(isAdmin ? anoAtual : undefined);
    const [mesTemp, setMesTemp] = useState<number | undefined>(isAdmin ? mesAtual : undefined);
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
    const [ano, setAno] = useState<number | undefined>(isAdmin ? anoAtual : undefined);
    const [mes, setMes] = useState<number | undefined>(isAdmin ? mesAtual : undefined);
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

    const [isInitialized, setIsInitialized] = useState(false);
    const [filtrosForamAlterados, setFiltrosForamAlterados] = useState(false);

    // Dados extraídos localmente
    const anosLocais = useAnosLocais(dadosChamados);
    const mesesDisponiveisNoAno = useMesesDisponiveisNoAno(dadosChamados, anoTemp);
    const recursosLocais = useRecursosLocais(dadosChamados);
    const chamadosLocais = useChamadosLocais(dadosChamados);
    const entradasLocais = useEntradasLocais(dadosChamados);
    const prioridadesLocais = usePrioridadesLocais(dadosChamados);
    const classificacoesLocais = useClassificacoesLocais(dadosChamados);
    const atribuicoesLocais = useAtribuicoesLocais(dadosChamados);
    const finalizacoesLocais = useFinalizacoesLocais(dadosChamados);
    const iniciosLocais = useIniciosLocais(dadosChamados);

    // Valores padrão
    const valoresPadrao = useMemo(
        () => ({
            ano: isAdmin ? anoAtual : undefined,
            mes: isAdmin ? mesAtual : undefined,
        }),
        [isAdmin, anoAtual, mesAtual]
    );

    // Status é FINALIZADO?
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

    // Função para obter label legível de um filtro
    const obterLabelFiltro = useCallback(
        (campo: string, valor: string | number | undefined) => {
            if (!valor) return '';

            switch (campo) {
                case 'ano':
                    return `Ano: ${valor}`;
                case 'mes':
                    return `Mês: ${MESES_NOMES[Number(valor) - 1]}`;
                case 'cliente':
                    const cliente = clientesData.find((c) => c.cod === valor);
                    return `Cliente: ${processarNome(cliente?.nome || String(valor), 3)}`;
                case 'recurso':
                    const recurso = recursosLocais.find((r) => r.cod === valor);
                    return `Consultor: ${processarNome(recurso?.nome || String(valor), 2)}`;
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
                case 'prioridade':
                    const prioridade = prioridadesLocais.find((p) => p.value === Number(valor));
                    return `Prioridade: ${prioridade?.label || valor}`;
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

    // Filtros ativos (tags)
    const filtrosAtivos = useMemo(() => {
        const tags: Array<{ campo: string; valor: string | number; label: string }> = [];

        // Verificar diferença dos valores padrão para ano/mês
        if (isAdmin) {
            if (ano !== valoresPadrao.ano) {
                tags.push({ campo: 'ano', valor: ano!, label: obterLabelFiltro('ano', ano) });
            }
            if (mes !== valoresPadrao.mes) {
                tags.push({ campo: 'mes', valor: mes!, label: obterLabelFiltro('mes', mes) });
            }
        } else {
            if (ano !== undefined) {
                tags.push({ campo: 'ano', valor: ano, label: obterLabelFiltro('ano', ano) });
            }
            if (mes !== undefined) {
                tags.push({ campo: 'mes', valor: mes, label: obterLabelFiltro('mes', mes) });
            }
        }

        if (isAdmin && clienteSelecionado) {
            tags.push({
                campo: 'cliente',
                valor: clienteSelecionado,
                label: obterLabelFiltro('cliente', clienteSelecionado),
            });
        }
        if (recursoSelecionado) {
            tags.push({
                campo: 'recurso',
                valor: recursoSelecionado,
                label: obterLabelFiltro('recurso', recursoSelecionado),
            });
        }
        if (statusSelecionado) {
            tags.push({
                campo: 'status',
                valor: statusSelecionado,
                label: obterLabelFiltro('status', statusSelecionado),
            });
        }
        if (chamadoSelecionado) {
            tags.push({
                campo: 'chamado',
                valor: chamadoSelecionado,
                label: obterLabelFiltro('chamado', chamadoSelecionado),
            });
        }
        if (entradaSelecionada) {
            tags.push({
                campo: 'entrada',
                valor: entradaSelecionada,
                label: obterLabelFiltro('entrada', entradaSelecionada),
            });
        }
        if (inicioSelecionado) {
            tags.push({
                campo: 'inicio',
                valor: inicioSelecionado,
                label: obterLabelFiltro('inicio', inicioSelecionado),
            });
        }
        if (atribuicaoSelecionada) {
            tags.push({
                campo: 'atribuicao',
                valor: atribuicaoSelecionada,
                label: obterLabelFiltro('atribuicao', atribuicaoSelecionada),
            });
        }
        if (prioridadeSelecionada) {
            tags.push({
                campo: 'prioridade',
                valor: prioridadeSelecionada,
                label: obterLabelFiltro('prioridade', prioridadeSelecionada),
            });
        }
        if (classificacaoSelecionada) {
            tags.push({
                campo: 'classificacao',
                valor: classificacaoSelecionada,
                label: obterLabelFiltro('classificacao', classificacaoSelecionada),
            });
        }
        if (finalizacaoSelecionada) {
            tags.push({
                campo: 'finalizacao',
                valor: finalizacaoSelecionada,
                label: obterLabelFiltro('finalizacao', finalizacaoSelecionada),
            });
        }

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
        isAdmin,
        obterLabelFiltro,
    ]);

    // Contadores e flags
    const mudancasCount = useMemo(() => {
        return [
            anoTemp !== ano,
            mesTemp !== mes,
            ...(isAdmin ? [clienteTemp !== clienteSelecionado] : []),
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
        isAdmin,
    ]);

    const temMudancas = mudancasCount > 0;

    const temFiltrosAtivos = filtrosAtivos.length > 0;

    // Callbacks
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
        ) {
            setFiltrosForamAlterados(true);
        }

        // Fechar dropdown após aplicar
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
                }
                if (campo === 'recurso') {
                    const temAnoMes =
                        (isAdmin && (ano !== valoresPadrao.ano || mes !== valoresPadrao.mes)) ||
                        (!isAdmin && (ano !== undefined || mes !== undefined));
                    const temCliente = isAdmin && clienteSelecionado;
                    return (
                        temAnoMes ||
                        temCliente ||
                        statusSelecionado ||
                        chamadoSelecionado ||
                        entradaSelecionada ||
                        prioridadeSelecionada ||
                        classificacaoSelecionada ||
                        atribuicaoSelecionada ||
                        finalizacaoSelecionada ||
                        inicioSelecionado
                    );
                }
                if (campo === 'ano' || campo === 'mes') {
                    const temCliente = isAdmin && clienteSelecionado;
                    return (
                        temCliente ||
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
        setAnoTemp(valoresPadrao.ano);
        setMesTemp(valoresPadrao.mes);
        if (isAdmin) {
            setClienteTemp('');
            setClienteSelecionado('');
        }
        setRecursoTemp('');
        setStatusTemp('');
        setChamadoTemp('');
        setEntradaTemp('');
        setPrioridadeTemp('');
        setClassificacaoTemp('');
        setAtribuicaoTemp('');
        setFinalizacaoTemp('');
        setInicioTemp('');

        setAno(valoresPadrao.ano);
        setMes(valoresPadrao.mes);
        if (isAdmin) setClienteSelecionado('');
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
        'w-full cursor-pointer rounded-md bg-white p-2 text-sm font-bold tracking-widest shadow-xs shadow-black transition-all duration-200 select-none hover:shadow-md hover:shadow-black focus:ring-2 focus:ring-purple-600 focus:outline-none disabled:cursor-not-allowed disabled:opacity-30';

    return (
        <FiltrosContext.Provider value={filtrosAtuais}>
            <div className="flex flex-col gap-10">
                {/* ==================== HEADER COMPACTO ==================== */}
                <header className="flex items-center justify-between px-4">
                    <div className="flex items-center gap-6">
                        {/* Botão Dropdown + Tags de Filtros Ativos */}
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

                            {/* Botão Limpar Externo */}
                            {filtrosAtivos.length > 1 && (
                                <button
                                    onClick={limparFiltros}
                                    className="flex cursor-pointer items-center justify-center gap-2 rounded-md border-t border-red-700 bg-gradient-to-br from-red-600 to-red-700 px-6 py-1 text-base font-extrabold tracking-widest text-white shadow-md shadow-black transition-all duration-200 hover:from-red-500 hover:to-red-600 hover:shadow-lg hover:shadow-black active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <MdFilterAltOff size={20} />
                                    <span>Limpar Tudo</span>
                                </button>
                            )}
                        </div>
                        {/* Tags de Filtros Aplicados */}
                        {filtrosAtivos.length > 0 && (
                            <div className="flex flex-wrap items-center gap-4">
                                {filtrosAtivos.map((filtro, index) => (
                                    <button
                                        key={`${filtro.campo}-${index}`}
                                        onClick={() =>
                                            limparFiltroIndividual(
                                                filtro.campo as
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
                                            )
                                        }
                                        title={`Remover filtro: ${filtro.label}`}
                                        className="group flex cursor-pointer items-center gap-4 rounded-full border-t border-purple-300 bg-purple-100 px-6 py-1 text-sm font-extrabold tracking-widest text-black shadow-sm shadow-black transition-all duration-200 hover:bg-purple-200 active:scale-95"
                                    >
                                        <span>{filtro.label}</span>
                                        <MdClose
                                            size={20}
                                            className="text-red-600 transition-all duration-200 group-hover:scale-150 group-hover:rotate-180"
                                        />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Data e Relógio */}
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

                {/* ==================== DROPDOWN DE FILTROS ==================== */}
                {dropdownAberto && (
                    <div className="mx-4 rounded-md border-t border-gray-300 bg-white p-6 shadow-md shadow-black">
                        <div className="grid grid-cols-3 gap-6">
                            {/* COLUNA 1: PERÍODO E CONTEXTO */}
                            <div className="flex flex-col gap-2">
                                <h3 className="flex items-center gap-2 text-base font-extrabold tracking-widest text-black select-none">
                                    PERÍODO / CONTEXTO
                                </h3>

                                <div className="flex flex-col gap-4">
                                    <SelectWithClear
                                        value={anoTemp}
                                        valorAplicado={ano}
                                        onChange={(value) =>
                                            setAnoTemp(value ? Number(value) : undefined)
                                        }
                                        onClearImmediate={() => limparFiltroIndividual('ano')}
                                        disabled={anoDesabilitado}
                                        options={years.map((y) => ({ value: y, label: String(y) }))}
                                        placeholder={anoDesabilitado ? 'Aplique o status' : 'Ano'}
                                        className={selectClassName}
                                    />

                                    <SelectWithClear
                                        value={mesTemp}
                                        valorAplicado={mes}
                                        onChange={(value) =>
                                            setMesTemp(value ? Number(value) : undefined)
                                        }
                                        onClearImmediate={() => limparFiltroIndividual('mes')}
                                        disabled={mesDesabilitado}
                                        options={mesesDisponiveis}
                                        placeholder={
                                            !anoTemp
                                                ? 'Selecione o ano primeiro'
                                                : mesesDisponiveis.length === 0
                                                  ? 'Nenhum mês disponível'
                                                  : 'Mês'
                                        }
                                        className={selectClassName}
                                    />

                                    {isAdmin && (
                                        <SelectWithClear
                                            value={clienteTemp}
                                            valorAplicado={clienteSelecionado}
                                            onChange={setClienteTemp}
                                            onClearImmediate={() =>
                                                limparFiltroIndividual('cliente')
                                            }
                                            disabled={
                                                !clientesData.length ||
                                                !!codCliente ||
                                                clientesLoading
                                            }
                                            options={clientesData.map((c) => ({
                                                value: c.cod,
                                                label: c.nome,
                                            }))}
                                            placeholder={
                                                clientesLoading ? 'Carregando...' : 'Cliente'
                                            }
                                            showClearButton={!codCliente}
                                            className={selectClassName}
                                        />
                                    )}

                                    <SelectWithClear
                                        value={recursoTemp}
                                        valorAplicado={recursoSelecionado}
                                        onChange={setRecursoTemp}
                                        onClearImmediate={() => limparFiltroIndividual('recurso')}
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
                                                    : 'Consultor'
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
                                        placeholder={statusLoading ? 'Carregando...' : 'Status'}
                                        className={selectClassName}
                                    />
                                </div>
                            </div>

                            {/* COLUNA 2: DADOS DO CHAMADO */}
                            <div className="gap- flex flex-col gap-2">
                                <h3 className="flex items-center gap-2 text-base font-extrabold tracking-widest text-black select-none">
                                    DADOS DO CHAMADO
                                </h3>

                                <div className="flex flex-col gap-4">
                                    <SelectWithClear
                                        value={chamadoTemp}
                                        valorAplicado={chamadoSelecionado}
                                        onChange={setChamadoTemp}
                                        onClearImmediate={() => limparFiltroIndividual('chamado')}
                                        disabled={chamadosLocais.length === 0}
                                        options={chamadosLocais}
                                        placeholder={
                                            chamadosLocais.length === 0
                                                ? 'Nenhum chamado disponível'
                                                : 'Nº do Chamado'
                                        }
                                        className={selectClassName}
                                    />

                                    <SelectWithClear
                                        value={entradaTemp}
                                        valorAplicado={entradaSelecionada}
                                        onChange={setEntradaTemp}
                                        onClearImmediate={() => limparFiltroIndividual('entrada')}
                                        disabled={entradasLocais.length === 0}
                                        options={entradasLocais}
                                        placeholder={
                                            entradasLocais.length === 0
                                                ? 'Nenhuma data de entrada disponível'
                                                : 'Data de Entrada'
                                        }
                                        className={selectClassName}
                                    />

                                    <SelectWithClear
                                        value={inicioTemp}
                                        valorAplicado={inicioSelecionado}
                                        onChange={setInicioTemp}
                                        onClearImmediate={() => limparFiltroIndividual('inicio')}
                                        disabled={iniciosLocais.length === 0}
                                        options={iniciosLocais}
                                        placeholder={
                                            iniciosLocais.length === 0
                                                ? 'Nenhuma data de início disponível'
                                                : 'Data de Início'
                                        }
                                        className={selectClassName}
                                    />

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
                                                : 'Data de Atribuição'
                                        }
                                        className={selectClassName}
                                    />

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
                                                ? 'Selecione o status FINALIZADO para ver as datas de finalização'
                                                : 'Data de Finalização'
                                        }
                                        className={selectClassName}
                                    />
                                </div>
                            </div>

                            {/* COLUNA 3: CARACTERÍSTICAS */}
                            <div className="gap- flex flex-col gap-2">
                                <h3 className="flex items-center gap-2 text-base font-extrabold tracking-widest text-black select-none">
                                    CARACTERÍSTICAS
                                </h3>

                                <div className="flex flex-col gap-4">
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
                                                : 'Prioridade'
                                        }
                                        className={selectClassName}
                                    />

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
                                                : 'Classificação'
                                        }
                                        className={selectClassName}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* BOTÕES NO RODAPÉ DO DROPDOWN */}
                        <div className="flex items-center justify-end gap-6">
                            <button
                                onClick={limparFiltros}
                                disabled={!temFiltrosAtivos}
                                className={`flex cursor-pointer items-center justify-center gap-2 rounded-md px-6 py-2 text-lg font-extrabold tracking-widest shadow-md shadow-black transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${
                                    temFiltrosAtivos
                                        ? 'cursor-pointer border-t border-red-700 bg-gradient-to-br from-red-600 to-red-700 text-white hover:from-red-500 hover:to-red-600 hover:shadow-lg hover:shadow-black active:scale-95'
                                        : 'cursor-not-allowed border-t border-gray-300 bg-gray-300 text-gray-700'
                                }`}
                            >
                                {temFiltrosAtivos && <MdFilterAltOff size={24} />}
                                <span>Limpar</span>
                            </button>

                            <button
                                onClick={aplicarFiltros}
                                disabled={!temMudancas}
                                className={`flex cursor-pointer items-center justify-center gap-2 rounded-md px-6 py-2 text-lg font-extrabold tracking-widest shadow-md shadow-black transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${
                                    temMudancas
                                        ? 'cursor-pointer border-t border-blue-700 bg-gradient-to-br from-blue-600 to-blue-700 text-white hover:from-blue-500 hover:to-blue-600 hover:shadow-lg hover:shadow-black active:scale-95'
                                        : 'cursor-not-allowed border-t border-gray-300 bg-gray-300 text-gray-700'
                                }`}
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
                )}
            </div>
            {children}
        </FiltrosContext.Provider>
    );
}
