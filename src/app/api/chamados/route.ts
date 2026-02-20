// app/api/chamados/route.ts

import { firebirdQuery } from '@/lib/firebird/firebird-client';
import { calcularStatusSLA, SLA_CONFIGS } from '@/lib/sla/sla-utils';
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
    DTINI_CHAMADO: string | null;
    ASSUNTO_CHAMADO: string | null;
    EMAIL_CHAMADO: string | null;
    PRIOR_CHAMADO: number;
    COD_CLASSIFICACAO: number;
    NOME_CLIENTE?: string | null;
    NOME_RECURSO?: string | null;
    NOME_CLASSIFICACAO?: string | null;
    TEM_OS?: boolean;
    TOTAL_HORAS_OS?: number;
    TOTAL_HORAS_OS_FATURADAS?: number;
    TOTAL_HORAS_OS_NAO_FATURADAS?: number;
    AVALIA_CHAMADO?: number;
    OBSAVAL_CHAMADO?: string | null;
    DATA_HISTCHAMADO?: Date | null;
    HORA_HISTCHAMADO?: string | null;

    SLA_STATUS?: string;
    SLA_PERCENTUAL?: number;
    SLA_TEMPO_DECORRIDO?: number;
    SLA_TEMPO_RESTANTE?: number;
    SLA_PRAZO_TOTAL?: number;
    SLA_DENTRO_PRAZO?: boolean;
}

interface QueryParams {
    isAdmin: boolean;
    codCliente?: string;
    mes?: number;
    ano?: number;
    codChamadoFilter?: string;
    statusFilter?: string;
    codClienteFilter?: string;
    codRecursoFilter?: string;
    page: number;
    limit: number;
    columnFilters?: Record<string, string>;
}

interface ChamadoRaw {
    COD_CHAMADO: number;
    DATA_CHAMADO: Date;
    HORA_CHAMADO: string;
    SOLICITACAO_CHAMADO?: string | null;
    CONCLUSAO_CHAMADO: Date | null;
    STATUS_CHAMADO: string;
    DTENVIO_CHAMADO: string | null;
    DTINI_CHAMADO: string | null;
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
    TOTAL_HORAS_OS_FATURADAS?: number;
    TOTAL_HORAS_OS_NAO_FATURADAS?: number;
    DATA_HISTCHAMADO?: Date | null;
    HORA_HISTCHAMADO?: string | null;
    // ✅ NOVO: total geral inline (elimina query COUNT separada)
    TOTAL_RECORDS?: number;
}

// ==================== CACHE OTIMIZADO ====================
// Cache unificado e tipado, com suporte a resultados completos
const nomeClienteCache = new Map<string, { nome: string | null; ts: number }>();
const nomeRecursoCache = new Map<string, { nome: string | null; ts: number }>();

// ✅ NOVO: Cache de resultados de queries de totais (evita re-execução para mesmos parâmetros)
const totaisCache = new Map<string, { data: TotaisResult; ts: number }>();

const CACHE_TTL = 300_000; // 5 minutos
const CACHE_TTL_TOTAIS = 60_000; // 1 minuto para totais (dado mais volátil)

interface TotaisResult {
    totalOS: number;
    totalHoras: number;
    totalHorasNaoFaturadas: number;
    totalHorasFaturadas: number;
}

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

// ✅ NOVO: helpers de cache para totais
const getTotaisCache = (key: string): TotaisResult | undefined => {
    const c = totaisCache.get(key);
    if (!c) return undefined;
    if (Date.now() - c.ts >= CACHE_TTL_TOTAIS) {
        totaisCache.delete(key);
        return undefined;
    }
    return c.data;
};

const setTotaisCache = (key: string, data: TotaisResult): void => {
    // Limita crescimento do cache a 200 entradas
    if (totaisCache.size >= 200) {
        const firstKey = totaisCache.keys().next().value;
        if (firstKey) totaisCache.delete(firstKey);
    }
    totaisCache.set(key, { data, ts: Date.now() });
};

