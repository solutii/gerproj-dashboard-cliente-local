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
    1: { prioridade: 1, tempoResposta: 8, tempoResolucao: 8 }, // Crítico
    2: { prioridade: 2, tempoResposta: 8, tempoResolucao: 8 }, // Alto
    3: { prioridade: 3, tempoResposta: 8, tempoResolucao: 8 }, // Médio
    4: { prioridade: 4, tempoResposta: 8, tempoResolucao: 8 }, // Baixo
    100: { prioridade: 100, tempoResposta: 8, tempoResolucao: 8 }, // Padrão
};

// Horário comercial padrão: 8h às 18h, seg-sex
export const HORARIO_COMERCIAL_PADRAO: HorarioComercial = {
    inicio: 8,
    fim: 18,
    diasUteis: [1, 2, 3, 4, 5], // segunda a sexta
};

// ==================== HELPERS DE FERIADO ====================

/**
 * Verifica se uma data é feriado.
 * Aceita formato "DD/MM" (qualquer ano) ou "DD/MM/YYYY" (ano específico).
 */
function isFeriado(data: Date, feriados: string[]): boolean {
    if (!feriados || feriados.length === 0) return false;
    const dd = data.getDate().toString().padStart(2, '0');
    const mm = (data.getMonth() + 1).toString().padStart(2, '0');
    const yyyy = data.getFullYear().toString();
    return feriados.some((f) => f === `${dd}/${mm}` || f === `${dd}/${mm}/${yyyy}`);
}

/**
 * Verifica se uma data está dentro do horário comercial.
 * Agora aceita opcionalmente um array de feriados.
 */
export function isDentroHorarioComercial(
    data: Date,
    config: HorarioComercial = HORARIO_COMERCIAL_PADRAO,
    feriados: string[] = []
): boolean {
    const dia = data.getDay();
    const hora = data.getHours();

    if (!config.diasUteis.includes(dia)) return false;
    if (isFeriado(data, feriados)) return false;
    return hora >= config.inicio && hora < config.fim;
}

/**
 * Normaliza dataFim para o último momento útil caso caia fora do horário comercial.
 */
function normalizarDataFim(data: Date, config: HorarioComercial, feriados: string[]): Date {
    const resultado = new Date(data);
    const hora = resultado.getHours();
    const minuto = resultado.getMinutes();
    const segundo = resultado.getSeconds();

    const antesDoExpediente = hora < config.inicio;
    const aposOExpediente =
        hora > config.fim || (hora === config.fim && (minuto > 0 || segundo > 0));
    const exatamenteNoFim = hora === config.fim && minuto === 0 && segundo === 0;

    if (exatamenteNoFim) return resultado;

    if (antesDoExpediente) {
        resultado.setDate(resultado.getDate() - 1);
        while (!config.diasUteis.includes(resultado.getDay()) || isFeriado(resultado, feriados)) {
            resultado.setDate(resultado.getDate() - 1);
        }
        resultado.setHours(config.fim, 0, 0, 0);
        return resultado;
    }

    if (aposOExpediente) {
        if (config.diasUteis.includes(resultado.getDay()) && !isFeriado(resultado, feriados)) {
            resultado.setHours(config.fim, 0, 0, 0);
        } else {
            resultado.setDate(resultado.getDate() - 1);
            while (
                !config.diasUteis.includes(resultado.getDay()) ||
                isFeriado(resultado, feriados)
            ) {
                resultado.setDate(resultado.getDate() - 1);
            }
            resultado.setHours(config.fim, 0, 0, 0);
        }
        return resultado;
    }

    // Dentro do horário mas em dia não útil ou feriado
    if (!config.diasUteis.includes(resultado.getDay()) || isFeriado(resultado, feriados)) {
        resultado.setDate(resultado.getDate() - 1);
        while (!config.diasUteis.includes(resultado.getDay()) || isFeriado(resultado, feriados)) {
            resultado.setDate(resultado.getDate() - 1);
        }
        resultado.setHours(config.fim, 0, 0, 0);
        return resultado;
    }

    return resultado;
}

/**
 * Calcula horas úteis entre duas datas considerando horário comercial e feriados.
 */
