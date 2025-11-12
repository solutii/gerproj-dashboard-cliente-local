import { firebirdQuery } from '@/lib/firebird/firebird-client';
import { NextResponse } from 'next/server';

// ==================== TIPOS ====================
interface QueryParams {
  isAdmin: boolean;
  codCliente?: string;
  cliente?: string;
  mes: number;
  ano: number;
}

interface Recurso {
  cod: string;
  nome: string;
}

// ==================== VALIDAÇÕES ====================
function validarParametros(
  searchParams: URLSearchParams,
): QueryParams | NextResponse {
  const isAdmin = searchParams.get('isAdmin') === 'true';
  const codCliente = searchParams.get('codCliente')?.trim();
  const cliente = searchParams.get('cliente')?.trim();
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

  return { isAdmin, codCliente, cliente, mes, ano };
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
const SQL_RECURSOS_BASE = `
  SELECT DISTINCT
    RECURSO.COD_RECURSO,
    RECURSO.NOME_RECURSO
  FROM OS
  LEFT JOIN RECURSO ON OS.CODREC_OS = RECURSO.COD_RECURSO
  LEFT JOIN TAREFA ON OS.CODTRF_OS = TAREFA.COD_TAREFA
  LEFT JOIN PROJETO ON TAREFA.CODPRO_TAREFA = PROJETO.COD_PROJETO
  LEFT JOIN CLIENTE ON PROJETO.CODCLI_PROJETO = CLIENTE.COD_CLIENTE
  WHERE OS.DTINI_OS >= ? 
    AND OS.DTINI_OS < ?
    AND RECURSO.NOME_RECURSO IS NOT NULL
    AND TRIM(RECURSO.NOME_RECURSO) <> ''
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

  // Filtro opcional por código de cliente (para admin)
  if (params.isAdmin && params.cliente) {
    sql += ` AND CLIENTE.COD_CLIENTE = ?`;
    paramsArray.push(parseInt(params.cliente));
  }

  // Ordenação alfabética
  sql += ` ORDER BY RECURSO.NOME_RECURSO`;

  return { sql, params: paramsArray };
}

// ==================== PROCESSAMENTO ====================
function processarRecursos(resultados: any[]): Recurso[] {
  return resultados
    .map((item) => ({
      cod: String(item.COD_RECURSO),
      nome: item.NOME_RECURSO
    }))
    .filter((recurso) => recurso.nome && recurso.nome.trim() !== '')
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));
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
      SQL_RECURSOS_BASE,
      params,
      [dataInicio, dataFim],
    );

    // Executar query
    const recursos = await firebirdQuery(sqlFinal, sqlParams);

    // Processar e ordenar recursos
    const recursosProcessados = processarRecursos(recursos);

    return NextResponse.json(recursosProcessados);
  } catch (error) {
    console.error('Erro detalhado ao buscar recursos:', error);
    console.error('Stack trace:', error instanceof Error ? error.stack : 'N/A');
    console.error('Message:', error instanceof Error ? error.message : error);

    return NextResponse.json(
      {
        error: 'Erro ao buscar recursos',
        message: error instanceof Error ? error.message : 'Erro desconhecido',
        timestamp: new Date().toISOString(),
        details: process.env.NODE_ENV === 'development' ? error : undefined,
      },
      { status: 500 },
    );
  }
}