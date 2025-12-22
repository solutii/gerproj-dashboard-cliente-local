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

interface OSData {
  DTINI_OS: string | Date;
  HRINI_OS: string;
  HRFIM_OS: string;
  CHAMADO_OS: string;
  CODTRF_OS: number;
  COD_RECURSO: number;
  NOME_RECURSO: string;
  COD_CLIENTE: number;
  NOME_CLIENTE: string;
  STATUS_CHAMADO: string;
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
function construirSQLBase(): string {
  return `
    SELECT 
      OS.DTINI_OS,
      OS.HRINI_OS,
      OS.HRFIM_OS,
      OS.CHAMADO_OS,
      OS.CODTRF_OS,
      RECURSO.COD_RECURSO,
      RECURSO.NOME_RECURSO,
      CLIENTE.COD_CLIENTE,
      CLIENTE.NOME_CLIENTE,
      CHAMADO.STATUS_CHAMADO
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

function extrairDia(dtini: string | Date): number {
  if (typeof dtini === 'string') {
    const [dia] = dtini.split('.');
    return parseInt(dia);
  } else if (dtini instanceof Date) {
    return dtini.getDate();
  } else if (dtini === null || dtini === undefined) {
    return 0;
  } else {
    const dataStr = String(dtini);
    const [dia] = dataStr.split('.');
    return parseInt(dia);
  }
}

// ==================== PROCESSAMENTO UNIFICADO ====================
function processarDadosUnificados(
  dados: OSData[],
  mes: number,
  ano: number,
  isAdmin: boolean,
) {
  const diasNoMes = new Date(ano, mes, 0).getDate();

  // Inicializar estruturas
  const horasPorDia = new Map<number, number>();
  for (let dia = 1; dia <= diasNoMes; dia++) {
    horasPorDia.set(dia, 0);
  }

  const horasPorChamado = new Map<
    string,
    { horas: number; cliente: string; status: string }
  >();
  const horasPorStatus = new Map<string, number>();
  const horasPorRecurso = new Map<
    string,
    { codRecurso: number; horas: number; quantidadeOS: number }
  >();
  const horasPorCliente = new Map<
    string,
    {
      codCliente: number;
      horas: number;
      quantidadeOS: number;
      chamados: Set<string>;
    }
  >();

  let totalOS = 0;
  let totalHoras = 0;
  const chamadosUnicos = new Set<string>();
  const recursosUnicos = new Set<number>();

  // Processar tudo em uma única passada
  dados.forEach((os) => {
    const horas = calcularHorasTrabalhadas(os.HRINI_OS, os.HRFIM_OS);
    totalOS++;
    totalHoras += horas;

    // 1. Horas por dia
    const diaNum = extrairDia(os.DTINI_OS);
    if (diaNum > 0 && diaNum <= diasNoMes) {
      const horasAtuais = horasPorDia.get(diaNum) || 0;
      horasPorDia.set(diaNum, horasAtuais + horas);
    }

    // 2. Top chamados
    if (os.CHAMADO_OS) {
      chamadosUnicos.add(os.CHAMADO_OS);
      const atual = horasPorChamado.get(os.CHAMADO_OS) || {
        horas: 0,
        cliente: os.NOME_CLIENTE || 'Sem cliente',
        status: os.STATUS_CHAMADO || 'Tarefa',
      };
      horasPorChamado.set(os.CHAMADO_OS, {
        ...atual,
        horas: atual.horas + horas,
      });
    }

    // 3. Horas por status
    const status = os.STATUS_CHAMADO || 'Tarefa';
    const horasStatus = horasPorStatus.get(status) || 0;
    horasPorStatus.set(status, horasStatus + horas);

    // 4. Horas por recurso
    if (os.COD_RECURSO) {
      recursosUnicos.add(os.COD_RECURSO);
      const recurso = os.NOME_RECURSO || 'Sem recurso';
      const atualRecurso = horasPorRecurso.get(recurso) || {
        codRecurso: os.COD_RECURSO,
        horas: 0,
        quantidadeOS: 0,
      };
      horasPorRecurso.set(recurso, {
        codRecurso: atualRecurso.codRecurso,
        horas: atualRecurso.horas + horas,
        quantidadeOS: atualRecurso.quantidadeOS + 1,
      });
    }

    // 5. Horas por cliente (apenas admin)
    if (isAdmin && os.COD_CLIENTE) {
      const cliente = os.NOME_CLIENTE || 'Sem cliente';
      const atualCliente = horasPorCliente.get(cliente) || {
        codCliente: os.COD_CLIENTE,
        horas: 0,
        quantidadeOS: 0,
        chamados: new Set<string>(),
      };

      if (os.CHAMADO_OS) {
        atualCliente.chamados.add(os.CHAMADO_OS);
      }

      horasPorCliente.set(cliente, {
        codCliente: atualCliente.codCliente,
        horas: atualCliente.horas + horas,
        quantidadeOS: atualCliente.quantidadeOS + 1,
        chamados: atualCliente.chamados,
      });
    }
  });

  // Formatar resultados
  return {
    totalizadores: {
      TOTAL_OS: totalOS,
      TOTAL_CHAMADOS: chamadosUnicos.size,
      TOTAL_RECURSOS: recursosUnicos.size,
      TOTAL_HRS: parseFloat(totalHoras.toFixed(2)),
    },
    horasPorDia: Array.from(horasPorDia.entries())
      .map(([dia, horas]) => ({
        dia,
        horas: parseFloat(horas.toFixed(2)),
        data: `${dia.toString().padStart(2, '0')}/${mes.toString().padStart(2, '0')}`,
      }))
      .sort((a, b) => a.dia - b.dia),
    topChamados: Array.from(horasPorChamado.entries())
      .map(([chamado, dados]) => ({
        chamado,
        horas: parseFloat(dados.horas.toFixed(2)),
        cliente: dados.cliente,
        status: dados.status,
      }))
      .sort((a, b) => b.horas - a.horas)
      .slice(0, 10),
    horasPorStatus: (() => {
      const dados = Array.from(horasPorStatus.entries())
        .map(([status, horas]) => ({
          status,
          horas: parseFloat(horas.toFixed(2)),
        }))
        .sort((a, b) => b.horas - a.horas);

      const total = dados.reduce((acc, item) => acc + item.horas, 0);

      return dados.map((item) => ({
        ...item,
        percentual:
          total > 0 ? parseFloat(((item.horas / total) * 100).toFixed(2)) : 0,
      }));
    })(),
    horasPorRecurso: Array.from(horasPorRecurso.entries())
      .map(([recurso, dados]) => ({
        recurso,
        codRecurso: dados.codRecurso,
        horas: parseFloat(dados.horas.toFixed(2)),
        quantidadeOS: dados.quantidadeOS,
        mediaHorasPorOS: parseFloat(
          (dados.horas / dados.quantidadeOS).toFixed(2),
        ),
      }))
      .sort((a, b) => b.horas - a.horas),
    horasPorCliente: isAdmin
      ? Array.from(horasPorCliente.entries())
          .map(([cliente, dados]) => ({
            cliente,
            codCliente: dados.codCliente,
            horas: parseFloat(dados.horas.toFixed(2)),
            quantidadeOS: dados.quantidadeOS,
            quantidadeChamados: dados.chamados.size,
            mediaHorasPorOS: parseFloat(
              (dados.horas / dados.quantidadeOS).toFixed(2),
            ),
          }))
          .sort((a, b) => b.horas - a.horas)
      : undefined,
  };
}

// ==================== GRÁFICO ANUAL (Paralelo) ====================
async function gerarHorasPorMes(ano: number, params: QueryParams) {
  const mesesNomes = [
    'Jan',
    'Fev',
    'Mar',
    'Abr',
    'Mai',
    'Jun',
    'Jul',
    'Ago',
    'Set',
    'Out',
    'Nov',
    'Dez',
  ];

  // Buscar todos os meses em paralelo
  const promessasMeses = Array.from({ length: 12 }, (_, i) => i + 1).map(
    async (mes) => {
      const { dataInicio, dataFim } = construirDatas(mes, ano);

      let sql = `
      SELECT OS.HRINI_OS, OS.HRFIM_OS
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

      const { sql: sqlFiltrado, params: sqlParams } = aplicarFiltros(
        sql,
        params,
        [dataInicio, dataFim],
      );

      try {
        const resultados = await firebirdQuery(sqlFiltrado, sqlParams);

        const totalHoras = resultados.reduce((acc: number, os: any) => {
          return acc + calcularHorasTrabalhadas(os.HRINI_OS, os.HRFIM_OS);
        }, 0);

        return {
          mes: mesesNomes[mes - 1],
          mesNum: mes,
          horas: parseFloat(totalHoras.toFixed(2)),
        };
      } catch (error) {
        console.error(`[API GRAFICOS] Erro ao buscar mês ${mes}:`, error);
        return {
          mes: mesesNomes[mes - 1],
          mesNum: mes,
          horas: 0,
        };
      }
    },
  );

  return Promise.all(promessasMeses);
}

