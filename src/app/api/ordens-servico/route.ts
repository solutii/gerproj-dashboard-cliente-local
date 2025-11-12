import { firebirdQuery } from '../../../lib/firebird/firebird-client';
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

// ==================== UTILITÁRIO PARA NORMALIZAR VALORES ====================
function normalizarValor(valor: any): any {
  // Se for string vazia, retorna null
  if (typeof valor === 'string' && valor.trim() === '') {
    return null;
  }
  // Se for undefined, retorna null
  if (valor === undefined) {
    return null;
  }
  // Retorna o valor original
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
  return array.map(item => normalizarObjeto(item));
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
    OS.COD_OS,
    OS.DTINI_OS,
    OS.HRINI_OS,
    OS.HRFIM_OS,
    OS.OBS_OS,
    OS.STATUS_OS,
    OS.CHAMADO_OS,
    OS.VALCLI_OS,
    OS.NUM_OS,
    OS.COMP_OS,
    OS.DTINC_OS,
    OS.CODTRF_OS,
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

const SQL_TOTALIZADORES_BASE = `
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
  
  // Filtros opcionais
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
function calcularHorasTrabalhadas(hrIni: string | null = '0000', hrFim: string | null = '0000'): number {
  // Tratar valores null
  const hrIniNorm = hrIni || '0000';
  const hrFimNorm = hrFim || '0000';
  
  const horaIni = parseInt(hrIniNorm.substring(0, 2));
  const minIni = parseInt(hrIniNorm.substring(2, 4));
  const horaFim = parseInt(hrFimNorm.substring(0, 2));
  const minFim = parseInt(hrFimNorm.substring(2, 4));
  
  const totalMinutos = (horaFim * 60 + minFim) - (horaIni * 60 + minIni);
  return parseFloat((totalMinutos / 60).toFixed(2));
}

function processarChamadosComHoras(chamados: OS[]): OSComHoras[] {
  return chamados.map(chamado => ({
    ...chamado,
    TOTAL_HRS_OS: calcularHorasTrabalhadas(chamado.HRINI_OS, chamado.HRFIM_OS)
  }));
}

function agruparHoras(chamados: OSComHoras[]): {
  horasPorChamado: Map<string, number>;
  horasPorTarefa: Map<number, number>;
} {
  const horasPorChamado = new Map<string, number>();
  const horasPorTarefa = new Map<number, number>();
  
  chamados.forEach(os => {
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
  // Tratar valores null ou vazios
  if (!dtiniOs) return 0;
  
  // Se vier como string (formato DD.MM.YYYY)
  if (typeof dtiniOs === 'string') {
    const [dia] = dtiniOs.split('.');
    return parseInt(dia) || 0;
  }
  
  // Se vier como objeto Date
  if (dtiniOs instanceof Date) {
    return dtiniOs.getDate();
  }
  
  // Tentar converter para Date se for timestamp ou outro formato
  const data = new Date(dtiniOs);
  if (!isNaN(data.getTime())) {
    return data.getDate();
  }
  
  return 0; // Fallback
}

function gerarHorasPorDia(chamados: OSComHoras[], mes: number, ano: number) {
  const diasNoMes = new Date(ano, mes, 0).getDate();
  const horasPorDia = new Map<number, number>();
  
  // Inicializar todos os dias com 0
  for (let dia = 1; dia <= diasNoMes; dia++) {
    horasPorDia.set(dia, 0);
  }
  
  // Acumular horas por dia
  chamados.forEach(os => {
    const diaNum = extrairDiaDoDate(os.DTINI_OS);
    if (diaNum > 0 && diaNum <= diasNoMes) {
      const horasAtuais = horasPorDia.get(diaNum) || 0;
      horasPorDia.set(diaNum, horasAtuais + (os.TOTAL_HRS_OS || 0));
    }
  });
  
  // Converter para array ordenado
  return Array.from(horasPorDia.entries())
    .map(([dia, horas]) => ({
      dia,
      horas: parseFloat(horas.toFixed(2)),
      data: `${dia.toString().padStart(2, '0')}/${mes.toString().padStart(2, '0')}`
    }))
    .sort((a, b) => a.dia - b.dia);
}

function gerarTopChamados(chamados: OSComHoras[], limite: number = 10) {
  const horasPorChamado = new Map<string, { horas: number; cliente: string; status: string }>();
  
  chamados.forEach(os => {
    if (!os.CHAMADO_OS) return;
    
    const atual = horasPorChamado.get(os.CHAMADO_OS) || { 
      horas: 0, 
      cliente: os.NOME_CLIENTE || 'Sem cliente',
      status: os.STATUS_CHAMADO || 'Sem status'
    };
    
    horasPorChamado.set(os.CHAMADO_OS, {
      ...atual,
      horas: atual.horas + (os.TOTAL_HRS_OS || 0)
    });
  });
  
  return Array.from(horasPorChamado.entries())
    .map(([chamado, dados]) => ({
      chamado,
      horas: parseFloat(dados.horas.toFixed(2)),
      cliente: dados.cliente,
      status: dados.status
    }))
    .sort((a, b) => b.horas - a.horas)
    .slice(0, limite);
}

function gerarHorasPorStatus(chamados: OSComHoras[]) {
  const horasPorStatus = new Map<string, number>();
  
  chamados.forEach(os => {
    const status = os.STATUS_CHAMADO || 'Sem status';
    const horasAtuais = horasPorStatus.get(status) || 0;
    horasPorStatus.set(status, horasAtuais + (os.TOTAL_HRS_OS || 0));
  });
  
  return Array.from(horasPorStatus.entries())
    .map(([status, horas]) => ({
      status,
      horas: parseFloat(horas.toFixed(2)),
      percentual: 0 // Será calculado depois
    }))
    .sort((a, b) => b.horas - a.horas);
}

function gerarHorasPorRecurso(chamados: OSComHoras[]) {
  const horasPorRecurso = new Map<string, { 
    codRecurso: number;
    horas: number; 
    quantidadeOS: number 
  }>();
  
  chamados.forEach(os => {
    const recurso = os.NOME_RECURSO || 'Sem recurso';
    const atual = horasPorRecurso.get(recurso) || { 
      codRecurso: os.COD_RECURSO,
      horas: 0, 
      quantidadeOS: 0 
    };
    
    horasPorRecurso.set(recurso, {
      codRecurso: atual.codRecurso,
      horas: atual.horas + (os.TOTAL_HRS_OS || 0),
      quantidadeOS: atual.quantidadeOS + 1
    });
  });
  
  return Array.from(horasPorRecurso.entries())
    .map(([recurso, dados]) => ({
      recurso,
      codRecurso: dados.codRecurso,
      horas: parseFloat(dados.horas.toFixed(2)),
      quantidadeOS: dados.quantidadeOS,
      mediaHorasPorOS: parseFloat((dados.horas / dados.quantidadeOS).toFixed(2))
    }))
    .sort((a, b) => b.horas - a.horas);
}

function gerarHorasPorCliente(chamados: OSComHoras[]) {
  const horasPorCliente = new Map<string, { 
    codCliente: number;
    horas: number; 
    quantidadeOS: number;
    quantidadeChamados: Set<string>;
  }>();
  
  chamados.forEach(os => {
    const cliente = os.NOME_CLIENTE || 'Sem cliente';
    const atual = horasPorCliente.get(cliente) || { 
      codCliente: os.COD_CLIENTE,
      horas: 0, 
      quantidadeOS: 0,
      quantidadeChamados: new Set<string>()
    };
    
    if (os.CHAMADO_OS) {
      atual.quantidadeChamados.add(os.CHAMADO_OS);
    }
    
    horasPorCliente.set(cliente, {
      codCliente: atual.codCliente,
      horas: atual.horas + (os.TOTAL_HRS_OS || 0),
      quantidadeOS: atual.quantidadeOS + 1,
      quantidadeChamados: atual.quantidadeChamados
    });
  });
  
  return Array.from(horasPorCliente.entries())
    .map(([cliente, dados]) => ({
      cliente,
      codCliente: dados.codCliente,
      horas: parseFloat(dados.horas.toFixed(2)),
      quantidadeOS: dados.quantidadeOS,
      quantidadeChamados: dados.quantidadeChamados.size,
      mediaHorasPorOS: parseFloat((dados.horas / dados.quantidadeOS).toFixed(2))
    }))
    .sort((a, b) => b.horas - a.horas);
}

async function gerarHorasPorMes(ano: number, params: QueryParams) {
  const mesesNomes = [
    'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
    'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
  ];
  
  const horasPorMes: Array<{ mes: string; horas: number; mesNum: number }> = [];
  
  // Buscar dados de todos os meses do ano
  for (let mes = 1; mes <= 12; mes++) {
    const { dataInicio, dataFim } = construirDatas(mes, ano);
    
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
      WHERE OS.DTINI_OS >= ? AND OS.DTINI_OS < ?
    `;
    
    const paramsMensal = [dataInicio, dataFim];
    
    // Aplicar filtros opcionais
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
        horas: parseFloat(totalHoras.toFixed(2))
      });
    } catch (error) {
      console.error(`Erro ao buscar dados do mês ${mes}:`, error);
      horasPorMes.push({
        mes: mesesNomes[mes - 1],
        mesNum: mes,
        horas: 0
      });
    }
  }
  
  return horasPorMes;
}

