// lib/os/feriados-service.ts

/**
 * Serviço de feriados integrado com https://api.feriados.dev
 *
 * Endpoints utilizados:
 *   GET /v1/holidays/year/{year}          → todos os feriados nacionais do ano
 *   GET /v1/holidays?year=X&state=SP      → feriados nacionais + estaduais
 *   GET /v1/holidays?year=X&state=SP&city=São Paulo → + municipais
 *
 * Funcionalidades:
 *   - Cache em memória por ano/estado/cidade com TTL de 24h
 *   - Paginação automática (PaginatedResponse)
 *   - Fallback estático em caso de falha da API
 *   - Retorna datas no formato "DD/MM/YYYY" para o calcular-horas-adicionais
 */

// ==================== TIPOS DA API ====================

interface FeriadoAPI {
    id: string;
    name: string;
    date: string; // "2024-12-25"
    type: 'national' | 'state' | 'municipal';
    state?: string;
    city?: string;
    description?: string;
}

interface PaginatedResponse {
    success: true;
    data: FeriadoAPI[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

interface SuccessResponse {
    success: true;
    data: FeriadoAPI[];
    message?: string;
}

interface ErrorResponse {
    success: false;
    error: {
        code: string;
        message: string;
        details?: object;
    };
}

type APIResponse = PaginatedResponse | SuccessResponse | ErrorResponse;

// ==================== TIPOS PÚBLICOS ====================

export interface FeriadosQueryParams {
    /** Ano dos feriados (obrigatório) */
    year: number;
    /** Sigla do estado para incluir feriados estaduais (ex: "SP") */
    state?: string;
    /** Nome da cidade para incluir feriados municipais (ex: "São Paulo") */
    city?: string;
}

// ==================== CONSTANTES ====================

const BASE_URL = 'https://api.feriados.dev';
const LIMIT_POR_PAGINA = 100;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas

/**
 * Fallback usado quando a API está indisponível.
 * Formato "DD/MM" é válido para qualquer ano no isFeriado().
 */
const FERIADOS_NACIONAIS_FALLBACK: string[] = [
    '01/01', // Ano Novo
    '21/04', // Tiradentes
    '01/05', // Dia do Trabalho
    '07/09', // Independência
    '12/10', // Nossa Senhora Aparecida
    '02/11', // Finados
    '15/11', // Proclamação da República
    '25/12', // Natal
];

// ==================== CACHE ====================

interface CacheEntry {
    datas: string[];
    ts: number;
}

const feriadosCache = new Map<string, CacheEntry>();

function buildCacheKey(params: FeriadosQueryParams): string {
    return `${params.year}|${params.state ?? ''}|${params.city ?? ''}`;
}

function getFromCache(key: string): string[] | undefined {
    const entry = feriadosCache.get(key);
    if (!entry) return undefined;
    if (Date.now() - entry.ts >= CACHE_TTL_MS) {
        feriadosCache.delete(key);
        return undefined;
    }
    return entry.datas;
}

function setToCache(key: string, datas: string[]): void {
    if (feriadosCache.size >= 50) {
        const oldest = feriadosCache.keys().next().value;
        if (oldest) feriadosCache.delete(oldest);
    }
    feriadosCache.set(key, { datas, ts: Date.now() });
}

// ==================== NORMALIZAÇÃO ====================

/** "2024-12-25" → "25/12/2024" */
function isoParaDDMMYYYY(isoDate: string): string {
    const [ano, mes, dia] = isoDate.split('-');
    return `${dia}/${mes}/${ano}`;
}

// ==================== FETCH INTERNO ====================

/**
 * Escolhe o endpoint mais adequado:
 *  - Sem state/city → /v1/holidays/year/{year}  (mais direto, retorna só nacionais)
 *  - Com state/city → /v1/holidays?year=X&state=X&city=X  (filtros adicionais)
 */
function buildUrl(params: FeriadosQueryParams, page: number): string {
    if (!params.state && !params.city) {
        return `${BASE_URL}/v1/holidays/year/${params.year}?page=${page}&limit=${LIMIT_POR_PAGINA}`;
    }

    const qs = new URLSearchParams({
        year: String(params.year),
        page: String(page),
        limit: String(LIMIT_POR_PAGINA),
    });

    if (params.state) qs.append('state', params.state);
    if (params.city) qs.append('city', params.city);

    return `${BASE_URL}/v1/holidays?${qs.toString()}`;
}

async function fetchPagina(
    params: FeriadosQueryParams,
    page: number
): Promise<{ feriados: FeriadoAPI[]; totalPages: number }> {
    const url = buildUrl(params, page);

    const response = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
        next: { revalidate: 86400 }, // Next.js ISR: revalida em 24h no servidor
    });

    if (!response.ok) {
        throw new Error(`[feriados-service] HTTP ${response.status} — ${url}`);
    }

    const json: APIResponse = await response.json();

    if (!json.success) {
        const err = json as ErrorResponse;
        throw new Error(`[feriados-service] ${err.error.code}: ${err.error.message}`);
    }

    const data = (json as SuccessResponse | PaginatedResponse).data;
    const totalPages = 'pagination' in json ? json.pagination.totalPages : 1;

    return { feriados: data, totalPages };
}

async function fetchTodosFeriados(params: FeriadosQueryParams): Promise<FeriadoAPI[]> {
    const { feriados, totalPages } = await fetchPagina(params, 1);

    if (totalPages <= 1) return feriados;

    // Páginas restantes em paralelo
    const paginas = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);
    const resultados = await Promise.all(paginas.map((p) => fetchPagina(params, p)));

    return [...feriados, ...resultados.flatMap((r) => r.feriados)];
}

// ==================== FUNÇÃO PRINCIPAL ====================

/**
 * Retorna datas de feriados no formato "DD/MM/YYYY" para um determinado
 * ano (e opcionalmente estado/cidade), prontas para uso no
 * calcularHorasComAdicional.
 *
 * Em caso de falha da API, retorna os feriados nacionais fixos como fallback.
 *
 * @example
 * // Apenas nacionais
 * await buscarFeriados({ year: 2025 })
 * // ["01/01/2025", "21/04/2025", ...]
 *
 * @example
 * // Nacionais + estaduais SP
 * await buscarFeriados({ year: 2025, state: 'SP' })
 *
 * @example
 * // Nacionais + estaduais + municipais de São Paulo
 * await buscarFeriados({ year: 2025, state: 'SP', city: 'São Paulo' })
 */
export async function buscarFeriados(params: FeriadosQueryParams): Promise<string[]> {
    const cacheKey = buildCacheKey(params);
    const cached = getFromCache(cacheKey);
    if (cached) return cached;

    try {
        const feriados = await fetchTodosFeriados(params);
        const datas = feriados.map((f) => isoParaDDMMYYYY(f.date));

        setToCache(cacheKey, datas);
        return datas;
    } catch (error) {
        console.error(
            '[feriados-service] API indisponível, usando fallback estático:',
            error instanceof Error ? error.message : error
        );

        // Fallback: converte "DD/MM" para "DD/MM/YYYY"
        return FERIADOS_NACIONAIS_FALLBACK.map((f) => `${f}/${params.year}`);
    }
}

/**
 * Limpa todo o cache de feriados.
 * Útil em testes ou para forçar atualização.
 */
export function limparCacheFeriados(): void {
    feriadosCache.clear();
}