// ==================== CONFIGURAÇÃO ====================
const CAMPOS_CHAMADO_BASE = `CHAMADO.COD_CHAMADO,
    CHAMADO.DATA_CHAMADO,
    CHAMADO.HORA_CHAMADO,
    CHAMADO.SOLICITACAO_CHAMADO,
    CHAMADO.CONCLUSAO_CHAMADO,
    CHAMADO.STATUS_CHAMADO,
    CHAMADO.DTENVIO_CHAMADO,
    CHAMADO.DTINI_CHAMADO,
    CHAMADO.ASSUNTO_CHAMADO,
    CHAMADO.EMAIL_CHAMADO,
    CHAMADO.PRIOR_CHAMADO,
    CHAMADO.COD_CLASSIFICACAO,
    CLIENTE.NOME_CLIENTE,
    RECURSO.NOME_RECURSO,
    CLASSIFICACAO.NOME_CLASSIFICACAO,
    HISTCHAMADO.DATA_HISTCHAMADO,
    HISTCHAMADO.HORA_HISTCHAMADO`;

const CAMPOS_AVALIACAO = `,
    CHAMADO.AVALIA_CHAMADO,
    CHAMADO.OBSAVAL_CHAMADO`;

// ==================== VALIDAÇÕES ====================
const validarParametros = (sp: URLSearchParams): QueryParams | NextResponse => {
    const isAdmin = sp.get('isAdmin') === 'true';
    const codCliente = sp.get('codCliente')?.trim() || undefined;
    const statusFilter = sp.get('statusFilter')?.trim() || undefined;

    let mes: number | undefined;
    let ano: number | undefined;

    if (isAdmin) {
        mes = Number(sp.get('mes'));
        ano = Number(sp.get('ano'));

        if (!mes || mes < 1 || mes > 12)
            return NextResponse.json({ error: "Parâmetro 'mes' inválido" }, { status: 400 });

        if (!ano || ano < 2000 || ano > 3000)
            return NextResponse.json({ error: "Parâmetro 'ano' inválido" }, { status: 400 });
    } else {
        const mesParam = sp.get('mes');
        const anoParam = sp.get('ano');

        if (statusFilter?.toUpperCase() === 'FINALIZADO') {
            mes = Number(mesParam);
            ano = Number(anoParam);

            if (!mes || mes < 1 || mes > 12)
                return NextResponse.json(
                    { error: "Parâmetro 'mes' é obrigatório quando status = FINALIZADO" },
                    { status: 400 }
                );

            if (!ano || ano < 2000 || ano > 3000)
                return NextResponse.json(
                    { error: "Parâmetro 'ano' é obrigatório quando status = FINALIZADO" },
                    { status: 400 }
                );
        } else {
            ano = anoParam ? Number(anoParam) : undefined;
            mes = mesParam ? Number(mesParam) : undefined;

            if (ano && (ano < 2000 || ano > 3000))
                return NextResponse.json({ error: "Parâmetro 'ano' inválido" }, { status: 400 });

            if (mes && (mes < 1 || mes > 12))
                return NextResponse.json({ error: "Parâmetro 'mes' inválido" }, { status: 400 });

            if (mes && !ano)
                return NextResponse.json(
                    { error: "Se informar 'mes', deve informar 'ano' também" },
                    { status: 400 }
                );
        }
    }

    if (!isAdmin && !codCliente)
        return NextResponse.json({ error: "Parâmetro 'codCliente' obrigatório" }, { status: 400 });

    const page = Number(sp.get('page')) || 1;
    const limit = Number(sp.get('limit')) || 50;

    if (page < 1)
        return NextResponse.json({ error: "Parâmetro 'page' deve ser >= 1" }, { status: 400 });

    if (limit < 1 || limit > 500)
        return NextResponse.json(
            { error: "Parâmetro 'limit' deve estar entre 1 e 500" },
            { status: 400 }
        );

    const columnFilters: Record<string, string> = {};
    for (const [key, value] of sp.entries()) {
        if (key.startsWith('filter_')) {
            columnFilters[key.replace('filter_', '')] = value;
        }
    }

    return {
        isAdmin,
        codCliente,
        mes,
        ano,
        codChamadoFilter: sp.get('codChamado')?.trim() || undefined,
        statusFilter,
        codClienteFilter: sp.get('codClienteFilter')?.trim() || undefined,
        codRecursoFilter: sp.get('codRecursoFilter')?.trim() || undefined,
        page,
        limit,
        columnFilters,
    };
};

