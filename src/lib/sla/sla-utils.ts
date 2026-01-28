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
 * Calcula horas úteis entre duas datas considerando horário comercial
 */
export function calcularHorasUteis(
    dataInicio: Date,
    dataFim: Date,
    config: HorarioComercial = HORARIO_COMERCIAL_PADRAO
): number {
    if (dataInicio >= dataFim) {
        return 0;
    }

    let horasUteis = 0;
    const atual = new Date(dataInicio);

    // Normaliza para o início do horário comercial se necessário
    if (atual.getHours() < config.inicio) {
        atual.setHours(config.inicio, 0, 0, 0);
    } else if (atual.getHours() >= config.fim) {
        // Se está fora do horário, vai para o próximo dia útil
        atual.setDate(atual.getDate() + 1);
        atual.setHours(config.inicio, 0, 0, 0);
    }

    while (atual < dataFim) {
        const diaAtual = atual.getDay();

        // Verifica se é dia útil
        if (config.diasUteis.includes(diaAtual)) {
            // Define início e fim do expediente para o dia atual
            const inicioExpediente = new Date(atual);
            inicioExpediente.setHours(config.inicio, 0, 0, 0);

            const fimExpediente = new Date(atual);
            fimExpediente.setHours(config.fim, 0, 0, 0);

            // Define o início real (máximo entre atual e início do expediente)
            const inicioReal = atual < inicioExpediente ? inicioExpediente : atual;

            // Define o fim real (mínimo entre dataFim e fim do expediente)
            const fimReal = dataFim < fimExpediente ? dataFim : fimExpediente;

            // Se há trabalho neste dia
            if (inicioReal < fimReal) {
                const horasNesteDia = (fimReal.getTime() - inicioReal.getTime()) / (1000 * 60 * 60);
                horasUteis += horasNesteDia;
            }
        }

        // Avança para o próximo dia
        atual.setDate(atual.getDate() + 1);
        atual.setHours(config.inicio, 0, 0, 0);

        // Se já passou do dataFim, encerra
        if (atual >= dataFim) {
            break;
        }
    }

    return Math.round(horasUteis * 100) / 100; // Arredonda para 2 casas decimais
}

/**
 * Parse da hora no formato "1401" ou "HH:MM" para horas e minutos
 */
function parseHoraChamado(horaChamado: string): { horas: number; minutos: number } {
    // Remove espaços e garante que tem conteúdo
    const horaLimpa = (horaChamado || '').trim();

    if (!horaLimpa) {
        return { horas: 0, minutos: 0 };
    }

    // Se vier no formato "HH:MM" ou "HH:MM:SS"
    if (horaLimpa.includes(':')) {
        const [horas, minutos] = horaLimpa.split(':').map(Number);
        return { horas: horas || 0, minutos: minutos || 0 };
    }

    // Se vier no formato "HHMM" (ex: "1401" = 14h01min)
    if (horaLimpa.length === 4) {
        const horas = parseInt(horaLimpa.substring(0, 2), 10);
        const minutos = parseInt(horaLimpa.substring(2, 4), 10);
        return { horas, minutos };
    }

    // Se vier no formato "HMM" (ex: "901" = 09h01min)
    if (horaLimpa.length === 3) {
        const horas = parseInt(horaLimpa.substring(0, 1), 10);
        const minutos = parseInt(horaLimpa.substring(1, 3), 10);
        return { horas, minutos };
    }

    // Se vier no formato "HH" (ex: "14" = 14h00min)
    if (horaLimpa.length === 2) {
        const horas = parseInt(horaLimpa, 10);
        return { horas, minutos: 0 };
    }

    // Fallback: tenta converter direto
    const horaNum = parseInt(horaLimpa, 10);
    if (!isNaN(horaNum)) {
        const horas = Math.floor(horaNum / 100);
        const minutos = horaNum % 100;
        return { horas, minutos };
    }

    return { horas: 0, minutos: 0 };
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

    // Parse correto da hora do chamado (formato "HHMM" como "1401" ou "HH:MM")
    const { horas, minutos } = parseHoraChamado(horaChamado);

    // Cria data/hora de abertura do chamado
    // IMPORTANTE: Usa a data do chamado mas com a hora correta do campo HORA_CHAMADO
    const dataAbertura = new Date(dataChamado);
    dataAbertura.setHours(horas, minutos, 0, 0);

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
        percentualUsado: Math.round(percentualUsado * 10) / 10, // 1 casa decimal
        tempoRestante: Math.round(tempoRestante * 10) / 10, // 1 casa decimal
        tempoDecorrido: Math.round(tempoDecorrido * 10) / 10, // 1 casa decimal
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
