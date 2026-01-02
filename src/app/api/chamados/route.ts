// app/api/chamados/route.ts - OTIMIZADO
import { firebirdQuery } from '@/lib/firebird/firebird-client';
import { NextRequest, NextResponse } from 'next/server';

// ==================== TIPOS ====================
export interface Chamado {
    COD_CHAMADO: number;
    DATA_CHAMADO: Date;
    HORA_CHAMADO: string;
    SOLICITACAO_CHAMADO?: string | null;
    CONCLUSAO_CHAMADO: Date | null;
    STATUS_CHAMADO: string;
    DTENVIO_CHAMADO: string | null;
    ASSUNTO_CHAMADO: string | null;
    EMAIL_CHAMADO: string | null;
    PRIOR_CHAMADO: number;
    COD_CLASSIFICACAO: number;
    NOME_CLIENTE?: string | null;
    NOME_RECURSO?: string | null;
    NOME_CLASSIFICACAO?: string | null;
    TEM_OS?: boolean;
    TOTAL_HORAS_OS?: number;
    AVALIA_CHAMADO?: number;
    OBSAVAL_CHAMADO?: string | null;
}

interface QueryParams {
    isAdmin: boolean;
    codCliente?: string;
    mes: number;
    ano: number;
    codChamadoFilter?: string;
    statusFilter?: string;
    codClienteFilter?: string;
    codRecursoFilter?: string;
    page: number;
    limit: number;
}

interface ChamadoRaw {
    COD_CHAMADO: number;
    DATA_CHAMADO: Date;
    HORA_CHAMADO: string;
    SOLICITACAO_CHAMADO?: string | null;
    CONCLUSAO_CHAMADO: Date | null;
    STATUS_CHAMADO: string;
    DTENVIO_CHAMADO: string | null;
    ASSUNTO_CHAMADO: string | null;
    EMAIL_CHAMADO: string | null;
    PRIOR_CHAMADO: number;
    COD_CLASSIFICACAO: number;
    NOME_CLIENTE?: string | null;
    NOME_RECURSO?: string | null;
    NOME_CLASSIFICACAO?: string | null;
    AVALIA_CHAMADO?: number;
    OBSAVAL_CHAMADO?: string | null;
    TOTAL_HORAS_OS?: number;
}

// ==================== CACHE OTIMIZADO ====================
const nomeClienteCache = new Map<string, { nome: string | null; ts: number }>();
const nomeRecursoCache = new Map<string, { nome: string | null; ts: number }>();
const CACHE_TTL = 300000; // 5 minutos

const getCached = (
    cache: Map<string, { nome: string | null; ts: number }>,
    key: string
): string | null | undefined => {
    const c = cache.get(key);
    if (!c) return undefined;
    if (Date.now() - c.ts >= CACHE_TTL) {
        cache.delete(key);
        return undefined;
    }
    return c.nome;
};

const setCache = (
    cache: Map<string, { nome: string | null; ts: number }>,
    key: string,
    value: string | null
): void => {
    cache.set(key, { nome: value, ts: Date.now() });
};

// ==================== CONFIGURAÇÃO ====================
const CAMPOS_CHAMADO_BASE = `CHAMADO.COD_CHAMADO,
    CHAMADO.DATA_CHAMADO,
    CHAMADO.HORA_CHAMADO,
    CHAMADO.SOLICITACAO_CHAMADO,
    CHAMADO.CONCLUSAO_CHAMADO,
    CHAMADO.STATUS_CHAMADO,
    CHAMADO.DTENVIO_CHAMADO,
    CHAMADO.ASSUNTO_CHAMADO,
    CHAMADO.EMAIL_CHAMADO,
    CHAMADO.PRIOR_CHAMADO,
    CHAMADO.COD_CLASSIFICACAO,
    CLIENTE.NOME_CLIENTE,
    RECURSO.NOME_RECURSO,
    CLASSIFICACAO.NOME_CLASSIFICACAO`;

// Apenas para chamados finalizados
const CAMPOS_AVALIACAO = `,
    CHAMADO.AVALIA_CHAMADO,
    CHAMADO.OBSAVAL_CHAMADO`;

