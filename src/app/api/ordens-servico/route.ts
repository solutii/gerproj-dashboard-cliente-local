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

interface OS {
  COD_OS: number;
  DTINI_OS: string;
  HRINI_OS: string;
  HRFIM_OS: string;
  OBS_OS: string;
  STATUS_OS: string;
  CHAMADO_OS?: string | null;
  VALCLI_OS?: string | null;
  NUM_OS: string;
  COMP_OS: string;
  DTINC_OS: string;
  CODTRF_OS?: number | null;
  COD_CLIENTE: number;
  NOME_CLIENTE: string;
  COD_RECURSO: number;
  NOME_RECURSO: string;
  STATUS_CHAMADO?: string | null;
}

interface OSComHoras extends OS {
  TOTAL_HRS_OS: number;
}

// ==================== CONFIGURAÇÃO DE CAMPOS ====================
const CAMPOS_OS = {
  COD_OS: 'OS.COD_OS',
  DTINI_OS: 'OS.DTINI_OS',
  HRINI_OS: 'OS.HRINI_OS',
  HRFIM_OS: 'OS.HRFIM_OS',
  OBS_OS: 'OS.OBS_OS',
  STATUS_OS: 'OS.STATUS_OS',
  CHAMADO_OS: 'OS.CHAMADO_OS',
  VALCLI_OS: 'OS.VALCLI_OS',
  NUM_OS: 'OS.NUM_OS',
  COMP_OS: 'OS.COMP_OS',
  DTINC_OS: 'OS.DTINC_OS',
  CODTRF_OS: 'OS.CODTRF_OS',
  COD_CLIENTE: 'CLIENTE.COD_CLIENTE',
  NOME_CLIENTE: 'CLIENTE.NOME_CLIENTE',
  COD_RECURSO: 'RECURSO.COD_RECURSO',
  NOME_RECURSO: 'RECURSO.NOME_RECURSO',
  STATUS_CHAMADO: 'CHAMADO.STATUS_CHAMADO',
};

// ==================== UTILITÁRIO PARA NORMALIZAR VALORES ====================
function normalizarValor(valor: any): any {
  if (typeof valor === 'string' && valor.trim() === '') {
    return null;
  }
  if (valor === undefined) {
    return null;
  }
  return valor;
}

function normalizarObjeto<T extends Record<string, any>>(obj: T): T {
  const objNormalizado = {} as T;

  for (const [key, value] of Object.entries(obj)) {
    objNormalizado[key as keyof T] = normalizarValor(value) as T[keyof T];
  }

  return objNormalizado;
}