function calcularPercentuais(dados: Array<{ horas: number; [key: string]: any }>) {
  const total = dados.reduce((acc, item) => acc + item.horas, 0);
  return dados.map(item => ({
    ...item,
    percentual: total > 0 ? parseFloat(((item.horas / total) * 100).toFixed(2)) : 0
  }));
}

function calcularTotalizadores(
  chamados: OSComHoras[],
  horasPorChamado: Map<string, number>,
  horasPorTarefa: Map<number, number>,
  totaisDB: any
) {
  const totalHoras = chamados.reduce((acc, os) => acc + (os.TOTAL_HRS_OS || 0), 0);
  
  const totalChamadosComHoras = horasPorChamado.size;
  const totalHorasChamados = Array.from(horasPorChamado.values()).reduce((acc, h) => acc + h, 0);
  const mediaHorasPorChamado = totalChamadosComHoras > 0 
    ? totalHorasChamados / totalChamadosComHoras 
    : 0;

  const totalTarefasComHoras = horasPorTarefa.size;
  const totalHorasTarefas = Array.from(horasPorTarefa.values()).reduce((acc, h) => acc + h, 0);
  const mediaHorasPorTarefa = totalTarefasComHoras > 0 
    ? totalHorasTarefas / totalTarefasComHoras 
    : 0;

  return {
    ...(totaisDB[0] || {
      TOTAL_OS: 0,
      TOTAL_CHAMADOS: 0,
      TOTAL_RECURSOS: 0
    }),
    TOTAL_HRS: parseFloat(totalHoras.toFixed(2)),
    TOTAL_HRS_CHAMADOS: parseFloat(totalHorasChamados.toFixed(2)),
    TOTAL_HRS_TAREFAS: parseFloat(totalHorasTarefas.toFixed(2)),
    MEDIA_HRS_POR_CHAMADO: parseFloat(mediaHorasPorChamado.toFixed(2)),
    MEDIA_HRS_POR_TAREFA: parseFloat(mediaHorasPorTarefa.toFixed(2)),
    TOTAL_CHAMADOS_COM_HORAS: totalChamadosComHoras,
    TOTAL_TAREFAS_COM_HORAS: totalTarefasComHoras
  };
}

