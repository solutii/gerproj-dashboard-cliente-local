// app/api/chamados/sla/config/route.ts

import { firebirdQuery } from '@/lib/firebird/firebird-client';
import { NextRequest, NextResponse } from 'next/server';

export interface SLAConfigCustom {
    COD_CONFIG: number;
    COD_CLIENTE?: number | null;
    PRIORIDADE: number;
    TEMPO_RESPOSTA: number; // em horas
    TEMPO_RESOLUCAO: number; // em horas
    HORA_INICIO: number; // 0-23
    HORA_FIM: number; // 0-23
    DIAS_UTEIS: string; // Ex: "1,2,3,4,5"
    ATIVO: boolean;
    DATA_CRIACAO: Date;
    DATA_ATUALIZACAO?: Date | null;
}

// ==================== GET - Buscar Configurações ====================
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const codCliente = searchParams.get('codCliente');
        const isAdmin = searchParams.get('isAdmin') === 'true';

        // Verificar se tabela existe, senão criar
        await criarTabelaSeNaoExistir();

        let sql = `
      SELECT
        COD_CONFIG,
        COD_CLIENTE,
        PRIORIDADE,
        TEMPO_RESPOSTA,
        TEMPO_RESOLUCAO,
        HORA_INICIO,
        HORA_FIM,
        DIAS_UTEIS,
        ATIVO,
        DATA_CRIACAO,
        DATA_ATUALIZACAO
      FROM SLA_CONFIG
      WHERE ATIVO = 1
    `;

        const params: any[] = [];

        if (!isAdmin && codCliente) {
            sql += ` AND (COD_CLIENTE = ? OR COD_CLIENTE IS NULL)`;
            params.push(parseInt(codCliente));
        } else if (codCliente) {
            sql += ` AND COD_CLIENTE = ?`;
            params.push(parseInt(codCliente));
        }

        sql += ` ORDER BY COD_CLIENTE NULLS LAST, PRIORIDADE`;

        const configs = await firebirdQuery<SLAConfigCustom>(sql, params);

        // Organizar por prioridade
        const configsPorPrioridade: Record<number, SLAConfigCustom> = {};

        configs.forEach((config) => {
            // Configurações específicas do cliente têm prioridade
            if (!configsPorPrioridade[config.PRIORIDADE] || config.COD_CLIENTE) {
                configsPorPrioridade[config.PRIORIDADE] = config;
            }
        });

        return NextResponse.json({
            success: true,
            configs: Object.values(configsPorPrioridade),
            total: Object.keys(configsPorPrioridade).length,
        });
    } catch (error) {
        console.error('[SLA CONFIG] Erro ao buscar:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Erro ao buscar configurações',
                message: error instanceof Error ? error.message : 'Erro desconhecido',
            },
            { status: 500 }
        );
    }
}

// ==================== POST - Criar/Atualizar Configuração ====================
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            codCliente,
            prioridade,
            tempoResposta,
            tempoResolucao,
            horaInicio,
            horaFim,
            diasUteis,
            isAdmin,
        } = body;

        // Validações
        if (!isAdmin && !codCliente) {
            return NextResponse.json(
                { error: 'Cliente obrigatório para não-admin' },
                { status: 400 }
            );
        }

        if (!prioridade || prioridade < 1) {
            return NextResponse.json({ error: 'Prioridade inválida' }, { status: 400 });
        }

        if (!tempoResposta || tempoResposta < 0.5) {
            return NextResponse.json(
                { error: 'Tempo de resposta deve ser >= 0.5h' },
                { status: 400 }
            );
        }

        if (!tempoResolucao || tempoResolucao < tempoResposta) {
            return NextResponse.json(
                { error: 'Tempo de resolução deve ser >= tempo de resposta' },
                { status: 400 }
            );
        }

        await criarTabelaSeNaoExistir();

        // Verificar se já existe configuração
        const whereClauses = ['PRIORIDADE = ?', 'ATIVO = 1'];
        const whereParams: any[] = [prioridade];

        if (codCliente) {
            whereClauses.push('COD_CLIENTE = ?');
            whereParams.push(parseInt(codCliente));
        } else {
            whereClauses.push('COD_CLIENTE IS NULL');
        }

        const checkSql = `
      SELECT COD_CONFIG
      FROM SLA_CONFIG
      WHERE ${whereClauses.join(' AND ')}
    `;

        const existing = await firebirdQuery<{ COD_CONFIG: number }>(checkSql, whereParams);

        if (existing.length > 0) {
            // Atualizar
            const updateSql = `
        UPDATE SLA_CONFIG SET
          TEMPO_RESPOSTA = ?,
          TEMPO_RESOLUCAO = ?,
          HORA_INICIO = ?,
          HORA_FIM = ?,
          DIAS_UTEIS = ?,
          DATA_ATUALIZACAO = CURRENT_TIMESTAMP
        WHERE COD_CONFIG = ?
      `;

            await firebirdQuery(updateSql, [
                tempoResposta,
                tempoResolucao,
                horaInicio ?? 8,
                horaFim ?? 18,
                diasUteis ?? '1,2,3,4,5',
                existing[0].COD_CONFIG,
            ]);

            return NextResponse.json({
                success: true,
                message: 'Configuração atualizada com sucesso',
                codConfig: existing[0].COD_CONFIG,
            });
        } else {
            // Inserir
            const insertSql = `
        INSERT INTO SLA_CONFIG (
          COD_CLIENTE,
          PRIORIDADE,
          TEMPO_RESPOSTA,
          TEMPO_RESOLUCAO,
          HORA_INICIO,
          HORA_FIM,
          DIAS_UTEIS,
          ATIVO,
          DATA_CRIACAO
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
      `;

            await firebirdQuery(insertSql, [
                codCliente ? parseInt(codCliente) : null,
                prioridade,
                tempoResposta,
                tempoResolucao,
                horaInicio ?? 8,
                horaFim ?? 18,
                diasUteis ?? '1,2,3,4,5',
            ]);

            return NextResponse.json({
                success: true,
                message: 'Configuração criada com sucesso',
            });
        }
    } catch (error) {
        console.error('[SLA CONFIG] Erro ao salvar:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Erro ao salvar configuração',
                message: error instanceof Error ? error.message : 'Erro desconhecido',
            },
            { status: 500 }
        );
    }
}

