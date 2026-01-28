// lib/sla/sla-utils.ts

export interface SLAConfig {
    prioridade: number;
    tempoResposta: number; // em horas
    tempoResolucao: number; // em horas
}

export interface SLAStatus {
    dentroPrazo: boolean;
    percentualUsado: number;
    tempoRestante: number; // em horas
    tempoDecorrido: number; // em horas
    prazoTotal: number; // em horas
    status: 'OK' | 'ALERTA' | 'CRITICO' | 'VENCIDO';
}

export interface HorarioComercial {
    inicio: number; // hora (0-23)
    fim: number; // hora (0-23)
    diasUteis: number[]; // 0 = domingo, 6 = sábado
}

// Configuração padrão de SLA por prioridade
export const SLA_CONFIGS: Record<number, SLAConfig> = {
    1: { prioridade: 1, tempoResposta: 2, tempoResolucao: 8 }, // Crítico
    2: { prioridade: 2, tempoResposta: 4, tempoResolucao: 16 }, // Alto
    3: { prioridade: 3, tempoResposta: 8, tempoResolucao: 24 }, // Médio
    4: { prioridade: 4, tempoResposta: 16, tempoResolucao: 48 }, // Baixo
    100: { prioridade: 100, tempoResposta: 24, tempoResolucao: 72 }, // Padrão
};

// Horário comercial padrão: 8h às 18h, seg-sex
export const HORARIO_COMERCIAL_PADRAO: HorarioComercial = {
    inicio: 8,
    fim: 18,
    diasUteis: [1, 2, 3, 4, 5], // segunda a sexta
};

/**
 * Verifica se uma data está dentro do horário comercial
 */
export function isDentroHorarioComercial(
    data: Date,
    config: HorarioComercial = HORARIO_COMERCIAL_PADRAO
): boolean {
    const dia = data.getDay();
    const hora = data.getHours();

    return config.diasUteis.includes(dia) && hora >= config.inicio && hora < config.fim;
}

/**
 * Calcula horas úteis entre duas datas
 */
export function calcularHorasUteis(
    dataInicio: Date,
    dataFim: Date,
    config: HorarioComercial = HORARIO_COMERCIAL_PADRAO
): number {
    let horasUteis = 0;
    const atual = new Date(dataInicio);

    while (atual < dataFim) {
        if (isDentroHorarioComercial(atual, config)) {
            horasUteis += 1;
        }
        atual.setHours(atual.getHours() + 1);
    }

    // Adiciona fração da última hora
    const minutosRestantes = (dataFim.getTime() - atual.getTime()) / (1000 * 60);
    if (minutosRestantes > 0 && isDentroHorarioComercial(dataFim, config)) {
        horasUteis += minutosRestantes / 60;
    }

    return horasUteis;
}

/**
 * Calcula o status do SLA para um chamado
 */
export function calcularStatusSLA(
    dataChamado: Date,
    horaChamado: string,
    prioridade: number,
    statusChamado: string,
    dataConclusao?: Date | null,
    tipoSLA: 'resposta' | 'resolucao' = 'resolucao'
): SLAStatus {
    const config = SLA_CONFIGS[prioridade] || SLA_CONFIGS[100];
    const prazoTotal = tipoSLA === 'resposta' ? config.tempoResposta : config.tempoResolucao;

    // Cria data/hora de abertura do chamado
    const [horas, minutos] = horaChamado.split(':').map(Number);
    const dataAbertura = new Date(dataChamado);
    dataAbertura.setHours(horas || 0, minutos || 0, 0, 0);

    // Define data de referência (conclusão ou agora)
    const dataReferencia = dataConclusao || new Date();

    // Calcula tempo decorrido em horas úteis
    const tempoDecorrido = calcularHorasUteis(dataAbertura, dataReferencia);
    const tempoRestante = Math.max(0, prazoTotal - tempoDecorrido);
    const percentualUsado = Math.min(100, (tempoDecorrido / prazoTotal) * 100);

    // Define status
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
        percentualUsado: Math.round(percentualUsado * 100) / 100,
        tempoRestante: Math.round(tempoRestante * 100) / 100,
        tempoDecorrido: Math.round(tempoDecorrido * 100) / 100,
        prazoTotal,
        status,
    };
}

/**
 * Formata horas em formato legível
 */
export function formatarHoras(horas: number): string {
    if (horas < 1) {
        const minutos = Math.round(horas * 60);
        return `${minutos}min`;
    }

    const horasInteiras = Math.floor(horas);
    const minutos = Math.round((horas - horasInteiras) * 60);

    if (minutos === 0) {
        return `${horasInteiras}h`;
    }

    return `${horasInteiras}h ${minutos}min`;
}

/**
 * Obtém cor para o status do SLA
 */
export function getCorStatusSLA(status: SLAStatus['status']): string {
    const cores = {
        OK: '#22c55e', // verde
        ALERTA: '#f59e0b', // amarelo
        CRITICO: '#ef4444', // vermelho
        VENCIDO: '#991b1b', // vermelho escuro
    };

    return cores[status];
}

/**
 * Calcula métricas agregadas de SLA
 */
export interface MetricasSLA {
    totalChamados: number;
    dentroSLA: number;
    foraSLA: number;
    percentualCumprimento: number;
    tempoMedioResolucao: number;
    porPrioridade: Record<
        number,
        {
            total: number;
            dentroSLA: number;
            percentual: number;
        }
    >;
}

export function calcularMetricasSLA(
    chamados: Array<{
        COD_CHAMADO: number;
        DATA_CHAMADO: Date;
        HORA_CHAMADO: string;
        PRIOR_CHAMADO: number;
        STATUS_CHAMADO: string;
        CONCLUSAO_CHAMADO?: Date | null;
    }>
): MetricasSLA {
    const metricas: MetricasSLA = {
        totalChamados: chamados.length,
        dentroSLA: 0,
        foraSLA: 0,
        percentualCumprimento: 0,
        tempoMedioResolucao: 0,
        porPrioridade: {},
    };

    let somaTempos = 0;

    chamados.forEach((chamado) => {
        const sla = calcularStatusSLA(
            chamado.DATA_CHAMADO,
            chamado.HORA_CHAMADO,
            chamado.PRIOR_CHAMADO,
            chamado.STATUS_CHAMADO,
            chamado.CONCLUSAO_CHAMADO
        );

        if (sla.dentroPrazo) {
            metricas.dentroSLA++;
        } else {
            metricas.foraSLA++;
        }

        somaTempos += sla.tempoDecorrido;

        // Agrupa por prioridade
        const prior = chamado.PRIOR_CHAMADO;
        if (!metricas.porPrioridade[prior]) {
            metricas.porPrioridade[prior] = {
                total: 0,
                dentroSLA: 0,
                percentual: 0,
            };
        }

        metricas.porPrioridade[prior].total++;
        if (sla.dentroPrazo) {
            metricas.porPrioridade[prior].dentroSLA++;
        }
    });

    // Calcula percentuais
    if (metricas.totalChamados > 0) {
        metricas.percentualCumprimento = (metricas.dentroSLA / metricas.totalChamados) * 100;
        metricas.tempoMedioResolucao = somaTempos / metricas.totalChamados;
    }

    Object.keys(metricas.porPrioridade).forEach((prior) => {
        const p = metricas.porPrioridade[Number(prior)];
        p.percentual = (p.dentroSLA / p.total) * 100;
    });

    return metricas;
}