export function calcularHorasUteis(
    dataInicio: Date,
    dataFim: Date,
    config: HorarioComercial = HORARIO_COMERCIAL_PADRAO,
    feriados: string[] = []
): number {
    if (dataInicio >= dataFim) return 0;

    const dataFimEfetiva = normalizarDataFim(dataFim, config, feriados);

    if (dataInicio >= dataFimEfetiva) return 0;

    let horasUteis = 0;
    const atual = new Date(dataInicio);

    // Normaliza início para dentro do horário comercial
    if (atual.getHours() < config.inicio) {
        atual.setHours(config.inicio, 0, 0, 0);
    } else if (atual.getHours() >= config.fim) {
        atual.setDate(atual.getDate() + 1);
        atual.setHours(config.inicio, 0, 0, 0);
    }

    while (atual < dataFimEfetiva) {
        const diaAtual = atual.getDay();

        // ✅ Verifica dia útil E não feriado
        if (config.diasUteis.includes(diaAtual) && !isFeriado(atual, feriados)) {
            const inicioExpediente = new Date(atual);
            inicioExpediente.setHours(config.inicio, 0, 0, 0);

            const fimExpediente = new Date(atual);
            fimExpediente.setHours(config.fim, 0, 0, 0);

            const inicioReal = atual < inicioExpediente ? inicioExpediente : atual;
            const fimReal = dataFimEfetiva < fimExpediente ? dataFimEfetiva : fimExpediente;

            if (inicioReal < fimReal) {
                horasUteis += (fimReal.getTime() - inicioReal.getTime()) / (1000 * 60 * 60);
            }
        }

        atual.setDate(atual.getDate() + 1);
        atual.setHours(config.inicio, 0, 0, 0);

        if (atual >= dataFimEfetiva) break;
    }

    return Math.round(horasUteis * 10000) / 10000;
}

/**
 * Parse da hora no formato "1401" ou "HH:MM" para horas e minutos
 */
function parseHoraChamado(horaChamado: string): { horas: number; minutos: number } {
    const horaLimpa = (horaChamado || '').trim();

    if (!horaLimpa) return { horas: 0, minutos: 0 };

    if (horaLimpa.includes(':')) {
        const [horas, minutos] = horaLimpa.split(':').map(Number);
        return { horas: horas || 0, minutos: minutos || 0 };
    }

    if (horaLimpa.length === 4) {
        return {
            horas: parseInt(horaLimpa.substring(0, 2), 10),
            minutos: parseInt(horaLimpa.substring(2, 4), 10),
        };
    }

    if (horaLimpa.length === 3) {
        return {
            horas: parseInt(horaLimpa.substring(0, 1), 10),
            minutos: parseInt(horaLimpa.substring(1, 3), 10),
        };
    }

    if (horaLimpa.length === 2) {
        return { horas: parseInt(horaLimpa, 10), minutos: 0 };
    }

    const horaNum = parseInt(horaLimpa, 10);
    if (!isNaN(horaNum)) {
        return { horas: Math.floor(horaNum / 100), minutos: horaNum % 100 };
    }

    return { horas: 0, minutos: 0 };
}

/**
 * Calcula o status do SLA para um chamado.
 * Agora aceita opcionalmente um array de feriados para cálculo preciso.
 */
export function calcularStatusSLA(
    dataChamado: Date,
    horaChamado: string,
    prioridade: number,
    statusChamado: string,
    dataConclusao?: Date | null,
    tipoSLA: 'resposta' | 'resolucao' = 'resolucao',
    feriados: string[] = [] // ✅ NOVO parâmetro
): SLAStatus {
    const config = SLA_CONFIGS[prioridade] || SLA_CONFIGS[100];
    const prazoTotal = tipoSLA === 'resposta' ? config.tempoResposta : config.tempoResolucao;

    const { horas, minutos } = parseHoraChamado(horaChamado);

    const dataAbertura = new Date(dataChamado);
    dataAbertura.setHours(horas, minutos, 0, 0);

    const dataReferencia = dataConclusao || new Date();

    // ✅ Passa feriados para o cálculo de horas úteis
    const tempoDecorrido = calcularHorasUteis(
        dataAbertura,
        dataReferencia,
        HORARIO_COMERCIAL_PADRAO,
        feriados
    );

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
        tempoDecorrido: Math.round(tempoDecorrido * 10000) / 10000,
        tempoRestante: Math.round(tempoRestante * 10000) / 10000,
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

    if (minutos === 0) return `${horasInteiras}h`;
    return `${horasInteiras}h ${minutos}min`;
}

/**
 * Obtém cor para o status do SLA
 */
export function getCorStatusSLA(status: SLAStatus['status']): string {
    const cores = {
        OK: '#22c55e',
        ALERTA: '#f59e0b',
        CRITICO: '#ef4444',
        VENCIDO: '#991b1b',
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
    }>,
    feriados: string[] = [] // ✅ NOVO parâmetro
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
            chamado.CONCLUSAO_CHAMADO,
            'resolucao',
            feriados // ✅ passa feriados
        );

        if (sla.dentroPrazo) {
            metricas.dentroSLA++;
        } else {
            metricas.foraSLA++;
        }

        somaTempos += sla.tempoDecorrido;

        const prior = chamado.PRIOR_CHAMADO;
        if (!metricas.porPrioridade[prior]) {
            metricas.porPrioridade[prior] = { total: 0, dentroSLA: 0, percentual: 0 };
        }

        metricas.porPrioridade[prior].total++;
        if (sla.dentroPrazo) {
            metricas.porPrioridade[prior].dentroSLA++;
        }
    });

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
