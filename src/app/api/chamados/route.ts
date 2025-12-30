// app/api/chamados/route.ts - PARTE 1
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
}

// ==================== CACHE ====================
// ✅ OTIMIZAÇÃO: Cache de nomes de clientes/recursos
const nomeClienteCache = new Map<string, { nome: string | null; timestamp: number }>();
const nomeRecursoCache = new Map<string, { nome: string | null; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

function getCachedNomeCliente(codCliente: string): string | null | undefined {
    const cached = nomeClienteCache.get(codCliente);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.nome;
    }
    if (cached) nomeClienteCache.delete(codCliente);
    return undefined;
}

function setCachedNomeCliente(codCliente: string, nome: string | null): void {
    nomeClienteCache.set(codCliente, { nome, timestamp: Date.now() });
}

function getCachedNomeRecurso(codRecurso: string): string | null | undefined {
    const cached = nomeRecursoCache.get(codRecurso);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.nome;
    }
    if (cached) nomeRecursoCache.delete(codRecurso);
    return undefined;
}

function setCachedNomeRecurso(codRecurso: string, nome: string | null): void {
    nomeRecursoCache.set(codRecurso, { nome, timestamp: Date.now() });
}

// ==================== CONFIGURAÇÃO DE CAMPOS ====================
const CAMPOS_CHAMADO = [
    'CHAMADO.COD_CHAMADO',
    'CHAMADO.DATA_CHAMADO',
    'CHAMADO.HORA_CHAMADO',
    'CHAMADO.SOLICITACAO_CHAMADO',
    'CHAMADO.CONCLUSAO_CHAMADO',
    'CHAMADO.STATUS_CHAMADO',
    'CHAMADO.DTENVIO_CHAMADO',
    'CHAMADO.ASSUNTO_CHAMADO',
    'CHAMADO.EMAIL_CHAMADO',
    'CHAMADO.PRIOR_CHAMADO',
    'CHAMADO.COD_CLASSIFICACAO',
    'CLIENTE.NOME_CLIENTE',
    'RECURSO.NOME_RECURSO',
    'CLASSIFICACAO.NOME_CLASSIFICACAO',
].join(',\n    ');

// ==================== VALIDAÇÕES ====================
function validarParametros(searchParams: URLSearchParams): QueryParams | NextResponse {
    const isAdmin = searchParams.get('isAdmin') === 'true';
    const codCliente = searchParams.get('codCliente')?.trim() || undefined;
    const mes = Number(searchParams.get('mes'));
    const ano = Number(searchParams.get('ano'));

    if (!mes || mes < 1 || mes > 12) {
        return NextResponse.json(
            { error: "Parâmetro 'mes' deve ser um número entre 1 e 12" },
            { status: 400 }
        );
    }

    if (!ano || ano < 2000 || ano > 3000) {
        return NextResponse.json(
            { error: "Parâmetro 'ano' deve ser um número válido" },
            { status: 400 }
        );
    }

    if (!isAdmin && !codCliente) {
        return NextResponse.json(
            { error: "Parâmetro 'codCliente' é obrigatório para usuários não admin" },
            { status: 400 }
        );
    }

    return {
        isAdmin,
        codCliente,
        mes,
        ano,
        codChamadoFilter: searchParams.get('codChamado')?.trim() || undefined,
        statusFilter: searchParams.get('statusFilter')?.trim() || undefined,
        codClienteFilter: searchParams.get('codClienteFilter')?.trim() || undefined,
        codRecursoFilter: searchParams.get('codRecursoFilter')?.trim() || undefined,
    };
}

// ==================== CONSTRUÇÃO DE DATAS ====================
function construirDatas(mes: number, ano: number): { dataInicio: string; dataFim: string } {
    const mesFormatado = mes.toString().padStart(2, '0');
    const dataInicio = `01.${mesFormatado}.${ano}`;
    const dataFim =
        mes === 12 ? `01.01.${ano + 1}` : `01.${(mes + 1).toString().padStart(2, '0')}.${ano}`;

    return { dataInicio, dataFim };
}