function normalizarArray<T extends Record<string, any>>(array: T[]): T[] {
  return array.map((item) => normalizarObjeto(item));
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

// ==================== CONSTRUÇÃO DE SQL ====================
// ✅ MUDANÇA PRINCIPAL: Adicionar filtros de CHAMADO_OS (igual à API de chamados)
function construirSQLBase(): string {
  const campos = Object.values(CAMPOS_OS).join(',\n    ');

  return `
  SELECT 
    ${campos}
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

function construirSQLTotalizadores(): string {
  return `
  SELECT 
    COUNT(*) AS TOTAL_OS,
    COUNT(DISTINCT OS.CHAMADO_OS) AS TOTAL_CHAMADOS,
    COUNT(DISTINCT RECURSO.COD_RECURSO) AS TOTAL_RECURSOS
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

function processarOSComHoras(ordensServico: OS[]): OSComHoras[] {
  return ordensServico.map((os) => ({
    ...os,
    TOTAL_HRS_OS: calcularHorasTrabalhadas(os.HRINI_OS, os.HRFIM_OS),
  }));
}

function agruparHoras(ordensServico: OSComHoras[]): {
  horasPorChamado: Map<string, number>;
  horasPorTarefa: Map<number, number>;
} {
  const horasPorChamado = new Map<string, number>();
  const horasPorTarefa = new Map<number, number>();

  ordensServico.forEach((os) => {
    const horas = os.TOTAL_HRS_OS || 0;

    if (os.CHAMADO_OS) {
      const atual = horasPorChamado.get(os.CHAMADO_OS) || 0;
      horasPorChamado.set(os.CHAMADO_OS, atual + horas);
    } else if (os.CODTRF_OS) {
      const atual = horasPorTarefa.get(os.CODTRF_OS) || 0;
      horasPorTarefa.set(os.CODTRF_OS, atual + horas);
    }
  });

  return { horasPorChamado, horasPorTarefa };
}

// ==================== AGREGAÇÕES PARA GRÁFICOS ====================
function extrairDiaDoDate(dtiniOs: any): number {
  if (!dtiniOs) return 0;

  if (typeof dtiniOs === 'string') {
    const [dia] = dtiniOs.split('.');
    return parseInt(dia) || 0;
  }

  if (dtiniOs instanceof Date) {
    return dtiniOs.getDate();
  }

  const data = new Date(dtiniOs);
  if (!isNaN(data.getTime())) {
    return data.getDate();
  }

  return 0;
}

function gerarHorasPorDia(
  ordensServico: OSComHoras[],
  mes: number,
  ano: number,
) {
  const diasNoMes = new Date(ano, mes, 0).getDate();
  const horasPorDia = new Map<number, number>();

  for (let dia = 1; dia <= diasNoMes; dia++) {
    horasPorDia.set(dia, 0);
  }

  ordensServico.forEach((os) => {
    const diaNum = extrairDiaDoDate(os.DTINI_OS);
    if (diaNum > 0 && diaNum <= diasNoMes) {
      const horasAtuais = horasPorDia.get(diaNum) || 0;
      horasPorDia.set(diaNum, horasAtuais + (os.TOTAL_HRS_OS || 0));
    }
  });

  return Array.from(horasPorDia.entries())
    .map(([dia, horas]) => ({
      dia,
      horas: parseFloat(horas.toFixed(2)),
      data: `${dia.toString().padStart(2, '0')}/${mes.toString().padStart(2, '0')}`,
    }))
    .sort((a, b) => a.dia - b.dia);
}

function gerarTopChamados(ordensServico: OSComHoras[], limite: number = 10) {
  const horasPorChamado = new Map<
    string,
    { horas: number; cliente: string; status: string }
  >();

  ordensServico.forEach((os) => {
    if (!os.CHAMADO_OS) return;

    const atual = horasPorChamado.get(os.CHAMADO_OS) || {
      horas: 0,
      cliente: os.NOME_CLIENTE || 'Sem cliente',
      status: os.STATUS_CHAMADO || 'Tarefa',
    };

    horasPorChamado.set(os.CHAMADO_OS, {
      ...atual,
      horas: atual.horas + (os.TOTAL_HRS_OS || 0),
    });
  });

  return Array.from(horasPorChamado.entries())
    .map(([chamado, dados]) => ({
      chamado,
      horas: parseFloat(dados.horas.toFixed(2)),
      cliente: dados.cliente,
      status: dados.status,
    }))
    .sort((a, b) => b.horas - a.horas)
    .slice(0, limite);
}

function gerarHorasPorStatus(ordensServico: OSComHoras[]) {
  const horasPorStatus = new Map<string, number>();

  ordensServico.forEach((os) => {
    const status = os.STATUS_CHAMADO || 'Tarefa';
    const horasAtuais = horasPorStatus.get(status) || 0;
    horasPorStatus.set(status, horasAtuais + (os.TOTAL_HRS_OS || 0));
  });

  return Array.from(horasPorStatus.entries())
    .map(([status, horas]) => ({
      status,
      horas: parseFloat(horas.toFixed(2)),
      percentual: 0,
    }))
    .sort((a, b) => b.horas - a.horas);
}

function gerarHorasPorRecurso(ordensServico: OSComHoras[]) {
  const horasPorRecurso = new Map<
    string,
    {
      codRecurso: number;
      horas: number;
      quantidadeOS: number;
    }
  >();

  ordensServico.forEach((os) => {
    const recurso = os.NOME_RECURSO || 'Sem recurso';
    const atual = horasPorRecurso.get(recurso) || {
      codRecurso: os.COD_RECURSO,
      horas: 0,
      quantidadeOS: 0,
    };

    horasPorRecurso.set(recurso, {
      codRecurso: atual.codRecurso,
      horas: atual.horas + (os.TOTAL_HRS_OS || 0),
      quantidadeOS: atual.quantidadeOS + 1,
    });
  });

  return Array.from(horasPorRecurso.entries())
    .map(([recurso, dados]) => ({
      recurso,
      codRecurso: dados.codRecurso,
      horas: parseFloat(dados.horas.toFixed(2)),
      quantidadeOS: dados.quantidadeOS,
      mediaHorasPorOS: parseFloat(
        (dados.horas / dados.quantidadeOS).toFixed(2),
      ),
    }))
    .sort((a, b) => b.horas - a.horas);
}

function gerarHorasPorCliente(ordensServico: OSComHoras[]) {
  const horasPorCliente = new Map<
    string,
    {
      codCliente: number;
      horas: number;
      quantidadeOS: number;
      quantidadeChamados: Set<string>;
    }
  >();

  ordensServico.forEach((os) => {
    const cliente = os.NOME_CLIENTE || 'Sem cliente';
    const atual = horasPorCliente.get(cliente) || {
      codCliente: os.COD_CLIENTE,
      horas: 0,
      quantidadeOS: 0,
      quantidadeChamados: new Set<string>(),
    };

    if (os.CHAMADO_OS) {
      atual.quantidadeChamados.add(os.CHAMADO_OS);
    }

    horasPorCliente.set(cliente, {
      codCliente: atual.codCliente,
      horas: atual.horas + (os.TOTAL_HRS_OS || 0),
      quantidadeOS: atual.quantidadeOS + 1,
      quantidadeChamados: atual.quantidadeChamados,
    });
  });

  return Array.from(horasPorCliente.entries())
    .map(([cliente, dados]) => ({
      cliente,
      codCliente: dados.codCliente,
      horas: parseFloat(dados.horas.toFixed(2)),
      quantidadeOS: dados.quantidadeOS,
      quantidadeChamados: dados.quantidadeChamados.size,
      mediaHorasPorOS: parseFloat(
        (dados.horas / dados.quantidadeOS).toFixed(2),
      ),
    }))
    .sort((a, b) => b.horas - a.horas);
}

// ==================== BUSCAR TOTAL DE CHAMADOS (COM E SEM OS) ====================
async function buscarTotalChamados(
  dataInicio: string,
  dataFim: string,
  params: QueryParams,
  codChamadosComOS: number[],
): Promise<number> {
  try {
    let sql = '';
    let sqlParams: any[] = [];

    if (params.isAdmin) {
      // Admin: chamados do período OU com OS no período
      if (codChamadosComOS.length === 0) {
        sql = `
          SELECT COUNT(DISTINCT CHAMADO.COD_CHAMADO) AS TOTAL_CHAMADOS
          FROM CHAMADO
          WHERE CHAMADO.DATA_CHAMADO >= ? 
            AND CHAMADO.DATA_CHAMADO < ?
        `;
        sqlParams = [dataInicio, dataFim];
      } else {
        const placeholders = codChamadosComOS.map(() => '?').join(',');
        sql = `
          SELECT COUNT(DISTINCT CHAMADO.COD_CHAMADO) AS TOTAL_CHAMADOS
          FROM CHAMADO
          WHERE (
            (CHAMADO.DATA_CHAMADO >= ? AND CHAMADO.DATA_CHAMADO < ?)
            OR CHAMADO.COD_CHAMADO IN (${placeholders})
          )
        `;
        sqlParams = [dataInicio, dataFim, ...codChamadosComOS];
      }
    } else {
      // Não-admin: apenas chamados com OS no período
      if (codChamadosComOS.length === 0) {
        return 0;
      }

      const placeholders = codChamadosComOS.map(() => '?').join(',');
      sql = `
        SELECT COUNT(DISTINCT CHAMADO.COD_CHAMADO) AS TOTAL_CHAMADOS
        FROM CHAMADO
        WHERE CHAMADO.COD_CHAMADO IN (${placeholders})
      `;
      sqlParams = [...codChamadosComOS];
    }

    // Aplicar filtros adicionais
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

    if (params.status) {
      sql += ` AND UPPER(CHAMADO.STATUS_CHAMADO) LIKE UPPER(?)`;
      sqlParams.push(`%${params.status}%`);
    }

    const resultado = await firebirdQuery<{ TOTAL_CHAMADOS: number }>(
      sql,
      sqlParams,
    );

    return resultado.length > 0 ? resultado[0].TOTAL_CHAMADOS : 0;
  } catch (error) {
    console.error('[API OS] Erro ao buscar total de chamados:', error);
    return 0;
  }
}

// ==================== BUSCAR CHAMADOS COM OS NO PERÍODO ====================
async function buscarChamadosComOSNoPeriodo(
  dataInicio: string,
  dataFim: string,
  params: QueryParams,
): Promise<number[]> {
  try {
    let sql = `
      SELECT DISTINCT CAST(OS.CHAMADO_OS AS INTEGER) AS COD_CHAMADO
      FROM OS
      LEFT JOIN TAREFA ON OS.CODTRF_OS = TAREFA.COD_TAREFA
      WHERE OS.DTINI_OS >= ? 
        AND OS.DTINI_OS < ?
        AND OS.CHAMADO_OS IS NOT NULL
        AND OS.CHAMADO_OS <> ''
        AND TAREFA.EXIBECHAM_TAREFA = 1
    `;

    const sqlParams: any[] = [dataInicio, dataFim];

    if (!params.isAdmin && params.codCliente) {
      sql = `
        SELECT DISTINCT CAST(OS.CHAMADO_OS AS INTEGER) AS COD_CHAMADO
        FROM OS
        LEFT JOIN CHAMADO ON OS.CHAMADO_OS = CAST(CHAMADO.COD_CHAMADO AS VARCHAR(20))
        LEFT JOIN TAREFA ON OS.CODTRF_OS = TAREFA.COD_TAREFA
        WHERE OS.DTINI_OS >= ? 
          AND OS.DTINI_OS < ?
          AND OS.CHAMADO_OS IS NOT NULL
          AND OS.CHAMADO_OS <> ''
          AND CHAMADO.COD_CLIENTE = ?
          AND TAREFA.EXIBECHAM_TAREFA = 1
      `;
      sqlParams.push(parseInt(params.codCliente));
    } else if (params.codClienteFilter) {
      sql = `
        SELECT DISTINCT CAST(OS.CHAMADO_OS AS INTEGER) AS COD_CHAMADO
        FROM OS
        LEFT JOIN CHAMADO ON OS.CHAMADO_OS = CAST(CHAMADO.COD_CHAMADO AS VARCHAR(20))
        LEFT JOIN TAREFA ON OS.CODTRF_OS = TAREFA.COD_TAREFA
        WHERE OS.DTINI_OS >= ? 
          AND OS.DTINI_OS < ?
          AND OS.CHAMADO_OS IS NOT NULL
          AND OS.CHAMADO_OS <> ''
          AND CHAMADO.COD_CLIENTE = ?
          AND TAREFA.EXIBECHAM_TAREFA = 1
      `;
      sqlParams.push(parseInt(params.codClienteFilter));
    }

    const resultado = await firebirdQuery<{ COD_CHAMADO: number }>(
      sql,
      sqlParams,
    );
    return resultado.map((r) => r.COD_CHAMADO);
  } catch (error) {
    console.error('[API OS] Erro ao buscar chamados com OS no período:', error);
    return [];
  }
}

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

  const horasPorMes: Array<{ mes: string; horas: number; mesNum: number }> = [];

  for (let mes = 1; mes <= 12; mes++) {
    const { dataInicio, dataFim } = construirDatas(mes, ano);

    // ✅ APLICAR MESMOS FILTROS: CHAMADO_OS obrigatório
    const sqlMensal = `
      SELECT 
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

    const paramsMensal = [dataInicio, dataFim];

    let sqlFiltrado = sqlMensal;
    if (!params.isAdmin && params.codCliente) {
      sqlFiltrado += ` AND CLIENTE.COD_CLIENTE = ?`;
      paramsMensal.push(params.codCliente);
    }
    if (params.codClienteFilter) {
      sqlFiltrado += ` AND CLIENTE.COD_CLIENTE = ?`;
      paramsMensal.push(params.codClienteFilter);
    }
    if (params.codRecursoFilter) {
      sqlFiltrado += ` AND RECURSO.COD_RECURSO = ?`;
      paramsMensal.push(params.codRecursoFilter);
    }
    if (params.status) {
      sqlFiltrado += ` AND UPPER(CHAMADO.STATUS_CHAMADO) LIKE UPPER(?)`;
      paramsMensal.push(`%${params.status}%`);
    }

    try {
      const resultados = await firebirdQuery(sqlFiltrado, paramsMensal);
      const normalizados = normalizarArray(resultados);

      const totalHoras = normalizados.reduce((acc, os) => {
        return acc + calcularHorasTrabalhadas(os.HRINI_OS, os.HRFIM_OS);
      }, 0);

      horasPorMes.push({
        mes: mesesNomes[mes - 1],
        mesNum: mes,
        horas: parseFloat(totalHoras.toFixed(2)),
      });
    } catch (error) {
      console.error(`[API OS] Erro ao buscar dados do mês ${mes}:`, error);
      horasPorMes.push({
        mes: mesesNomes[mes - 1],
        mesNum: mes,
        horas: 0,
      });
    }
  }

  return horasPorMes;
}

function calcularPercentuais(
  dados: Array<{ horas: number; [key: string]: any }>,
) {
  const total = dados.reduce((acc, item) => acc + item.horas, 0);
  return dados.map((item) => ({
    ...item,
    percentual:
      total > 0 ? parseFloat(((item.horas / total) * 100).toFixed(2)) : 0,
  }));
}

function calcularTotalizadores(
  ordensServico: OSComHoras[],
  horasPorChamado: Map<string, number>,
  horasPorTarefa: Map<number, number>,
  totaisDB: any,
  totalChamadosGeral: number, // ✅ Novo parâmetro
) {
  const totalHoras = ordensServico.reduce(
    (acc, os) => acc + (os.TOTAL_HRS_OS || 0),
    0,
  );

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
    TOTAL_OS: totaisDB[0]?.TOTAL_OS || 0,
    TOTAL_CHAMADOS: totalChamadosGeral, // ✅ Usar o total geral (com e sem OS)
    TOTAL_RECURSOS: totaisDB[0]?.TOTAL_RECURSOS || 0,
    TOTAL_HRS: parseFloat(totalHoras.toFixed(2)),
    TOTAL_HRS_CHAMADOS: parseFloat(totalHorasChamados.toFixed(2)),
    TOTAL_HRS_TAREFAS: parseFloat(totalHorasTarefas.toFixed(2)),
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

    // ✅ 1. Buscar códigos de chamados que têm OS no período
    const codChamadosComOS = await buscarChamadosComOSNoPeriodo(
      dataInicio,
      dataFim,
      params,
    );

    // ✅ 2. Buscar total de chamados (com e sem OS)
    const totalChamadosGeral = await buscarTotalChamados(
      dataInicio,
      dataFim,
      params,
      codChamadosComOS,
    );

    const sqlBase = construirSQLBase();
    const { sql: sqlPrincipal, params: paramsPrincipal } = aplicarFiltros(
      sqlBase,
      params,
      [dataInicio, dataFim],
    );
    const sqlFinal = `${sqlPrincipal} ORDER BY OS.DTINI_OS DESC, OS.HRINI_OS DESC`;

    const sqlTotalizadores = construirSQLTotalizadores();
    const { sql: sqlTotais, params: paramsTotais } = aplicarFiltros(
      sqlTotalizadores,
      params,
      [dataInicio, dataFim],
    );

    const [ordensServicoRaw, totalizadoresDB] = await Promise.all([
      firebirdQuery(sqlFinal, paramsPrincipal),
      firebirdQuery(sqlTotais, paramsTotais),
    ]);

    const ordensServico = normalizarArray(ordensServicoRaw);

    const ordensServicoComHoras = processarOSComHoras(ordensServico);
    const { horasPorChamado, horasPorTarefa } = agruparHoras(
      ordensServicoComHoras,
    );

    // ✅ 3. Passar o total geral de chamados
    const totalizadores = calcularTotalizadores(
      ordensServicoComHoras,
      horasPorChamado,
      horasPorTarefa,
      totalizadoresDB,
      totalChamadosGeral, // ✅ Novo parâmetro
    );

    const horasPorDia = gerarHorasPorDia(
      ordensServicoComHoras,
      params.mes,
      params.ano,
    );
    const topChamados = gerarTopChamados(ordensServicoComHoras, 10);
    const horasPorStatusRaw = gerarHorasPorStatus(ordensServicoComHoras);
    const horasPorStatus = calcularPercentuais(horasPorStatusRaw);
    const horasPorRecurso = gerarHorasPorRecurso(ordensServicoComHoras);
    const horasPorCliente = params.isAdmin
      ? gerarHorasPorCliente(ordensServicoComHoras)
      : undefined;
    const horasPorMes = await gerarHorasPorMes(params.ano, params);

    return NextResponse.json({
      ordensServico: ordensServicoComHoras,
      totalizadores,
      graficos: {
        horasPorDia,
        topChamados,
        horasPorStatus,
        horasPorRecurso,
        horasPorCliente,
        horasPorMes,
      },
    });
  } catch (error) {
    console.error('[API OS] Erro ao buscar ordens de serviço:', error);
    console.error(
      '[API OS] Stack:',
      error instanceof Error ? error.stack : 'N/A',
    );
    console.error(
      '[API OS] Message:',
      error instanceof Error ? error.message : error,
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