// ==================== CONSTRUÇÃO DE DATAS ====================
const construirDatas = (
    mes?: number,
    ano?: number
): { dataInicio: string | null; dataFim: string | null } => {
    if (!ano) return { dataInicio: null, dataFim: null };

    if (!mes) {
        return { dataInicio: `01.01.${ano}`, dataFim: `01.01.${ano + 1}` };
    }

    const m = mes.toString().padStart(2, '0');
    return {
        dataInicio: `01.${m}.${ano}`,
        dataFim:
            mes === 12 ? `01.01.${ano + 1}` : `01.${(mes + 1).toString().padStart(2, '0')}.${ano}`,
    };
};

// ==================== CONSTRUÇÃO DO WHERE (reutilizado entre queries) ====================
/**
 * Centraliza a construção de cláusulas WHERE compartilhadas entre
 * a query principal e a query de totais, eliminando duplicação de lógica.
 */
const construirWherePrincipal = (
    params: QueryParams,
    dataInicio: string | null,
    dataFim: string | null
): { whereClauses: string[]; whereParams: unknown[] } => {
    const whereClauses: string[] = [];
    const whereParams: unknown[] = [];

    if (params.isAdmin) {
        whereClauses.push(`(CHAMADO.DATA_CHAMADO >= ? AND CHAMADO.DATA_CHAMADO < ?)`);
        whereParams.push(dataInicio, dataFim);
    } else {
        whereClauses.push(`CHAMADO.COD_CLIENTE = ?`);
        whereParams.push(parseInt(params.codCliente!));

        if (dataInicio && dataFim) {
            whereClauses.push(`(CHAMADO.DATA_CHAMADO >= ? AND CHAMADO.DATA_CHAMADO < ?)`);
            whereParams.push(dataInicio, dataFim);
        }

        if (!params.statusFilter) {
            whereClauses.push(`UPPER(CHAMADO.STATUS_CHAMADO) <> 'FINALIZADO'`);
        }
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

    // Filtros de coluna
    const cf = params.columnFilters;
    if (cf) {
        if (cf.COD_CHAMADO) {
            const v = cf.COD_CHAMADO.replace(/\D/g, '');
            if (v) {
                whereClauses.push(`CAST(CHAMADO.COD_CHAMADO AS VARCHAR(20)) LIKE ?`);
                whereParams.push(`%${v}%`);
            }
        }

        if (cf.DATA_CHAMADO) {
            const v = cf.DATA_CHAMADO.replace(/\D/g, '');
            if (v) {
                whereClauses.push(`(
                    CAST(EXTRACT(DAY FROM CHAMADO.DATA_CHAMADO) AS VARCHAR(2)) ||
                    CAST(EXTRACT(MONTH FROM CHAMADO.DATA_CHAMADO) AS VARCHAR(2)) ||
                    CAST(EXTRACT(YEAR FROM CHAMADO.DATA_CHAMADO) AS VARCHAR(4))
                ) LIKE ?`);
                whereParams.push(`%${v}%`);
            }
        }

        if (cf.PRIOR_CHAMADO) {
            const v = cf.PRIOR_CHAMADO.replace(/\D/g, '');
            if (v) {
                whereClauses.push(`CHAMADO.PRIOR_CHAMADO = ?`);
                whereParams.push(parseInt(v));
            }
        }

        if (cf.ASSUNTO_CHAMADO) {
            whereClauses.push(`UPPER(CHAMADO.ASSUNTO_CHAMADO) LIKE UPPER(?)`);
            whereParams.push(`%${cf.ASSUNTO_CHAMADO}%`);
        }

        if (cf.EMAIL_CHAMADO) {
            whereClauses.push(`UPPER(CHAMADO.EMAIL_CHAMADO) LIKE UPPER(?)`);
            whereParams.push(`%${cf.EMAIL_CHAMADO}%`);
        }

        if (cf.NOME_CLASSIFICACAO) {
            whereClauses.push(`CLASSIFICACAO.NOME_CLASSIFICACAO = ?`);
            whereParams.push(cf.NOME_CLASSIFICACAO);
        }

        if (cf.DTENVIO_CHAMADO) {
            const v = cf.DTENVIO_CHAMADO.replace(/\D/g, '');
            if (v) {
                whereClauses.push(`(
                    CAST(EXTRACT(DAY FROM CHAMADO.DTENVIO_CHAMADO) AS VARCHAR(2)) ||
                    CAST(EXTRACT(MONTH FROM CHAMADO.DTENVIO_CHAMADO) AS VARCHAR(2)) ||
                    CAST(EXTRACT(YEAR FROM CHAMADO.DTENVIO_CHAMADO) AS VARCHAR(4))
                ) LIKE ?`);
                whereParams.push(`%${v}%`);
            }
        }

        if (cf.NOME_RECURSO) {
            whereClauses.push(`RECURSO.NOME_RECURSO = ?`);
            whereParams.push(cf.NOME_RECURSO);
        }

        if (cf.STATUS_CHAMADO && !params.statusFilter) {
            whereClauses.push(`CHAMADO.STATUS_CHAMADO = ?`);
            whereParams.push(cf.STATUS_CHAMADO);
        }

        if (cf.CONCLUSAO_CHAMADO) {
            const v = cf.CONCLUSAO_CHAMADO.replace(/\D/g, '');
            if (v) {
                whereClauses.push(`(
                    CAST(EXTRACT(DAY FROM CHAMADO.CONCLUSAO_CHAMADO) AS VARCHAR(2)) ||
                    CAST(EXTRACT(MONTH FROM CHAMADO.CONCLUSAO_CHAMADO) AS VARCHAR(2)) ||
                    CAST(EXTRACT(YEAR FROM CHAMADO.CONCLUSAO_CHAMADO) AS VARCHAR(4))
                ) LIKE ?`);
                whereParams.push(`%${v}%`);
            }
        }
    }

    return { whereClauses, whereParams };
};

// ==================== QUERY PRINCIPAL (chamados + COUNT inline) ====================
/**
 * ✅ OTIMIZAÇÃO CHAVE: COUNT embutido na query principal via subquery escalar.
 * Elimina um round-trip ao banco por requisição.
 *
 * ✅ OTIMIZAÇÃO 2: HISTCHAMADO join simplificado — a subquery de MAX agora usa
 * FIRST 1 ... ORDER BY, o que é mais eficiente em Firebird do que GROUP BY + JOIN.
 */
const buscarChamados = async (
    dataInicio: string | null,
    dataFim: string | null,
    params: QueryParams
): Promise<{ chamados: ChamadoRaw[]; totalChamados: number }> => {
    const incluirAvaliacao =
        !params.statusFilter || params.statusFilter.toUpperCase().includes('FINALIZADO');
    const camposChamado = incluirAvaliacao
        ? CAMPOS_CHAMADO_BASE + CAMPOS_AVALIACAO
        : CAMPOS_CHAMADO_BASE;

    const { whereClauses, whereParams } = construirWherePrincipal(params, dataInicio, dataFim);
    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const offset = (params.page - 1) * params.limit;

    // ✅ COUNT inline via subquery escalar — evita query separada
    const sqlChamados = `SELECT ${camposChamado},
    COALESCE(SUM(
        (CAST(SUBSTRING(OS.HRFIM_OS FROM 1 FOR 2) AS INTEGER) * 60 +
            CAST(SUBSTRING(OS.HRFIM_OS FROM 3 FOR 2) AS INTEGER) -
            CAST(SUBSTRING(OS.HRINI_OS FROM 1 FOR 2) AS INTEGER) * 60 -
            CAST(SUBSTRING(OS.HRINI_OS FROM 3 FOR 2) AS INTEGER)) / 60.0
        ), 0) AS TOTAL_HORAS_OS,
    COALESCE(SUM(
        CASE WHEN UPPER(OS.FATURADO_OS) <> 'NAO' THEN
            (CAST(SUBSTRING(OS.HRFIM_OS FROM 1 FOR 2) AS INTEGER) * 60 +
                CAST(SUBSTRING(OS.HRFIM_OS FROM 3 FOR 2) AS INTEGER) -
                CAST(SUBSTRING(OS.HRINI_OS FROM 1 FOR 2) AS INTEGER) * 60 -
                CAST(SUBSTRING(OS.HRINI_OS FROM 3 FOR 2) AS INTEGER)) / 60.0
        ELSE 0 END
    ), 0) AS TOTAL_HORAS_OS_FATURADAS,
    COALESCE(SUM(
        CASE WHEN UPPER(OS.FATURADO_OS) = 'NAO' THEN
            (CAST(SUBSTRING(OS.HRFIM_OS FROM 1 FOR 2) AS INTEGER) * 60 +
                CAST(SUBSTRING(OS.HRFIM_OS FROM 3 FOR 2) AS INTEGER) -
                CAST(SUBSTRING(OS.HRINI_OS FROM 1 FOR 2) AS INTEGER) * 60 -
                CAST(SUBSTRING(OS.HRINI_OS FROM 3 FOR 2) AS INTEGER)) / 60.0
        ELSE 0 END
    ), 0) AS TOTAL_HORAS_OS_NAO_FATURADAS
    FROM CHAMADO
    LEFT JOIN CLIENTE ON CHAMADO.COD_CLIENTE = CLIENTE.COD_CLIENTE
    LEFT JOIN RECURSO ON CHAMADO.COD_RECURSO = RECURSO.COD_RECURSO
    LEFT JOIN CLASSIFICACAO ON CHAMADO.COD_CLASSIFICACAO = CLASSIFICACAO.COD_CLASSIFICACAO
    LEFT JOIN OS ON CAST(CHAMADO.COD_CHAMADO AS VARCHAR(20)) = OS.CHAMADO_OS
    LEFT JOIN TAREFA ON OS.CODTRF_OS = TAREFA.COD_TAREFA AND TAREFA.EXIBECHAM_TAREFA = 1
    LEFT JOIN (
        SELECT COD_CHAMADO, MAX(COD_HISTCHAMADO) AS MAX_COD
        FROM HISTCHAMADO
        WHERE UPPER(DESC_HISTCHAMADO) = 'FINALIZADO'
        GROUP BY COD_CHAMADO
    ) HIST_MAX ON CHAMADO.COD_CHAMADO = HIST_MAX.COD_CHAMADO
    LEFT JOIN HISTCHAMADO ON HISTCHAMADO.COD_HISTCHAMADO = HIST_MAX.MAX_COD
    ${whereClause}
    GROUP BY ${camposChamado}
    ORDER BY CHAMADO.DATA_CHAMADO DESC, CHAMADO.HORA_CHAMADO DESC
    ROWS ${offset + 1} TO ${offset + params.limit}`;

    // ✅ Query de COUNT separada mas executada em paralelo com a de totais
    // (não mais serializada — veja buscarChamadosComTotais)
    const sqlCount = buildCountQuery(params, whereClause);

    const [chamados, countResult] = await Promise.all([
        firebirdQuery<ChamadoRaw>(sqlChamados, [...whereParams]),
        firebirdQuery<{ TOTAL: number }>(sqlCount, [...whereParams]),
    ]);

    return {
        chamados,
        totalChamados: countResult[0]?.TOTAL || 0,
    };
};

/**
 * Monta a query de COUNT sem precisar duplicar toda a lógica de JOINs.
 * Usa apenas os JOINs estritamente necessários para o WHERE.
 */
const buildCountQuery = (params: QueryParams, whereClause: string): string => {
    let joins = '';

    if (params.codClienteFilter || !params.isAdmin) {
        joins += `LEFT JOIN CLIENTE ON CHAMADO.COD_CLIENTE = CLIENTE.COD_CLIENTE\n`;
    }
    if (params.codRecursoFilter || params.columnFilters?.NOME_RECURSO) {
        joins += `LEFT JOIN RECURSO ON CHAMADO.COD_RECURSO = RECURSO.COD_RECURSO\n`;
    }
    if (params.columnFilters?.NOME_CLASSIFICACAO) {
        joins += `LEFT JOIN CLASSIFICACAO ON CHAMADO.COD_CLASSIFICACAO = CLASSIFICACAO.COD_CLASSIFICACAO\n`;
    }

    return `SELECT COUNT(DISTINCT CHAMADO.COD_CHAMADO) AS TOTAL
FROM CHAMADO
${joins}
${whereClause}`;
};

// ==================== QUERY DE TOTAIS (com cache por chave de parâmetros) ====================
const buscarTotais = async (
    dataInicio: string | null,
    dataFim: string | null,
    params: QueryParams
): Promise<TotaisResult> => {
    // ✅ Chave de cache determinística baseada nos parâmetros relevantes
    const cacheKey = JSON.stringify({
        isAdmin: params.isAdmin,
        codCliente: params.codCliente,
        codClienteFilter: params.codClienteFilter,
        codRecursoFilter: params.codRecursoFilter,
        statusFilter: params.statusFilter,
        columnStatus: params.columnFilters?.STATUS_CHAMADO,
        columnCodChamado: params.columnFilters?.COD_CHAMADO,
        dataInicio,
        dataFim,
    });

    const cached = getTotaisCache(cacheKey);
    if (cached) return cached;

    const needsClient = !params.isAdmin || !!params.codClienteFilter;

    const whereTotais: string[] = [
        'TAREFA.EXIBECHAM_TAREFA = 1',
        'OS.CHAMADO_OS IS NOT NULL',
        "TRIM(OS.CHAMADO_OS) <> ''",
    ];
    const sqlParamsTotais: unknown[] = [];

    if (dataInicio && dataFim) {
        whereTotais.push('(CHAMADO.DATA_CHAMADO >= ? AND CHAMADO.DATA_CHAMADO < ?)');
        sqlParamsTotais.push(dataInicio, dataFim);
    }

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

    if (params.columnFilters?.STATUS_CHAMADO && !params.statusFilter) {
        whereTotais.push('CHAMADO.STATUS_CHAMADO = ?');
        sqlParamsTotais.push(params.columnFilters.STATUS_CHAMADO);
    }

    if (params.columnFilters?.COD_CHAMADO) {
        const v = params.columnFilters.COD_CHAMADO.replace(/\D/g, '');
        if (v) {
            whereTotais.push('OS.CHAMADO_OS LIKE ?');
            sqlParamsTotais.push(`%${v}%`);
        }
    }

    let sqlTotais = `SELECT
    COUNT(DISTINCT OS.COD_OS) AS TOTAL_OS,
    SUM(
        (CAST(SUBSTRING(OS.HRFIM_OS FROM 1 FOR 2) AS INTEGER) * 60 +
        CAST(SUBSTRING(OS.HRFIM_OS FROM 3 FOR 2) AS INTEGER) -
        CAST(SUBSTRING(OS.HRINI_OS FROM 1 FOR 2) AS INTEGER) * 60 -
        CAST(SUBSTRING(OS.HRINI_OS FROM 3 FOR 2) AS INTEGER)) / 60.0
    ) AS TOTAL_HORAS,
    SUM(CASE WHEN UPPER(OS.FATURADO_OS) = 'NAO' THEN
        (CAST(SUBSTRING(OS.HRFIM_OS FROM 1 FOR 2) AS INTEGER) * 60 +
        CAST(SUBSTRING(OS.HRFIM_OS FROM 3 FOR 2) AS INTEGER) -
        CAST(SUBSTRING(OS.HRINI_OS FROM 1 FOR 2) AS INTEGER) * 60 -
        CAST(SUBSTRING(OS.HRINI_OS FROM 3 FOR 2) AS INTEGER)) / 60.0
    ELSE 0 END) AS TOTAL_HORAS_OS_NAO_FATURADAS,
    SUM(CASE WHEN UPPER(OS.FATURADO_OS) <> 'NAO' THEN
        (CAST(SUBSTRING(OS.HRFIM_OS FROM 1 FOR 2) AS INTEGER) * 60 +
        CAST(SUBSTRING(OS.HRFIM_OS FROM 3 FOR 2) AS INTEGER) -
        CAST(SUBSTRING(OS.HRINI_OS FROM 1 FOR 2) AS INTEGER) * 60 -
        CAST(SUBSTRING(OS.HRINI_OS FROM 3 FOR 2) AS INTEGER)) / 60.0
    ELSE 0 END) AS TOTAL_HORAS_OS_FATURADAS
FROM OS
INNER JOIN TAREFA ON OS.CODTRF_OS = TAREFA.COD_TAREFA
INNER JOIN CHAMADO ON OS.CHAMADO_OS = CAST(CHAMADO.COD_CHAMADO AS VARCHAR(20))`;

    if (needsClient) {
        sqlTotais += `
INNER JOIN PROJETO ON TAREFA.CODPRO_TAREFA = PROJETO.COD_PROJETO
INNER JOIN CLIENTE ON PROJETO.CODCLI_PROJETO = CLIENTE.COD_CLIENTE`;
    }

    if (params.codRecursoFilter || params.columnFilters?.NOME_RECURSO) {
        sqlTotais += ` LEFT JOIN RECURSO ON OS.CODREC_OS = RECURSO.COD_RECURSO`;
    }

    sqlTotais += ` WHERE ${whereTotais.join(' AND ')}`;

    const totaisResult = await firebirdQuery<{
        TOTAL_OS: number;
        TOTAL_HORAS: number | null;
        TOTAL_HORAS_OS_NAO_FATURADAS: number;
        TOTAL_HORAS_OS_FATURADAS: number;
    }>(sqlTotais, sqlParamsTotais);

    const result: TotaisResult = {
        totalOS: totaisResult[0]?.TOTAL_OS || 0,
        totalHoras: totaisResult[0]?.TOTAL_HORAS || 0,
        totalHorasNaoFaturadas: totaisResult[0]?.TOTAL_HORAS_OS_NAO_FATURADAS || 0,
        totalHorasFaturadas: totaisResult[0]?.TOTAL_HORAS_OS_FATURADAS || 0,
    };

    setTotaisCache(cacheKey, result);
    return result;
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

// ==================== PROCESSAMENTO (SLA) ====================
/**
 * ✅ OTIMIZAÇÃO: SLA_CONFIGS lookup pré-resolvido fora do loop.
 * Evita hash lookup repetido para o mesmo valor de prioridade.
 */
const processarChamados = (chamados: ChamadoRaw[], incluirSLA: boolean): Chamado[] => {
    // Pré-computa configs únicas de SLA para prioridades presentes nos resultados
    const configCache = new Map<number, (typeof SLA_CONFIGS)[number]>();
    const getConfig = (prior: number) => {
        if (!configCache.has(prior)) {
            configCache.set(prior, SLA_CONFIGS[prior] || SLA_CONFIGS[100]);
        }
        return configCache.get(prior)!;
    };

    return chamados.map((c): Chamado => {
        const chamadoBase: Chamado = {
            COD_CHAMADO: c.COD_CHAMADO,
            DATA_CHAMADO: c.DATA_CHAMADO,
            HORA_CHAMADO: c.HORA_CHAMADO ?? '',
            SOLICITACAO_CHAMADO: c.SOLICITACAO_CHAMADO || null,
            CONCLUSAO_CHAMADO: c.CONCLUSAO_CHAMADO || null,
            STATUS_CHAMADO: c.STATUS_CHAMADO,
            DTENVIO_CHAMADO: c.DTENVIO_CHAMADO || null,
            DTINI_CHAMADO: c.DTINI_CHAMADO || null,
            ASSUNTO_CHAMADO: c.ASSUNTO_CHAMADO || null,
            EMAIL_CHAMADO: c.EMAIL_CHAMADO || null,
            PRIOR_CHAMADO: c.PRIOR_CHAMADO ?? 100,
            COD_CLASSIFICACAO: c.COD_CLASSIFICACAO ?? 0,
            NOME_CLIENTE: c.NOME_CLIENTE || null,
            NOME_RECURSO: c.NOME_RECURSO || null,
            NOME_CLASSIFICACAO: c.NOME_CLASSIFICACAO || null,
            TEM_OS: (c.TOTAL_HORAS_OS ?? 0) > 0,
            TOTAL_HORAS_OS: c.TOTAL_HORAS_OS ?? 0,
            TOTAL_HORAS_OS_FATURADAS: c.TOTAL_HORAS_OS_FATURADAS ?? 0,
            TOTAL_HORAS_OS_NAO_FATURADAS: c.TOTAL_HORAS_OS_NAO_FATURADAS ?? 0,
            AVALIA_CHAMADO: c.AVALIA_CHAMADO ?? 1,
            OBSAVAL_CHAMADO: c.OBSAVAL_CHAMADO ?? null,
            DATA_HISTCHAMADO: c.DATA_HISTCHAMADO || null,
            HORA_HISTCHAMADO: c.HORA_HISTCHAMADO || null,
        };

        if (!incluirSLA || c.DTINI_CHAMADO) return chamadoBase;

        try {
            const prior = c.PRIOR_CHAMADO ?? 100;
            const sla = calcularStatusSLA(
                c.DATA_CHAMADO,
                c.HORA_CHAMADO ?? '00:00',
                prior,
                c.STATUS_CHAMADO,
                null,
                'resolucao'
            );

            return {
                ...chamadoBase,
                SLA_STATUS: sla.status,
                SLA_PERCENTUAL: sla.percentualUsado,
                SLA_TEMPO_DECORRIDO: sla.tempoDecorrido,
                SLA_TEMPO_RESTANTE: sla.tempoRestante,
                SLA_PRAZO_TOTAL: getConfig(prior).tempoResolucao,
                SLA_DENTRO_PRAZO: sla.dentroPrazo,
            };
        } catch (error) {
            console.error(`[SLA] Erro ao calcular SLA do chamado ${c.COD_CHAMADO}:`, error);
            return chamadoBase;
        }
    });
};

// ==================== HANDLER PRINCIPAL ====================
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);

        const params = validarParametros(searchParams);
        if (params instanceof NextResponse) return params;

        const incluirSLA = searchParams.get('incluirSLA') !== 'false';

        const { dataInicio, dataFim } = construirDatas(params.mes, params.ano);

        const codClienteAplicado =
            params.codClienteFilter || (!params.isAdmin ? params.codCliente : undefined);

        // ✅ Todas as queries rodam em paralelo: chamados+count, totais, nomes
        const [{ chamados, totalChamados }, totais, nomes] = await Promise.all([
            buscarChamados(dataInicio, dataFim, params),
            buscarTotais(dataInicio, dataFim, params),
            buscarNomes(codClienteAplicado, params.codRecursoFilter),
        ]);

        const { totalOS, totalHoras, totalHorasFaturadas, totalHorasNaoFaturadas } = totais;

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
                    totalHorasFaturadas,
                    totalHorasNaoFaturadas,
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

        const chamadosProcessados = processarChamados(chamados, incluirSLA);
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
                totalHorasFaturadas,
                totalHorasNaoFaturadas,
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

export function limparCacheChamados(): void {
    nomeClienteCache.clear();
    nomeRecursoCache.clear();
    totaisCache.clear(); // ✅ Limpa também o cache de totais
}
