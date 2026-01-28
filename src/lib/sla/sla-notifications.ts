// lib/sla/sla-notifications.ts

import { firebirdQuery } from '@/lib/firebird/firebird-client';
import { calcularStatusSLA, SLA_CONFIGS } from '../sla/sla-utils';

export interface NotificacaoSLA {
    COD_NOTIFICACAO: number;
    COD_CHAMADO: number;
    TIPO_NOTIFICACAO: 'ALERTA' | 'CRITICO' | 'VENCIDO';
    EMAIL_DESTINO: string;
    DATA_ENVIO: Date;
    ENVIADO: boolean;
    ERRO_ENVIO?: string | null;
}

export interface ConfigNotificacao {
    emailsAlerta: string[]; // Emails para receber alertas (75-90%)
    emailsCriticos: string[]; // Emails para alertas críticos (90-100%)
    emailsVencidos: string[]; // Emails para SLA vencido (>100%)
    intervaloVerificacao: number; // em minutos
    ativo: boolean;
}

// ==================== Verificar Chamados Críticos ====================
export async function verificarChamadosCriticos(): Promise<{
    alertas: any[];
    criticos: any[];
    vencidos: any[];
}> {
    try {
        // Buscar chamados em aberto
        const sql = `
      SELECT
        CHAMADO.COD_CHAMADO,
        CHAMADO.DATA_CHAMADO,
        CHAMADO.HORA_CHAMADO,
        CHAMADO.PRIOR_CHAMADO,
        CHAMADO.STATUS_CHAMADO,
        CHAMADO.ASSUNTO_CHAMADO,
        CHAMADO.EMAIL_CHAMADO,
        CLIENTE.NOME_CLIENTE,
        CLIENTE.EMAIL_CLIENTE,
        RECURSO.NOME_RECURSO,
        RECURSO.EMAIL_RECURSO
      FROM CHAMADO
      LEFT JOIN CLIENTE ON CHAMADO.COD_CLIENTE = CLIENTE.COD_CLIENTE
      LEFT JOIN RECURSO ON CHAMADO.COD_RECURSO = RECURSO.COD_RECURSO
      WHERE UPPER(CHAMADO.STATUS_CHAMADO) NOT IN ('FINALIZADO', 'CANCELADO')
        AND CHAMADO.DATA_CHAMADO >= CURRENT_DATE - 30
      ORDER BY CHAMADO.PRIOR_CHAMADO, CHAMADO.DATA_CHAMADO
    `;

        const chamados = await firebirdQuery<any>(sql, []);

        const alertas: any[] = [];
        const criticos: any[] = [];
        const vencidos: any[] = [];

        chamados.forEach((chamado) => {
            const sla = calcularStatusSLA(
                chamado.DATA_CHAMADO,
                chamado.HORA_CHAMADO,
                chamado.PRIOR_CHAMADO,
                chamado.STATUS_CHAMADO,
                null,
                'resolucao'
            );

            const info = {
                ...chamado,
                sla,
                emails: [
                    chamado.EMAIL_CHAMADO,
                    chamado.EMAIL_CLIENTE,
                    chamado.EMAIL_RECURSO,
                ].filter(Boolean),
            };

            switch (sla.status) {
                case 'ALERTA':
                    alertas.push(info);
                    break;
                case 'CRITICO':
                    criticos.push(info);
                    break;
                case 'VENCIDO':
                    vencidos.push(info);
                    break;
            }
        });

        return { alertas, criticos, vencidos };
    } catch (error) {
        console.error('[SLA NOTIFICATIONS] Erro ao verificar:', error);
        throw error;
    }
}

// ==================== Enviar Notificações por Email ====================
export async function enviarNotificacaoEmail(
    chamado: any,
    tipo: 'ALERTA' | 'CRITICO' | 'VENCIDO',
    destinatarios: string[]
): Promise<boolean> {
    try {
        const assunto = gerarAssuntoEmail(chamado, tipo);
        const corpo = gerarCorpoEmail(chamado, tipo);

        // Aqui você integraria com seu serviço de email (SendGrid, AWS SES, etc)
        // Exemplo com API genérica:
        const response = await fetch('/api/email/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                to: destinatarios,
                subject: assunto,
                html: corpo,
            }),
        });

        if (!response.ok) {
            throw new Error('Erro ao enviar email');
        }

        // Registrar notificação enviada
        await registrarNotificacao(chamado.COD_CHAMADO, tipo, destinatarios.join(','), true);

        return true;
    } catch (error) {
        console.error('[SLA NOTIFICATIONS] Erro ao enviar email:', error);
        await registrarNotificacao(
            chamado.COD_CHAMADO,
            tipo,
            destinatarios.join(','),
            false,
            error instanceof Error ? error.message : 'Erro desconhecido'
        );
        return false;
    }
}

