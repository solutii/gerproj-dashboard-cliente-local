// src/lib/firebird/firebird.ts
import Firebird from 'node-firebird';
import { corrigirTextoCorrompido } from '../../formatters/formatar-texto-corrompido';

// ─── Options ────────────────────────────────────────────────────────────────

export const firebirdOptions: Firebird.Options = {
    host: process.env.FIREBIRD_HOST,
    port: Number(process.env.FIREBIRD_PORT),
    database: process.env.FIREBIRD_DATABASE,
    user: process.env.FIREBIRD_USER,
    password: process.env.FIREBIRD_PASSWORD,
    lowercase_keys: false,
    pageSize: 4096,
};

// ─── Pool Singleton (sobrevive ao hot reload do Next.js) ─────────────────────

const globalForFirebird = globalThis as unknown as {
    fbPool: Firebird.ConnectionPool | undefined;
};

function getPool(): Firebird.ConnectionPool {
    if (!globalForFirebird.fbPool) {
        console.log('[FIREBIRD] Criando pool de conexões...');
        globalForFirebird.fbPool = Firebird.pool(5, firebirdOptions);
    }
    return globalForFirebird.fbPool;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function detectAndConvertEncoding(buffer: Buffer): string {
    try {
        const utf8Text = buffer.toString('utf8');
        if (!utf8Text.includes('�')) {
            return utf8Text;
        }
        const latin1Text = buffer.toString('latin1');
        return latin1Text;
    } catch (error) {
        console.error('Erro ao converter encoding:', error);
        return buffer.toString('utf8');
    }
}

function extractTextFromHtml(html: string): string {
    if (!html || !html.trim()) return '';

    const text = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/,\s*,/g, ',')
        .replace(/"\s*"/g, '"')
        .replace(/,\s*"/g, ' ')
        .replace(/"\s*,/g, ' ')
        .replace(/^[,"\s]+|[,"\s]+$/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    return text;
}

// rawBlob=true pula a extração/limpeza de HTML — usado para BLOBs que guardam
// HTML a ser preservado (ex: CLIENTE_IA), diferente de descrições de chamados
// onde o HTML é lixo de editor rico e deve virar texto puro.
function readBlob(blobFunction: any, transaction: any, rawBlob = false): Promise<string | null> {
    return new Promise((resolve) => {
        if (!blobFunction || typeof blobFunction !== 'function') {
            resolve(null);
            return;
        }

        try {
            const chunks: Buffer[] = [];

            blobFunction((err: any, name: string, eventEmitter: any) => {
                if (err) {
                    console.error('Erro ao ler BLOB:', err);
                    resolve(null);
                    return;
                }

                if (!eventEmitter) {
                    console.error('EventEmitter não retornado');
                    resolve(null);
                    return;
                }

                eventEmitter.on('data', (chunk: Buffer) => {
                    chunks.push(chunk);
                });

                eventEmitter.on('end', () => {
                    try {
                        const fullBuffer = Buffer.concat(chunks);
                        const text = detectAndConvertEncoding(fullBuffer);

                        if (rawBlob) {
                            resolve(text || null);
                            return;
                        }

                        const cleanText = extractTextFromHtml(text);
                        const correctedText = corrigirTextoCorrompido(cleanText);
                        resolve(correctedText || null);
                    } catch (error) {
                        console.error('Erro ao processar buffer do BLOB:', error);
                        resolve(null);
                    }
                });

                eventEmitter.on('error', (err: any) => {
                    console.error('Erro no stream do BLOB:', err);
                    resolve(null);
                });
            });
        } catch (error) {
            console.error('Erro ao processar BLOB:', error);
            resolve(null);
        }
    });
}

async function processRow(row: any, transaction: any, rawBlobs = false): Promise<any> {
    const processedRow: any = {};
    const blobPromises: Array<Promise<void>> = [];

    for (const key in row) {
        const value = row[key];
        const valueType = typeof value;

        if (valueType === 'function') {
            const promise = readBlob(value, transaction, rawBlobs).then((blobContent) => {
                processedRow[key] = blobContent;
            });
            blobPromises.push(promise);
        } else if (valueType === 'object' && value !== null && value.call) {
            const promise = readBlob(value, transaction, rawBlobs).then((blobContent) => {
                processedRow[key] = blobContent;
            });
            blobPromises.push(promise);
        } else {
            processedRow[key] = value;
        }
    }

    await Promise.all(blobPromises);

    return processedRow;
}

// ─── Timeout de segurança ──────────────────────────────────────────────────
//
// Se qualquer etapa (pool.get / transaction / query / commit) travar e nunca
// chamar seu callback — por instabilidade de rede, driver, etc — a conexão
// fica presa "emprestada" do pool para sempre. Com um pool fixo de 5
// conexões, algumas travas ao longo de dias esgotam o pool inteiro e toda
// query nova passa a ficar pendurada indefinidamente. Esse timeout garante
// que a conexão sempre volta ao pool (via db.detach), mesmo em caso de trava.
const QUERY_TIMEOUT_MS = 20_000;

function settleOnce<T>(
    fn: (
        resolve: (value: T) => void,
        reject: (reason: unknown) => void,
        registerDb: (db: Firebird.Database) => void
    ) => void
): Promise<T> {
    return new Promise((resolve, reject) => {
        let settled = false;
        let dbRef: Firebird.Database | null = null;

        const timer = setTimeout(() => {
            if (settled) return;
            settled = true;
            console.error(
                `[FIREBIRD] Query travou por mais de ${QUERY_TIMEOUT_MS}ms — liberando conexão do pool à força.`
            );
            try {
                dbRef?.detach();
            } catch {
                // conexão pode já estar inválida — ignora
            }
            reject(new Error('Timeout na consulta ao Firebird'));
        }, QUERY_TIMEOUT_MS);

        fn(
            (value) => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                resolve(value);
            },
            (reason) => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                reject(reason);
            },
            (db) => {
                dbRef = db;
            }
        );
    });
}

// ─── Query (SELECT) ───────────────────────────────────────────────────────────

export function queryFirebird<T = any>(
    sql: string,
    params: any[] = [],
    options?: { rawBlobs?: boolean }
): Promise<T[]> {
    return settleOnce<T[]>((resolve, reject, registerDb) => {
        const pool = getPool();

        pool.get((err, db) => {
            if (err) return reject(err);
            registerDb(db);

            db.transaction(Firebird.ISOLATION_READ_COMMITTED, (err, transaction) => {
                if (err) {
                    db.detach();
                    return reject(err);
                }

                transaction.query(sql, params, async (err, result) => {
                    if (err) {
                        transaction.rollback(() => db.detach());
                        return reject(err);
                    }

                    try {
                        const processedResults = await Promise.all(
                            result.map((row: any) =>
                                processRow(row, transaction, options?.rawBlobs)
                            )
                        );

                        transaction.commit((err) => {
                            db.detach(); // devolve conexão ao pool
                            if (err) return reject(err);
                            resolve(processedResults as T[]);
                        });
                    } catch (error) {
                        console.error('[FIREBIRD] Erro ao processar:', error);
                        transaction.rollback(() => db.detach());
                        reject(error);
                    }
                });
            });
        });
    });
}

// ─── Execute (INSERT, UPDATE, DELETE) ────────────────────────────────────────

export function executeFirebird(sql: string, params: any[] = []): Promise<void> {
    return settleOnce<void>((resolve, reject, registerDb) => {
        const pool = getPool();

        pool.get((err, db) => {
            if (err) return reject(err);
            registerDb(db);

            db.transaction(Firebird.ISOLATION_READ_COMMITTED, (err, transaction) => {
                if (err) {
                    db.detach();
                    return reject(err);
                }

                transaction.query(sql, params, (err) => {
                    if (err) {
                        transaction.rollback(() => db.detach());
                        return reject(err);
                    }

                    transaction.commit((err) => {
                        db.detach(); // devolve conexão ao pool
                        if (err) return reject(err);
                        resolve();
                    });
                });
            });
        });
    });
}