// ==================== VALIDAÇÕES ====================
const validarParametros = (sp: URLSearchParams): QueryParams | NextResponse => {
    const isAdmin = sp.get('isAdmin') === 'true';
    const codCliente = sp.get('codCliente')?.trim() || undefined;
    const mes = Number(sp.get('mes'));
    const ano = Number(sp.get('ano'));
    const page = Number(sp.get('page')) || 1;
    const limit = Number(sp.get('limit')) || 50;

    if (!mes || mes < 1 || mes > 12) {
        return NextResponse.json({ error: "Parâmetro 'mes' inválido" }, { status: 400 });
    }

    if (!ano || ano < 2000 || ano > 3000) {
        return NextResponse.json({ error: "Parâmetro 'ano' inválido" }, { status: 400 });
    }

    if (!isAdmin && !codCliente) {
        return NextResponse.json({ error: "Parâmetro 'codCliente' obrigatório" }, { status: 400 });
    }

    if (page < 1) {
        return NextResponse.json({ error: "Parâmetro 'page' deve ser >= 1" }, { status: 400 });
    }

    if (limit < 1 || limit > 500) {
        return NextResponse.json(
            { error: "Parâmetro 'limit' deve estar entre 1 e 500" },
            { status: 400 }
        );
    }

    return {
        isAdmin,
        codCliente,
        mes,
        ano,
        codChamadoFilter: sp.get('codChamado')?.trim() || undefined,
        statusFilter: sp.get('statusFilter')?.trim() || undefined,
        codClienteFilter: sp.get('codClienteFilter')?.trim() || undefined,
        codRecursoFilter: sp.get('codRecursoFilter')?.trim() || undefined,
        page,
        limit,
    };
};

// ==================== CONSTRUÇÃO DE DATAS ====================
const construirDatas = (mes: number, ano: number): { dataInicio: string; dataFim: string } => {
    const m = mes.toString().padStart(2, '0');
    const dataInicio = `01.${m}.${ano}`;
    const dataFim =
        mes === 12 ? `01.01.${ano + 1}` : `01.${(mes + 1).toString().padStart(2, '0')}.${ano}`;
    return { dataInicio, dataFim };
};

