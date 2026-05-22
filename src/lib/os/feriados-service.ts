// lib/os/feriados-service.ts

/**
 * Serviço de feriados integrado com https://brasilapi.com.br
 *
 * Endpoint utilizado:
 *   GET /api/feriados/v1/{year} → todos os feriados nacionais do ano
 *
 * Funcionalidades:
 *   - Cache de Promises por ano (evita race condition com requisições simultâneas)
 *   - Fallback estático em caso de falha da API
 *   - Suporte a feriados estaduais e municipais via arrays configuráveis
 *   - Retorna datas no formato "DD/MM/YYYY" para o calcular-horas-adicionais
 */

// ==================== TIPOS PÚBLICOS ====================

export interface FeriadosQueryParams {
    /** Ano dos feriados (obrigatório) */
    year: number;
}

// ==================== FERIADOS ESTADUAIS ====================
// Adicione aqui os feriados do seu estado no formato "DD/MM"
// Eles serão aplicados em TODOS os anos automaticamente

const FERIADOS_ESTADUAIS: string[] = [
    // Exemplo — MG:
    // '24/04', // São Jorge
];

// ==================== FERIADOS MUNICIPAIS ====================
// Adicione aqui os feriados da sua cidade no formato "DD/MM"
// Eles serão aplicados em TODOS os anos automaticamente

const FERIADOS_MUNICIPAIS: string[] = [
    '15/08', // Exemplo — Assunção de Nossa Senhora
    '08/12', // Exemplo — Imaculada Conceição
];

// ==================== FERIADOS EXTRAS POR ANO ====================
// Para feriados pontuais (ex: eleições, eventos específicos)
// Formato: { ano: ["DD/MM", "DD/MM"] }

const FERIADOS_EXTRAS_POR_ANO: Record<number, string[]> = {
    // Exemplo:
    // 2026: ['04/10', '25/10'], // 1º e 2º turno eleições 2026
};

// ==================== CONSTANTES ====================

const BASE_URL = 'https://brasilapi.com.br/api/feriados/v1';

/**
 * Fallback estático com feriados nacionais + móveis por ano.
 * Usado quando a BrasilAPI está indisponível.
 * Formato "DD/MM" — o ano é concatenado dinamicamente.
 */
const FERIADOS_FALLBACK: Record<number, string[]> = {
    2024: [
        '01/01', // Ano Novo
        '12/02', // Carnaval
        '13/02', // Carnaval
        '29/03', // Sexta-feira Santa
        '31/03', // Páscoa
        '21/04', // Tiradentes
        '01/05', // Dia do Trabalho
        '30/05', // Corpus Christi
        '07/09', // Independência
        '12/10', // Nossa Senhora Aparecida
        '02/11', // Finados
        '15/11', // Proclamação da República
        '20/11', // Consciência Negra
        '25/12', // Natal
    ],
    2025: [
        '01/01', // Ano Novo
        '03/03', // Carnaval
        '04/03', // Carnaval
        '18/04', // Sexta-feira Santa
        '20/04', // Páscoa
        '21/04', // Tiradentes
        '01/05', // Dia do Trabalho
        '19/06', // Corpus Christi
        '07/09', // Independência
        '12/10', // Nossa Senhora Aparecida
        '02/11', // Finados
        '15/11', // Proclamação da República
        '20/11', // Consciência Negra
        '25/12', // Natal
    ],
    2026: [
        '01/01', // Ano Novo
        '17/02', // Carnaval
        '18/02', // Carnaval
        '03/04', // Sexta-feira Santa
        '05/04', // Páscoa
        '21/04', // Tiradentes
        '01/05', // Dia do Trabalho
        '04/06', // Corpus Christi
        '07/09', // Independência
        '12/10', // Nossa Senhora Aparecida
        '02/11', // Finados
        '15/11', // Proclamação da República
        '20/11', // Consciência Negra
        '25/12', // Natal
    ],
    2027: [
        '01/01', // Ano Novo
        '08/02', // Carnaval
        '09/02', // Carnaval
        '26/03', // Sexta-feira Santa
        '28/03', // Páscoa
        '21/04', // Tiradentes
        '01/05', // Dia do Trabalho
        '27/05', // Corpus Christi
        '07/09', // Independência
        '12/10', // Nossa Senhora Aparecida
        '02/11', // Finados
        '15/11', // Proclamação da República
        '20/11', // Consciência Negra
        '25/12', // Natal
    ],
};

