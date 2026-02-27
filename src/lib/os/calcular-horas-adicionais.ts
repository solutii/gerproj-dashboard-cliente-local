// lib/os/calcular-horas-adicionais.ts

/**
 * Utilitário para cálculo de horas trabalhadas com adicional de 50%
 * para horas fora do horário comercial.
 *
 * REGRAS DE NEGÓCIO:
 *
 * 1. Janelas de horário em DIAS ÚTEIS (seg-sex, não feriado):
 *    - 00h–05h  → fora do horário → com adicional
 *    - 05h–08h  → janela especial → SEM adicional (trata como normal)
 *    - 08h–18h  → horário comercial → sem adicional
 *    - 18h–24h  → fora do horário → com adicional
 *
 * 2. DIAS NÃO ÚTEIS (fim de semana e feriados):
 *    - Qualquer horário → com adicional
 *
 * 3. O adicional de 50% é aplicado SOMENTE sobre as horas cheias da
 *    parcela fora do horário. A fração de hora restante é cobrada
 *    normalmente (sem adicional).
 *    Exemplos:
 *      - 1,5h fora → 1h×1.5 + 0.5h = 2h equivalente
 *      - 2,5h fora → 2h×1.5 + 0.5h = 3.5h equivalente
 *      - 0,75h fora → 0h×1.5 + 0.75h = 0.75h equivalente (nenhuma hora cheia)
 */

// ==================== TIPOS ====================

export interface HorasAdicionaisResult {
    /** Horas trabalhadas sem qualquer adicional (comercial + janela 05–08 em dia útil) */
    horasSemAdicional: number;
    /** Horas fora do horário com direito a adicional (valor bruto real trabalhado) */
    horasComAdicional: number;
    /** Horas cheias dentro de horasComAdicional (base de cálculo do adicional) */
    horasCheiasComAdicional: number;
    /** Fração de hora dentro de horasComAdicional (cobrada sem adicional) */
    fracaoHoraComAdicional: number;
    /** Valor equivalente das horas com adicional: (horasCheiasComAdicional × 1.5) + fracaoHoraComAdicional */
    horasComAdicionalEquivalente: number;
    /** Total equivalente final: horasSemAdicional + horasComAdicionalEquivalente */
    totalHorasEquivalente: number;
    /** Total bruto real trabalhado: horasSemAdicional + horasComAdicional */
    totalHorasBruto: number;
    /** Indica se houve qualquer hora com direito a adicional */
    temAdicional: boolean;
    /** Valor monetário do adicional gerado (totalEquivalente - totalBruto) em horas */
    horasAdicionalGerado: number;
}

export interface ConfigHorasAdicionais {
    /** Início da janela especial madrugada/manhã sem adicional em dias úteis (padrão: 5) */
    horaJanelaEspecialInicio: number;
    /** Fim da janela especial / início do horário comercial (padrão: 8) */
    horaComercialInicio: number;
    /** Fim do horário comercial (padrão: 18) */
    horaComercialFim: number;
    /** Multiplicador para horas cheias fora do horário (padrão: 1.5) */
    multiplicador: number;
    /** Feriados no formato "DD/MM" (todo ano) ou "DD/MM/YYYY" (ano específico) */
    feriados: string[];
}

// ==================== CONFIGURAÇÃO PADRÃO ====================

export const CONFIG_PADRAO_ADICIONAL: ConfigHorasAdicionais = {
    horaJanelaEspecialInicio: 5,
    horaComercialInicio: 8,
    horaComercialFim: 18,
    multiplicador: 1.5,
    feriados: [
        '01/01', // Ano Novo
        '21/04', // Tiradentes
        '01/05', // Dia do Trabalho
        '07/09', // Independência
        '12/10', // Nossa Senhora Aparecida
        '02/11', // Finados
        '15/11', // Proclamação da República
        '25/12', // Natal
    ],
};

// ==================== HELPERS INTERNOS ====================

/** Converte "HHMM" ou "HH:MM" para minutos desde meia-noite */
function horaParaMinutos(hora: string): number {
    const h = hora.trim();
    if (h.includes(':')) {
        const [hh, mm] = h.split(':').map(Number);
        return (hh || 0) * 60 + (mm || 0);
    }
    if (h.length === 4) return parseInt(h.slice(0, 2), 10) * 60 + parseInt(h.slice(2, 4), 10);
    if (h.length === 3) return parseInt(h.slice(0, 1), 10) * 60 + parseInt(h.slice(1, 3), 10);
    return parseInt(h, 10) * 60;
}

function isFeriado(data: Date, feriados: string[]): boolean {
    const dd = data.getDate().toString().padStart(2, '0');
    const mm = (data.getMonth() + 1).toString().padStart(2, '0');
    const yyyy = data.getFullYear().toString();
    return feriados.some((f) => f === `${dd}/${mm}` || f === `${dd}/${mm}/${yyyy}`);
}