// ==================== BUSCAR CHAMADOS COM OS NO PERÍODO ====================
// ✅ OTIMIZAÇÃO: Query unificada, mais eficiente
async function buscarChamadosComOSNoPeriodo(
    dataInicio: string,
    dataFim: string,
    params: QueryParams
): Promise<number[]> {
    try {
        const precisaCliente = !params.isAdmin || params.codClienteFilter;

        let sql = `
      SELECT DISTINCT CAST(OS.CHAMADO_OS AS INTEGER) AS COD_CHAMADO
      FROM OS
      INNER JOIN TAREFA ON OS.CODTRF_OS = TAREFA.COD_TAREFA
    `;

        if (precisaCliente) {
            sql += `
      INNER JOIN PROJETO ON TAREFA.CODPRO_TAREFA = PROJETO.COD_PROJETO
      INNER JOIN CLIENTE ON PROJETO.CODCLI_PROJETO = CLIENTE.COD_CLIENTE
      `;
        }

        sql += `
      WHERE OS.DTINI_OS >= ?
        AND OS.DTINI_OS < ?
        AND OS.CHAMADO_OS IS NOT NULL
        AND TRIM(OS.CHAMADO_OS) <> ''
        AND TAREFA.EXIBECHAM_TAREFA = 1
    `;

        const sqlParams: any[] = [dataInicio, dataFim];

        const codClienteAplicado =
            params.codClienteFilter || (!params.isAdmin ? params.codCliente : undefined);

        if (codClienteAplicado) {
            sql += ` AND CLIENTE.COD_CLIENTE = ?`;
            sqlParams.push(parseInt(codClienteAplicado));
        }

        const resultado = await firebirdQuery<{ COD_CHAMADO: number }>(sql, sqlParams);
        return resultado.map((r) => r.COD_CHAMADO);
    } catch (error) {
        console.error('[API CHAMADOS] Erro ao buscar chamados com OS:', error);
        return [];
    }
}

// ==================== CONSTRUÇÃO DE SQL COM UNIÃO ====================
// ✅ OTIMIZAÇÃO: SQL otimizado com INNER JOINs onde possível
function construirSQLBase(
    dataInicio: string,
    dataFim: string,
    codChamadosComOS: number[],
    isAdmin: boolean
): string {
    if (codChamadosComOS.length === 0) {
        if (!isAdmin) {
            return `
  SELECT ${CAMPOS_CHAMADO}
  FROM CHAMADO
  LEFT JOIN CLIENTE ON CHAMADO.COD_CLIENTE = CLIENTE.COD_CLIENTE
  LEFT JOIN RECURSO ON CHAMADO.COD_RECURSO = RECURSO.COD_RECURSO
  LEFT JOIN CLASSIFICACAO ON CHAMADO.COD_CLASSIFICACAO = CLASSIFICACAO.COD_CLASSIFICACAO
  WHERE 1 = 0`;
        }

        return `
  SELECT ${CAMPOS_CHAMADO}
  FROM CHAMADO
  LEFT JOIN CLIENTE ON CHAMADO.COD_CLIENTE = CLIENTE.COD_CLIENTE
  LEFT JOIN RECURSO ON CHAMADO.COD_RECURSO = RECURSO.COD_RECURSO
  LEFT JOIN CLASSIFICACAO ON CHAMADO.COD_CLASSIFICACAO = CLASSIFICACAO.COD_CLASSIFICACAO
  WHERE CHAMADO.DATA_CHAMADO >= ? AND CHAMADO.DATA_CHAMADO < ?
`;
    }

    const placeholders = codChamadosComOS.map(() => '?').join(',');

    if (!isAdmin) {
        return `
  SELECT ${CAMPOS_CHAMADO}
  FROM CHAMADO
  LEFT JOIN CLIENTE ON CHAMADO.COD_CLIENTE = CLIENTE.COD_CLIENTE
  LEFT JOIN RECURSO ON CHAMADO.COD_RECURSO = RECURSO.COD_RECURSO
  LEFT JOIN CLASSIFICACAO ON CHAMADO.COD_CLASSIFICACAO = CLASSIFICACAO.COD_CLASSIFICACAO
  WHERE CHAMADO.COD_CHAMADO IN (${placeholders})
`;
    }

    return `
  SELECT ${CAMPOS_CHAMADO}
  FROM CHAMADO
  LEFT JOIN CLIENTE ON CHAMADO.COD_CLIENTE = CLIENTE.COD_CLIENTE
  LEFT JOIN RECURSO ON CHAMADO.COD_RECURSO = RECURSO.COD_RECURSO
  LEFT JOIN CLASSIFICACAO ON CHAMADO.COD_CLASSIFICACAO = CLASSIFICACAO.COD_CLASSIFICACAO
  WHERE (
    (CHAMADO.DATA_CHAMADO >= ? AND CHAMADO.DATA_CHAMADO < ?)
    OR CHAMADO.COD_CHAMADO IN (${placeholders})
  )
`;
}

