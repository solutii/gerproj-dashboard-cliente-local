// src/app/api/dashboard/hrs-contratadas-hrs-executadas/route.ts
import { firebirdQuery } from '@/lib/firebird/firebird-client';
import { NextResponse } from 'next/server';

// ==================== TIPOS ====================
interface QueryParams {
    codCliente: string;
    mes: number;
    ano: number;
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
    FATURADO_OS?: string;
}

interface DadosCliente {
    nome_cliente: string | null;
    maxLimmes: number;
    tarefasDistintas: Set<number>;
    horasExecutadasFaturadas: number;
    horasExecutadasNaoFaturadas: number;
}

// ==================== VALIDAÇÕES ====================
function validarParametros(searchParams: URLSearchParams): QueryParams | NextResponse {
    const codCliente = searchParams.get('codCliente')?.trim();
    const mes = Number(searchParams.get('mes'));
    const ano = Number(searchParams.get('ano'));

    if (!codCliente) {
        return NextResponse.json(
            { error: "Parâmetro 'codCliente' é obrigatório" },
            { status: 400 }
        );
    }

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

    return {
        codCliente,
        mes,
        ano,
        codRecursoFilter: searchParams.get('codRecursoFilter')?.trim() || undefined,
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
function construirSQL(params: QueryParams): string {
    let sql = `
    SELECT
      CLIENTE.COD_CLIENTE,
      CLIENTE.NOME_CLIENTE,
      TAREFA.COD_TAREFA,
      TAREFA.LIMMES_TAREFA,
      OS.HRINI_OS,
      OS.HRFIM_OS,
      OS.FATURADO_OS
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
      AND CLIENTE.COD_CLIENTE = ?
    `;

    if (params.codRecursoFilter) {
        sql += ` AND RECURSO.COD_RECURSO = ?`;
    }

    if (params.status) {
        sql += ` AND UPPER(CHAMADO.STATUS_CHAMADO) LIKE UPPER(?)`;
    }

    return sql;
}

function construirParametros(params: QueryParams, dataInicio: string, dataFim: string): any[] {
    const parametros: any[] = [dataInicio, dataFim, parseInt(params.codCliente)];

    if (params.codRecursoFilter) {
        parametros.push(parseInt(params.codRecursoFilter));
    }

    if (params.status) {
        parametros.push(`%${params.status}%`);
    }

    return parametros;
}

// ==================== CÁLCULOS DE TEMPO ====================
const HORAS_CACHE = new Map<string, number>();

function converterHoraParaMinutos(hora: string | null): number {
    if (!hora) return 0;

    // Remove espaços e garante 4 caracteres com zero à esquerda
    const horaStr = hora.toString().trim().padStart(4, '0');

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
        diferencaMinutos += 1440;
    }

    return diferencaMinutos / 60;
}

// ==================== PROCESSAMENTO DE DADOS ====================
function agruparPorCliente(apontamentos: Apontamento[]): Map<string, DadosCliente> {
    const clientesMap = new Map<string, DadosCliente>();

    for (const apt of apontamentos) {
        const codCliente = apt.COD_CLIENTE?.toString() || 'SEM_CODIGO';

        let cliente = clientesMap.get(codCliente);

        if (!cliente) {
            cliente = {
                nome_cliente: apt.NOME_CLIENTE || null,
                maxLimmes: 0,
                tarefasDistintas: new Set<number>(),
                horasExecutadasFaturadas: 0,
                horasExecutadasNaoFaturadas: 0,
            };
            clientesMap.set(codCliente, cliente);
        }

        if (apt.LIMMES_TAREFA && apt.LIMMES_TAREFA > cliente.maxLimmes) {
            cliente.maxLimmes = apt.LIMMES_TAREFA;
        }

        if (apt.COD_TAREFA) {
            cliente.tarefasDistintas.add(apt.COD_TAREFA);
        }

        if (apt.HRINI_OS && apt.HRFIM_OS) {
            const horas = calcularDiferencaHoras(apt.HRINI_OS, apt.HRFIM_OS);
            const ehNaoFaturado = apt.FATURADO_OS?.toUpperCase() === 'NAO';

            if (ehNaoFaturado) {
                cliente.horasExecutadasNaoFaturadas += horas;
            } else {
                cliente.horasExecutadasFaturadas += horas;
            }
        }
    }

    return clientesMap;
}

const arredondar = (valor: number): number => Math.round(valor * 100) / 100;

function calcularDetalhesClientes(clientesMap: Map<string, DadosCliente>) {
    let totalHorasContratadas = 0;
    let totalHorasFaturadas = 0;
    let totalHorasNaoFaturadas = 0;

    const detalhes = Array.from(clientesMap.entries()).map(([codCliente, dados]) => {
        const horasContratadas = dados.maxLimmes;
        const horasFaturadas = arredondar(dados.horasExecutadasFaturadas);
        const horasNaoFaturadas = arredondar(dados.horasExecutadasNaoFaturadas);
        const horasExecutadas = arredondar(horasFaturadas + horasNaoFaturadas);

        totalHorasContratadas += horasContratadas;
        totalHorasFaturadas += horasFaturadas;
        totalHorasNaoFaturadas += horasNaoFaturadas;

        return {
            cod_cliente: codCliente,
            nome_cliente: dados.nome_cliente,
            horasContratadas,
            horasExecutadas,
            horasFaturadas,
            horasNaoFaturadas,
            totalLimmesTarefas: dados.tarefasDistintas.size,
        };
    });

    return {
        detalhes,
        totalContratadas: arredondar(totalHorasContratadas),
        totalExecutadas: arredondar(totalHorasFaturadas + totalHorasNaoFaturadas),
        totalFaturadas: arredondar(totalHorasFaturadas),
        totalNaoFaturadas: arredondar(totalHorasNaoFaturadas),
    };
}

function calcularResumo(
    totalContratadas: number,
    totalExecutadas: number,
    totalFaturadas: number,
    totalNaoFaturadas: number,
    totalClientes: number
) {
    return {
        totalClientes,
        diferencaHoras: arredondar(totalContratadas - totalExecutadas),
        percentualExecucao:
            totalContratadas > 0 ? arredondar((totalExecutadas / totalContratadas) * 100) : 0,
        percentualFaturadas:
            totalExecutadas > 0 ? arredondar((totalFaturadas / totalExecutadas) * 100) : 0,
        percentualNaoFaturadas:
            totalExecutadas > 0 ? arredondar((totalNaoFaturadas / totalExecutadas) * 100) : 0,
    };
}

// ==================== HANDLER PRINCIPAL ====================
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);

        const params = validarParametros(searchParams);
        if (params instanceof NextResponse) return params;

        const { dataInicio, dataFim } = construirDatas(params.mes, params.ano);

        const sql = construirSQL(params);
        const parametros = construirParametros(params, dataInicio, dataFim);

        const apontamentos = await firebirdQuery<Apontamento>(sql, parametros);

        if (!apontamentos || apontamentos.length === 0) {
            return NextResponse.json({
                totalHorasContratadas: 0,
                totalHorasExecutadas: 0,
                totalHorasFaturadas: 0,
                totalHorasNaoFaturadas: 0,
                detalhesClientes: [],
                resumo: {
                    totalClientes: 0,
                    diferencaHoras: 0,
                    percentualExecucao: 0,
                    percentualFaturadas: 0,
                    percentualNaoFaturadas: 0,
                },
            });
        }

        const clientesMap = agruparPorCliente(apontamentos);

        const { detalhes, totalContratadas, totalExecutadas, totalFaturadas, totalNaoFaturadas } =
            calcularDetalhesClientes(clientesMap);

        const resumo = calcularResumo(
            totalContratadas,
            totalExecutadas,
            totalFaturadas,
            totalNaoFaturadas,
            clientesMap.size
        );

        return NextResponse.json({
            totalHorasContratadas: totalContratadas,
            totalHorasExecutadas: totalExecutadas,
            totalHorasFaturadas: totalFaturadas,
            totalHorasNaoFaturadas: totalNaoFaturadas,
            detalhesClientes: detalhes,
            resumo,
        });
    } catch (error) {
        console.error('[API HORAS] Erro:', error instanceof Error ? error.message : error);

        return NextResponse.json(
            {
                error: 'Erro interno do servidor',
                message: error instanceof Error ? error.message : 'Erro desconhecido',
                details: process.env.NODE_ENV === 'development' ? error : undefined,
            },
            { status: 500 }
        );
    }
}