function isDiaUtil(data: Date, feriados: string[]): boolean {
    const dow = data.getDay(); // 0 = domingo, 6 = sábado
    if (dow === 0 || dow === 6) return false;
    if (isFeriado(data, feriados)) return false;
    return true;
}

/**
 * Arredonda para 4 casas decimais, evitando erros de ponto flutuante.
 */
function r(v: number): number {
    return Math.round(v * 10000) / 10000;
}

// ==================== LÓGICA DE JANELAS ====================

/**
 * Dado um dia e um intervalo [inicioMin, fimMin], distribui os minutos
 * entre as categorias:
 *   - minutosSemAdicional: dentro do horário comercial OU janela 05–08 em dia útil
 *   - minutosComAdicional: fora do horário com direito a adicional
 *
 * As janelas por tipo de dia são:
 *
 * DIA ÚTIL:
 *   [00, 300)  → com adicional      (00h–05h)
 *   [300, 480) → sem adicional      (05h–08h, janela especial)
 *   [480, 1080)→ sem adicional      (08h–18h, comercial)
 *   [1080,1440)→ com adicional      (18h–24h)
 *
 * DIA NÃO ÚTIL:
 *   [00, 1440) → com adicional (qualquer horário)
 */
function distribuirMinutos(
    data: Date,
    inicioMin: number,
    fimMin: number,
    config: ConfigHorasAdicionais
): { minutosSemAdicional: number; minutosComAdicional: number } {
    const { horaJanelaEspecialInicio, horaComercialInicio, horaComercialFim, feriados } = config;

    const janelaMin = horaJanelaEspecialInicio * 60; // 300
    const comercialInicioMin = horaComercialInicio * 60; // 480
    const comercialFimMin = horaComercialFim * 60; // 1080

    let minutosSemAdicional = 0;
    let minutosComAdicional = 0;

    if (!isDiaUtil(data, feriados)) {
        // DIA NÃO ÚTIL: tudo com adicional
        minutosComAdicional = fimMin - inicioMin;
        return { minutosSemAdicional, minutosComAdicional };
    }

    // DIA ÚTIL: avalia cada janela separadamente
    // Janela 1: [0, 300) — com adicional
    const j1Inicio = 0;
    const j1Fim = janelaMin;
    minutosComAdicional += intersecao(inicioMin, fimMin, j1Inicio, j1Fim);

    // Janela 2: [300, 480) — sem adicional (janela especial)
    const j2Inicio = janelaMin;
    const j2Fim = comercialInicioMin;
    minutosSemAdicional += intersecao(inicioMin, fimMin, j2Inicio, j2Fim);

    // Janela 3: [480, 1080) — sem adicional (horário comercial)
    const j3Inicio = comercialInicioMin;
    const j3Fim = comercialFimMin;
    minutosSemAdicional += intersecao(inicioMin, fimMin, j3Inicio, j3Fim);

    // Janela 4: [1080, 1440) — com adicional
    const j4Inicio = comercialFimMin;
    const j4Fim = 1440;
    minutosComAdicional += intersecao(inicioMin, fimMin, j4Inicio, j4Fim);

    return { minutosSemAdicional, minutosComAdicional };
}

/** Retorna a quantidade de minutos de interseção entre [aInicio, aFim) e [bInicio, bFim) */
function intersecao(aInicio: number, aFim: number, bInicio: number, bFim: number): number {
    return Math.max(0, Math.min(aFim, bFim) - Math.max(aInicio, bInicio));
}

// ==================== CÁLCULO DO ADICIONAL SOBRE HORAS CHEIAS ====================

/**
 * Aplica a regra de adicional apenas sobre horas cheias:
 *   - Separa parte inteira e fração das horasComAdicional
 *   - Aplica multiplicador apenas na parte inteira
 *   - Soma a fração sem adicional
 *
 * Exemplo: 2.5h com adicional 1.5×
 *   → 2h × 1.5 = 3h  +  0.5h = 3.5h equivalente
 */
function calcularEquivalenteComAdicional(
    horasComAdicional: number,
    multiplicador: number
): {
    horasCheiasComAdicional: number;
    fracaoHoraComAdicional: number;
    horasComAdicionalEquivalente: number;
} {
    const horasCheias = Math.floor(horasComAdicional);
    const fracao = r(horasComAdicional - horasCheias);
    const equivalente = r(horasCheias * multiplicador + fracao);

    return {
        horasCheiasComAdicional: horasCheias,
        fracaoHoraComAdicional: fracao,
        horasComAdicionalEquivalente: equivalente,
    };
}

// ==================== FUNÇÃO PRINCIPAL ====================

