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

function readBlob(blobFunction: any, transaction: any): Promise<string | null> {
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

async function processRow(row: any, transaction: any): Promise<any> {
    const processedRow: any = {};
    const blobPromises: Array<Promise<void>> = [];

    for (const key in row) {
        const value = row[key];
        const valueType = typeof value;

        if (valueType === 'function') {
            const promise = readBlob(value, transaction).then((blobContent) => {
                processedRow[key] = blobContent;
            });
            blobPromises.push(promise);
        } else if (valueType === 'object' && value !== null && value.call) {
            const promise = readBlob(value, transaction).then((blobContent) => {
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

// ─── Query (SELECT) ───────────────────────────────────────────────────────────

export function queryFirebird<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
        const pool = getPool();

        pool.get((err, db) => {
            if (err) return reject(err);

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
                            result.map((row: any) => processRow(row, transaction))
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
    return new Promise((resolve, reject) => {
        const pool = getPool();

        pool.get((err, db) => {
            if (err) return reject(err);

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