// ==================== HANDLER PRINCIPAL ====================
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const params = validarParametros(searchParams);
    if (params instanceof NextResponse) return params;

    const { dataInicio, dataFim } = construirDatas(params.mes, params.ano);

    // Buscar dados do mês atual e horas por mês em paralelo
    const sqlBase = construirSQLBase();
    const { sql: sqlFinal, params: paramsFinal } = aplicarFiltros(
      sqlBase,
      params,
      [dataInicio, dataFim],
    );

    const [dadosMes, horasPorMes] = await Promise.all([
      firebirdQuery<OSData>(sqlFinal, paramsFinal),
      gerarHorasPorMes(params.ano, params),
    ]);

    // Processar todos os gráficos de uma vez
    const resultados = processarDadosUnificados(
      dadosMes,
      params.mes,
      params.ano,
      params.isAdmin,
    );

    return NextResponse.json({
      totalizadores: resultados.totalizadores,
      graficos: {
        horasPorDia: resultados.horasPorDia,
        topChamados: resultados.topChamados,
        horasPorStatus: resultados.horasPorStatus,
        horasPorRecurso: resultados.horasPorRecurso,
        horasPorCliente: resultados.horasPorCliente,
        horasPorMes,
      },
    });
  } catch (error) {
    console.error('[API GRAFICOS] Erro ao buscar dados:', error);
    console.error(
      '[API GRAFICOS] Stack:',
      error instanceof Error ? error.stack : 'N/A',
    );

    return NextResponse.json(
      {
        error: 'Erro interno do servidor',
        message: error instanceof Error ? error.message : 'Erro desconhecido',
        details: process.env.NODE_ENV === 'development' ? error : undefined,
      },
      { status: 500 },
    );
  }
}
