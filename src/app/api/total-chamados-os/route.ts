import { NextResponse } from 'next/server';
import { firebirdQuery } from '../../../lib/firebird/firebird-client';

// ==================== TIPOS ====================
interface QueryParams {
  isAdmin: boolean;
  codCliente?: string;
  mes: number;
  ano: number;
  codClienteFilter?: string;
  codRecursoFilter?: string;
  status?: string;
}

interface ResultadoTotalizadores {
  TOTAL_CHAMADOS: number;
  TOTAL_OS: number;
}

// ==================== VALIDAÇÕES ====================
function validarParametros(
  searchParams: URLSearchParams,
): QueryParams | NextResponse {
  const isAdmin = searchParams.get('isAdmin') === 'true';
  const codCliente = searchParams.get('codCliente')?.trim() || undefined;
  const mes = Number(searchParams.get('mes'));
  const ano = Number(searchParams.get('ano'));

  if (!mes || mes < 1 || mes > 12) {
    return NextResponse.json(
      { error: "Parâmetro 'mes' deve ser um número entre 1 e 12" },
      { status: 400 },
    );
  }

  if (!ano || ano < 2000 || ano > 3000) {
    return NextResponse.json(
      { error: "Parâmetro 'ano' deve ser um número válido" },
      { status: 400 },
    );
  }

  if (!isAdmin && !codCliente) {
    return NextResponse.json(
      { error: "Parâmetro 'codCliente' é obrigatório para usuários não admin" },
      { status: 400 },
    );
  }

  return {
    isAdmin,
    codCliente,
    mes,
    ano,
    codClienteFilter: searchParams.get('codClienteFilter')?.trim() || undefined,
    codRecursoFilter: searchParams.get('codRecursoFilter')?.trim() || undefined,
    status: searchParams.get('status')?.trim() || undefined,
  };
}

// ==================== CONSTRUÇÃO DE DATAS ====================
function construirDatas(
  mes: number,
  ano: number,
): { dataInicio: string; dataFim: string } {
  const mesFormatado = mes.toString().padStart(2, '0');
  const dataInicio = `01.${mesFormatado}.${ano}`;

  const dataFim =
    mes === 12
      ? `01.01.${ano + 1}`
      : `01.${(mes + 1).toString().padStart(2, '0')}.${ano}`;

  return { dataInicio, dataFim };
}

// ==================== CONSTRUÇÃO DE SQL OTIMIZADO ====================
function construirSQLTotalizadoresOtimizado(params: QueryParams): string {
  // Query unificada que calcula tudo de uma vez
  let sql = `
  WITH OS_VALIDAS AS (
    SELECT 
      CAST(OS.CHAMADO_OS AS INTEGER) AS COD_CHAMADO_OS,
      OS.CHAMADO_OS
    FROM OS
    INNER JOIN TAREFA ON OS.CODTRF_OS = TAREFA.COD_TAREFA
    INNER JOIN PROJETO ON TAREFA.CODPRO_TAREFA = PROJETO.COD_PROJETO
    INNER JOIN CLIENTE ON PROJETO.CODCLI_PROJETO = CLIENTE.COD_CLIENTE
    INNER JOIN RECURSO ON OS.CODREC_OS = RECURSO.COD_RECURSO
    LEFT JOIN CHAMADO ON CASE WHEN TRIM(OS.CHAMADO_OS) = '' THEN NULL ELSE CAST(OS.CHAMADO_OS AS INTEGER) END = CHAMADO.COD_CHAMADO
    WHERE OS.DTINI_OS >= ? 
      AND OS.DTINI_OS < ?
      AND TAREFA.EXIBECHAM_TAREFA = 1
      AND OS.CHAMADO_OS IS NOT NULL
      AND OS.CHAMADO_OS <> ''
  `;

  return sql;
}

function aplicarFiltrosOS(sql: string, params: QueryParams): string {
  if (!params.isAdmin && params.codCliente) {
    sql += ` AND CLIENTE.COD_CLIENTE = ?`;
  }

  if (params.codClienteFilter) {
    sql += ` AND CLIENTE.COD_CLIENTE = ?`;
  }

  if (params.codRecursoFilter) {
    sql += ` AND RECURSO.COD_RECURSO = ?`;
  }

  if (params.status) {
    sql += ` AND UPPER(CHAMADO.STATUS_CHAMADO) LIKE UPPER(?)`;
  }

  return sql;
}

