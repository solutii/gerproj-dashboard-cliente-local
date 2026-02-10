// src/hooks/useSLADinamico.ts
'use client';

import { useEffect, useState } from 'react';

interface SLAStatus {
    dentroPrazo: boolean;
    percentualUsado: number;
    tempoRestante: number;
    tempoDecorrido: number;
    prazoTotal: number;
    status: 'OK' | 'ALERTA' | 'CRITICO' | 'VENCIDO';
}

interface SLAConfig {
    prioridade: number;
    tempoResposta: number;
    tempoResolucao: number;
}

interface HorarioComercial {
    inicio: number;
    fim: number;
    diasUteis: number[];
}

const SLA_CONFIGS: Record<number, SLAConfig> = {
    1: { prioridade: 1, tempoResposta: 2, tempoResolucao: 8 },
    2: { prioridade: 2, tempoResposta: 4, tempoResolucao: 16 },
    3: { prioridade: 3, tempoResposta: 8, tempoResolucao: 24 },
    4: { prioridade: 4, tempoResposta: 16, tempoResolucao: 48 },
    100: { prioridade: 100, tempoResposta: 24, tempoResolucao: 72 },
};

const HORARIO_COMERCIAL_PADRAO: HorarioComercial = {
    inicio: 8,
    fim: 18,
    diasUteis: [1, 2, 3, 4, 5],
};

function isDentroHorarioComercial(
    data: Date,
    config: HorarioComercial = HORARIO_COMERCIAL_PADRAO
): boolean {
    const dia = data.getDay();
    const hora = data.getHours();
    return config.diasUteis.includes(dia) && hora >= config.inicio && hora < config.fim;
}

function calcularHorasUteis(
    dataInicio: Date,
    dataFim: Date,
    config: HorarioComercial = HORARIO_COMERCIAL_PADRAO
): number {
    if (dataInicio >= dataFim) return 0;

    let horasUteis = 0;
    const atual = new Date(dataInicio);

    if (atual.getHours() < config.inicio) {
        atual.setHours(config.inicio, 0, 0, 0);
    } else if (atual.getHours() >= config.fim) {
        atual.setDate(atual.getDate() + 1);
        atual.setHours(config.inicio, 0, 0, 0);
    }

    while (atual < dataFim) {
        const diaAtual = atual.getDay();

        if (config.diasUteis.includes(diaAtual)) {
            const inicioExpediente = new Date(atual);
            inicioExpediente.setHours(config.inicio, 0, 0, 0);

            const fimExpediente = new Date(atual);
            fimExpediente.setHours(config.fim, 0, 0, 0);

            const inicioReal = atual < inicioExpediente ? inicioExpediente : atual;
            const fimReal = dataFim < fimExpediente ? dataFim : fimExpediente;

            if (inicioReal < fimReal) {
                const horasNesteDia = (fimReal.getTime() - inicioReal.getTime()) / (1000 * 60 * 60);
                horasUteis += horasNesteDia;
            }
        }

        atual.setDate(atual.getDate() + 1);
        atual.setHours(config.inicio, 0, 0, 0);

        if (atual >= dataFim) break;
    }

    return horasUteis;
}

function parseHoraChamado(horaChamado: string): { horas: number; minutos: number } {
    const horaLimpa = (horaChamado || '').trim();

    if (!horaLimpa) return { horas: 0, minutos: 0 };

    if (horaLimpa.includes(':')) {
        const [horas, minutos] = horaLimpa.split(':').map(Number);
        return { horas: horas || 0, minutos: minutos || 0 };
    }

    if (horaLimpa.length === 4) {
        const horas = parseInt(horaLimpa.substring(0, 2), 10);
        const minutos = parseInt(horaLimpa.substring(2, 4), 10);
        return { horas, minutos };
    }

    if (horaLimpa.length === 3) {
        const horas = parseInt(horaLimpa.substring(0, 1), 10);
        const minutos = parseInt(horaLimpa.substring(1, 3), 10);
        return { horas, minutos };
    }

    if (horaLimpa.length === 2) {
        const horas = parseInt(horaLimpa, 10);
        return { horas, minutos: 0 };
    }

    const horaNum = parseInt(horaLimpa, 10);
    if (!isNaN(horaNum)) {
        const horas = Math.floor(horaNum / 100);
        const minutos = horaNum % 100;
        return { horas, minutos };
    }

    return { horas: 0, minutos: 0 };
}