// ==================== HANDLER PRINCIPAL ====================
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Validar parâmetros
    const params = validarParametros(searchParams);
    if (params instanceof NextResponse) return params;

    // Construir datas
    const { dataInicio, dataFim } = construirDatas(params.mes, params.ano);

    // Construir query principal
    const { sql: sqlPrincipal, params: paramsPrincipal } = aplicarFiltros(
      SQL_BASE,
      params,
      [dataInicio, dataFim]
    );
    const sqlFinal = `${sqlPrincipal} ORDER BY OS.DTINI_OS DESC, OS.HRINI_OS DESC`;

    // Construir query de totalizadores
    const { sql: sqlTotais, params: paramsTotais } = aplicarFiltros(
      SQL_TOTALIZADORES_BASE,
      params,
      [dataInicio, dataFim]
    );

    // Executar queries em paralelo para melhor performance
    const [chamadosRaw, totalizadoresDB] = await Promise.all([
      firebirdQuery(sqlFinal, paramsPrincipal),
      firebirdQuery(sqlTotais, paramsTotais)
    ]);

    // NORMALIZAR DADOS - Converter strings vazias em null
    const chamados = normalizarArray(chamadosRaw);

    // Processar dados
    const chamadosComHoras = processarChamadosComHoras(chamados);
    const { horasPorChamado, horasPorTarefa } = agruparHoras(chamadosComHoras);
    const totalizadores = calcularTotalizadores(
      chamadosComHoras,
      horasPorChamado,
      horasPorTarefa,
      totalizadoresDB
    );

    // Gerar dados para gráficos
    const horasPorDia = gerarHorasPorDia(chamadosComHoras, params.mes, params.ano);
    const topChamados = gerarTopChamados(chamadosComHoras, 10);
    const horasPorStatusRaw = gerarHorasPorStatus(chamadosComHoras);
    const horasPorStatus = calcularPercentuais(horasPorStatusRaw);
    const horasPorRecurso = gerarHorasPorRecurso(chamadosComHoras);
    const horasPorCliente = params.isAdmin ? gerarHorasPorCliente(chamadosComHoras) : undefined;
    
    // Gerar dados anuais (todos os meses do ano)
    const horasPorMes = await gerarHorasPorMes(params.ano, params);

    return NextResponse.json({
      ordensServico: chamadosComHoras,
      totalizadores,
      graficos: {
        horasPorDia,          // Gráfico de linha - evolução diária
        topChamados,          // Gráfico de barras - top chamados
        horasPorStatus,       // Gráfico de pizza - distribuição por status
        horasPorRecurso,      // Gráfico de barras horizontais - horas por recurso
        horasPorCliente,      // Gráfico comparativo (apenas admin)
        horasPorMes           // Gráfico de barras - horas por mês (ano completo)
      }
    });

  } catch (error) {
    console.error('Erro ao buscar chamados:', error);
    console.error('Stack trace:', error instanceof Error ? error.stack : 'N/A');
    console.error('Message:', error instanceof Error ? error.message : error);
    
    return NextResponse.json(
      { 
        error: 'Erro no servidor',
        message: error instanceof Error ? error.message : 'Erro desconhecido',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      },
      { status: 500 }
    );
  }
}