// ==================== Gerar Assunto do Email ====================
function gerarAssuntoEmail(chamado: any, tipo: 'ALERTA' | 'CRITICO' | 'VENCIDO'): string {
    const prefixos: Record<'ALERTA' | 'CRITICO' | 'VENCIDO', string> = {
        ALERTA: '⚠️ ALERTA',
        CRITICO: '🔴 CRÍTICO',
        VENCIDO: '❌ SLA VENCIDO',
    };

    return `${prefixos[tipo]} - Chamado #${chamado.COD_CHAMADO} - ${chamado.ASSUNTO_CHAMADO}`;
}

// ==================== Gerar Corpo do Email ====================
function gerarCorpoEmail(chamado: any, tipo: 'ALERTA' | 'CRITICO' | 'VENCIDO'): string {
    const { sla } = chamado;
    const config = SLA_CONFIGS[chamado.PRIOR_CHAMADO] || SLA_CONFIGS[100];

    const cores: Record<'ALERTA' | 'CRITICO' | 'VENCIDO', string> = {
        ALERTA: '#f59e0b',
        CRITICO: '#ef4444',
        VENCIDO: '#991b1b',
    };

    const mensagens: Record<'ALERTA' | 'CRITICO' | 'VENCIDO', string> = {
        ALERTA: 'está próximo do vencimento',
        CRITICO: 'está em estado crítico',
        VENCIDO: 'teve o SLA vencido',
    };

    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: ${cores[tipo]}; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
        .info-row { padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
        .label { font-weight: bold; color: #6b7280; }
        .value { color: #111827; }
        .progress { background: #e5e7eb; height: 24px; border-radius: 12px; overflow: hidden; margin: 10px 0; }
        .progress-bar { background: ${cores[tipo]}; height: 100%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 12px; }
        .footer { background: #f3f4f6; padding: 15px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 8px 8px; }
        .btn { display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2 style="margin: 0;">Notificação de SLA</h2>
          <p style="margin: 10px 0 0 0;">O chamado ${mensagens[tipo]}</p>
        </div>

        <div class="content">
          <div class="info-row">
            <span class="label">Chamado:</span>
            <span class="value">#${chamado.COD_CHAMADO}</span>
          </div>

          <div class="info-row">
            <span class="label">Cliente:</span>
            <span class="value">${chamado.NOME_CLIENTE || 'N/A'}</span>
          </div>

          <div class="info-row">
            <span class="label">Assunto:</span>
            <span class="value">${chamado.ASSUNTO_CHAMADO || 'N/A'}</span>
          </div>

          <div class="info-row">
            <span class="label">Responsável:</span>
            <span class="value">${chamado.NOME_RECURSO || 'Não atribuído'}</span>
          </div>

          <div class="info-row">
            <span class="label">Prioridade:</span>
            <span class="value">${getPrioridadeLabel(chamado.PRIOR_CHAMADO)}</span>
          </div>

          <div class="info-row">
            <span class="label">Data de Abertura:</span>
            <span class="value">${formatarData(chamado.DATA_CHAMADO)} ${chamado.HORA_CHAMADO}</span>
          </div>

          <div style="margin: 20px 0;">
            <div class="label">Progresso do SLA:</div>
            <div class="progress">
              <div class="progress-bar" style="width: ${Math.min(100, sla.percentualUsado)}%">
                ${sla.percentualUsado.toFixed(1)}%
              </div>
            </div>
          </div>

          <div class="info-row">
            <span class="label">Tempo Decorrido:</span>
            <span class="value">${sla.tempoDecorrido.toFixed(1)}h de ${config.tempoResolucao}h</span>
          </div>

          <div class="info-row">
            <span class="label">Tempo Restante:</span>
            <span class="value" style="color: ${cores[tipo]}; font-weight: bold;">
              ${sla.tempoRestante > 0 ? sla.tempoRestante.toFixed(1) + 'h' : 'VENCIDO'}
            </span>
          </div>

          <div style="text-align: center; margin-top: 20px;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/chamados/${chamado.COD_CHAMADO}" class="btn">
              Ver Chamado
            </a>
          </div>
        </div>

        <div class="footer">
          <p>Esta é uma notificação automática do sistema de gerenciamento de chamados.</p>
          <p>Por favor, não responda este email.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// ==================== Registrar Notificação ====================
async function registrarNotificacao(
    codChamado: number,
    tipo: string,
    emailDestino: string,
    enviado: boolean,
    erroEnvio?: string
): Promise<void> {
    try {
        // Criar tabela se não existir
        await criarTabelaNotificacoesSeNaoExistir();

        const sql = `
      INSERT INTO SLA_NOTIFICACAO (
        COD_CHAMADO,
        TIPO_NOTIFICACAO,
        EMAIL_DESTINO,
        DATA_ENVIO,
        ENVIADO,
        ERRO_ENVIO
      ) VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, ?)
    `;

        await firebirdQuery(sql, [
            codChamado,
            tipo,
            emailDestino,
            enviado ? 1 : 0,
            erroEnvio || null,
        ]);
    } catch (error) {
        console.error('[SLA NOTIFICATIONS] Erro ao registrar notificação:', error);
    }
}

// ==================== Criar Tabela de Notificações ====================
async function criarTabelaNotificacoesSeNaoExistir(): Promise<void> {
    try {
        const checkSql = `
      SELECT 1 FROM RDB$RELATIONS
      WHERE RDB$RELATION_NAME = 'SLA_NOTIFICACAO'
    `;

        const exists = await firebirdQuery(checkSql, []);

        if (exists.length === 0) {
            const createSql = `
        CREATE TABLE SLA_NOTIFICACAO (
          COD_NOTIFICACAO INTEGER NOT NULL PRIMARY KEY,
          COD_CHAMADO INTEGER NOT NULL,
          TIPO_NOTIFICACAO VARCHAR(20) NOT NULL,
          EMAIL_DESTINO VARCHAR(500),
          DATA_ENVIO TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          ENVIADO SMALLINT DEFAULT 0,
          ERRO_ENVIO VARCHAR(500)
        )
      `;

            await firebirdQuery(createSql, []);

            const createGenSql = `CREATE GENERATOR GEN_SLA_NOTIFICACAO`;
            await firebirdQuery(createGenSql, []).catch(() => {});

            const createTriggerSql = `
        CREATE TRIGGER SLA_NOTIFICACAO_BI FOR SLA_NOTIFICACAO
        ACTIVE BEFORE INSERT POSITION 0
        AS
        BEGIN
          IF (NEW.COD_NOTIFICACAO IS NULL) THEN
            NEW.COD_NOTIFICACAO = GEN_ID(GEN_SLA_NOTIFICACAO, 1);
        END
      `;

            await firebirdQuery(createTriggerSql, []).catch(() => {});
        }
    } catch (error) {
        console.error('[SLA NOTIFICATIONS] Erro ao criar tabela:', error);
    }
}

// ==================== Utilitários ====================
function getPrioridadeLabel(prior: number): string {
    const labels: Record<number, string> = {
        1: '🔴 Crítica',
        2: '🟠 Alta',
        3: '🟡 Média',
        4: '🟢 Baixa',
    };
    return labels[prior] || '⚪ Normal';
}

function formatarData(data: Date): string {
    return new Date(data).toLocaleDateString('pt-BR');
}

// ==================== API Route para Verificação Automática ====================
// app/api/chamados/sla/verificar/route.ts
export async function verificarENotificar(config: ConfigNotificacao): Promise<{
    success: boolean;
    notificacoesEnviadas: number;
    erros: number;
}> {
    try {
        if (!config.ativo) {
            return { success: false, notificacoesEnviadas: 0, erros: 0 };
        }

        const { alertas, criticos, vencidos } = await verificarChamadosCriticos();

        let notificacoesEnviadas = 0;
        let erros = 0;

        // Enviar alertas
        for (const chamado of alertas) {
            const destinatarios = [...new Set([...config.emailsAlerta, ...chamado.emails])];

            const enviado = await enviarNotificacaoEmail(chamado, 'ALERTA', destinatarios);
            if (enviado) notificacoesEnviadas++;
            else erros++;
        }

        // Enviar críticos
        for (const chamado of criticos) {
            const destinatarios = [...new Set([...config.emailsCriticos, ...chamado.emails])];

            const enviado = await enviarNotificacaoEmail(chamado, 'CRITICO', destinatarios);
            if (enviado) notificacoesEnviadas++;
            else erros++;
        }

        // Enviar vencidos
        for (const chamado of vencidos) {
            const destinatarios = [...new Set([...config.emailsVencidos, ...chamado.emails])];

            const enviado = await enviarNotificacaoEmail(chamado, 'VENCIDO', destinatarios);
            if (enviado) notificacoesEnviadas++;
            else erros++;
        }

        return {
            success: true,
            notificacoesEnviadas,
            erros,
        };
    } catch (error) {
        console.error('[SLA NOTIFICATIONS] Erro na verificação:', error);
        return {
            success: false,
            notificacoesEnviadas: 0,
            erros: 1,
        };
    }
}
