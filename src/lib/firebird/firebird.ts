// src/lib/firebird/firebird.ts
import Firebird from 'node-firebird';
import { corrigirTextoCorrompido } from '../../formatters/formatar-texto-corrompido';

// ─── Patch: encoding de texto do driver (leitura E escrita) ──────────────────
//
// node-firebird@1.1.9 IGNORA a option `encoding` ao decodificar colunas
// VARCHAR/CHAR — lib/wire/xsqlvar.js chama `data.readText(len, Const.DEFAULT_ENCODING)`
// com a constante fixa 'UTF8' (lib/wire/const.js), não com o que configuramos
// na conexão. O banco (legado Delphi/Windows) grava em WIN1252: um byte
// acentuado sozinho (ex: 0xE7 = "ç") não é uma sequência UTF-8 válida, então
// Buffer.toString('utf8', ...) descarta o byte original e devolve "�" — uma
// perda de dado que não tem como ser corrigida depois (não sabemos mais qual
// dos 256 valores de byte era). WIN1252 e latin1 são idênticos no intervalo
// 0xA0–0xFF (onde ficam os acentos), então forçar 'latin1' aqui decodifica
// certo. Isso é um patch no protótipo do driver, não uma option pública —
// se um dia atualizarmos o node-firebird (a versão instalada é bem antiga),
// vale checar se essa versão nova já respeita `encoding` e remover o patch.
// O mesmo bug existe simetricamente na escrita: xsqlvar.js (SQLParamString.encode)
// chama `data.addText(this.value, Const.DEFAULT_ENCODING)` — grava parâmetros
// de string sempre como UTF-8, mesmo em coluna WIN1252/NONE (1 byte por
// caractere). Resultado: "ç" (1 char) grava como 2 bytes UTF-8 (0xC3 0x87),
// e na releitura (mesmo já com o patch de leitura acima) vira "Ã" duplicado —
// dado errado gravado no banco, não só um problema de exibição. Sem esse
// patch de escrita, qualquer INSERT/UPDATE com acento corrompe a coluna.
{
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- caminho interno do driver, sem types públicos
    const { XdrReader, XdrWriter } = require('node-firebird/lib/wire/serialize');

    const readTextOriginal = XdrReader.prototype.readText;
    XdrReader.prototype.readText = function (len: number) {
        return readTextOriginal.call(this, len, 'latin1');
    };

    const addTextOriginal = XdrWriter.prototype.addText;
    XdrWriter.prototype.addText = function (s: string) {
        return addTextOriginal.call(this, s, 'latin1');
    };
}

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
        } else if (valueType === 'string') {
            // Colunas VARCHAR/CHAR não passam pelo readBlob — sem essa correção,
            // valores acentuados gravados com encoding divergente do driver
            // (ex: "CRIAÇÃO" -> "CRIA��O") chegam corrompidos no front.
            processedRow[key] = corrigirTextoCorrompido(value);
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