/**
 * Calcula o breakdown de horas de uma OS aplicando as regras de adicional.
 *
 * @param dtIniOS - Data da OS (Date ou string ISO/timestamp)
 * @param hrIniOS - Hora de início no formato "HHMM" ou "HH:MM"
 * @param hrFimOS - Hora de fim no formato "HHMM" ou "HH:MM"
 * @param config  - Configuração (opcional, usa padrão se omitido)
 */
export function calcularHorasComAdicional(
    dtIniOS: Date | string,
    hrIniOS: string,
    hrFimOS: string,
    config: ConfigHorasAdicionais = CONFIG_PADRAO_ADICIONAL
): HorasAdicionaisResult {
    const data = typeof dtIniOS === 'string' ? new Date(dtIniOS) : new Date(dtIniOS);

    const inicioMin = horaParaMinutos(hrIniOS);
    const fimMin = horaParaMinutos(hrFimOS);

    if (isNaN(data.getTime()) || fimMin <= inicioMin) {
        return resultado_zerado();
    }

    const { minutosSemAdicional, minutosComAdicional } = distribuirMinutos(
        data,
        inicioMin,
        fimMin,
        config
    );

    const horasSemAdicional = r(minutosSemAdicional / 60);
    const horasComAdicional = r(minutosComAdicional / 60);

    const { horasCheiasComAdicional, fracaoHoraComAdicional, horasComAdicionalEquivalente } =
        calcularEquivalenteComAdicional(horasComAdicional, config.multiplicador);

    const totalBruto = r(horasSemAdicional + horasComAdicional);
    const totalEquivalente = r(horasSemAdicional + horasComAdicionalEquivalente);
    const horasAdicionalGerado = r(totalEquivalente - totalBruto);

    return {
        horasSemAdicional,
        horasComAdicional,
        horasCheiasComAdicional,
        fracaoHoraComAdicional,
        horasComAdicionalEquivalente,
        totalHorasEquivalente: totalEquivalente,
        totalHorasBruto: totalBruto,
        temAdicional: horasComAdicional > 0,
        horasAdicionalGerado,
    };
}

// ==================== AGREGAÇÃO ====================

/**
 * Soma os resultados de múltiplas OS em um único totalizador.
 * O adicional sobre horas cheias é recalculado sobre o total agregado,
 * e não simplesmente somado, para respeitar a regra de horas cheias.
 */
export function agregarHorasAdicionais(resultados: HorasAdicionaisResult[]): HorasAdicionaisResult {
    // Soma os brutos
    const horasSemAdicional = r(resultados.reduce((acc, r) => acc + r.horasSemAdicional, 0));
    const horasComAdicional = r(resultados.reduce((acc, r) => acc + r.horasComAdicional, 0));

    // Recalcula o equivalente sobre o total agregado de horas com adicional,
    // pois a regra de "apenas horas cheias" deve ser aplicada ao total,
    // não OS a OS (evita distorções de arredondamento).
    const { horasCheiasComAdicional, fracaoHoraComAdicional, horasComAdicionalEquivalente } =
        calcularEquivalenteComAdicional(horasComAdicional, CONFIG_PADRAO_ADICIONAL.multiplicador);

    const totalBruto = r(horasSemAdicional + horasComAdicional);
    const totalEquivalente = r(horasSemAdicional + horasComAdicionalEquivalente);

    return {
        horasSemAdicional,
        horasComAdicional,
        horasCheiasComAdicional,
        fracaoHoraComAdicional,
        horasComAdicionalEquivalente,
        totalHorasEquivalente: totalEquivalente,
        totalHorasBruto: totalBruto,
        temAdicional: horasComAdicional > 0,
        horasAdicionalGerado: r(totalEquivalente - totalBruto),
    };
}

// ==================== FORMATAÇÃO ====================

/**
 * Formata horas decimais em "Xh Ymin".
 * Exemplos: 1.5 → "1h 30min" | 0.5 → "30min" | 2.0 → "2h"
 */
export function formatarHorasAdicional(horas: number): string {
    if (horas <= 0) return '0min';
    const inteiras = Math.floor(horas);
    const minutos = Math.round((horas - inteiras) * 60);
    if (inteiras === 0) return `${minutos}min`;
    if (minutos === 0) return `${inteiras}h`;
    return `${inteiras}h ${minutos}min`;
}

// ==================== HELPERS ====================

function resultado_zerado(): HorasAdicionaisResult {
    return {
        horasSemAdicional: 0,
        horasComAdicional: 0,
        horasCheiasComAdicional: 0,
        fracaoHoraComAdicional: 0,
        horasComAdicionalEquivalente: 0,
        totalHorasEquivalente: 0,
        totalHorasBruto: 0,
        temAdicional: false,
        horasAdicionalGerado: 0,
    };
}
