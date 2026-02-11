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
 * Normaliza dataFim para o último momento útil caso caia fora do horário comercial.
 * Exemplos:
 *   05/02 00:00 (antes do expediente) → 04/02 18:00 (fim do expediente do dia anterior útil)
 *   04/02 20:00 (após o expediente)   → 04/02 18:00 (fim do expediente do próprio dia)
 *   06/02 00:00 (sábado, 00:00)       → 05/02 18:00 (fim do expediente da sexta)
 */
function normalizarDataFim(data: Date, config: HorarioComercial): Date {
    const resultado = new Date(data);
    const hora = resultado.getHours();
    const minuto = resultado.getMinutes();
    const segundo = resultado.getSeconds();

    const antesDoExpediente = hora < config.inicio;
    const aposOExpediente =
        hora > config.fim || (hora === config.fim && (minuto > 0 || segundo > 0));
    const exatamenteNoFim = hora === config.fim && minuto === 0 && segundo === 0;

    if (exatamenteNoFim) {
        // 18:00:00 exato é válido — não normaliza
        return resultado;
    }

    if (antesDoExpediente) {
        // Antes do expediente → recua para o fim do expediente do último dia útil anterior
        resultado.setDate(resultado.getDate() - 1);
        while (!config.diasUteis.includes(resultado.getDay())) {
            resultado.setDate(resultado.getDate() - 1);
        }
        resultado.setHours(config.fim, 0, 0, 0);
        return resultado;
    }

    if (aposOExpediente) {
        // Após o expediente → usa o fim do expediente do próprio dia se for dia útil,
        // senão recua para o último dia útil anterior
        if (config.diasUteis.includes(resultado.getDay())) {
            resultado.setHours(config.fim, 0, 0, 0);
        } else {
            resultado.setDate(resultado.getDate() - 1);
            while (!config.diasUteis.includes(resultado.getDay())) {
                resultado.setDate(resultado.getDate() - 1);
            }
            resultado.setHours(config.fim, 0, 0, 0);
        }
        return resultado;
    }

    // Dentro do horário comercial, mas em dia não útil (ex: sábado às 10h)
    if (!config.diasUteis.includes(resultado.getDay())) {
        resultado.setDate(resultado.getDate() - 1);
        while (!config.diasUteis.includes(resultado.getDay())) {
            resultado.setDate(resultado.getDate() - 1);
        }
        resultado.setHours(config.fim, 0, 0, 0);
        return resultado;
    }

    return resultado;
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

    // ✅ Normaliza dataFim: se cair fora do expediente, recua para o último momento útil
    const dataFimEfetiva = normalizarDataFim(dataFim, config);

    // Se após normalizar dataFim ficou antes ou igual ao início, retorna 0
    if (dataInicio >= dataFimEfetiva) {
        return 0;
    }

    let horasUteis = 0;
    const atual = new Date(dataInicio);

    // Normaliza início para dentro do horário comercial se necessário
    if (atual.getHours() < config.inicio) {
        atual.setHours(config.inicio, 0, 0, 0);
    } else if (atual.getHours() >= config.fim) {
        // Se está fora do horário, vai para o próximo dia útil
        atual.setDate(atual.getDate() + 1);
        atual.setHours(config.inicio, 0, 0, 0);
    }

    while (atual < dataFimEfetiva) {
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

            // Define o fim real (mínimo entre dataFimEfetiva e fim do expediente)
            const fimReal = dataFimEfetiva < fimExpediente ? dataFimEfetiva : fimExpediente;

            // Se há trabalho neste dia
            if (inicioReal < fimReal) {
                const horasNesteDia = (fimReal.getTime() - inicioReal.getTime()) / (1000 * 60 * 60);
                horasUteis += horasNesteDia;
            }
        }

        // Avança para o próximo dia
        atual.setDate(atual.getDate() + 1);
        atual.setHours(config.inicio, 0, 0, 0);

        // Se já passou do dataFimEfetiva, encerra
        if (atual >= dataFimEfetiva) {
            break;
        }
    }

    // ✅ 4 casas decimais para não perder precisão de minutos na exibição
    return Math.round(horasUteis * 10000) / 10000;
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

    // Define data de referência (conclusão/início atendimento ou agora)
    const dataReferencia = dataConclusao || new Date();

    // ✅ Única chamada — sem duplicata
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
        percentualUsado: Math.round(percentualUsado * 10) / 10, // 1 casa decimal para exibição
        tempoDecorrido: Math.round(tempoDecorrido * 10000) / 10000, // 4 casas para preservar minutos
        tempoRestante: Math.round(tempoRestante * 10000) / 10000, // 4 casas para preservar minutos
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
