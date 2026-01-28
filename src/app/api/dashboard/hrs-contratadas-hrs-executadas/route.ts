// src/app/api/dashboard/hrs-contratadas-hrs-executadas/route.ts
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

interface Apontamento {
    COD_CLIENTE?: number;
    NOME_CLIENTE?: string;
    COD_TAREFA?: number;
    LIMMES_TAREFA?: number;
    HRINI_OS?: string;
    HRFIM_OS?: string;
}

interface DadosCliente {
    nome_cliente: string | null;
    maxLimmes: number;
    tarefasDistintas: Set<number>;
    horasExecutadas: number;
}

// ==================== VALIDAÇÕES ====================
function validarParametros(searchParams: URLSearchParams): QueryParams | NextResponse {
    const isAdmin = searchParams.get('isAdmin') === 'true';
    const codCliente = searchParams.get('codCliente')?.trim();
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
        codClienteFilter: searchParams.get('codClienteFilter')?.trim(),
        codRecursoFilter: searchParams.get('codRecursoFilter')?.trim(),
        status: searchParams.get('status') || undefined,
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

// ==================== CONSTRUÇÃO DE SQL ====================
// ✅ OTIMIZAÇÃO: Movido CAST para WHERE, filtragem mais cedo
const SQL_BASE = `
  SELECT
    CLIENTE.COD_CLIENTE,
    CLIENTE.NOME_CLIENTE,
    TAREFA.COD_TAREFA,
    TAREFA.LIMMES_TAREFA,
    OS.HRINI_OS,
    OS.HRFIM_OS
  FROM OS
  INNER JOIN TAREFA ON OS.CODTRF_OS = TAREFA.COD_TAREFA
  INNER JOIN PROJETO ON TAREFA.CODPRO_TAREFA = PROJETO.COD_PROJETO
  INNER JOIN CLIENTE ON PROJETO.CODCLI_PROJETO = CLIENTE.COD_CLIENTE
  LEFT JOIN RECURSO ON OS.CODREC_OS = RECURSO.COD_RECURSO
  LEFT JOIN CHAMADO ON CAST(OS.CHAMADO_OS AS INTEGER) = CHAMADO.COD_CHAMADO
  WHERE OS.DTINI_OS >= ?
    AND OS.DTINI_OS < ?
    AND TAREFA.EXIBECHAM_TAREFA = 1
    AND OS.CHAMADO_OS IS NOT NULL
    AND TRIM(OS.CHAMADO_OS) <> ''
    AND UPPER(OS.FATURADO_OS) <> 'NAO'
`;

// ✅ SUGESTÃO DE ÍNDICES (adicionar no banco):
// CREATE INDEX IDX_OS_DTINI_CHAMADO ON OS(DTINI_OS, CHAMADO_OS);
// CREATE INDEX IDX_TAREFA_EXIBECHAM ON TAREFA(EXIBECHAM_TAREFA);
// CREATE INDEX IDX_PROJETO_CODCLI ON PROJETO(CODCLI_PROJETO);

function aplicarFiltros(
    sqlBase: string,
    params: QueryParams,
    paramsArray: any[]
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

// ==================== CÁLCULOS DE TEMPO ====================
// ✅ OTIMIZAÇÃO: Lookup table para conversões comuns
const HORAS_CACHE = new Map<string, number>();

function converterHoraParaMinutos(hora: string | null): number {
    if (!hora) return 0;

    const horaStr = hora.toString().padStart(4, '0');

    // Cache para valores repetidos
    if (HORAS_CACHE.has(horaStr)) {
        return HORAS_CACHE.get(horaStr)!;
    }

    const horas = parseInt(horaStr.substring(0, 2)) || 0;
    const minutos = parseInt(horaStr.substring(2, 4)) || 0;
    const resultado = horas * 60 + minutos;

    HORAS_CACHE.set(horaStr, resultado);
    return resultado;
}

function calcularDiferencaHoras(hrInicio: string | null, hrFim: string | null): number {
    if (!hrInicio || !hrFim) return 0;

    const minutosInicio = converterHoraParaMinutos(hrInicio);
    const minutosFim = converterHoraParaMinutos(hrFim);

    let diferencaMinutos = minutosFim - minutosInicio;

    if (diferencaMinutos < 0) {
        diferencaMinutos += 1440; // 24 * 60
    }

    return diferencaMinutos / 60;
}

// ==================== PROCESSAMENTO DE DADOS ====================
// ✅ OTIMIZAÇÃO: Processamento em single-pass, Math.max inline
function agruparPorCliente(apontamentos: Apontamento[]): Map<string, DadosCliente> {
    const clientesMap = new Map<string, DadosCliente>();

    for (let i = 0; i < apontamentos.length; i++) {
        const apt = apontamentos[i];
        const codCliente = apt.COD_CLIENTE?.toString() || 'SEM_CODIGO';

        let cliente = clientesMap.get(codCliente);

        if (!cliente) {
            cliente = {
                nome_cliente: apt.NOME_CLIENTE || null,
                maxLimmes: 0,
                tarefasDistintas: new Set<number>(),
                horasExecutadas: 0,
            };
            clientesMap.set(codCliente, cliente);
        }

        // ✅ OTIMIZAÇÃO: Calcular max inline ao invés de array
        if (apt.LIMMES_TAREFA && apt.LIMMES_TAREFA > cliente.maxLimmes) {
            cliente.maxLimmes = apt.LIMMES_TAREFA;
        }

        if (apt.COD_TAREFA) {
            cliente.tarefasDistintas.add(apt.COD_TAREFA);
        }

        // ✅ OTIMIZAÇÃO: Evitar chamadas de função quando possível
        if (apt.HRINI_OS && apt.HRFIM_OS) {
            cliente.horasExecutadas += calcularDiferencaHoras(apt.HRINI_OS, apt.HRFIM_OS);
        }
    }

    return clientesMap;
}

// ✅ OTIMIZAÇÃO: Arredondamento inline
const arredondar = (valor: number): number => Math.round(valor * 100) / 100;

// ✅ OTIMIZAÇÃO: Single-pass para cálculos
function calcularDetalhesClientes(clientesMap: Map<string, DadosCliente>) {
    let totalHorasContratadas = 0;
    let totalHorasExecutadas = 0;

    const detalhes = Array.from(clientesMap.entries()).map(([codCliente, dados]) => {
        const horasContratadas = dados.maxLimmes;
        const horasExecutadas = arredondar(dados.horasExecutadas);

        totalHorasContratadas += horasContratadas;
        totalHorasExecutadas += horasExecutadas;

        return {
            cod_cliente: codCliente,
            nome_cliente: dados.nome_cliente,
            horasContratadas,
            horasExecutadas,
            totalLimmesTarefas: dados.tarefasDistintas.size,
        };
    });

    return {
        detalhes,
        totalContratadas: arredondar(totalHorasContratadas),
        totalExecutadas: arredondar(totalHorasExecutadas),
    };
}

function calcularResumo(totalContratadas: number, totalExecutadas: number, totalClientes: number) {
    return {
        totalClientes,
        diferencaHoras: arredondar(totalContratadas - totalExecutadas),
        percentualExecucao:
            totalContratadas > 0 ? arredondar((totalExecutadas / totalContratadas) * 100) : 0,
    };
}

// ==================== HANDLER PRINCIPAL ====================
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);

        const params = validarParametros(searchParams);
        if (params instanceof NextResponse) return params;

        const { dataInicio, dataFim } = construirDatas(params.mes, params.ano);

        const { sql, params: sqlParams } = aplicarFiltros(SQL_BASE, params, [dataInicio, dataFim]);

        // ✅ Query otimizada executa
        const apontamentos = await firebirdQuery(sql, sqlParams);

        // ✅ Early return se não houver dados
        if (!apontamentos || apontamentos.length === 0) {
            return NextResponse.json({
                totalHorasContratadas: 0,
                totalHorasExecutadas: 0,
                detalhesClientes: [],
                resumo: {
                    totalClientes: 0,
                    diferencaHoras: 0,
                    percentualExecucao: 0,
                },
            });
        }

        const clientesMap = agruparPorCliente(apontamentos);

        const { detalhes, totalContratadas, totalExecutadas } =
            calcularDetalhesClientes(clientesMap);

        const resumo = calcularResumo(totalContratadas, totalExecutadas, clientesMap.size);

        return NextResponse.json({
            totalHorasContratadas: totalContratadas,
            totalHorasExecutadas: totalExecutadas,
            detalhesClientes: detalhes,
            resumo,
        });
    } catch (error) {
        console.error('[API HORAS] Erro:', error instanceof Error ? error.message : error);

        return NextResponse.json(
            {
                error: 'Erro interno do servidor',
                message: error instanceof Error ? error.message : 'Erro desconhecado',
                details: process.env.NODE_ENV === 'development' ? error : undefined,
            },
            { status: 500 }
        );
    }
}
