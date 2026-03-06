// lib/os/feriados-service.ts

/**
 * Serviço de feriados integrado com https://brasilapi.com.br
 *
 * Endpoint utilizado:
 *   GET /api/feriados/v1/{year} → todos os feriados nacionais do ano
 *
 * Funcionalidades:
 *   - Cache em memória por ano com TTL de 24h
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
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas

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

// ==================== CACHE ====================

interface CacheEntry {
    datas: string[];
    ts: number;
}

const feriadosCache = new Map<string, CacheEntry>();

function getFromCache(year: number): string[] | undefined {
    const entry = feriadosCache.get(String(year));
    if (!entry) return undefined;
    if (Date.now() - entry.ts >= CACHE_TTL_MS) {
        feriadosCache.delete(String(year));
        return undefined;
    }
    return entry.datas;
}

function setToCache(year: number, datas: string[]): void {
    if (feriadosCache.size >= 50) {
        const oldest = feriadosCache.keys().next().value;
        if (oldest) feriadosCache.delete(oldest);
    }
    feriadosCache.set(String(year), { datas, ts: Date.now() });
}

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

    const todos = [...nacionais, ...estaduais, ...municipais, ...extras];

    // Remove duplicatas
    return [...new Set(todos)];
}

// ==================== FUNÇÃO PRINCIPAL ====================

/**
 * Retorna datas de feriados no formato "DD/MM/YYYY" para um determinado ano,
 * incluindo nacionais (via BrasilAPI), estaduais, municipais e extras.
 *
 * Em caso de falha da API, retorna os feriados do fallback estático.
 *
 * @example
 * await buscarFeriados({ year: 2026 })
 * // ["01/01/2026", "17/02/2026", "03/04/2026", ...]
 */
export async function buscarFeriados(params: FeriadosQueryParams): Promise<string[]> {
    const cached = getFromCache(params.year);
    if (cached) return cached;

    try {
        const response = await fetch(`${BASE_URL}/${params.year}`, {
            headers: { 'Content-Type': 'application/json' },
            next: { revalidate: 86400 }, // Next.js ISR: revalida em 24h no servidor
        });

        if (!response.ok) {
            throw new Error(`[feriados-service] HTTP ${response.status}`);
        }

        const feriados: { date: string; name: string; type: string }[] = await response.json();
        const nacionais = feriados.map((f) => isoParaDDMMYYYY(f.date));
        const datas = mesclarFeriados(nacionais, params.year);

        setToCache(params.year, datas);
        return datas;
    } catch (error) {
        console.error(
            '[feriados-service] BrasilAPI indisponível, usando fallback estático:',
            error instanceof Error ? error.message : error
        );

        // Fallback com feriados do ano mapeado
        const fallback = FERIADOS_FALLBACK[params.year] ?? FERIADOS_FIXOS_GENERICOS;
        const nacionais = fallback.map((f) => `${f}/${params.year}`);
        return mesclarFeriados(nacionais, params.year);
    }
}

/**
 * Limpa todo o cache de feriados.
 * Útil em testes ou para forçar atualização.
 */
export function limparCacheFeriados(): void {
    feriadosCache.clear();
}
