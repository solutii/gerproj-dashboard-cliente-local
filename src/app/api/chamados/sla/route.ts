// app/api/chamados/sla/route.ts

import { firebirdQuery } from '@/lib/firebird/firebird-client';
import { calcularMetricasSLA, calcularStatusSLA, SLA_CONFIGS } from '@/lib/sla/sla-utils';
import { NextRequest, NextResponse } from 'next/server';

interface ChamadoSLA {
    COD_CHAMADO: number;
    DATA_CHAMADO: Date;
    HORA_CHAMADO: string;
    PRIOR_CHAMADO: number;
    STATUS_CHAMADO: string;
    CONCLUSAO_CHAMADO?: Date | null;
    NOME_CLIENTE?: string;
    ASSUNTO_CHAMADO?: string;
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);

        // Parâmetros
        const isAdmin = searchParams.get('isAdmin') === 'true';
        const codCliente = searchParams.get('codCliente')?.trim();
        const mes = Number(searchParams.get('mes'));
        const ano = Number(searchParams.get('ano'));
        const statusFilter = searchParams.get('statusFilter')?.trim();
        const tipoRelatorio = searchParams.get('tipo') || 'resumo'; // resumo, detalhado, metricas

        // Validações
        if (!isAdmin && !codCliente) {
            return NextResponse.json(
                { error: "Parâmetro 'codCliente' obrigatório para não-admin" },
                { status: 400 }
            );
        }

        if (!mes || mes < 1 || mes > 12) {
            return NextResponse.json({ error: "Parâmetro 'mes' inválido" }, { status: 400 });
        }

        if (!ano || ano < 2000 || ano > 3000) {
            return NextResponse.json({ error: "Parâmetro 'ano' inválido" }, { status: 400 });
        }

        // Construir datas
        const m = mes.toString().padStart(2, '0');
        const dataInicio = `01.${m}.${ano}`;
        const dataFim =
            mes === 12 ? `01.01.${ano + 1}` : `01.${(mes + 1).toString().padStart(2, '0')}.${ano}`;

        // Construir query
        const whereClauses: string[] = ['CHAMADO.DATA_CHAMADO >= ?', 'CHAMADO.DATA_CHAMADO < ?'];
        const params: any[] = [dataInicio, dataFim];

        if (!isAdmin && codCliente) {
            whereClauses.push('CHAMADO.COD_CLIENTE = ?');
            params.push(parseInt(codCliente));
        }

        if (statusFilter) {
            whereClauses.push('UPPER(CHAMADO.STATUS_CHAMADO) LIKE UPPER(?)');
            params.push(`%${statusFilter}%`);
        }

        const whereClause = whereClauses.join(' AND ');

        const sql = `
      SELECT
        CHAMADO.COD_CHAMADO,
        CHAMADO.DATA_CHAMADO,
        CHAMADO.HORA_CHAMADO,
        CHAMADO.PRIOR_CHAMADO,
        CHAMADO.STATUS_CHAMADO,
        CHAMADO.CONCLUSAO_CHAMADO,
        CHAMADO.ASSUNTO_CHAMADO,
        CLIENTE.NOME_CLIENTE
      FROM CHAMADO
      LEFT JOIN CLIENTE ON CHAMADO.COD_CLIENTE = CLIENTE.COD_CLIENTE
      WHERE ${whereClause}
      ORDER BY CHAMADO.DATA_CHAMADO DESC, CHAMADO.HORA_CHAMADO DESC
    `;

        const chamados = await firebirdQuery<ChamadoSLA>(sql, params);

        if (chamados.length === 0) {
            return NextResponse.json({
                success: true,
                mes,
                ano,
                totalChamados: 0,
                metricas: null,
                data: [],
            });
        }

        // Processar SLA para cada chamado
        const chamadosComSLA = chamados.map((chamado) => {
            const slaResolucao = calcularStatusSLA(
                chamado.DATA_CHAMADO,
                chamado.HORA_CHAMADO,
                chamado.PRIOR_CHAMADO,
                chamado.STATUS_CHAMADO,
                chamado.CONCLUSAO_CHAMADO,
                'resolucao'
            );

            const slaResposta = calcularStatusSLA(
                chamado.DATA_CHAMADO,
                chamado.HORA_CHAMADO,
                chamado.PRIOR_CHAMADO,
                chamado.STATUS_CHAMADO,
                chamado.CONCLUSAO_CHAMADO,
                'resposta'
            );

            const config = SLA_CONFIGS[chamado.PRIOR_CHAMADO] || SLA_CONFIGS[100];

            return {
                codChamado: chamado.COD_CHAMADO,
                dataChamado: chamado.DATA_CHAMADO,
                horaChamado: chamado.HORA_CHAMADO,
                prioridade: chamado.PRIOR_CHAMADO,
                status: chamado.STATUS_CHAMADO,
                assunto: chamado.ASSUNTO_CHAMADO,
                cliente: chamado.NOME_CLIENTE,
                conclusao: chamado.CONCLUSAO_CHAMADO,
                sla: {
                    config: {
                        tempoResposta: config.tempoResposta,
                        tempoResolucao: config.tempoResolucao,
                    },
                    resposta: slaResposta,
                    resolucao: slaResolucao,
                },
            };
        });

        // Calcular métricas agregadas
        const metricas = calcularMetricasSLA(chamados);

        // Retornar dados conforme tipo de relatório
        if (tipoRelatorio === 'metricas') {
            return NextResponse.json({
                success: true,
                mes,
                ano,
                metricas,
            });
        }

        if (tipoRelatorio === 'resumo') {
            // Retorna apenas resumo estatístico
            const resumoPorStatus = chamadosComSLA.reduce(
                (acc, c) => {
                    const status = c.sla.resolucao.status;
                    acc[status] = (acc[status] || 0) + 1;
                    return acc;
                },
                {} as Record<string, number>
            );

            return NextResponse.json({
                success: true,
                mes,
                ano,
                totalChamados: chamados.length,
                metricas,
                resumoPorStatus,
                chamadosCriticos: chamadosComSLA
                    .filter(
                        (c) =>
                            c.sla.resolucao.status === 'CRITICO' ||
                            c.sla.resolucao.status === 'VENCIDO'
                    )
                    .slice(0, 10), // Top 10 críticos
            });
        }

        // Retorna dados detalhados
        return NextResponse.json({
            success: true,
            mes,
            ano,
            totalChamados: chamados.length,
            metricas,
            data: chamadosComSLA,
        });
    } catch (error) {
        console.error('[API SLA] Erro:', error instanceof Error ? error.message : error);

        return NextResponse.json(
            {
                success: false,
                error: 'Erro ao buscar métricas de SLA',
                message: error instanceof Error ? error.message : 'Erro desconhecido',
            },
            { status: 500 }
        );
    }
}

// Endpoint adicional para configuração de SLA
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // Aqui você pode implementar salvamento de configurações customizadas de SLA
        // por cliente ou globalmente

        return NextResponse.json({
            success: true,
            message: 'Configuração de SLA atualizada',
        });
    } catch (error) {
        return NextResponse.json(
            {
                success: false,
                error: 'Erro ao atualizar configuração de SLA',
            },
            { status: 500 }
        );
    }
}