// ==================== QUERY ÚNICA OTIMIZADA ====================
const buscarChamadosComTotais = async (
    dataInicio: string,
    dataFim: string,
    params: QueryParams
): Promise<{
    chamados: ChamadoRaw[];
    totalChamados: number;
    totalOS: number;
    totalHoras: number;
}> => {
    try {
        const needsClient = !params.isAdmin || params.codClienteFilter;
        const codClienteAplicado =
            params.codClienteFilter || (!params.isAdmin ? params.codCliente : undefined);

        // Determinar se precisa dos campos de avaliação
        const incluirAvaliacao =
            !params.statusFilter || params.statusFilter.toUpperCase().includes('FINALIZADO');
        const camposChamado = incluirAvaliacao
            ? CAMPOS_CHAMADO_BASE + CAMPOS_AVALIACAO
            : CAMPOS_CHAMADO_BASE;

        // ===== CONSTRUIR WHERE CLAUSES (usado em ambas queries) =====
        const whereClauses: string[] = [];
        const whereParams: any[] = [];

        if (params.isAdmin) {
            whereClauses.push(`(CHAMADO.DATA_CHAMADO >= ? AND CHAMADO.DATA_CHAMADO < ?)`);
            whereParams.push(dataInicio, dataFim);
        } else {
            whereClauses.push(`CHAMADO.COD_CLIENTE = ?`);
            whereParams.push(parseInt(params.codCliente!));
        }

        if (params.codChamadoFilter) {
            whereClauses.push(`CHAMADO.COD_CHAMADO = ?`);
            whereParams.push(parseInt(params.codChamadoFilter));
        }

        if (params.statusFilter) {
            whereClauses.push(`UPPER(CHAMADO.STATUS_CHAMADO) LIKE UPPER(?)`);
            whereParams.push(`%${params.statusFilter}%`);
        }

        if (params.codClienteFilter) {
            whereClauses.push(`CHAMADO.COD_CLIENTE = ?`);
            whereParams.push(parseInt(params.codClienteFilter));
        }

        if (params.codRecursoFilter) {
            whereClauses.push(`CHAMADO.COD_RECURSO = ?`);
            whereParams.push(parseInt(params.codRecursoFilter));
        }

        const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        // ===== QUERY DE CONTAGEM (necessária para paginação) =====
        const sqlCount = `SELECT COUNT(DISTINCT CHAMADO.COD_CHAMADO) AS TOTAL
FROM CHAMADO
${whereClause}`;

        // ===== QUERY PRINCIPAL - CHAMADOS COM HORAS E PAGINAÇÃO =====
        const offset = (params.page - 1) * params.limit;

        let sqlChamados = `SELECT ${camposChamado},
    COALESCE(SUM((CAST(SUBSTRING(OS.HRFIM_OS FROM 1 FOR 2) AS INTEGER) * 60 +
         CAST(SUBSTRING(OS.HRFIM_OS FROM 3 FOR 2) AS INTEGER) -
         CAST(SUBSTRING(OS.HRINI_OS FROM 1 FOR 2) AS INTEGER) * 60 -
         CAST(SUBSTRING(OS.HRINI_OS FROM 3 FOR 2) AS INTEGER)) / 60.0), 0) AS TOTAL_HORAS_OS
FROM CHAMADO
LEFT JOIN CLIENTE ON CHAMADO.COD_CLIENTE = CLIENTE.COD_CLIENTE
LEFT JOIN RECURSO ON CHAMADO.COD_RECURSO = RECURSO.COD_RECURSO
LEFT JOIN CLASSIFICACAO ON CHAMADO.COD_CLASSIFICACAO = CLASSIFICACAO.COD_CLASSIFICACAO
LEFT JOIN OS ON CAST(CHAMADO.COD_CHAMADO AS VARCHAR(20)) = OS.CHAMADO_OS
    AND OS.DTINI_OS >= ? AND OS.DTINI_OS < ?
LEFT JOIN TAREFA ON OS.CODTRF_OS = TAREFA.COD_TAREFA AND TAREFA.EXIBECHAM_TAREFA = 1
${whereClause}
GROUP BY ${camposChamado}
ORDER BY CHAMADO.DATA_CHAMADO DESC, CHAMADO.HORA_CHAMADO DESC
ROWS ${offset + 1} TO ${offset + params.limit}`;

        const sqlParamsChamados = [dataInicio, dataFim, ...whereParams];

        // ===== QUERY DE TOTAIS DE OS =====
        let sqlTotais = `SELECT
    COUNT(DISTINCT OS.COD_OS) AS TOTAL_OS,
    SUM((CAST(SUBSTRING(OS.HRFIM_OS FROM 1 FOR 2) AS INTEGER) * 60 +
         CAST(SUBSTRING(OS.HRFIM_OS FROM 3 FOR 2) AS INTEGER) -
         CAST(SUBSTRING(OS.HRINI_OS FROM 1 FOR 2) AS INTEGER) * 60 -
         CAST(SUBSTRING(OS.HRINI_OS FROM 3 FOR 2) AS INTEGER)) / 60.0) AS TOTAL_HORAS
FROM OS
INNER JOIN TAREFA ON OS.CODTRF_OS = TAREFA.COD_TAREFA`;

        if (params.statusFilter) {
            sqlTotais += ` LEFT JOIN CHAMADO ON OS.CHAMADO_OS = CAST(CHAMADO.COD_CHAMADO AS VARCHAR(20))`;
        }

        if (needsClient) {
            sqlTotais += `
INNER JOIN PROJETO ON TAREFA.CODPRO_TAREFA = PROJETO.COD_PROJETO
INNER JOIN CLIENTE ON PROJETO.CODCLI_PROJETO = CLIENTE.COD_CLIENTE`;
        }

        if (params.codRecursoFilter) {
            sqlTotais += ` LEFT JOIN RECURSO ON OS.CODREC_OS = RECURSO.COD_RECURSO`;
        }

        const whereTotais: string[] = [
            'OS.DTINI_OS >= ?',
            'OS.DTINI_OS < ?',
            'TAREFA.EXIBECHAM_TAREFA = 1',
            'OS.CHAMADO_OS IS NOT NULL',
            "TRIM(OS.CHAMADO_OS) <> ''",
        ];

        const sqlParamsTotais: any[] = [dataInicio, dataFim];

        if (!params.isAdmin && params.codCliente) {
            whereTotais.push('CLIENTE.COD_CLIENTE = ?');
            sqlParamsTotais.push(parseInt(params.codCliente));
        }

        if (params.codClienteFilter) {
            whereTotais.push('CLIENTE.COD_CLIENTE = ?');
            sqlParamsTotais.push(parseInt(params.codClienteFilter));
        }

        if (params.codRecursoFilter) {
            whereTotais.push('RECURSO.COD_RECURSO = ?');
            sqlParamsTotais.push(parseInt(params.codRecursoFilter));
        }

        if (params.statusFilter) {
            whereTotais.push('UPPER(CHAMADO.STATUS_CHAMADO) LIKE UPPER(?)');
            sqlParamsTotais.push(`%${params.statusFilter}%`);
        }

        sqlTotais += ` WHERE ${whereTotais.join(' AND ')}`;

        // Executar as três queries em paralelo
        const [countResult, chamados, totaisResult] = await Promise.all([
            firebirdQuery<{ TOTAL: number }>(sqlCount, whereParams),
            firebirdQuery<ChamadoRaw>(sqlChamados, sqlParamsChamados),
            firebirdQuery<{ TOTAL_OS: number; TOTAL_HORAS: number | null }>(
                sqlTotais,
                sqlParamsTotais
            ),
        ]);

        return {
            chamados,
            totalChamados: countResult[0]?.TOTAL || 0,
            totalOS: totaisResult[0]?.TOTAL_OS || 0,
            totalHoras: totaisResult[0]?.TOTAL_HORAS || 0,
        };
    } catch (error) {
        console.error('[API CHAMADOS] Erro buscarChamadosComTotais:', error);
        throw error;
    }
};