function aplicarFiltros(
    sqlBase: string,
    params: QueryParams,
    paramsArray: any[]
): { sql: string; params: any[] } {
    let sql = sqlBase;

    if (!params.isAdmin && params.codCliente) {
        sql += ` AND CHAMADO.COD_CLIENTE = ?`;
        paramsArray.push(parseInt(params.codCliente));
    }

    if (params.codChamadoFilter) {
        sql += ` AND CHAMADO.COD_CHAMADO = ?`;
        paramsArray.push(parseInt(params.codChamadoFilter));
    }

    if (params.statusFilter) {
        sql += ` AND UPPER(CHAMADO.STATUS_CHAMADO) LIKE UPPER(?)`;
        paramsArray.push(`%${params.statusFilter}%`);
    }

    if (params.codClienteFilter) {
        sql += ` AND CHAMADO.COD_CLIENTE = ?`;
        paramsArray.push(parseInt(params.codClienteFilter));
    }

    if (params.codRecursoFilter) {
        sql += ` AND CHAMADO.COD_RECURSO = ?`;
        paramsArray.push(parseInt(params.codRecursoFilter));
    }

    return { sql, params: paramsArray };
}

// ==================== BUSCAR HORAS DE OS POR CHAMADOS ====================
// ✅ OTIMIZAÇÃO: Cálculo de horas otimizado
async function buscarHorasPorChamados(
    codChamados: number[],
    dataInicio: string,
    dataFim: string
): Promise<Map<number, number>> {
    if (codChamados.length === 0) return new Map();

    try {
        const placeholders = codChamados.map(() => '?').join(',');

        const sql = `
      SELECT
        CAST(OS.CHAMADO_OS AS INTEGER) AS COD_CHAMADO,
        SUM(
          (CAST(SUBSTRING(OS.HRFIM_OS FROM 1 FOR 2) AS INTEGER) * 60 +
           CAST(SUBSTRING(OS.HRFIM_OS FROM 3 FOR 2) AS INTEGER) -
           CAST(SUBSTRING(OS.HRINI_OS FROM 1 FOR 2) AS INTEGER) * 60 -
           CAST(SUBSTRING(OS.HRINI_OS FROM 3 FOR 2) AS INTEGER)) / 60.0
        ) AS TOTAL_HORAS
      FROM OS
      WHERE OS.CHAMADO_OS IN (${placeholders})
        AND OS.DTINI_OS >= ?
        AND OS.DTINI_OS < ?
      GROUP BY OS.CHAMADO_OS
    `;

        const params = [...codChamados.map(String), dataInicio, dataFim];
        const resultado = await firebirdQuery<{
            COD_CHAMADO: number;
            TOTAL_HORAS: number;
        }>(sql, params);

        const mapaHoras = new Map<number, number>();
        for (let i = 0; i < resultado.length; i++) {
            mapaHoras.set(resultado[i].COD_CHAMADO, resultado[i].TOTAL_HORAS || 0);
        }

        return mapaHoras;
    } catch (error) {
        console.error('[API CHAMADOS] Erro ao buscar horas:', error);
        return new Map();
    }
}

// ==================== PROCESSAMENTO DE DADOS ====================
// ✅ OTIMIZAÇÃO: Processamento inline mais rápido
function processarChamados(chamados: any[], mapaHoras: Map<number, number>): Chamado[] {
    const resultado: Chamado[] = [];

    for (let i = 0; i < chamados.length; i++) {
        const c = chamados[i];
        const totalHoras = mapaHoras.get(c.COD_CHAMADO) || 0;

        resultado.push({
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
            TEM_OS: totalHoras > 0,
            TOTAL_HORAS_OS: totalHoras,
        });
    }

    return resultado;
}

