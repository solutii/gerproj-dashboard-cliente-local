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

interface ResultadoMedias {
  MEDIA_HRS_POR_CHAMADO: number;
  MEDIA_HRS_POR_TAREFA: number;
  TOTAL_CHAMADOS_COM_HORAS: number;
  TOTAL_TAREFAS_COM_HORAS: number;
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

// ==================== CONSTRUÇÃO DE SQL COMPATÍVEL COM DIALECT 1 ====================
function construirSQLMediasCompativel(): string {
  return `
  SELECT 
    OS.CHAMADO_OS,
    OS.CODTRF_OS,
    OS.HRINI_OS,
    OS.HRFIM_OS
  FROM OS
  LEFT JOIN TAREFA ON OS.CODTRF_OS = TAREFA.COD_TAREFA
  LEFT JOIN PROJETO ON TAREFA.CODPRO_TAREFA = PROJETO.COD_PROJETO
  LEFT JOIN CLIENTE ON PROJETO.CODCLI_PROJETO = CLIENTE.COD_CLIENTE
  LEFT JOIN RECURSO ON OS.CODREC_OS = RECURSO.COD_RECURSO
  LEFT JOIN CHAMADO ON CASE WHEN TRIM(OS.CHAMADO_OS) = '' THEN NULL ELSE CAST(OS.CHAMADO_OS AS INTEGER) END = CHAMADO.COD_CHAMADO
  WHERE OS.DTINI_OS >= ? 
    AND OS.DTINI_OS < ?
    AND TAREFA.EXIBECHAM_TAREFA = 1
    AND OS.CHAMADO_OS IS NOT NULL
    AND OS.CHAMADO_OS <> ''
`;
}

function aplicarFiltros(
  sqlBase: string,
  params: QueryParams,
  paramsArray: any[],
): { sql: string; params: any[] } {
  let sql = sqlBase;

  if (!params.isAdmin && params.codCliente) {
    sql += ` AND CLIENTE.COD_CLIENTE = ?`;
    paramsArray.push(parseInt(params.codCliente));
  }

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

// ==================== CÁLCULOS ====================
function calcularHorasTrabalhadas(
  hrIni: string | null = '0000',
  hrFim: string | null = '0000',
): number {
  const hrIniNorm = hrIni || '0000';
  const hrFimNorm = hrFim || '0000';

  const horaIni = parseInt(hrIniNorm.substring(0, 2));
  const minIni = parseInt(hrIniNorm.substring(2, 4));
  const horaFim = parseInt(hrFimNorm.substring(0, 2));
  const minFim = parseInt(hrFimNorm.substring(2, 4));

  const totalMinutos = horaFim * 60 + minFim - (horaIni * 60 + minIni);
  return parseFloat((totalMinutos / 60).toFixed(2));
}

function calcularMedias(ordensServico: any[]): ResultadoMedias {
  const horasPorChamado = new Map<string, number>();
  const horasPorTarefa = new Map<number, number>();

  ordensServico.forEach((os) => {
    const horas = calcularHorasTrabalhadas(os.HRINI_OS, os.HRFIM_OS);

    if (os.CHAMADO_OS) {
      const atual = horasPorChamado.get(os.CHAMADO_OS) || 0;
      horasPorChamado.set(os.CHAMADO_OS, atual + horas);
    }

    if (os.CODTRF_OS) {
      const atual = horasPorTarefa.get(os.CODTRF_OS) || 0;
      horasPorTarefa.set(os.CODTRF_OS, atual + horas);
    }
  });

  const totalChamadosComHoras = horasPorChamado.size;
  const totalHorasChamados = Array.from(horasPorChamado.values()).reduce(
    (acc, h) => acc + h,
    0,
  );
  const mediaHorasPorChamado =
    totalChamadosComHoras > 0 ? totalHorasChamados / totalChamadosComHoras : 0;

  const totalTarefasComHoras = horasPorTarefa.size;
  const totalHorasTarefas = Array.from(horasPorTarefa.values()).reduce(
    (acc, h) => acc + h,
    0,
  );
  const mediaHorasPorTarefa =
    totalTarefasComHoras > 0 ? totalHorasTarefas / totalTarefasComHoras : 0;

  return {
    MEDIA_HRS_POR_CHAMADO: parseFloat(mediaHorasPorChamado.toFixed(2)),
    MEDIA_HRS_POR_TAREFA: parseFloat(mediaHorasPorTarefa.toFixed(2)),
    TOTAL_CHAMADOS_COM_HORAS: totalChamadosComHoras,
    TOTAL_TAREFAS_COM_HORAS: totalTarefasComHoras,
  };
}

// ==================== HANDLER PRINCIPAL ====================
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const params = validarParametros(searchParams);
    if (params instanceof NextResponse) return params;

    const { dataInicio, dataFim } = construirDatas(params.mes, params.ano);

    const sqlBase = construirSQLMediasCompativel();
    const { sql: sqlFinal, params: paramsFinal } = aplicarFiltros(
      sqlBase,
      params,
      [dataInicio, dataFim],
    );

    const ordensServico = await firebirdQuery(sqlFinal, paramsFinal);

    const medias = calcularMedias(ordensServico);

    return NextResponse.json(medias);
  } catch (error) {
    console.error('[API MEDIAS] Erro ao calcular médias:', error);
    console.error(
      '[API MEDIAS] Stack:',
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
