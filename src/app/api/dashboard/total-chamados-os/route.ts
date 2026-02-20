// app/api/dashboard/total-chamados-os/route.ts
import { NextResponse } from 'next/server';
import { firebirdQuery } from '../../../../lib/firebird/firebird-client';

// ==================== TIPOS ====================
interface QueryParams {
    codCliente: string;
    mes: number;
    ano: number;
    codRecursoFilter?: string;
    status?: string;
}

interface ResultadoTotalizadores {
    TOTAL_CHAMADOS: number;
    CHAMADOS_AGUARDANDO_VALIDACAO: number;
    CHAMADOS_ATRIBUIDO: number;
    CHAMADOS_EM_ATENDIMENTO: number;
    CHAMADOS_FINALIZADO: number;
    CHAMADOS_STANDBY: number;
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
        status: searchParams.get('status')?.trim() || undefined,
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
      COUNT(DISTINCT CHAMADO.COD_CHAMADO) AS TOTAL_CHAMADOS,
      COUNT(DISTINCT CASE WHEN UPPER(TRIM(CHAMADO.STATUS_CHAMADO)) = 'FINALIZADO'           THEN CHAMADO.COD_CHAMADO END) AS CHAMADOS_FINALIZADO,
      COUNT(DISTINCT CASE WHEN UPPER(TRIM(CHAMADO.STATUS_CHAMADO)) = 'STANDBY'              THEN CHAMADO.COD_CHAMADO END) AS CHAMADOS_STANDBY,
      COUNT(DISTINCT CASE WHEN UPPER(TRIM(CHAMADO.STATUS_CHAMADO)) = 'EM ATENDIMENTO'       THEN CHAMADO.COD_CHAMADO END) AS CHAMADOS_EM_ATENDIMENTO,
      COUNT(DISTINCT CASE WHEN UPPER(TRIM(CHAMADO.STATUS_CHAMADO)) = 'AGUARDANDO VALIDACAO' THEN CHAMADO.COD_CHAMADO END) AS CHAMADOS_AGUARDANDO_VALIDACAO,
      COUNT(DISTINCT CASE WHEN UPPER(TRIM(CHAMADO.STATUS_CHAMADO)) = 'ATRIBUIDO'            THEN CHAMADO.COD_CHAMADO END) AS CHAMADOS_ATRIBUIDO
    FROM CHAMADO
    WHERE CHAMADO.DATA_CHAMADO >= ?
      AND CHAMADO.DATA_CHAMADO < ?
      AND CHAMADO.COD_CLIENTE = ?
    `;

    if (params.codRecursoFilter) {
        sql += ` AND CHAMADO.COD_RECURSO = ?`;
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

// ==================== HANDLER PRINCIPAL ====================
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);

        const params = validarParametros(searchParams);
        if (params instanceof NextResponse) return params;

        const { dataInicio, dataFim } = construirDatas(params.mes, params.ano);

        const sql = construirSQL(params);
        const parametros = construirParametros(params, dataInicio, dataFim);

        const resultado = await firebirdQuery<ResultadoTotalizadores>(sql, parametros);

        const totalizadores: ResultadoTotalizadores = resultado[0] || {
            TOTAL_CHAMADOS: 0,
            CHAMADOS_AGUARDANDO_VALIDACAO: 0,
            CHAMADOS_ATRIBUIDO: 0,
            CHAMADOS_EM_ATENDIMENTO: 0,
            CHAMADOS_FINALIZADO: 0,
            CHAMADOS_STANDBY: 0,
        };

        return NextResponse.json(totalizadores);
    } catch (error) {
        console.error('[API TOTALIZADORES] Erro ao buscar totalizadores:', error);
        console.error('[API TOTALIZADORES] Stack:', error instanceof Error ? error.stack : 'N/A');

        return NextResponse.json(
            {
                error: 'Erro interno do servidor',
                message: error instanceof Error ? error.message : 'Erro desconhecido',
            },
            { status: 500 }
        );
    }
}
