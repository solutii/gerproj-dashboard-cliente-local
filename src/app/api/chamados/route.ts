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
    DATA_INICIO_ATENDIMENTO?: Date | null;
    HORA_INICIO_ATENDIMENTO?: string | null;

    SLA_STATUS?: string;
    SLA_PERCENTUAL?: number;
    SLA_TEMPO_DECORRIDO?: number;
    SLA_TEMPO_RESTANTE?: number;
    SLA_PRAZO_TOTAL?: number;
    SLA_DENTRO_PRAZO?: boolean;
}

interface QueryParams {
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
    DATA_INICIO_ATENDIMENTO?: Date | null;
    HORA_INICIO_ATENDIMENTO?: string | null;
    TOTAL_RECORDS?: number;
}

// ==================== CORREÇÃO 1: CACHE DE PROMISES ====================
//
// Substitui o cache de valores simples por cache de Promises.
//
// Problema anterior: com múltiplas requisições simultâneas, todas
// encontravam o cache vazio antes de qualquer uma terminar a query,
// disparando N queries idênticas ao banco para a mesma chave.
//
// Agora: a primeira requisição registra a Promise no cache; todas as
// seguintes reutilizam essa mesma Promise — 1 query por chave, sempre.

const nomeClienteCache = new Map<string, Promise<string | null>>();
const nomeRecursoCache = new Map<string, Promise<string | null>>();
const totaisCache = new Map<string, Promise<TotaisResult>>();

// TTL não se aplica a Promises em andamento, apenas a resultados já
// resolvidos. Para invalidação por tempo, usamos um wrapper que registra
// o timestamp junto com a Promise resolvida.
const CACHE_TTL = 300_000; // 5 min — nomes de cliente/recurso
const CACHE_TTL_TOTAIS = 60_000; // 1 min — totais (mudam com frequência)

interface TotaisResult {
    totalOS: number;
    totalHoras: number;
    totalHorasNaoFaturadas: number;
    totalHorasFaturadas: number;
}

// Cache com TTL para nomes — retorna Promise<string|null>
function getCachedNome(
    cache: Map<string, Promise<string | null>>,
    key: string
): Promise<string | null> | undefined {
    return cache.get(key);
}

function setCachedNome(
    cache: Map<string, Promise<string | null>>,
    key: string,
    promise: Promise<string | null>
): void {
    cache.set(key, promise);
    // Invalida após TTL para evitar nomes obsoletos
    promise
        .then(() => {
            setTimeout(() => cache.delete(key), CACHE_TTL);
        })
        .catch(() => {
            cache.delete(key); // remove imediatamente em caso de erro
        });
}

// Cache com TTL para totais — retorna Promise<TotaisResult>
function getCachedTotais(key: string): Promise<TotaisResult> | undefined {
    return totaisCache.get(key);
}

function setCachedTotais(key: string, promise: Promise<TotaisResult>): void {
    totaisCache.set(key, promise);
    promise
        .then(() => {
            setTimeout(() => totaisCache.delete(key), CACHE_TTL_TOTAIS);
        })
        .catch(() => {
            totaisCache.delete(key);
        });
    // Limita tamanho do cache
    if (totaisCache.size > 200) {
        const firstKey = totaisCache.keys().next().value;
        if (firstKey) totaisCache.delete(firstKey);
    }
}

// ==================== CONFIGURAÇÃO ====================
const CAMPOS_CHAMADO_BASE_SELECT = `CHAMADO.COD_CHAMADO,
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
    HISTCHAMADO.HORA_HISTCHAMADO,
    HISTCHAMADO_INICIO.DATA_HISTCHAMADO AS DATA_INICIO_ATENDIMENTO,
    HISTCHAMADO_INICIO.HORA_HISTCHAMADO AS HORA_INICIO_ATENDIMENTO`;

const CAMPOS_CHAMADO_BASE_GROUPBY = `CHAMADO.COD_CHAMADO,
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
    HISTCHAMADO.HORA_HISTCHAMADO,
    HISTCHAMADO_INICIO.DATA_HISTCHAMADO,
    HISTCHAMADO_INICIO.HORA_HISTCHAMADO`;