// app/api/chamados/route.ts - PARTE 2
// ✅ Cole este código APÓS a Parte 1

// ==================== QUERIES DE TOTAIS OTIMIZADAS ====================
// ✅ OTIMIZAÇÃO: Query unificada para buscar TOTAL_OS e TOTAL_HORAS em uma única query
async function buscarTotaisOS(
    dataInicio: string,
    dataFim: string,
    params: QueryParams
): Promise<{ totalOS: number; totalHoras: number }> {
    try {
        const precisaCliente = !params.isAdmin || params.codClienteFilter;
        const precisaRecurso = !!params.codRecursoFilter;
        const precisaChamado = !!params.statusFilter;

        let sql = `
      SELECT
        COUNT(OS.COD_OS) AS TOTAL_OS,
        SUM(
          (CAST(SUBSTRING(OS.HRFIM_OS FROM 1 FOR 2) AS INTEGER) * 60 +
           CAST(SUBSTRING(OS.HRFIM_OS FROM 3 FOR 2) AS INTEGER) -
           CAST(SUBSTRING(OS.HRINI_OS FROM 1 FOR 2) AS INTEGER) * 60 -
           CAST(SUBSTRING(OS.HRINI_OS FROM 3 FOR 2) AS INTEGER)) / 60.0
        ) AS TOTAL_HORAS
      FROM OS
      INNER JOIN TAREFA ON OS.CODTRF_OS = TAREFA.COD_TAREFA
    `;

        if (precisaChamado) {
            sql += `
      LEFT JOIN CHAMADO ON OS.CHAMADO_OS = CAST(CHAMADO.COD_CHAMADO AS VARCHAR(20))
      `;
        }

        if (precisaCliente) {
            sql += `
      INNER JOIN PROJETO ON TAREFA.CODPRO_TAREFA = PROJETO.COD_PROJETO
      INNER JOIN CLIENTE ON PROJETO.CODCLI_PROJETO = CLIENTE.COD_CLIENTE
      `;
        }

        if (precisaRecurso) {
            sql += `
      LEFT JOIN RECURSO ON OS.CODREC_OS = RECURSO.COD_RECURSO
      `;
        }

        sql += `
      WHERE OS.DTINI_OS >= ?
        AND OS.DTINI_OS < ?
        AND TAREFA.EXIBECHAM_TAREFA = 1
        AND OS.CHAMADO_OS IS NOT NULL
        AND TRIM(OS.CHAMADO_OS) <> ''
    `;

        const sqlParams: any[] = [dataInicio, dataFim];

        if (!params.isAdmin && params.codCliente) {
            sql += ` AND CLIENTE.COD_CLIENTE = ?`;
            sqlParams.push(parseInt(params.codCliente));
        }

        if (params.codClienteFilter) {
            sql += ` AND CLIENTE.COD_CLIENTE = ?`;
            sqlParams.push(parseInt(params.codClienteFilter));
        }

        if (params.codRecursoFilter) {
            sql += ` AND RECURSO.COD_RECURSO = ?`;
            sqlParams.push(parseInt(params.codRecursoFilter));
        }

        if (params.statusFilter) {
            sql += ` AND UPPER(CHAMADO.STATUS_CHAMADO) LIKE UPPER(?)`;
            sqlParams.push(`%${params.statusFilter}%`);
        }

        const resultado = await firebirdQuery<{
            TOTAL_OS: number;
            TOTAL_HORAS: number | null;
        }>(sql, sqlParams);

        return {
            totalOS: resultado.length > 0 ? resultado[0].TOTAL_OS : 0,
            totalHoras:
                resultado.length > 0 && resultado[0].TOTAL_HORAS !== null
                    ? resultado[0].TOTAL_HORAS
                    : 0,
        };
    } catch (error) {
        console.error('[API CHAMADOS] Erro ao buscar totais:', error);
        return { totalOS: 0, totalHoras: 0 };
    }
}