// ==================== DELETE - Desativar Configuração ====================
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const codConfig = searchParams.get('codConfig');

        if (!codConfig) {
            return NextResponse.json(
                { error: 'Código da configuração obrigatório' },
                { status: 400 }
            );
        }

        const sql = `
      UPDATE SLA_CONFIG
      SET ATIVO = 0, DATA_ATUALIZACAO = CURRENT_TIMESTAMP
      WHERE COD_CONFIG = ?
    `;

        await firebirdQuery(sql, [parseInt(codConfig)]);

        return NextResponse.json({
            success: true,
            message: 'Configuração desativada com sucesso',
        });
    } catch (error) {
        console.error('[SLA CONFIG] Erro ao deletar:', error);
        return NextResponse.json(
            { success: false, error: 'Erro ao deletar configuração' },
            { status: 500 }
        );
    }
}

// ==================== Criar Tabela ====================
async function criarTabelaSeNaoExistir() {
    try {
        const checkTableSql = `
      SELECT 1 FROM RDB$RELATIONS
      WHERE RDB$RELATION_NAME = 'SLA_CONFIG'
    `;

        const exists = await firebirdQuery(checkTableSql, []);

        if (exists.length === 0) {
            const createTableSql = `
        CREATE TABLE SLA_CONFIG (
          COD_CONFIG INTEGER NOT NULL PRIMARY KEY,
          COD_CLIENTE INTEGER,
          PRIORIDADE INTEGER NOT NULL,
          TEMPO_RESPOSTA NUMERIC(10,2) NOT NULL,
          TEMPO_RESOLUCAO NUMERIC(10,2) NOT NULL,
          HORA_INICIO INTEGER DEFAULT 8,
          HORA_FIM INTEGER DEFAULT 18,
          DIAS_UTEIS VARCHAR(50) DEFAULT '1,2,3,4,5',
          ATIVO SMALLINT DEFAULT 1,
          DATA_CRIACAO TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          DATA_ATUALIZACAO TIMESTAMP
        )
      `;

            await firebirdQuery(createTableSql, []);

            // Criar generator
            const createGenSql = `CREATE GENERATOR GEN_SLA_CONFIG`;
            await firebirdQuery(createGenSql, []).catch(() => {});

            // Criar trigger
            const createTriggerSql = `
        CREATE TRIGGER SLA_CONFIG_BI FOR SLA_CONFIG
        ACTIVE BEFORE INSERT POSITION 0
        AS
        BEGIN
          IF (NEW.COD_CONFIG IS NULL) THEN
            NEW.COD_CONFIG = GEN_ID(GEN_SLA_CONFIG, 1);
        END
      `;

            await firebirdQuery(createTriggerSql, []).catch(() => {});

            console.log('[SLA CONFIG] Tabela criada com sucesso');
        }
    } catch (error) {
        console.error('[SLA CONFIG] Erro ao criar tabela:', error);
        // Não lança erro para não quebrar a aplicação
    }
}