/**
 * Feriados fixos genéricos usados quando o ano não está mapeado no fallback.
 */
const FERIADOS_FIXOS_GENERICOS: string[] = [
    '01/01', // Ano Novo
    '21/04', // Tiradentes
    '01/05', // Dia do Trabalho
    '07/09', // Independência
    '12/10', // Nossa Senhora Aparecida
    '02/11', // Finados
    '15/11', // Proclamação da República
    '20/11', // Consciência Negra
    '25/12', // Natal
];

// ==================== CACHE DE PROMISES ====================
//
// Armazena a Promise em andamento (ou já resolvida) por ano.
//
// Vantagem sobre cache de valor: se 1.500 chamadas simultâneas chegam
// antes da primeira resposta da API, todas recebem a MESMA Promise —
// apenas 1 fetch HTTP é disparado. Com um cache de valor simples,
// todas encontrariam o cache vazio e disparariam 1.500 fetches.

const feriadosPromiseCache = new Map<number, Promise<string[]>>();

// ==================== NORMALIZAÇÃO ====================

/** "2026-12-25" → "25/12/2026" */
function isoParaDDMMYYYY(isoDate: string): string {
    const [ano, mes, dia] = isoDate.split('-');
    return `${dia}/${mes}/${ano}`;
}

// ==================== MESCLAGEM ====================

/**
 * Mescla feriados nacionais com estaduais, municipais e extras do ano,
 * removendo duplicatas.
 */
function mesclarFeriados(nacionais: string[], year: number): string[] {
    const estaduais = FERIADOS_ESTADUAIS.map((f) => `${f}/${year}`);
    const municipais = FERIADOS_MUNICIPAIS.map((f) => `${f}/${year}`);
    const extras = (FERIADOS_EXTRAS_POR_ANO[year] ?? []).map((f) => `${f}/${year}`);

    return [...new Set([...nacionais, ...estaduais, ...municipais, ...extras])];
}

// ==================== FALLBACK ====================

function feriadosFallback(year: number): string[] {
    const base = FERIADOS_FALLBACK[year] ?? FERIADOS_FIXOS_GENERICOS;
    const nacionais = base.map((f) => `${f}/${year}`);
    return mesclarFeriados(nacionais, year);
}

// ==================== FUNÇÃO PRINCIPAL ====================

/**
 * Retorna datas de feriados no formato "DD/MM/YYYY" para um determinado ano,
 * incluindo nacionais (via BrasilAPI), estaduais, municipais e extras.
 *
 * O cache de Promises garante que chamadas simultâneas para o mesmo ano
 * disparem apenas 1 requisição HTTP, eliminando a race condition que
 * causava centenas de fetches paralelos.
 *
 * Em caso de falha da API, retorna os feriados do fallback estático
 * e remove a entrada do cache para permitir nova tentativa futura.
 *
 * @example
 * await buscarFeriados({ year: 2026 })
 * // ["01/01/2026", "17/02/2026", "03/04/2026", ...]
 */
export function buscarFeriados(params: FeriadosQueryParams): Promise<string[]> {
    const { year } = params;

    // Reutiliza Promise existente (em andamento ou já resolvida)
    if (feriadosPromiseCache.has(year)) {
        return feriadosPromiseCache.get(year)!;
    }

    const promise = (async (): Promise<string[]> => {
        try {
            const response = await fetch(`${BASE_URL}/${year}`, {
                headers: { 'Content-Type': 'application/json' },
                next: { revalidate: 86400 }, // Next.js ISR: revalida em 24h
            });

            if (!response.ok) {
                throw new Error(`[feriados-service] HTTP ${response.status}`);
            }

            const feriados: { date: string; name: string; type: string }[] = await response.json();

            const nacionais = feriados.map((f) => isoParaDDMMYYYY(f.date));
            return mesclarFeriados(nacionais, year);
        } catch (error) {
            console.error(
                '[feriados-service] BrasilAPI indisponível, usando fallback estático:',
                error instanceof Error ? error.message : error
            );

            // Remove do cache para permitir nova tentativa na próxima requisição
            feriadosPromiseCache.delete(year);

            return feriadosFallback(year);
        }
    })();

    feriadosPromiseCache.set(year, promise);
    return promise;
}

/**
 * Limpa todo o cache de feriados.
 * Útil em testes ou para forçar atualização.
 */
export function limparCacheFeriados(): void {
    feriadosPromiseCache.clear();
}