// ==================== BUSCAR NOMES (COM CACHE) ====================
const buscarNomes = async (
    codCliente?: string,
    codRecurso?: string
): Promise<{ cliente: string | null; recurso: string | null }> => {
    const promises: Promise<string | null>[] = [];

    if (codCliente) {
        const cached = getCached(nomeClienteCache, codCliente);
        if (cached !== undefined) {
            promises.push(Promise.resolve(cached));
        } else {
            promises.push(
                firebirdQuery<{ NOME_CLIENTE: string }>(
                    'SELECT NOME_CLIENTE FROM CLIENTE WHERE COD_CLIENTE = ?',
                    [parseInt(codCliente)]
                )
                    .then((r) => {
                        const nome = r[0]?.NOME_CLIENTE || null;
                        setCache(nomeClienteCache, codCliente, nome);
                        return nome;
                    })
                    .catch(() => null)
            );
        }
    } else {
        promises.push(Promise.resolve(null));
    }

    if (codRecurso) {
        const cached = getCached(nomeRecursoCache, codRecurso);
        if (cached !== undefined) {
            promises.push(Promise.resolve(cached));
        } else {
            promises.push(
                firebirdQuery<{ NOME_RECURSO: string }>(
                    'SELECT NOME_RECURSO FROM RECURSO WHERE COD_RECURSO = ?',
                    [parseInt(codRecurso)]
                )
                    .then((r) => {
                        const nome = r[0]?.NOME_RECURSO || null;
                        setCache(nomeRecursoCache, codRecurso, nome);
                        return nome;
                    })
                    .catch(() => null)
            );
        }
    } else {
        promises.push(Promise.resolve(null));
    }

    const [cliente, recurso] = await Promise.all(promises);
    return { cliente, recurso };
};