function construirSQLCompleto(params: QueryParams): string {
  let sqlBase = construirSQLTotalizadoresOtimizado(params);
  sqlBase = aplicarFiltrosOS(sqlBase, params);

  // Continua a CTE com a parte de chamados
  let sqlChamados = '';

  if (params.isAdmin) {
    sqlChamados = `
  ),
  CHAMADOS_PERIODO AS (
    SELECT DISTINCT CHAMADO.COD_CHAMADO
    FROM CHAMADO
    WHERE CHAMADO.DATA_CHAMADO >= ? 
      AND CHAMADO.DATA_CHAMADO < ?
  ),
  CHAMADOS_COM_OS AS (
    SELECT DISTINCT COD_CHAMADO_OS AS COD_CHAMADO
    FROM OS_VALIDAS
  ),
  TODOS_CHAMADOS AS (
    SELECT COD_CHAMADO FROM CHAMADOS_PERIODO
    UNION
    SELECT COD_CHAMADO FROM CHAMADOS_COM_OS
  ),
  CHAMADOS_FILTRADOS AS (
    SELECT TC.COD_CHAMADO
    FROM TODOS_CHAMADOS TC
    INNER JOIN CHAMADO ON TC.COD_CHAMADO = CHAMADO.COD_CHAMADO
    WHERE 1=1
    `;
  } else {
    sqlChamados = `
  ),
  CHAMADOS_COM_OS AS (
    SELECT DISTINCT COD_CHAMADO_OS AS COD_CHAMADO
    FROM OS_VALIDAS
  ),
  CHAMADOS_FILTRADOS AS (
    SELECT CCO.COD_CHAMADO
    FROM CHAMADOS_COM_OS CCO
    INNER JOIN CHAMADO ON CCO.COD_CHAMADO = CHAMADO.COD_CHAMADO
    WHERE 1=1
    `;
  }

  // Aplicar filtros de chamado
  if (!params.isAdmin && params.codCliente) {
    sqlChamados += ` AND CHAMADO.COD_CLIENTE = ?`;
  }

  if (params.codClienteFilter) {
    sqlChamados += ` AND CHAMADO.COD_CLIENTE = ?`;
  }

  if (params.codRecursoFilter) {
    sqlChamados += ` AND CHAMADO.COD_RECURSO = ?`;
  }

  if (params.status) {
    sqlChamados += ` AND UPPER(CHAMADO.STATUS_CHAMADO) LIKE UPPER(?)`;
  }

  // Finalizar query com contagens
  const sqlFinal = `
  )
  SELECT 
    (SELECT COUNT(DISTINCT COD_CHAMADO) FROM CHAMADOS_FILTRADOS) AS TOTAL_CHAMADOS,
    (SELECT COUNT(*) FROM OS_VALIDAS) AS TOTAL_OS
  FROM RDB$DATABASE
  `;

  return sqlBase + sqlChamados + sqlFinal;
}

function construirParametros(
  params: QueryParams,
  dataInicio: string,
  dataFim: string,
): any[] {
  const parametros: any[] = [dataInicio, dataFim];

  // Filtros de OS
  if (!params.isAdmin && params.codCliente) {
    parametros.push(parseInt(params.codCliente));
  }

  if (params.codClienteFilter) {
    parametros.push(parseInt(params.codClienteFilter));
  }

  if (params.codRecursoFilter) {
    parametros.push(parseInt(params.codRecursoFilter));
  }

  if (params.status) {
    parametros.push(`%${params.status}%`);
  }

  // Para admin, adicionar data de chamados
  if (params.isAdmin) {
    parametros.push(dataInicio, dataFim);
  }

  // Filtros de chamado (repetir os mesmos filtros)
  if (!params.isAdmin && params.codCliente) {
    parametros.push(parseInt(params.codCliente));
  }

  if (params.codClienteFilter) {
    parametros.push(parseInt(params.codClienteFilter));
  }

  if (params.codRecursoFilter) {
    parametros.push(parseInt(params.codRecursoFilter));
  }

  if (params.status) {
    parametros.push(`%${params.status}%`);
  }

  return parametros;
}

// ==================== HANDLER PRINCIPAL ====================
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const params = validarParametros(searchParams);
    if (params instanceof NextResponse) return params;

    const { dataInicio, dataFim } = construirDatas(params.mes, params.ano);

    // Query unificada - tudo em uma única execução
    const sqlCompleto = construirSQLCompleto(params);
    const parametros = construirParametros(params, dataInicio, dataFim);

    const resultado = await firebirdQuery<ResultadoTotalizadores>(
      sqlCompleto,
      parametros,
    );

    const totalizadores: ResultadoTotalizadores = resultado[0] || {
      TOTAL_CHAMADOS: 0,
      TOTAL_OS: 0,
    };

    return NextResponse.json(totalizadores);
  } catch (error) {
    console.error('[API TOTALIZADORES] Erro ao buscar totalizadores:', error);
    console.error(
      '[API TOTALIZADORES] Stack:',
      error instanceof Error ? error.stack : 'N/A',
    );

    return NextResponse.json(
      {
        error: 'Erro interno do servidor',
        message: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 },
    );
  }
}
