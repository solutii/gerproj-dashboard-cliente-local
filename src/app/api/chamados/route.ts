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
    DTINI_CHAMADO: string | null; // ✅ ADICIONAR
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
    DTINI_CHAMADO: string | null; // ✅ ADICIONAR
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
    DATA_HISTCHAMADO?: Date | null;
    HORA_HISTCHAMADO?: string | null;
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
        // Para admin, mes e ano continuam obrigatórios
        mes = Number(sp.get('mes'));
        ano = Number(sp.get('ano'));

        if (!mes || mes < 1 || mes > 12) {
            return NextResponse.json({ error: "Parâmetro 'mes' inválido" }, { status: 400 });
        }

        if (!ano || ano < 2000 || ano > 3000) {
            return NextResponse.json({ error: "Parâmetro 'ano' inválido" }, { status: 400 });
        }
    } else {
        // Para não admin
        const mesParam = sp.get('mes');
        const anoParam = sp.get('ano');

        // ✅ NOVA LÓGICA: Se status for FINALIZADO, mes e ano são obrigatórios
        if (statusFilter?.toUpperCase() === 'FINALIZADO') {
            mes = Number(mesParam);
            ano = Number(anoParam);

            if (!mes || mes < 1 || mes > 12) {
                return NextResponse.json(
                    { error: "Parâmetro 'mes' é obrigatório quando status = FINALIZADO" },
                    { status: 400 }
                );
            }

            if (!ano || ano < 2000 || ano > 3000) {
                return NextResponse.json(
                    { error: "Parâmetro 'ano' é obrigatório quando status = FINALIZADO" },
                    { status: 400 }
                );
            }
        } else {
            // ✅ MODIFICAÇÃO: Para status diferente de FINALIZADO, aceita apenas ano
            ano = anoParam ? Number(anoParam) : undefined;
            mes = mesParam ? Number(mesParam) : undefined;

            // Validação do ano (se fornecido)
            if (ano && (ano < 2000 || ano > 3000)) {
                return NextResponse.json({ error: "Parâmetro 'ano' inválido" }, { status: 400 });
            }

            // Validação do mês (se fornecido)
            if (mes && (mes < 1 || mes > 12)) {
                return NextResponse.json({ error: "Parâmetro 'mes' inválido" }, { status: 400 });
            }

            // ✅ Se informou mês mas não informou ano, retorna erro
            if (mes && !ano) {
                return NextResponse.json(
                    { error: "Se informar 'mes', deve informar 'ano' também" },
                    { status: 400 }
                );
            }
        }
    }

    if (!isAdmin && !codCliente) {
        return NextResponse.json({ error: "Parâmetro 'codCliente' obrigatório" }, { status: 400 });
    }

    const page = Number(sp.get('page')) || 1;
    const limit = Number(sp.get('limit')) || 50;

    if (page < 1) {
        return NextResponse.json({ error: "Parâmetro 'page' deve ser >= 1" }, { status: 400 });
    }

    if (limit < 1 || limit > 500) {
        return NextResponse.json(
            { error: "Parâmetro 'limit' deve estar entre 1 e 500" },
            { status: 400 }
        );
    }

    const columnFilters: Record<string, string> = {};
    for (const [key, value] of sp.entries()) {
        if (key.startsWith('filter_')) {
            const columnId = key.replace('filter_', '');
            columnFilters[columnId] = value;
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
    // ✅ MODIFICAÇÃO: Se não houver ano, retorna null
    if (!ano) {
        return { dataInicio: null, dataFim: null };
    }

    // ✅ NOVA LÓGICA: Se tiver ano mas não tiver mês, usa o ano inteiro
    if (!mes) {
        const dataInicio = `01.01.${ano}`;
        const dataFim = `01.01.${ano + 1}`;
        return { dataInicio, dataFim };
    }

    // Lógica original: mes + ano
    const m = mes.toString().padStart(2, '0');
    const dataInicio = `01.${m}.${ano}`;
    const dataFim =
        mes === 12 ? `01.01.${ano + 1}` : `01.${(mes + 1).toString().padStart(2, '0')}.${ano}`;
    return { dataInicio, dataFim };
};

// ==================== QUERY ÚNICA OTIMIZADA ====================
const buscarChamadosComTotais = async (
    dataInicio: string | null,
    dataFim: string | null,
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

        const incluirAvaliacao =
            !params.statusFilter || params.statusFilter.toUpperCase().includes('FINALIZADO');
        const camposChamado = incluirAvaliacao
            ? CAMPOS_CHAMADO_BASE + CAMPOS_AVALIACAO
            : CAMPOS_CHAMADO_BASE;

        // ===== CONSTRUIR WHERE CLAUSES =====
        const whereClauses: string[] = [];
        const whereParams: any[] = [];

        if (params.isAdmin) {
            // Para admin, sempre filtrar por data (mes + ano obrigatórios)
            whereClauses.push(`(CHAMADO.DATA_CHAMADO >= ? AND CHAMADO.DATA_CHAMADO < ?)`);
            whereParams.push(dataInicio, dataFim);

            // ✅ ADMIN NÃO FILTRA POR STATUS AUTOMATICAMENTE
            // Apenas se o usuário explicitamente filtrar
        } else {
            // Para não admin
            whereClauses.push(`CHAMADO.COD_CLIENTE = ?`);
            whereParams.push(parseInt(params.codCliente!));

            // ✅ MODIFICAÇÃO: Aplica filtro de data se houver ano (com ou sem mês)
            if (dataInicio && dataFim) {
                whereClauses.push(`(CHAMADO.DATA_CHAMADO >= ? AND CHAMADO.DATA_CHAMADO < ?)`);
                whereParams.push(dataInicio, dataFim);
            }

            // ✅ IMPORTANTE: Para NÃO-ADMIN, se não houver filtro de status,
            // buscar apenas chamados NÃO FINALIZADOS
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

        // Aplicar filtros de coluna
        if (params.columnFilters) {
            if (params.columnFilters.COD_CHAMADO) {
                const codChamado = params.columnFilters.COD_CHAMADO.replace(/\D/g, '');
                if (codChamado) {
                    whereClauses.push(`CAST(CHAMADO.COD_CHAMADO AS VARCHAR(20)) LIKE ?`);
                    whereParams.push(`%${codChamado}%`);
                }
            }

            if (params.columnFilters.DATA_CHAMADO) {
                const dateNumbers = params.columnFilters.DATA_CHAMADO.replace(/\D/g, '');
                if (dateNumbers) {
                    whereClauses.push(`(
                        CAST(EXTRACT(DAY FROM CHAMADO.DATA_CHAMADO) AS VARCHAR(2)) ||
                        CAST(EXTRACT(MONTH FROM CHAMADO.DATA_CHAMADO) AS VARCHAR(2)) ||
                        CAST(EXTRACT(YEAR FROM CHAMADO.DATA_CHAMADO) AS VARCHAR(4))
                    ) LIKE ?`);
                    whereParams.push(`%${dateNumbers}%`);
                }
            }

            if (params.columnFilters.PRIOR_CHAMADO) {
                const prioridade = params.columnFilters.PRIOR_CHAMADO.replace(/\D/g, '');
                if (prioridade) {
                    whereClauses.push(`CHAMADO.PRIOR_CHAMADO = ?`);
                    whereParams.push(parseInt(prioridade));
                }
            }

            if (params.columnFilters.ASSUNTO_CHAMADO) {
                whereClauses.push(`UPPER(CHAMADO.ASSUNTO_CHAMADO) LIKE UPPER(?)`);
                whereParams.push(`%${params.columnFilters.ASSUNTO_CHAMADO}%`);
            }

            if (params.columnFilters.EMAIL_CHAMADO) {
                whereClauses.push(`UPPER(CHAMADO.EMAIL_CHAMADO) LIKE UPPER(?)`);
                whereParams.push(`%${params.columnFilters.EMAIL_CHAMADO}%`);
            }

            if (params.columnFilters.NOME_CLASSIFICACAO) {
                whereClauses.push(`CLASSIFICACAO.NOME_CLASSIFICACAO = ?`);
                whereParams.push(params.columnFilters.NOME_CLASSIFICACAO);
            }

            if (params.columnFilters.DTENVIO_CHAMADO) {
                const dateNumbers = params.columnFilters.DTENVIO_CHAMADO.replace(/\D/g, '');
                if (dateNumbers) {
                    whereClauses.push(`(
                        CAST(EXTRACT(DAY FROM CHAMADO.DTENVIO_CHAMADO) AS VARCHAR(2)) ||
                        CAST(EXTRACT(MONTH FROM CHAMADO.DTENVIO_CHAMADO) AS VARCHAR(2)) ||
                        CAST(EXTRACT(YEAR FROM CHAMADO.DTENVIO_CHAMADO) AS VARCHAR(4))
                    ) LIKE ?`);
                    whereParams.push(`%${dateNumbers}%`);
                }
            }

            if (params.columnFilters.NOME_RECURSO) {
                whereClauses.push(`RECURSO.NOME_RECURSO = ?`);
                whereParams.push(params.columnFilters.NOME_RECURSO);
            }

            if (params.columnFilters.STATUS_CHAMADO && !params.statusFilter) {
                whereClauses.push(`CHAMADO.STATUS_CHAMADO = ?`);
                whereParams.push(params.columnFilters.STATUS_CHAMADO);
            }

            if (params.columnFilters.CONCLUSAO_CHAMADO) {
                const dateNumbers = params.columnFilters.CONCLUSAO_CHAMADO.replace(/\D/g, '');
                if (dateNumbers) {
                    whereClauses.push(`(
                        CAST(EXTRACT(DAY FROM CHAMADO.CONCLUSAO_CHAMADO) AS VARCHAR(2)) ||
                        CAST(EXTRACT(MONTH FROM CHAMADO.CONCLUSAO_CHAMADO) AS VARCHAR(2)) ||
                        CAST(EXTRACT(YEAR FROM CHAMADO.CONCLUSAO_CHAMADO) AS VARCHAR(4))
                    ) LIKE ?`);
                    whereParams.push(`%${dateNumbers}%`);
                }
            }
        }

        const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        const sqlCount = `SELECT COUNT(DISTINCT CHAMADO.COD_CHAMADO) AS TOTAL
FROM CHAMADO
LEFT JOIN CLIENTE ON CHAMADO.COD_CLIENTE = CLIENTE.COD_CLIENTE
LEFT JOIN RECURSO ON CHAMADO.COD_RECURSO = RECURSO.COD_RECURSO
LEFT JOIN CLASSIFICACAO ON CHAMADO.COD_CLASSIFICACAO = CLASSIFICACAO.COD_CLASSIFICACAO
${whereClause}`;

        const offset = (params.page - 1) * params.limit;

        // ✅ Para query de OS, usar datas se disponíveis, senão usar intervalo amplo
        const osDataInicio = dataInicio || '01.01.2000';
        const osDataFim = dataFim || '31.12.2099';

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
    AND UPPER(OS.FATURADO_OS) <> 'NAO'  -- ✅ ADICIONAR ESTA LINHA
LEFT JOIN TAREFA ON OS.CODTRF_OS = TAREFA.COD_TAREFA AND TAREFA.EXIBECHAM_TAREFA = 1
LEFT JOIN HISTCHAMADO ON CHAMADO.COD_CHAMADO = HISTCHAMADO.COD_CHAMADO
    AND UPPER(HISTCHAMADO.DESC_HISTCHAMADO) = 'FINALIZADO'
${whereClause}
GROUP BY ${camposChamado}
ORDER BY CHAMADO.DATA_CHAMADO DESC, CHAMADO.HORA_CHAMADO DESC
ROWS ${offset + 1} TO ${offset + params.limit}`;

        const sqlParamsChamados = [osDataInicio, osDataFim, ...whereParams];

        // Query de totais
        let sqlTotais = `SELECT
    COUNT(DISTINCT OS.COD_OS) AS TOTAL_OS,
    SUM((CAST(SUBSTRING(OS.HRFIM_OS FROM 1 FOR 2) AS INTEGER) * 60 +
         CAST(SUBSTRING(OS.HRFIM_OS FROM 3 FOR 2) AS INTEGER) -
         CAST(SUBSTRING(OS.HRINI_OS FROM 1 FOR 2) AS INTEGER) * 60 -
         CAST(SUBSTRING(OS.HRINI_OS FROM 3 FOR 2) AS INTEGER)) / 60.0) AS TOTAL_HORAS
FROM OS
INNER JOIN TAREFA ON OS.CODTRF_OS = TAREFA.COD_TAREFA`;

        if (params.statusFilter || params.columnFilters?.STATUS_CHAMADO) {
            sqlTotais += ` LEFT JOIN CHAMADO ON OS.CHAMADO_OS = CAST(CHAMADO.COD_CHAMADO AS VARCHAR(20))`;
        }

        if (needsClient) {
            sqlTotais += `
INNER JOIN PROJETO ON TAREFA.CODPRO_TAREFA = PROJETO.COD_PROJETO
INNER JOIN CLIENTE ON PROJETO.CODCLI_PROJETO = CLIENTE.COD_CLIENTE`;
        }

        if (params.codRecursoFilter || params.columnFilters?.NOME_RECURSO) {
            sqlTotais += ` LEFT JOIN RECURSO ON OS.CODREC_OS = RECURSO.COD_RECURSO`;
        }

        const whereTotais: string[] = [
            'OS.DTINI_OS >= ?',
            'OS.DTINI_OS < ?',
            'TAREFA.EXIBECHAM_TAREFA = 1',
            'OS.CHAMADO_OS IS NOT NULL',
            "TRIM(OS.CHAMADO_OS) <> ''",
            "UPPER(OS.FATURADO_OS) <> 'NAO'",
        ];

        const sqlParamsTotais: any[] = [osDataInicio, osDataFim];

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
            const codChamado = params.columnFilters.COD_CHAMADO.replace(/\D/g, '');
            if (codChamado) {
                whereTotais.push('OS.CHAMADO_OS LIKE ?');
                sqlParamsTotais.push(`%${codChamado}%`);
            }
        }

        sqlTotais += ` WHERE ${whereTotais.join(' AND ')}`;

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
const processarChamados = (chamados: ChamadoRaw[], incluirSLA: boolean): Chamado[] => {
    return chamados.map((c) => {
        const chamadoBase: Chamado = {
            COD_CHAMADO: c.COD_CHAMADO,
            DATA_CHAMADO: c.DATA_CHAMADO,
            HORA_CHAMADO: c.HORA_CHAMADO ?? '',
            SOLICITACAO_CHAMADO: c.SOLICITACAO_CHAMADO || null,
            CONCLUSAO_CHAMADO: c.CONCLUSAO_CHAMADO || null,
            STATUS_CHAMADO: c.STATUS_CHAMADO,
            DTENVIO_CHAMADO: c.DTENVIO_CHAMADO || null,
            DTINI_CHAMADO: c.DTINI_CHAMADO || null, // ✅ ADICIONAR
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
            DATA_HISTCHAMADO: c.DATA_HISTCHAMADO || null,
            HORA_HISTCHAMADO: c.HORA_HISTCHAMADO || null,
        };

        // ✅ Se incluirSLA = false OU já iniciou atendimento, retorna sem SLA
        if (!incluirSLA || c.DTINI_CHAMADO) {
            return chamadoBase;
        }

        // ✅ Calcular SLA apenas para chamados que ainda não iniciaram atendimento
        try {
            const sla = calcularStatusSLA(
                c.DATA_CHAMADO,
                c.HORA_CHAMADO ?? '00:00',
                c.PRIOR_CHAMADO ?? 100,
                c.STATUS_CHAMADO,
                c.DTINI_CHAMADO ? new Date(c.DTINI_CHAMADO) : null, // ✅ USAR DTINI_CHAMADO
                'resolucao'
            );

            const config = SLA_CONFIGS[c.PRIOR_CHAMADO ?? 100] || SLA_CONFIGS[100];

            return {
                ...chamadoBase,
                SLA_STATUS: sla.status,
                SLA_PERCENTUAL: sla.percentualUsado,
                SLA_TEMPO_DECORRIDO: sla.tempoDecorrido,
                SLA_TEMPO_RESTANTE: sla.tempoRestante,
                SLA_PRAZO_TOTAL: config.tempoResolucao,
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

        // ✅ ADICIONAR: Verificar se deve incluir SLA
        const incluirSLA = searchParams.get('incluirSLA') !== 'false'; // true por padrão

        const { dataInicio, dataFim } = construirDatas(params.mes, params.ano);

        const codClienteAplicado =
            params.codClienteFilter || (!params.isAdmin ? params.codCliente : undefined);

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

        // ✅ MODIFICAR: Passar incluirSLA para processarChamados
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
}