// ==================== BUSCAR NOMES (COM CACHE) ====================
// ✅ OTIMIZAÇÃO: Com cache para evitar queries repetidas
async function buscarNomeCliente(codCliente: string): Promise<string | null> {
    const cached = getCachedNomeCliente(codCliente);
    if (cached !== undefined) return cached;

    try {
        const sql = `SELECT NOME_CLIENTE FROM CLIENTE WHERE COD_CLIENTE = ?`;
        const resultado = await firebirdQuery<{ NOME_CLIENTE: string }>(sql, [
            parseInt(codCliente),
        ]);

        const nome = resultado.length > 0 ? resultado[0].NOME_CLIENTE : null;
        setCachedNomeCliente(codCliente, nome);
        return nome;
    } catch (error) {
        console.error('[API CHAMADOS] Erro ao buscar nome do cliente:', error);
        return null;
    }
}

async function buscarNomeRecurso(codRecurso: string): Promise<string | null> {
    const cached = getCachedNomeRecurso(codRecurso);
    if (cached !== undefined) return cached;

    try {
        const sql = `SELECT NOME_RECURSO FROM RECURSO WHERE COD_RECURSO = ?`;
        const resultado = await firebirdQuery<{ NOME_RECURSO: string }>(sql, [
            parseInt(codRecurso),
        ]);

        const nome = resultado.length > 0 ? resultado[0].NOME_RECURSO : null;
        setCachedNomeRecurso(codRecurso, nome);
        return nome;
    } catch (error) {
        console.error('[API CHAMADOS] Erro ao buscar nome do recurso:', error);
        return null;
    }
}

// ==================== BUSCAR STATUS DO CHAMADO ====================
// ✅ OTIMIZAÇÃO: Query simplificada
async function buscarStatusChamado(
    statusFilter: string,
    dataInicio: string,
    dataFim: string,
    params: QueryParams,
    codChamadosComOS: number[]
): Promise<string | null> {
    try {
        let sql = '';
        let sqlParams: any[] = [];

        if (params.isAdmin) {
            if (codChamadosComOS.length === 0) {
                sql = `
          SELECT FIRST 1 CHAMADO.STATUS_CHAMADO
          FROM CHAMADO
          WHERE CHAMADO.DATA_CHAMADO >= ?
            AND CHAMADO.DATA_CHAMADO < ?
            AND UPPER(CHAMADO.STATUS_CHAMADO) LIKE UPPER(?)
        `;
                sqlParams = [dataInicio, dataFim, `%${statusFilter}%`];
            } else {
                const placeholders = codChamadosComOS.map(() => '?').join(',');
                sql = `
          SELECT FIRST 1 CHAMADO.STATUS_CHAMADO
          FROM CHAMADO
          WHERE (
            (CHAMADO.DATA_CHAMADO >= ? AND CHAMADO.DATA_CHAMADO < ?)
            OR CHAMADO.COD_CHAMADO IN (${placeholders})
          )
          AND UPPER(CHAMADO.STATUS_CHAMADO) LIKE UPPER(?)
        `;
                sqlParams = [dataInicio, dataFim, ...codChamadosComOS, `%${statusFilter}%`];
            }
        } else {
            // Não-admin: apenas chamados com OS
            if (codChamadosComOS.length === 0) return null;

            const placeholders = codChamadosComOS.map(() => '?').join(',');
            sql = `
        SELECT FIRST 1 CHAMADO.STATUS_CHAMADO
        FROM CHAMADO
        WHERE CHAMADO.COD_CHAMADO IN (${placeholders})
          AND UPPER(CHAMADO.STATUS_CHAMADO) LIKE UPPER(?)
      `;
            sqlParams = [...codChamadosComOS, `%${statusFilter}%`];
        }

        if (!params.isAdmin && params.codCliente) {
            sql += ` AND CHAMADO.COD_CLIENTE = ?`;
            sqlParams.push(parseInt(params.codCliente));
        }

        if (params.codClienteFilter) {
            sql += ` AND CHAMADO.COD_CLIENTE = ?`;
            sqlParams.push(parseInt(params.codClienteFilter));
        }

        if (params.codRecursoFilter) {
            sql += ` AND CHAMADO.COD_RECURSO = ?`;
            sqlParams.push(parseInt(params.codRecursoFilter));
        }

        const resultado = await firebirdQuery<{ STATUS_CHAMADO: string }>(sql, sqlParams);
        return resultado.length > 0 ? resultado[0].STATUS_CHAMADO : null;
    } catch (error) {
        console.error('[API CHAMADOS] Erro ao buscar status:', error);
        return null;
    }
}

