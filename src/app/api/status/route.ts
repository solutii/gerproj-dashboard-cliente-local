import { firebirdQuery } from '@/lib/firebird/firebird-client';
import { NextResponse } from 'next/server';

// ==================== TIPOS ====================
interface QueryParams {
  isAdmin: boolean;
  codCliente?: string;
  cliente?: string;
  recurso?: string;
  mes: number;
  ano: number;
}

// ==================== VALIDAÇÕES ====================
function validarParametros(
  searchParams: URLSearchParams,
): QueryParams | NextResponse {
  const isAdmin = searchParams.get('isAdmin') === 'true';
  const codCliente = searchParams.get('codCliente')?.trim();
  const cliente = searchParams.get('cliente')?.trim();
  const recurso = searchParams.get('recurso')?.trim();
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

  return { isAdmin, codCliente, cliente, recurso, mes, ano };
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

// ==================== CONSTRUÇÃO DE SQL ====================
const SQL_STATUS_BASE = `
  SELECT DISTINCT
    CHAMADO.STATUS_CHAMADO
  FROM OS
  LEFT JOIN CHAMADO ON CAST(OS.CHAMADO_OS AS INTEGER) = CHAMADO.COD_CHAMADO
  LEFT JOIN RECURSO ON OS.CODREC_OS = RECURSO.COD_RECURSO
  LEFT JOIN TAREFA ON OS.CODTRF_OS = TAREFA.COD_TAREFA
  LEFT JOIN PROJETO ON TAREFA.CODPRO_TAREFA = PROJETO.COD_PROJETO
  LEFT JOIN CLIENTE ON PROJETO.CODCLI_PROJETO = CLIENTE.COD_CLIENTE
  WHERE OS.DTINI_OS >= ? 
    AND OS.DTINI_OS < ?
    AND CHAMADO.STATUS_CHAMADO IS NOT NULL
    AND TRIM(CHAMADO.STATUS_CHAMADO) <> ''
`;

function aplicarFiltros(
  sqlBase: string,
  params: QueryParams,
  paramsArray: any[],
): { sql: string; params: any[] } {
  let sql = sqlBase;

  // Filtro obrigatório para não-admin
  if (!params.isAdmin && params.codCliente) {
    sql += ` AND CLIENTE.COD_CLIENTE = ?`;
    paramsArray.push(parseInt(params.codCliente));
  }

  // Filtro opcional por CÓDIGO de cliente (para admin)
  if (params.isAdmin && params.cliente) {
    sql += ` AND CLIENTE.COD_CLIENTE = ?`;  // ← MUDOU: COD ao invés de NOME
    paramsArray.push(parseInt(params.cliente));  // ← MUDOU: parseInt
  }

  // Filtro opcional por CÓDIGO de recurso
  if (params.recurso) {
    sql += ` AND RECURSO.COD_RECURSO = ?`;  // ← MUDOU: COD ao invés de NOME
    paramsArray.push(parseInt(params.recurso));  // ← MUDOU: parseInt
  }

  // Ordenação alfabética
  sql += ` ORDER BY CHAMADO.STATUS_CHAMADO`;

  return { sql, params: paramsArray };
}

// ==================== PROCESSAMENTO ====================
function processarStatus(resultados: any[]): string[] {
  return resultados
    .map((item) => item.STATUS_CHAMADO)
    .filter(
      (status): status is string => status != null && status.trim() !== '',
    )
    .sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
}

// ==================== HANDLER PRINCIPAL ====================
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // Validar parâmetros
    const params = validarParametros(searchParams);
    if (params instanceof NextResponse) return params;

    // Construir datas no formato Firebird DATE (DD.MM.YYYY)
    const { dataInicio, dataFim } = construirDatas(params.mes, params.ano);

    // Construir query com filtros
    const { sql: sqlFinal, params: sqlParams } = aplicarFiltros(
      SQL_STATUS_BASE,
      params,
      [dataInicio, dataFim],
    );

    // Executar query
    const statusList = await firebirdQuery(sqlFinal, sqlParams);

    // Processar e ordenar status
    const statusUnicos = processarStatus(statusList);

    return NextResponse.json(statusUnicos);
  } catch (error) {
    console.error('Erro detalhado ao buscar status:', error);
    console.error('Stack trace:', error instanceof Error ? error.stack : 'N/A');
    console.error('Message:', error instanceof Error ? error.message : error);

    return NextResponse.json(
      {
        error: 'Erro ao buscar status',
        message: error instanceof Error ? error.message : 'Erro desconhecido',
        timestamp: new Date().toISOString(),
        details: process.env.NODE_ENV === 'development' ? error : undefined,
      },
      { status: 500 },
    );
  }
}
