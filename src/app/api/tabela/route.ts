import { firebirdQuery } from '@/lib/firebird/firebird-client';
import { NextResponse } from 'next/server';

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

interface ApontamentoFirebird {
  CHAMADO_OS?: string;
  COD_OS: string;
  CODTRF_OS?: string;
  DTINI_OS: string;
  COD_CLIENTE?: number;
  NOME_CLIENTE?: string;
  STATUS_CHAMADO?: string;
  COD_RECURSO?: number;
  NOME_RECURSO?: string;
  HRINI_OS?: string;
  HRFIM_OS?: string;
  OBS_OS?: string;
  VALCLI_OS?: string;
}

interface ApontamentoProcessado {
  chamado_os: string | null;
  cod_os: string;
  codtrf_os: string | null;
  dtini_os: string;
  nome_cliente: string | null;
  status_chamado: string | null;
  nome_recurso: string | null;
  hrini_os: string | null;
  hrfim_os: string | null;
  total_horas: string;
  obs: string | null;
  valcli_os: string | null;
}

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
    codClienteFilter: searchParams.get('codClienteFilter')?.trim() || undefined,
    codRecursoFilter: searchParams.get('codRecursoFilter')?.trim() || undefined,
    status: searchParams.get('status')?.trim() || undefined
  };
}

// ==================== CONSTRUÇÃO DE DATAS ====================
function construirDatas(mes: number, ano: number): { dataInicio: string; dataFim: string } {
  const mesFormatado = mes.toString().padStart(2, '0');
  const dataInicio = `01.${mesFormatado}.${ano}`;
  
  const dataFim = mes === 12 
    ? `01.01.${ano + 1}`
    : `01.${(mes + 1).toString().padStart(2, '0')}.${ano}`;

  return { dataInicio, dataFim };
}

// ==================== CONSTRUÇÃO DE SQL ====================
const SQL_BASE = `
  SELECT 
    OS.CHAMADO_OS,
    OS.COD_OS,
    OS.CODTRF_OS,
    OS.DTINI_OS,
    OS.HRINI_OS,
    OS.HRFIM_OS,
    OS.OBS_OS,
    OS.VALCLI_OS,
    CLIENTE.COD_CLIENTE,
    CLIENTE.NOME_CLIENTE,
    RECURSO.COD_RECURSO,
    RECURSO.NOME_RECURSO,
    CHAMADO.STATUS_CHAMADO
  FROM OS
  LEFT JOIN TAREFA ON OS.CODTRF_OS = TAREFA.COD_TAREFA
  LEFT JOIN PROJETO ON TAREFA.CODPRO_TAREFA = PROJETO.COD_PROJETO
  LEFT JOIN CLIENTE ON PROJETO.CODCLI_PROJETO = CLIENTE.COD_CLIENTE
  LEFT JOIN RECURSO ON OS.CODREC_OS = RECURSO.COD_RECURSO
  LEFT JOIN CHAMADO ON CASE WHEN TRIM(OS.CHAMADO_OS) = '' THEN NULL ELSE CAST(OS.CHAMADO_OS AS INTEGER) END = CHAMADO.COD_CHAMADO
  WHERE OS.DTINI_OS >= ? AND OS.DTINI_OS < ?
`;

function aplicarFiltros(
  sqlBase: string,
  params: QueryParams,
  paramsArray: any[]
): { sql: string; params: any[] } {
  let sql = sqlBase;

  // Filtro obrigatório para não-admin
  if (!params.isAdmin && params.codCliente) {
    sql += ` AND CLIENTE.COD_CLIENTE = ?`;
    paramsArray.push(parseInt(params.codCliente));
  }
  
  // Filtros opcionais (MESMA LÓGICA DA API DE OS)
  if (params.codClienteFilter) {
    sql += ` AND CLIENTE.COD_CLIENTE = ?`;
    paramsArray.push(parseInt(params.codClienteFilter));
  }

  if (params.codRecursoFilter) {
    sql += ` AND RECURSO.COD_RECURSO = ?`;
    paramsArray.push(parseInt(params.codRecursoFilter));
  }

  if (params.status) {
    sql += ` AND UPPER(CHAMADO.STATUS_CHAMADO) LIKE UPPER(?)`;
    paramsArray.push(`%${params.status}%`);
  }

  return { sql, params: paramsArray };
}

// ==================== CÁLCULOS DE TEMPO ====================
function converterHoraParaMinutos(hora: string | null | undefined): number {
  if (!hora) return 0;

  const horaStr = hora.toString().padStart(4, '0');
  const horas = parseInt(horaStr.substring(0, 2)) || 0;
  const minutos = parseInt(horaStr.substring(2, 4)) || 0;

  return horas * 60 + minutos;
}

function calcularDiferencaHoras(hrInicio: string | null | undefined, hrFim: string | null | undefined): number {
  if (!hrInicio || !hrFim) return 0;

  const minutosInicio = converterHoraParaMinutos(hrInicio);
  const minutosFim = converterHoraParaMinutos(hrFim);

  let diferencaMinutos = minutosFim - minutosInicio;

  // Se a hora fim for menor que a início, assume que passou para o dia seguinte
  if (diferencaMinutos < 0) {
    diferencaMinutos += 24 * 60;
  }

  return diferencaMinutos;
}