// ==================== HANDLER PRINCIPAL ====================
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);

        const params = validarParametros(searchParams);
        if (params instanceof NextResponse) return params;

        const { dataInicio, dataFim } = construirDatas(params.mes, params.ano);

        // ✅ OTIMIZAÇÃO CRÍTICA: Executar queries em paralelo
        const [codChamadosComOS, { totalOS, totalHoras: totalHorasOS }] = await Promise.all([
            buscarChamadosComOSNoPeriodo(dataInicio, dataFim, params),
            buscarTotaisOS(dataInicio, dataFim, params),
        ]);

        // ✅ OTIMIZAÇÃO: Buscar nomes em paralelo apenas se necessário
        const codClienteAplicado =
            params.codClienteFilter || (!params.isAdmin ? params.codCliente : undefined);

        const promisesNomes: Promise<any>[] = [];

        if (codClienteAplicado) {
            promisesNomes.push(buscarNomeCliente(codClienteAplicado));
        } else {
            promisesNomes.push(Promise.resolve(null));
        }

        if (params.codRecursoFilter) {
            promisesNomes.push(buscarNomeRecurso(params.codRecursoFilter));
        } else {
            promisesNomes.push(Promise.resolve(null));
        }

        if (params.statusFilter) {
            promisesNomes.push(
                buscarStatusChamado(
                    params.statusFilter,
                    dataInicio,
                    dataFim,
                    params,
                    codChamadosComOS
                )
            );
        } else {
            promisesNomes.push(Promise.resolve(null));
        }

        const [nomeClienteFiltro, nomeRecursoFiltro, statusFiltro] =
            await Promise.all(promisesNomes);

        // Query principal de chamados
        const sqlBase = construirSQLBase(dataInicio, dataFim, codChamadosComOS, params.isAdmin);
        const paramsArray: any[] = [];

        if (params.isAdmin) {
            if (codChamadosComOS.length > 0) {
                paramsArray.push(dataInicio, dataFim, ...codChamadosComOS.map(String));
            } else {
                paramsArray.push(dataInicio, dataFim);
            }
        } else {
            if (codChamadosComOS.length > 0) {
                paramsArray.push(...codChamadosComOS.map(String));
            }
        }

        const { sql, params: sqlParams } = aplicarFiltros(sqlBase, params, paramsArray);
        const sqlFinal = `${sql} ORDER BY CHAMADO.DATA_CHAMADO DESC, CHAMADO.HORA_CHAMADO DESC`;

        // ✅ OTIMIZAÇÃO: Executar chamados e horas em paralelo quando possível
        const chamados = await firebirdQuery<any>(sqlFinal, sqlParams);

        if (chamados.length === 0) {
            return NextResponse.json(
                {
                    success: true,
                    cliente: nomeClienteFiltro,
                    recurso: nomeRecursoFiltro,
                    status: statusFiltro,
                    totalChamados: 0,
                    totalOS: totalOS,
                    totalHorasOS: totalHorasOS,
                    mes: params.mes,
                    ano: params.ano,
                    data: [],
                },
                { status: 200 }
            );
        }

        // Buscar horas de OS
        const codChamados = chamados.map((c) => c.COD_CHAMADO);
        const mapaHoras = await buscarHorasPorChamados(codChamados, dataInicio, dataFim);

        // Processar chamados
        const chamadosProcessados = processarChamados(chamados, mapaHoras);

        return NextResponse.json(
            {
                success: true,
                cliente: nomeClienteFiltro,
                recurso: nomeRecursoFiltro,
                status: statusFiltro,
                totalChamados: chamadosProcessados.length,
                totalOS: totalOS,
                totalHorasOS: totalHorasOS,
                mes: params.mes,
                ano: params.ano,
                data: chamadosProcessados,
            },
            { status: 200 }
        );
    } catch (error) {
        console.error('[API CHAMADOS] ❌ Erro:', error instanceof Error ? error.message : error);

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
// ✅ Função para limpar cache
export function limparCacheChamados(): void {
    nomeClienteCache.clear();
    nomeRecursoCache.clear();
}