const CAMPOS_AVALIACAO_SELECT = `,
    CHAMADO.AVALIA_CHAMADO,
    CHAMADO.OBSAVAL_CHAMADO`;

const CAMPOS_AVALIACAO_GROUPBY = `,
    CHAMADO.AVALIA_CHAMADO,
    CHAMADO.OBSAVAL_CHAMADO`;

// ==================== VALIDAÇÕES ====================
const validarParametros = (sp: URLSearchParams): QueryParams | NextResponse => {
    const codCliente = sp.get('codCliente')?.trim() || undefined;
    const statusFilter = sp.get('statusFilter')?.trim() || undefined;

    let mes: number | undefined;
    let ano: number | undefined;

    const mesParam = sp.get('mes');
    const anoParam = sp.get('ano');

    const statusUpper = statusFilter?.toUpperCase();
    if (statusUpper === 'FINALIZADO' || statusUpper === 'TODOS') {
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

    if (!codCliente)
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

// ==================== CONSTRUÇÃO DO WHERE ====================
const construirWherePrincipal = (
    params: QueryParams,
    dataInicio: string | null,
    dataFim: string | null,
    modo?: 'finalizados' | 'nao_finalizados'
): { whereClauses: string[]; whereParams: unknown[] } => {
    const whereClauses: string[] = [];
    const whereParams: unknown[] = [];

    const statusUpper = params.statusFilter?.toUpperCase();
    const isTodos = statusUpper === 'TODOS';

    whereClauses.push(`CHAMADO.COD_CLIENTE = ?`);
    whereParams.push(parseInt(params.codCliente!));

    if (dataInicio && dataFim) {
        if (isTodos) {
            if (modo === 'finalizados') {
                whereClauses.push(`UPPER(CHAMADO.STATUS_CHAMADO) = 'FINALIZADO'`);
                whereClauses.push(
                    `(HISTCHAMADO.DATA_HISTCHAMADO >= ? AND HISTCHAMADO.DATA_HISTCHAMADO < ?)`
                );
            } else {
                whereClauses.push(`UPPER(CHAMADO.STATUS_CHAMADO) <> 'FINALIZADO'`);
                whereClauses.push(`(CHAMADO.DATA_CHAMADO >= ? AND CHAMADO.DATA_CHAMADO < ?)`);
            }
            whereParams.push(dataInicio, dataFim);
        } else if (statusUpper !== 'FINALIZADO') {
            whereClauses.push(`(OS.DTINI_OS >= ? AND OS.DTINI_OS < ?)`);
            whereParams.push(dataInicio, dataFim);
        }
        // FINALIZADO: filtro de data vai dentro do INNER JOIN HIST_MAX no corpo da query
    }

    if (!params.statusFilter) {
        whereClauses.push(`UPPER(CHAMADO.STATUS_CHAMADO) <> 'FINALIZADO'`);
    }

    if (params.codClienteFilter) {
        whereClauses.push(`CHAMADO.COD_CLIENTE = ?`);
        whereParams.push(parseInt(params.codClienteFilter));
    }

    if (params.codRecursoFilter) {
        whereClauses.push(`CHAMADO.COD_RECURSO = ?`);
        whereParams.push(parseInt(params.codRecursoFilter));
    }

    if (params.codChamadoFilter) {
        whereClauses.push(`CHAMADO.COD_CHAMADO = ?`);
        whereParams.push(parseInt(params.codChamadoFilter));
    }

    if (params.statusFilter && params.statusFilter.toUpperCase() !== 'TODOS') {
        whereClauses.push(`UPPER(CHAMADO.STATUS_CHAMADO) LIKE UPPER(?)`);
        whereParams.push(`%${params.statusFilter}%`);
    }

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

const buscarChamadosTodos = async (
    dataInicio: string | null,
    dataFim: string | null,
    params: QueryParams
): Promise<{ chamados: ChamadoRaw[]; totalChamados: number }> => {
    // ── PASSO 1: queries leves, só IDs ──────────────────────────────────

    const buildIdParams = (modo: 'finalizados' | 'nao_finalizados') => {
        const clauses: string[] = [];
        const p: unknown[] = [];

        clauses.push(`CHAMADO.COD_CLIENTE = ?`);
        p.push(parseInt(params.codCliente!));

        if (params.codClienteFilter) {
            clauses.push(`CHAMADO.COD_CLIENTE = ?`);
            p.push(parseInt(params.codClienteFilter));
        }

        if (params.codRecursoFilter) {
            clauses.push(`CHAMADO.COD_RECURSO = ?`);
            p.push(parseInt(params.codRecursoFilter));
        }

        if (modo === 'finalizados') {
            clauses.push(`UPPER(CHAMADO.STATUS_CHAMADO) = 'FINALIZADO'`);
            // data de finalização vai dentro do INNER JOIN HIST_MAX_JOIN — não entra no WHERE
        } else {
            clauses.push(`UPPER(CHAMADO.STATUS_CHAMADO) <> 'FINALIZADO'`);
            if (dataInicio && dataFim) {
                clauses.push(`CHAMADO.DATA_CHAMADO >= ? AND CHAMADO.DATA_CHAMADO < ?`);
                p.push(dataInicio, dataFim);
            }
        }

        // filtros de coluna que precisam de join simples
        if (params.columnFilters?.COD_CHAMADO) {
            const v = params.columnFilters.COD_CHAMADO.replace(/\D/g, '');
            if (v) {
                clauses.push(`CAST(CHAMADO.COD_CHAMADO AS VARCHAR(20)) LIKE ?`);
                p.push(`%${v}%`);
            }
        }

        if (params.codChamadoFilter) {
            clauses.push(`CHAMADO.COD_CHAMADO = ?`);
            p.push(parseInt(params.codChamadoFilter));
        }

        const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';

        const histJoin =
            modo === 'finalizados' && dataInicio && dataFim
                ? `INNER JOIN (
                SELECT COD_CHAMADO
                FROM HISTCHAMADO
                WHERE UPPER(DESC_HISTCHAMADO) = 'FINALIZADO'
                AND DATA_HISTCHAMADO >= '${dataInicio}'
                AND DATA_HISTCHAMADO < '${dataFim}'
                GROUP BY COD_CHAMADO
            ) HIST_MAX_JOIN ON CHAMADO.COD_CHAMADO = HIST_MAX_JOIN.COD_CHAMADO`
                : '';

        const sql = `
            SELECT CHAMADO.COD_CHAMADO, CHAMADO.DATA_CHAMADO, CHAMADO.HORA_CHAMADO
            FROM CHAMADO
            ${histJoin}
            ${where}
        `;

        return { sql, p };
    };

    // Roda as duas queries de IDs em paralelo
    const [{ sql: sqlFin, p: pFin }, { sql: sqlNaoFin, p: pNaoFin }] = [
        buildIdParams('finalizados'),
        buildIdParams('nao_finalizados'),
    ];

    const [idsFin, idsNaoFin] = await Promise.all([
        firebirdQuery<{ COD_CHAMADO: number; DATA_CHAMADO: Date; HORA_CHAMADO: string }>(
            sqlFin,
            pFin
        ),
        firebirdQuery<{ COD_CHAMADO: number; DATA_CHAMADO: Date; HORA_CHAMADO: string }>(
            sqlNaoFin,
            pNaoFin
        ),
    ]);

    // ── PASSO 2: merge, dedup, ordena e pagina em memória ───────────────
    // (só IDs/datas, custo desprezível mesmo com 2.000 registros)

    const vistos = new Set<number>();
    const merged: { COD_CHAMADO: number; DATA_CHAMADO: Date; HORA_CHAMADO: string }[] = [];

    for (const c of [...idsFin, ...idsNaoFin]) {
        if (!vistos.has(c.COD_CHAMADO)) {
            vistos.add(c.COD_CHAMADO);
            merged.push(c);
        }
    }

    merged.sort((a, b) => {
        const diff = new Date(b.DATA_CHAMADO).getTime() - new Date(a.DATA_CHAMADO).getTime();
        if (diff !== 0) return diff;
        return (b.HORA_CHAMADO ?? '').localeCompare(a.HORA_CHAMADO ?? '');
    });

    const totalChamados = merged.length;
    const offset = (params.page - 1) * params.limit;
    const paginaIds = merged.slice(offset, offset + params.limit).map((c) => c.COD_CHAMADO);

    if (paginaIds.length === 0) {
        return { chamados: [], totalChamados };
    }

    // ── PASSO 3: query completa só para os IDs da página ────────────────
    // Máximo params.limit registros (geralmente 50) — sempre rápida

    const placeholders = paginaIds.map(() => '?').join(', ');

    const sqlCompleta = `
        SELECT ${CAMPOS_CHAMADO_BASE_SELECT}${CAMPOS_AVALIACAO_SELECT},
        COALESCE(SUM(
            CASE WHEN UPPER(OS.FATURADO_OS) <> 'NAO' THEN
                (CAST(SUBSTRING(OS.HRFIM_OS FROM 1 FOR 2) AS INTEGER) * 60 +
                    CAST(SUBSTRING(OS.HRFIM_OS FROM 3 FOR 2) AS INTEGER) -
                    CAST(SUBSTRING(OS.HRINI_OS FROM 1 FOR 2) AS INTEGER) * 60 -
                    CAST(SUBSTRING(OS.HRINI_OS FROM 3 FOR 2) AS INTEGER)) / 60.0
            ELSE 0 END
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
        LEFT JOIN OS ON OS.CHAMADO_OS = CAST(CHAMADO.COD_CHAMADO AS VARCHAR(20))
        LEFT JOIN TAREFA ON OS.CODTRF_OS = TAREFA.COD_TAREFA AND TAREFA.EXIBECHAM_TAREFA = 1
        LEFT JOIN (
            SELECT COD_CHAMADO, MAX(COD_HISTCHAMADO) AS MAX_COD
            FROM HISTCHAMADO
            WHERE UPPER(DESC_HISTCHAMADO) = 'FINALIZADO'
            GROUP BY COD_CHAMADO
        ) HIST_MAX ON CHAMADO.COD_CHAMADO = HIST_MAX.COD_CHAMADO
        LEFT JOIN HISTCHAMADO ON HISTCHAMADO.COD_HISTCHAMADO = HIST_MAX.MAX_COD
        LEFT JOIN (
            SELECT COD_CHAMADO, MAX(COD_HISTCHAMADO) AS MAX_COD
            FROM HISTCHAMADO
            WHERE UPPER(DESC_HISTCHAMADO) LIKE 'EM ATENDIMENTO%'
            GROUP BY COD_CHAMADO
        ) HIST_INICIO ON CHAMADO.COD_CHAMADO = HIST_INICIO.COD_CHAMADO
        LEFT JOIN HISTCHAMADO HISTCHAMADO_INICIO ON HISTCHAMADO_INICIO.COD_HISTCHAMADO = HIST_INICIO.MAX_COD
        WHERE CHAMADO.COD_CHAMADO IN (${placeholders})
        GROUP BY ${CAMPOS_CHAMADO_BASE_GROUPBY}${CAMPOS_AVALIACAO_GROUPBY}
    `;

    const chamadosRaw = await firebirdQuery<ChamadoRaw>(sqlCompleta, paginaIds);

    // Reordena o resultado para bater com a ordem da página
    const ordemMap = new Map(paginaIds.map((id, i) => [id, i]));
    chamadosRaw.sort(
        (a, b) => (ordemMap.get(a.COD_CHAMADO) ?? 0) - (ordemMap.get(b.COD_CHAMADO) ?? 0)
    );

    return { chamados: chamadosRaw, totalChamados };
};

// ==================== QUERY PRINCIPAL ====================
const buscarChamados = async (
    dataInicio: string | null,
    dataFim: string | null,
    params: QueryParams
): Promise<{ chamados: ChamadoRaw[]; totalChamados: number }> => {
    const isTodos = params.statusFilter?.toUpperCase() === 'TODOS';

    if (isTodos) {
        return buscarChamadosTodos(dataInicio, dataFim, params);
    }

    const incluirAvaliacao =
        !params.statusFilter ||
        params.statusFilter.toUpperCase().includes('FINALIZADO') ||
        params.statusFilter.toUpperCase() === 'TODOS';

    const camposSelect = incluirAvaliacao
        ? CAMPOS_CHAMADO_BASE_SELECT + CAMPOS_AVALIACAO_SELECT
        : CAMPOS_CHAMADO_BASE_SELECT;

    const camposGroupBy = incluirAvaliacao
        ? CAMPOS_CHAMADO_BASE_GROUPBY + CAMPOS_AVALIACAO_GROUPBY
        : CAMPOS_CHAMADO_BASE_GROUPBY;

    const { whereClauses, whereParams } = construirWherePrincipal(params, dataInicio, dataFim);
    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const offset = (params.page - 1) * params.limit;

    const osJoinType = dataInicio && dataFim ? 'INNER' : 'LEFT';

    const isFinalizado = params.statusFilter?.toUpperCase() === 'FINALIZADO';
    const histMaxJoin =
        isFinalizado && dataInicio && dataFim
            ? `INNER JOIN (
        SELECT COD_CHAMADO, MAX(COD_HISTCHAMADO) AS MAX_COD
        FROM HISTCHAMADO
        WHERE UPPER(DESC_HISTCHAMADO) = 'FINALIZADO'
        AND DATA_HISTCHAMADO >= '${dataInicio}'
        AND DATA_HISTCHAMADO < '${dataFim}'
        GROUP BY COD_CHAMADO
    ) HIST_MAX ON CHAMADO.COD_CHAMADO = HIST_MAX.COD_CHAMADO`
            : `LEFT JOIN (
        SELECT COD_CHAMADO, MAX(COD_HISTCHAMADO) AS MAX_COD
        FROM HISTCHAMADO
        WHERE UPPER(DESC_HISTCHAMADO) = 'FINALIZADO'
        GROUP BY COD_CHAMADO
    ) HIST_MAX ON CHAMADO.COD_CHAMADO = HIST_MAX.COD_CHAMADO`;

    const sqlChamados = `SELECT ${camposSelect},
    COALESCE(SUM(
        CASE WHEN UPPER(OS.FATURADO_OS) <> 'NAO' THEN
            (CAST(SUBSTRING(OS.HRFIM_OS FROM 1 FOR 2) AS INTEGER) * 60 +
                CAST(SUBSTRING(OS.HRFIM_OS FROM 3 FOR 2) AS INTEGER) -
                CAST(SUBSTRING(OS.HRINI_OS FROM 1 FOR 2) AS INTEGER) * 60 -
                CAST(SUBSTRING(OS.HRINI_OS FROM 3 FOR 2) AS INTEGER)) / 60.0
        ELSE 0 END
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
    ${osJoinType} JOIN OS ON OS.CHAMADO_OS = CAST(CHAMADO.COD_CHAMADO AS VARCHAR(20))
    ${osJoinType} JOIN TAREFA ON OS.CODTRF_OS = TAREFA.COD_TAREFA AND TAREFA.EXIBECHAM_TAREFA = 1
    ${histMaxJoin}
    LEFT JOIN HISTCHAMADO ON HISTCHAMADO.COD_HISTCHAMADO = HIST_MAX.MAX_COD
    LEFT JOIN (
        SELECT COD_CHAMADO, MAX(COD_HISTCHAMADO) AS MAX_COD
        FROM HISTCHAMADO
        WHERE UPPER(DESC_HISTCHAMADO) LIKE 'EM ATENDIMENTO%'
        GROUP BY COD_CHAMADO
    ) HIST_INICIO ON CHAMADO.COD_CHAMADO = HIST_INICIO.COD_CHAMADO
    LEFT JOIN HISTCHAMADO HISTCHAMADO_INICIO ON HISTCHAMADO_INICIO.COD_HISTCHAMADO = HIST_INICIO.MAX_COD
    ${whereClause}
    GROUP BY ${camposGroupBy}
    ORDER BY CHAMADO.DATA_CHAMADO DESC, CHAMADO.HORA_CHAMADO DESC
    ROWS ${offset + 1} TO ${offset + params.limit}`;

    const sqlCount = buildCountQuery(params, whereClause, osJoinType, dataInicio, dataFim);

    const [chamados, countResult] = await Promise.all([
        firebirdQuery<ChamadoRaw>(sqlChamados, [...whereParams]),
        firebirdQuery<{ TOTAL: number }>(sqlCount, [...whereParams]),
    ]);

    return {
        chamados,
        totalChamados: countResult[0]?.TOTAL || 0,
    };
};

const buildCountQuery = (
    params: QueryParams,
    whereClause: string,
    osJoinType: string,
    dataInicio: string | null,
    dataFim: string | null
): string => {
    let joins = `${osJoinType} JOIN OS ON OS.CHAMADO_OS = CAST(CHAMADO.COD_CHAMADO AS VARCHAR(20))\n`;
    joins += `${osJoinType} JOIN TAREFA ON OS.CODTRF_OS = TAREFA.COD_TAREFA AND TAREFA.EXIBECHAM_TAREFA = 1\n`;

    joins += `LEFT JOIN CLIENTE ON CHAMADO.COD_CLIENTE = CLIENTE.COD_CLIENTE\n`;
    if (params.codRecursoFilter || params.columnFilters?.NOME_RECURSO) {
        joins += `LEFT JOIN RECURSO ON CHAMADO.COD_RECURSO = RECURSO.COD_RECURSO\n`;
    }
    if (params.columnFilters?.NOME_CLASSIFICACAO) {
        joins += `LEFT JOIN CLASSIFICACAO ON CHAMADO.COD_CLASSIFICACAO = CLASSIFICACAO.COD_CLASSIFICACAO\n`;
    }

    if (params.statusFilter?.toUpperCase() === 'FINALIZADO' && dataInicio && dataFim) {
        joins += `INNER JOIN (SELECT COD_CHAMADO FROM HISTCHAMADO WHERE UPPER(DESC_HISTCHAMADO) = 'FINALIZADO' AND DATA_HISTCHAMADO >= '${dataInicio}' AND DATA_HISTCHAMADO < '${dataFim}' GROUP BY COD_CHAMADO) HIST_MAX ON CHAMADO.COD_CHAMADO = HIST_MAX.COD_CHAMADO\n`;
    }

    return `SELECT COUNT(DISTINCT CHAMADO.COD_CHAMADO) AS TOTAL
FROM CHAMADO
${joins}
${whereClause}`;
};

// ==================== QUERY DE TOTAIS ====================
const buscarTotais = async (
    dataInicio: string | null,
    dataFim: string | null,
    params: QueryParams
): Promise<TotaisResult> => {
    const cacheKey = JSON.stringify({
        codCliente: params.codCliente,
        codClienteFilter: params.codClienteFilter,
        codRecursoFilter: params.codRecursoFilter,
        statusFilter: params.statusFilter,
        columnStatus: params.columnFilters?.STATUS_CHAMADO,
        columnCodChamado: params.columnFilters?.COD_CHAMADO,
        dataInicio,
        dataFim,
    });

    // ✅ CORREÇÃO 1 aplicada: reutiliza Promise em andamento
    const cached = getCachedTotais(cacheKey);
    if (cached) return cached;

    const needsClient = true;

    const whereTotais: string[] = [
        'TAREFA.EXIBECHAM_TAREFA = 1',
        'OS.CHAMADO_OS IS NOT NULL',
        "TRIM(OS.CHAMADO_OS) <> ''",
    ];
    const sqlParamsTotais: unknown[] = [];

    if (dataInicio && dataFim) {
        whereTotais.push('(OS.DTINI_OS >= ? AND OS.DTINI_OS < ?)');
        sqlParamsTotais.push(dataInicio, dataFim);
    }

    if (params.codCliente) {
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

    if (params.statusFilter && params.statusFilter.toUpperCase() !== 'TODOS') {
        whereTotais.push('UPPER(CHAMADO.STATUS_CHAMADO) LIKE UPPER(?)');
        sqlParamsTotais.push(`%${params.statusFilter}%`);
    } else if (!params.statusFilter) {
        whereTotais.push("UPPER(CHAMADO.STATUS_CHAMADO) <> 'FINALIZADO'");
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
        CASE WHEN UPPER(OS.FATURADO_OS) <> 'NAO' THEN
            (CAST(SUBSTRING(OS.HRFIM_OS FROM 1 FOR 2) AS INTEGER) * 60 +
            CAST(SUBSTRING(OS.HRFIM_OS FROM 3 FOR 2) AS INTEGER) -
            CAST(SUBSTRING(OS.HRINI_OS FROM 1 FOR 2) AS INTEGER) * 60 -
            CAST(SUBSTRING(OS.HRINI_OS FROM 3 FOR 2) AS INTEGER)) / 60.0
        ELSE 0 END
    ) AS TOTAL_HORAS,
    SUM(
        CASE WHEN UPPER(OS.FATURADO_OS) = 'NAO' THEN
            (CAST(SUBSTRING(OS.HRFIM_OS FROM 1 FOR 2) AS INTEGER) * 60 +
            CAST(SUBSTRING(OS.HRFIM_OS FROM 3 FOR 2) AS INTEGER) -
            CAST(SUBSTRING(OS.HRINI_OS FROM 1 FOR 2) AS INTEGER) * 60 -
            CAST(SUBSTRING(OS.HRINI_OS FROM 3 FOR 2) AS INTEGER)) / 60.0
        ELSE 0 END) AS TOTAL_HORAS_OS_NAO_FATURADAS,
    SUM(
        CASE WHEN UPPER(OS.FATURADO_OS) <> 'NAO' THEN
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

    const promise = firebirdQuery<{
        TOTAL_OS: number;
        TOTAL_HORAS: number | null;
        TOTAL_HORAS_OS_NAO_FATURADAS: number;
        TOTAL_HORAS_OS_FATURADAS: number;
    }>(sqlTotais, sqlParamsTotais).then((totaisResult) => ({
        totalOS: totaisResult[0]?.TOTAL_OS || 0,
        totalHoras: totaisResult[0]?.TOTAL_HORAS || 0,
        totalHorasNaoFaturadas: totaisResult[0]?.TOTAL_HORAS_OS_NAO_FATURADAS || 0,
        totalHorasFaturadas: totaisResult[0]?.TOTAL_HORAS_OS_FATURADAS || 0,
    }));

    setCachedTotais(cacheKey, promise);
    return promise;
};

// ==================== BUSCAR NOMES (CORREÇÃO 1 APLICADA) ====================
const buscarNomes = async (
    codCliente?: string,
    codRecurso?: string
): Promise<{ cliente: string | null; recurso: string | null }> => {
    const promises: Promise<string | null>[] = [];

    if (codCliente) {
        let clientePromise = getCachedNome(nomeClienteCache, codCliente);
        if (!clientePromise) {
            clientePromise = firebirdQuery<{ NOME_CLIENTE: string }>(
                'SELECT NOME_CLIENTE FROM CLIENTE WHERE COD_CLIENTE = ?',
                [parseInt(codCliente)]
            )
                .then((r) => r[0]?.NOME_CLIENTE || null)
                .catch(() => null);
            setCachedNome(nomeClienteCache, codCliente, clientePromise);
        }
        promises.push(clientePromise);
    } else {
        promises.push(Promise.resolve(null));
    }

    if (codRecurso) {
        let recursoPromise = getCachedNome(nomeRecursoCache, codRecurso);
        if (!recursoPromise) {
            recursoPromise = firebirdQuery<{ NOME_RECURSO: string }>(
                'SELECT NOME_RECURSO FROM RECURSO WHERE COD_RECURSO = ?',
                [parseInt(codRecurso)]
            )
                .then((r) => r[0]?.NOME_RECURSO || null)
                .catch(() => null);
            setCachedNome(nomeRecursoCache, codRecurso, recursoPromise);
        }
        promises.push(recursoPromise);
    } else {
        promises.push(Promise.resolve(null));
    }

    const [cliente, recurso] = await Promise.all(promises);
    return { cliente, recurso };
};

// ==================== PROCESSAMENTO (SLA) ====================
const processarChamados = (chamados: ChamadoRaw[], incluirSLA: boolean): Chamado[] => {
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
            DATA_INICIO_ATENDIMENTO: c.DATA_INICIO_ATENDIMENTO || null,
            HORA_INICIO_ATENDIMENTO: c.HORA_INICIO_ATENDIMENTO || null,
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

        const codClienteAplicado = params.codClienteFilter || params.codCliente;

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
    totaisCache.clear();
}
