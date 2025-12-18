// app/api/chamados/[codChamado]/os/route.ts
import { firebirdQuery } from '@/lib/firebird/firebird-client';
import { NextRequest, NextResponse } from 'next/server';

// ==================== TIPOS ====================
export interface OrdemServico {
  COD_OS: number;
  CODTRF_OS: number;
  DTINI_OS: Date;
  HRINI_OS: string;
  HRFIM_OS: string;
  OBS: string | null;
  NUM_OS: string | null;
  VALCLI_OS: string | null;
  OBSCLI_OS?: string | null;
  NOME_RECURSO?: string | null;
  NOME_TAREFA?: string | null;
  NOME_CLIENTE?: string | null;
  TOTAL_HORAS_OS: number;
}

interface RouteParams {
  params: {
    codChamado: string;
  };
}

interface QueryParams {
  isAdmin: boolean;
  codCliente?: number;
  mes?: number;
  ano?: number;
}

// ==================== CONFIGURAÇÃO DE CAMPOS ====================
const CAMPOS_OS = {
  COD_OS: 'OS.COD_OS',
  CODTRF_OS: 'OS.CODTRF_OS',
  DTINI_OS: 'OS.DTINI_OS',
  HRINI_OS: 'OS.HRINI_OS',
  HRFIM_OS: 'OS.HRFIM_OS',
  OBS: 'OS.OBS',
  NUM_OS: 'OS.NUM_OS',
  VALCLI_OS: 'OS.VALCLI_OS',
  OBSCLI_OS: 'OS.OBSCLI_OS',
  NOME_RECURSO: 'RECURSO.NOME_RECURSO',
  NOME_TAREFA: 'TAREFA.NOME_TAREFA',
  NOME_CLIENTE: 'CLIENTE.NOME_CLIENTE',
};

// ==================== VALIDAÇÕES ====================
function validarCodChamado(codChamado: string): number | NextResponse {
  const cod = parseInt(codChamado);

  if (isNaN(cod) || cod <= 0) {
    return NextResponse.json(
      { error: "Parâmetro 'codChamado' deve ser um número válido" },
      { status: 400 },
    );
  }

  return cod;
}

