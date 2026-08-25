// app/api/dashboard/sla-metricas/route.ts
//
// Métricas agregadas de SLA (cumprimento de prazo por prioridade, tempo médio
// de resolução) pro card do dashboard. Só leitura — reaproveita
// calcularMetricasSLA() já existente em sla-utils.ts.
import { safeErrorMessage } from '@/lib/api-error';
import { firebirdQuery } from '@/lib/firebird/firebird-client';
import { buscarFeriados } from '@/lib/os/feriados-service';
import { calcularMetricasSLA } from '@/lib/sla/sla-utils';
import { NextResponse } from 'next/server';

interface QueryParams {
    codCliente: string;
    mes: number;
    ano: number;
    codRecursoFilter?: string;
}

interface ChamadoSLARow {
    COD_CHAMADO: number;
    DATA_CHAMADO: Date;
    HORA_CHAMADO: string;
    PRIOR_CHAMADO: number;
    STATUS_CHAMADO: string;
    CONCLUSAO_CHAMADO: Date | null;
}

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
    };
}

function construirDatas(mes: number, ano: number): { dataInicio: string; dataFim: string } {
    const mesFormatado = mes.toString().padStart(2, '0');
    const dataInicio = `01.${mesFormatado}.${ano}`;

    const dataFim =
        mes === 12 ? `01.01.${ano + 1}` : `01.${(mes + 1).toString().padStart(2, '0')}.${ano}`;

    return { dataInicio, dataFim };
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);

        const params = validarParametros(searchParams);
        if (params instanceof NextResponse) return params;

        const { dataInicio, dataFim } = construirDatas(params.mes, params.ano);

        let sql = `
            SELECT CHAMADO.COD_CHAMADO, CHAMADO.DATA_CHAMADO, CHAMADO.HORA_CHAMADO,
                   CHAMADO.PRIOR_CHAMADO, CHAMADO.STATUS_CHAMADO, CHAMADO.CONCLUSAO_CHAMADO
            FROM CHAMADO
            WHERE CHAMADO.DATA_CHAMADO >= ?
              AND CHAMADO.DATA_CHAMADO < ?
              AND CHAMADO.COD_CLIENTE = ?
        `;
        const sqlParams: (string | number)[] = [dataInicio, dataFim, parseInt(params.codCliente)];

        if (params.codRecursoFilter) {
            sql += ` AND CHAMADO.COD_RECURSO = ?`;
            sqlParams.push(parseInt(params.codRecursoFilter));
        }

        const [chamados, feriados] = await Promise.all([
            firebirdQuery<ChamadoSLARow>(sql, sqlParams),
            buscarFeriados({ year: params.ano }),
        ]);

        const metricas = calcularMetricasSLA(
            chamados.map((c) => ({
                COD_CHAMADO: c.COD_CHAMADO,
                DATA_CHAMADO: c.DATA_CHAMADO,
                HORA_CHAMADO: c.HORA_CHAMADO,
                PRIOR_CHAMADO: c.PRIOR_CHAMADO ?? 100,
                STATUS_CHAMADO: c.STATUS_CHAMADO,
                CONCLUSAO_CHAMADO: c.CONCLUSAO_CHAMADO,
            })),
            feriados
        );

        return NextResponse.json(metricas);
    } catch (error) {
        console.error('[API SLA METRICAS] Erro:', error);
        return NextResponse.json(
            {
                error: 'Erro ao calcular métricas de SLA',
                message: safeErrorMessage(error),
            },
            { status: 500 }
        );
    }
}