function calcularStatusSLA(
    dataChamado: Date,
    horaChamado: string,
    prioridade: number,
    statusChamado: string,
    dataInicioAtendimento?: Date | null,
    tipoSLA: 'resposta' | 'resolucao' = 'resolucao'
): SLAStatus {
    const config = SLA_CONFIGS[prioridade] || SLA_CONFIGS[100];
    const prazoTotal = tipoSLA === 'resposta' ? config.tempoResposta : config.tempoResolucao;

    const { horas, minutos } = parseHoraChamado(horaChamado);

    const dataAbertura = new Date(dataChamado);
    dataAbertura.setHours(horas, minutos, 0, 0);

    // ✅ MUDANÇA: Usar dataInicioAtendimento se existir, senão usa data atual
    const dataReferencia = dataInicioAtendimento || new Date();

    const tempoDecorrido = calcularHorasUteis(dataAbertura, dataReferencia);
    const tempoRestante = Math.max(0, prazoTotal - tempoDecorrido);
    const percentualUsado = Math.min(100, (tempoDecorrido / prazoTotal) * 100);

    let status: SLAStatus['status'];
    if (percentualUsado >= 100) {
        status = 'VENCIDO';
    } else if (percentualUsado >= 90) {
        status = 'CRITICO';
    } else if (percentualUsado >= 75) {
        status = 'ALERTA';
    } else {
        status = 'OK';
    }

    return {
        dentroPrazo: percentualUsado < 100,
        percentualUsado: Math.round(percentualUsado * 10) / 10,
        tempoRestante: Math.round(tempoRestante * 10) / 10,
        tempoDecorrido: Math.round(tempoDecorrido * 10) / 10,
        prazoTotal,
        status,
    };
}

/**
 * Hook para calcular SLA com atualização automática
 * Calcula o tempo entre a abertura do chamado e o início do atendimento
 *
 * @param dataChamado Data de abertura do chamado
 * @param horaChamado Hora de abertura (formato "HHMM" ou "HH:MM")
 * @param prioridade Prioridade do chamado (1-4 ou 100)
 * @param statusChamado Status atual do chamado
 * @param dataInicioAtendimento Data de início do atendimento (DTINI_CHAMADO)
 * @param intervalMs Intervalo de atualização em milissegundos (padrão: 60000 = 1 minuto)
 * @returns SLAStatus atualizado dinamicamente ou null se dados inválidos
 */
export function useSLADinamico(
    dataChamado: Date | string | null,
    horaChamado: string | null,
    prioridade: number,
    statusChamado: string,
    dataInicioAtendimento?: Date | string | null,
    intervalMs: number = 60000 // Atualiza a cada 1 minuto por padrão
): SLAStatus | null {
    const [sla, setSLA] = useState<SLAStatus | null>(null);

    useEffect(() => {
        // Validações básicas
        if (!dataChamado || !horaChamado) {
            setSLA(null);
            return;
        }

        // Função para calcular e atualizar o SLA
        const atualizarSLA = () => {
            try {
                const data = typeof dataChamado === 'string' ? new Date(dataChamado) : dataChamado;

                // ✅ Converter dataInicioAtendimento se existir
                const inicioAtendimento = dataInicioAtendimento
                    ? typeof dataInicioAtendimento === 'string'
                        ? new Date(dataInicioAtendimento)
                        : dataInicioAtendimento
                    : null;

                const slaCalculado = calcularStatusSLA(
                    data,
                    horaChamado,
                    prioridade,
                    statusChamado,
                    inicioAtendimento, // ✅ Passa a data de início se existir
                    'resolucao'
                );

                setSLA(slaCalculado);
            } catch (error) {
                console.error('[useSLADinamico] Erro ao calcular SLA:', error);
                setSLA(null);
            }
        };

        // Calcula imediatamente
        atualizarSLA();

        // ✅ Se já tem dataInicioAtendimento, não precisa atualizar dinamicamente
        if (dataInicioAtendimento) {
            return; // SLA está "congelado" na data de início do atendimento
        }

        // ✅ Apenas configura intervalo se NÃO tiver início de atendimento e estiver em horário comercial
        const agora = new Date();
        if (isDentroHorarioComercial(agora)) {
            const intervalo = setInterval(atualizarSLA, intervalMs);
            return () => clearInterval(intervalo);
        }

        // Se fora do horário, recalcula quando entrar no horário novamente
        // (checando a cada 5 minutos)
        const intervaloChecagem = setInterval(
            () => {
                const agora = new Date();
                if (isDentroHorarioComercial(agora)) {
                    atualizarSLA();
                }
            },
            5 * 60 * 1000
        ); // 5 minutos

        return () => clearInterval(intervaloChecagem);
    }, [dataChamado, horaChamado, prioridade, statusChamado, dataInicioAtendimento, intervalMs]);

    return sla;
}

/**
 * Hook simplificado que retorna se deve mostrar o SLA
 * ✅ ATUALIZADO: Sempre retorna true (mostra para todos os status)
 */
export function useDeveMostrarSLA(
    statusChamado: string,
    dataInicioAtendimento?: Date | string | null
): boolean {
    return true; // ✅ Sempre mostra SLA
}