function validarAutorizacao(
  searchParams: URLSearchParams,
  codChamado: number,
): QueryParams | NextResponse {
  const isAdmin = searchParams.get('isAdmin') === 'true';
  const codCliente = searchParams.get('codCliente')?.trim();
  const mes = searchParams.get('mes');
  const ano = searchParams.get('ano');

  if (!isAdmin && !codCliente) {
    return NextResponse.json(
      { error: "Parâmetro 'codCliente' é obrigatório para usuários não admin" },
      { status: 400 },
    );
  }

  // Validar mes e ano se fornecidos
  let mesNum: number | undefined = undefined;
  let anoNum: number | undefined = undefined;

  if (mes && ano) {
    mesNum = Number(mes);
    anoNum = Number(ano);

    if (mesNum < 1 || mesNum > 12) {
      return NextResponse.json(
        { error: "Parâmetro 'mes' deve ser um número entre 1 e 12" },
        { status: 400 },
      );
    }

    if (anoNum < 2000 || anoNum > 3000) {
      return NextResponse.json(
        { error: "Parâmetro 'ano' deve ser um número válido" },
        { status: 400 },
      );
    }
  }

  return {
    isAdmin,
    codCliente: codCliente ? parseInt(codCliente) : undefined,
    mes: mesNum,
    ano: anoNum,
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

// ==================== VERIFICAR PERMISSÃO ====================
async function verificarPermissaoChamado(
  codChamado: number,
  codCliente: number,
): Promise<boolean> {
  try {
    const sql = `
      SELECT COD_CHAMADO 
      FROM CHAMADO 
      WHERE COD_CHAMADO = ? AND COD_CLIENTE = ?
    `;

    const resultado = await firebirdQuery<{ COD_CHAMADO: number }>(sql, [
      codChamado,
      codCliente,
    ]);

    return resultado.length > 0;
  } catch (error) {
    console.error('[API OS] Erro ao verificar permissão do chamado:', error);
    return false;
  }
}

// ==================== CÁLCULO DE HORAS TRABALHADAS ====================
function calcularHorasTrabalhadas(hrIni: string, hrFim: string): number {
  // Formato esperado: "HHMM" (ex: "0830" = 08:30)
  const horaIni =
    parseInt(hrIni.substring(0, 2)) + parseInt(hrIni.substring(2, 4)) / 60;
  const horaFim =
    parseInt(hrFim.substring(0, 2)) + parseInt(hrFim.substring(2, 4)) / 60;

  return horaFim - horaIni;
}

// ==================== CONSTRUÇÃO DE SQL ====================
function construirSQLBase(
  dataInicio?: string,
  dataFim?: string,
): { sql: string; temFiltroPeriodo: boolean } {
  const campos = Object.values(CAMPOS_OS).join(',\n    ');

  let sql = `
  SELECT 
    ${campos}
  FROM OS
  LEFT JOIN RECURSO ON OS.CODREC_OS = RECURSO.COD_RECURSO
  LEFT JOIN TAREFA ON OS.CODTRF_OS = TAREFA.COD_TAREFA
  LEFT JOIN CHAMADO ON OS.CHAMADO_OS = CAST(CHAMADO.COD_CHAMADO AS VARCHAR(20))
  LEFT JOIN CLIENTE ON CHAMADO.COD_CLIENTE = CLIENTE.COD_CLIENTE
  WHERE OS.CHAMADO_OS = ?`;

  // Se tiver filtro de período, adicionar
  if (dataInicio && dataFim) {
    sql += `
    AND OS.DTINI_OS >= ? 
    AND OS.DTINI_OS < ?`;
    return { sql: sql + `
  ORDER BY OS.DTINI_OS DESC, OS.NUM_OS DESC`, temFiltroPeriodo: true };
  }

  return { sql: sql + `
  ORDER BY OS.DTINI_OS DESC, OS.NUM_OS DESC`, temFiltroPeriodo: false };
}

// ==================== PROCESSAMENTO DE DADOS ====================
function processarOrdemServico(os: any[]): OrdemServico[] {
  return os.map((item) => ({
    COD_OS: item.COD_OS,
    CODTRF_OS: item.CODTRF_OS,
    DTINI_OS: item.DTINI_OS,
    HRINI_OS: item.HRINI_OS,
    HRFIM_OS: item.HRFIM_OS,
    OBS: item.OBS || null,
    NUM_OS: item.NUM_OS || null,
    VALCLI_OS: item.VALCLI_OS || null,
    OBSCLI_OS: item.OBSCLI_OS || null,
    NOME_RECURSO: item.NOME_RECURSO || null,
    NOME_TAREFA: item.NOME_TAREFA || null,
    NOME_CLIENTE: item.NOME_CLIENTE || null,
    TOTAL_HORAS_OS: calcularHorasTrabalhadas(item.HRINI_OS, item.HRFIM_OS),
  }));
}

// ==================== HANDLER PRINCIPAL ====================
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { searchParams } = new URL(request.url);
    const { codChamado } = await params;

    // Validar código do chamado
    const codChamadoValidado = validarCodChamado(codChamado);
    if (codChamadoValidado instanceof NextResponse) return codChamadoValidado;

    // Validar autorização
    const auth = validarAutorizacao(searchParams, codChamadoValidado);
    if (auth instanceof NextResponse) return auth;

    // Se não for admin, verificar se o chamado pertence ao cliente
    if (!auth.isAdmin && auth.codCliente) {
      const temPermissao = await verificarPermissaoChamado(
        codChamadoValidado,
        auth.codCliente,
      );

      if (!temPermissao) {
        return NextResponse.json(
          { error: 'Você não tem permissão para acessar este chamado' },
          { status: 403 },
        );
      }
    }

    // Construir SQL dinamicamente com ou sem filtro de período
    let sqlParams: any[] = [codChamado];
    let dataInicio: string | undefined;
    let dataFim: string | undefined;

    if (auth.mes && auth.ano) {
      const datas = construirDatas(auth.mes, auth.ano);
      dataInicio = datas.dataInicio;
      dataFim = datas.dataFim;
    }

    const { sql: sqlFinal, temFiltroPeriodo } = construirSQLBase(
      dataInicio,
      dataFim,
    );

    // Se tem filtro de período, adicionar os parâmetros de data
    if (temFiltroPeriodo && dataInicio && dataFim) {
      sqlParams.push(dataInicio, dataFim);
    }

    // Buscar OS's do chamado
    const os = await firebirdQuery<any>(sqlFinal, sqlParams);

    // Processar dados
    const osProcessadas = processarOrdemServico(os);

    // Calcular totais
    const totais = {
      quantidade_OS: osProcessadas.length,
      total_horas_chamado: osProcessadas.reduce(
        (acc, item) => acc + item.TOTAL_HORAS_OS,
        0,
      ),
    };

    return NextResponse.json(
      {
        success: true,
        codChamado: codChamadoValidado,
        periodo: temFiltroPeriodo
          ? { mes: auth.mes, ano: auth.ano }
          : undefined,
        totais,
        data: osProcessadas,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('[API OS] ❌ Erro geral:', error);
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
        success: false,
        error: 'Erro interno do servidor',
        message: error instanceof Error ? error.message : 'Erro desconhecido',
        details: process.env.NODE_ENV === 'development' ? error : undefined,
      },
      { status: 500 },
    );
  }
}