// ==================== PROCESSAMENTO ====================
const processarChamados = (chamados: ChamadoRaw[]): Chamado[] => {
    return chamados.map((c) => ({
        COD_CHAMADO: c.COD_CHAMADO,
        DATA_CHAMADO: c.DATA_CHAMADO,
        HORA_CHAMADO: c.HORA_CHAMADO ?? '',
        SOLICITACAO_CHAMADO: c.SOLICITACAO_CHAMADO || null,
        CONCLUSAO_CHAMADO: c.CONCLUSAO_CHAMADO || null,
        STATUS_CHAMADO: c.STATUS_CHAMADO,
        DTENVIO_CHAMADO: c.DTENVIO_CHAMADO || null,
        ASSUNTO_CHAMADO: c.ASSUNTO_CHAMADO || null,
        EMAIL_CHAMADO: c.EMAIL_CHAMADO || null,
        PRIOR_CHAMADO: c.PRIOR_CHAMADO ?? 100,
        COD_CLASSIFICACAO: c.COD_CLASSIFICACAO ?? 0,
        NOME_CLIENTE: c.NOME_CLIENTE || null,
        NOME_RECURSO: c.NOME_RECURSO || null,
        NOME_CLASSIFICACAO: c.NOME_CLASSIFICACAO || null,
        TEM_OS: (c.TOTAL_HORAS_OS ?? 0) > 0,
        TOTAL_HORAS_OS: c.TOTAL_HORAS_OS ?? 0,
        AVALIA_CHAMADO: c.AVALIA_CHAMADO ?? 1,
        OBSAVAL_CHAMADO: c.OBSAVAL_CHAMADO ?? null,
    }));
};

// ==================== HANDLER PRINCIPAL ====================
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);

        const params = validarParametros(searchParams);
        if (params instanceof NextResponse) return params;

        const { dataInicio, dataFim } = construirDatas(params.mes, params.ano);

        const codClienteAplicado =
            params.codClienteFilter || (!params.isAdmin ? params.codCliente : undefined);

        // Execução paralela: buscar chamados+totais e nomes
        const [resultado, nomes] = await Promise.all([
            buscarChamadosComTotais(dataInicio, dataFim, params),
            buscarNomes(codClienteAplicado, params.codRecursoFilter),
        ]);

        const { chamados, totalChamados, totalOS, totalHoras } = resultado;

        if (chamados.length === 0) {
            return NextResponse.json(
                {
                    success: true,
                    cliente: nomes.cliente,
                    recurso: nomes.recurso,
                    status: null,
                    totalChamados: 0,
                    totalOS,
                    totalHorasOS: totalHoras,
                    mes: params.mes,
                    ano: params.ano,
                    pagination: {
                        page: params.page,
                        limit: params.limit,
                        totalPages: 0,
                        hasNextPage: false,
                        hasPreviousPage: false,
                    },
                    data: [],
                },
                { status: 200 }
            );
        }

        const chamadosProcessados = processarChamados(chamados);

        // Status do primeiro chamado (se houver filtro de status)
        const statusFiltro = params.statusFilter ? chamados[0]?.STATUS_CHAMADO || null : null;

        const totalPages = Math.ceil(totalChamados / params.limit);

        return NextResponse.json(
            {
                success: true,
                cliente: nomes.cliente,
                recurso: nomes.recurso,
                status: statusFiltro,
                totalChamados,
                totalOS,
                totalHorasOS: totalHoras,
                mes: params.mes,
                ano: params.ano,
                pagination: {
                    page: params.page,
                    limit: params.limit,
                    totalPages,
                    hasNextPage: params.page < totalPages,
                    hasPreviousPage: params.page > 1,
                },
                data: chamadosProcessados,
            },
            { status: 200 }
        );
    } catch (error) {
        console.error('[API CHAMADOS] Erro:', error instanceof Error ? error.message : error);

        return NextResponse.json(
            {
                success: false,
                error: 'Erro interno do servidor',
                message: error instanceof Error ? error.message : 'Erro desconhecido',
                details: process.env.NODE_ENV === 'development' ? error : undefined,
            },
            { status: 500 }
        );
    }
}

// ==================== FUNÇÕES AUXILIARES ====================
export function limparCacheChamados(): void {
    nomeClienteCache.clear();
    nomeRecursoCache.clear();
}
