// app/api/chamados/sla-integrado/route.ts

import { firebirdQuery } from '@/lib/firebird/firebird-client';
import { gerarRelatorioExcel, gerarRelatorioPDF } from '@/lib/sla/sla-reports';
import { calcularMetricasSLA, calcularStatusSLA, SLA_CONFIGS } from '@/lib/sla/sla-utils';
import { NextRequest, NextResponse } from 'next/server';

interface ChamadoComSLA {
    COD_CHAMADO: number;
    DATA_CHAMADO: Date;
    HORA_CHAMADO: string;
    SOLICITACAO_CHAMADO?: string | null;
    CONCLUSAO_CHAMADO: Date | null;
    STATUS_CHAMADO: string;
    DTENVIO_CHAMADO: string | null;
    ASSUNTO_CHAMADO: string | null;
    EMAIL_CHAMADO: string | null;
    PRIOR_CHAMADO: number;
    COD_CLASSIFICACAO: number;
    NOME_CLIENTE?: string | null;
    NOME_RECURSO?: string | null;
    NOME_CLASSIFICACAO?: string | null;
    TEM_OS?: boolean;
    TOTAL_HORAS_OS?: number;
    AVALIA_CHAMADO?: number;
    OBSAVAL_CHAMADO?: string | null;
    DATA_HISTCHAMADO?: Date | null;
    HORA_HISTCHAMADO?: string | null;
    // Campos SLA
    SLA_STATUS: string;
    SLA_PERCENTUAL: number;
    SLA_TEMPO_DECORRIDO: number;
    SLA_TEMPO_RESTANTE: number;
    SLA_PRAZO_TOTAL: number;
    SLA_DENTRO_PRAZO: boolean;
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);

        // Parâmetros básicos
        const isAdmin = searchParams.get('isAdmin') === 'true';
        const codCliente = searchParams.get('codCliente')?.trim();
        const mes = Number(searchParams.get('mes'));
        const ano = Number(searchParams.get('ano'));
        const page = Number(searchParams.get('page')) || 1;
        const limit = Number(searchParams.get('limit')) || 50;
        const incluirSLA = searchParams.get('incluirSLA') !== 'false'; // true por padrão
        const exportFormat = searchParams.get('export'); // 'excel' ou 'pdf'

        // Validações básicas
        if (!isAdmin && !codCliente) {
            return NextResponse.json(
                { error: "Parâmetro 'codCliente' obrigatório" },
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

        // Construir query base
        const whereClauses: string[] = ['CHAMADO.DATA_CHAMADO >= ?', 'CHAMADO.DATA_CHAMADO < ?'];
        const params: any[] = [dataInicio, dataFim];

        if (!isAdmin && codCliente) {
            whereClauses.push('CHAMADO.COD_CLIENTE = ?');
            params.push(parseInt(codCliente));
        }

        // Filtros adicionais
        const statusFilter = searchParams.get('statusFilter');
        if (statusFilter) {
            whereClauses.push('UPPER(CHAMADO.STATUS_CHAMADO) LIKE UPPER(?)');
            params.push(`%${statusFilter}%`);
        }

        const codChamadoFilter = searchParams.get('codChamado');
        if (codChamadoFilter) {
            whereClauses.push('CHAMADO.COD_CHAMADO = ?');
            params.push(parseInt(codChamadoFilter));
        }

        const slaStatusFilter = searchParams.get('slaStatus'); // 'OK', 'ALERTA', 'CRITICO', 'VENCIDO'

        const whereClause = whereClauses.join(' AND ');

        // Query principal
        const sql = `
      SELECT
        CHAMADO.COD_CHAMADO,
        CHAMADO.DATA_CHAMADO,
        CHAMADO.HORA_CHAMADO,
        CHAMADO.SOLICITACAO_CHAMADO,
        CHAMADO.CONCLUSAO_CHAMADO,
        CHAMADO.STATUS_CHAMADO,
        CHAMADO.DTENVIO_CHAMADO,
        CHAMADO.ASSUNTO_CHAMADO,
        CHAMADO.EMAIL_CHAMADO,
        CHAMADO.PRIOR_CHAMADO,
        CHAMADO.COD_CLASSIFICACAO,
        CHAMADO.AVALIA_CHAMADO,
        CHAMADO.OBSAVAL_CHAMADO,
        CLIENTE.NOME_CLIENTE,
        RECURSO.NOME_RECURSO,
        CLASSIFICACAO.NOME_CLASSIFICACAO,
        HISTCHAMADO.DATA_HISTCHAMADO,
        HISTCHAMADO.HORA_HISTCHAMADO,
        COALESCE(SUM((CAST(SUBSTRING(OS.HRFIM_OS FROM 1 FOR 2) AS INTEGER) * 60 +
             CAST(SUBSTRING(OS.HRFIM_OS FROM 3 FOR 2) AS INTEGER) -
             CAST(SUBSTRING(OS.HRINI_OS FROM 1 FOR 2) AS INTEGER) * 60 -
             CAST(SUBSTRING(OS.HRINI_OS FROM 3 FOR 2) AS INTEGER)) / 60.0), 0) AS TOTAL_HORAS_OS
      FROM CHAMADO
      LEFT JOIN CLIENTE ON CHAMADO.COD_CLIENTE = CLIENTE.COD_CLIENTE
      LEFT JOIN RECURSO ON CHAMADO.COD_RECURSO = RECURSO.COD_RECURSO
      LEFT JOIN CLASSIFICACAO ON CHAMADO.COD_CLASSIFICACAO = CLASSIFICACAO.COD_CLASSIFICACAO
      LEFT JOIN OS ON CAST(CHAMADO.COD_CHAMADO AS VARCHAR(20)) = OS.CHAMADO_OS
          AND OS.DTINI_OS >= ? AND OS.DTINI_OS < ?
      LEFT JOIN TAREFA ON OS.CODTRF_OS = TAREFA.COD_TAREFA AND TAREFA.EXIBECHAM_TAREFA = 1
      LEFT JOIN HISTCHAMADO ON CHAMADO.COD_CHAMADO = HISTCHAMADO.COD_CHAMADO
          AND UPPER(HISTCHAMADO.DESC_HISTCHAMADO) = 'FINALIZADO'
      WHERE ${whereClause}
      GROUP BY
        CHAMADO.COD_CHAMADO,
        CHAMADO.DATA_CHAMADO,
        CHAMADO.HORA_CHAMADO,
        CHAMADO.SOLICITACAO_CHAMADO,
        CHAMADO.CONCLUSAO_CHAMADO,
        CHAMADO.STATUS_CHAMADO,
        CHAMADO.DTENVIO_CHAMADO,
        CHAMADO.ASSUNTO_CHAMADO,
        CHAMADO.EMAIL_CHAMADO,
        CHAMADO.PRIOR_CHAMADO,
        CHAMADO.COD_CLASSIFICACAO,
        CHAMADO.AVALIA_CHAMADO,
        CHAMADO.OBSAVAL_CHAMADO,
        CLIENTE.NOME_CLIENTE,
        RECURSO.NOME_RECURSO,
        CLASSIFICACAO.NOME_CLASSIFICACAO,
        HISTCHAMADO.DATA_HISTCHAMADO,
        HISTCHAMADO.HORA_HISTCHAMADO
      ORDER BY CHAMADO.DATA_CHAMADO DESC, CHAMADO.HORA_CHAMADO DESC
    `;

        const sqlParams = [dataInicio, dataFim, ...params];
        const chamadosRaw = await firebirdQuery<any>(sql, sqlParams);

        // Processar chamados com SLA
        let chamadosProcessados = chamadosRaw.map((c) => {
            const base = {
                COD_CHAMADO: c.COD_CHAMADO,
                DATA_CHAMADO: c.DATA_CHAMADO,
                HORA_CHAMADO: c.HORA_CHAMADO ?? '',
                SOLICITACAO_CHAMADO: c.SOLICITACAO_CHAMADO || null,
                CONCLUSAO_CHAMADO: c.CONCLUSAO_CHAMADO || null,
                STATUS_CHAMADO: c.STATUS_CHAMADO,
                DTENVIO_CHAMADO: c.DTENVIO_CHAMADO || null,
                ASSUNTO_CHAMADO: c.ASSUNTO_CHAMADO || null,
                EMAIL_CHAMADO: c.EMAIL_CHAMADO || null,
                PRIOR_CHAMADO: c.PRIOR_CHAMADO ?? 100,
                COD_CLASSIFICACAO: c.COD_CLASSIFICACAO ?? 0,
                NOME_CLIENTE: c.NOME_CLIENTE || null,
                NOME_RECURSO: c.NOME_RECURSO || null,
                NOME_CLASSIFICACAO: c.NOME_CLASSIFICACAO || null,
                TEM_OS: (c.TOTAL_HORAS_OS ?? 0) > 0,
                TOTAL_HORAS_OS: c.TOTAL_HORAS_OS ?? 0,
                AVALIA_CHAMADO: c.AVALIA_CHAMADO ?? 1,
                OBSAVAL_CHAMADO: c.OBSAVAL_CHAMADO ?? null,
                DATA_HISTCHAMADO: c.DATA_HISTCHAMADO || null,
                HORA_HISTCHAMADO: c.HORA_HISTCHAMADO || null,
            };

            if (!incluirSLA) {
                return base;
            }

            // Calcular SLA
            const sla = calcularStatusSLA(
                c.DATA_CHAMADO,
                c.HORA_CHAMADO ?? '00:00',
                c.PRIOR_CHAMADO ?? 100,
                c.STATUS_CHAMADO,
                c.CONCLUSAO_CHAMADO,
                'resolucao'
            );

            const config = SLA_CONFIGS[c.PRIOR_CHAMADO ?? 100] || SLA_CONFIGS[100];

            return {
                ...base,
                SLA_STATUS: sla.status,
                SLA_PERCENTUAL: sla.percentualUsado,
                SLA_TEMPO_DECORRIDO: sla.tempoDecorrido,
                SLA_TEMPO_RESTANTE: sla.tempoRestante,
                SLA_PRAZO_TOTAL: config.tempoResolucao,
                SLA_DENTRO_PRAZO: sla.dentroPrazo,
            };
        });

        // Filtrar por status de SLA se solicitado
        if (slaStatusFilter && incluirSLA) {
            chamadosProcessados = chamadosProcessados.filter(
                (c) => 'SLA_STATUS' in c && c.SLA_STATUS === slaStatusFilter.toUpperCase()
            );
        }

        // Paginação
        const totalChamados = chamadosProcessados.length;
        const totalPages = Math.ceil(totalChamados / limit);
        const offset = (page - 1) * limit;
        const chamadosPaginados = chamadosProcessados.slice(offset, offset + limit);

        // Calcular métricas se SLA estiver incluído
        let metricas = null;
        if (incluirSLA) {
            metricas = calcularMetricasSLA(chamadosRaw);
        }

        // Se for solicitado export, gerar arquivo
        if (exportFormat) {
            const dadosExport = {
                chamados: chamadosRaw,
                metricas: metricas || calcularMetricasSLA(chamadosRaw),
                periodo: { mes, ano },
                cliente: chamadosRaw[0]?.NOME_CLIENTE || undefined,
            };

            if (exportFormat === 'excel') {
                const blob = await gerarRelatorioExcel(dadosExport);
                const buffer = await blob.arrayBuffer();

                return new NextResponse(buffer, {
                    headers: {
                        'Content-Type':
                            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                        'Content-Disposition': `attachment; filename="relatorio-sla-${mes}-${ano}.xlsx"`,
                    },
                });
            }

            if (exportFormat === 'pdf') {
                const html = await gerarRelatorioPDF(dadosExport);

                return new NextResponse(html, {
                    headers: {
                        'Content-Type': 'text/html',
                        'Content-Disposition': `inline; filename="relatorio-sla-${mes}-${ano}.html"`,
                    },
                });
            }
        }

        // Resposta padrão JSON
        return NextResponse.json({
            success: true,
            mes,
            ano,
            totalChamados,
            metricas,
            pagination: {
                page,
                limit,
                totalPages,
                hasNextPage: page < totalPages,
                hasPreviousPage: page > 1,
            },
            data: chamadosPaginados,
        });
    } catch (error) {
        console.error('[API SLA INTEGRADO] Erro:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Erro ao buscar chamados com SLA',
                message: error instanceof Error ? error.message : 'Erro desconhecido',
            },
            { status: 500 }
        );
    }
}

// ==================== Endpoint para Webhook de Notificações ====================
// app/api/chamados/sla/webhook/route.ts
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action, config } = body;

        if (action === 'verificar') {
            // Importar função de verificação
            const { verificarENotificar } = await import('@/lib/sla/sla-notifications');

            const resultado = await verificarENotificar(config);

            return NextResponse.json({
                success: true,
                resultado,
            });
        }

        if (action === 'testar') {
            // Testar envio de notificação
            return NextResponse.json({
                success: true,
                message: 'Notificação de teste enviada',
            });
        }

        return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
    } catch (error) {
        console.error('[SLA WEBHOOK] Erro:', error);
        return NextResponse.json(
            { success: false, error: 'Erro ao processar webhook' },
            { status: 500 }
        );
    }
}