function formatarDuracao(totalMinutos: number): string {
  if (totalMinutos <= 0) return '-';
  
  const horas = Math.floor(totalMinutos / 60);
  const minutos = totalMinutos % 60;
  
  // Se for menos de 1 hora, retorna apenas os minutos
  if (horas === 0) {
    return `${minutos}min`;
  }
  
  // Se tiver horas, formata completo (h para singular, hs para plural)
  const sufixoHora = horas === 1 ? 'h' : 'hs';
  
  // Se não tiver minutos e horas for menor que 10, retorna apenas as horas com uma casa
  if (minutos === 0 && horas < 10) {
    return `${String(horas).padStart(1, '0')}${sufixoHora}`;
  }

  // Se não tiver minutos e horas for 10 ou mais, retorna apenas as horas com duas casas
  if (minutos === 0 && horas >= 10) {
    return `${String(horas).padStart(2, '0')}${sufixoHora}`;
  }
  
  // Formata completo com horas e minutos
  return `${String(horas).padStart(2, '0')}${sufixoHora}:${String(minutos).padStart(2, '0')}min`;
}

// ==================== NORMALIZAÇÃO ====================
function normalizarValcliOs(valcli: string | null | undefined): string | null {
  if (!valcli) {
    // REGRA DE NEGÓCIO: Coluna VALCLI_OS foi criada recentemente com valor padrão 'SIM'.
    // Registros anteriores à criação da coluna estão como NULL no banco.
    // Por padrão, consideramos NULL como 'SIM' (aprovado) para manter consistência.
    return 'SIM';
  }
  
  return String(valcli).trim().toUpperCase();
}

// ==================== PROCESSAMENTO DE DADOS ====================
function processarApontamentos(apontamentos: ApontamentoFirebird[]): {
  apontamentosProcessados: ApontamentoProcessado[];
  totalMinutos: number;
} {
  let totalMinutos = 0;

  const apontamentosProcessados = apontamentos.map(apontamento => {
    // Calcula minutos trabalhados
    const minutosApontamento = calcularDiferencaHoras(
      apontamento.HRINI_OS,
      apontamento.HRFIM_OS
    );
    
    totalMinutos += minutosApontamento;

    return {
      chamado_os: apontamento.CHAMADO_OS || null,
      cod_os: apontamento.COD_OS,
      codtrf_os: apontamento.CODTRF_OS || null,
      dtini_os: apontamento.DTINI_OS,
      nome_cliente: apontamento.NOME_CLIENTE || null,
      status_chamado: apontamento.STATUS_CHAMADO || null,
      nome_recurso: apontamento.NOME_RECURSO || null,
      hrini_os: apontamento.HRINI_OS || null,
      hrfim_os: apontamento.HRFIM_OS || null,
      total_horas: formatarDuracao(minutosApontamento),
      obs: apontamento.OBS_OS || null,
      valcli_os: normalizarValcliOs(apontamento.VALCLI_OS),
    };
  });

  return { apontamentosProcessados, totalMinutos };
}

// ==================== HANDLER PRINCIPAL ====================
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    
    console.log('[API] Iniciando busca de apontamentos');

    // Validar parâmetros
    const params = validarParametros(searchParams);
    if (params instanceof NextResponse) return params;

    console.log('[API] Parâmetros validados:', params);

    // Construir datas
    const { dataInicio, dataFim } = construirDatas(params.mes, params.ano);

    console.log('[API] Período:', { dataInicio, dataFim });

    // Construir e executar query
    const { sql, params: sqlParams } = aplicarFiltros(
      SQL_BASE,
      params,
      [dataInicio, dataFim]
    );

    const sqlFinal = `${sql} ORDER BY RECURSO.NOME_RECURSO ASC, OS.DTINI_OS ASC, OS.HRINI_OS ASC`;

    console.log('[API] Executando query no Firebird...');
    console.log('[API] Filtros aplicados:', {
      codClienteFilter: params.codClienteFilter,
      codRecursoFilter: params.codRecursoFilter,
      status: params.status
    });

    const apontamentos = await firebirdQuery(sqlFinal, sqlParams);

    console.log(`[API] Encontrados ${apontamentos.length} apontamentos`);

    // Processar dados
    const { apontamentosProcessados, totalMinutos } = processarApontamentos(apontamentos);

    const totalHorasGeral = formatarDuracao(totalMinutos);

    console.log('[API] Processamento concluído:', {
      total_apontamentos: apontamentosProcessados.length,
      total_horas: totalHorasGeral
    });

    return NextResponse.json({
      totalHorasGeral,
      apontamentos: apontamentosProcessados,
    });

  } catch (error) {
    console.error('[API] Erro geral:', error);
    console.error('[API] Stack:', error instanceof Error ? error.stack : 'N/A');
    console.error('[API] Message:', error instanceof Error ? error.message : error);
    
    return NextResponse.json(
      { 
        error: 'Erro interno do servidor',
        message: error instanceof Error ? error.message : 'Erro desconhecido',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      },
      { status: 500 }
    );
  }
}