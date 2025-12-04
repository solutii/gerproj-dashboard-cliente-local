import Firebird from 'node-firebird';

export const firebirdOptions: Firebird.Options = {
  host: process.env.FIREBIRD_HOST,
  port: Number(process.env.FIREBIRD_PORT),
  database: process.env.FIREBIRD_DATABASE,
  user: process.env.FIREBIRD_USER,
  password: process.env.FIREBIRD_PASSWORD,
  lowercase_keys: false,
  pageSize: 4096,
};

// ============== NOVA FUNÇÃO: Detectar e converter encoding ==============
function detectAndConvertEncoding(buffer: Buffer): string {
  try {
    // Tenta UTF-8 primeiro
    const utf8Text = buffer.toString('utf8');
    
    // Verifica se há caracteres de substituição (�) que indicam encoding errado
    if (!utf8Text.includes('�')) {
      return utf8Text;
    }
    
    // Se falhou, tenta ISO-8859-1 (Latin1)
    const latin1Text = buffer.toString('latin1');
    return latin1Text;
  } catch (error) {
    console.error('Erro ao converter encoding:', error);
    return buffer.toString('utf8'); // Fallback
  }
}

// ============== NOVA FUNÇÃO: Limpar HTML e extrair texto ==============
function extractTextFromHtml(html: string): string {
  if (!html || !html.trim()) return '';
  
  // Remove tags HTML comuns
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // Remove scripts
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')   // Remove styles
    .replace(/<[^>]+>/g, ' ')                          // Remove todas as tags
    .replace(/&nbsp;/g, ' ')                           // Substitui &nbsp;
    .replace(/&quot;/g, '"')                           // Substitui &quot;
    .replace(/&apos;/g, "'")                           // Substitui &apos;
    .replace(/&lt;/g, '<')                             // Substitui &lt;
    .replace(/&gt;/g, '>')                             // Substitui &gt;
    .replace(/&amp;/g, '&')                            // Substitui &amp;
    .replace(/,\s*,/g, ',')                            // Remove vírgulas duplicadas
    .replace(/"\s*"/g, '"')                            // Remove aspas vazias duplicadas
    .replace(/,\s*"/g, ' ')                            // Remove vírgula antes de aspas
    .replace(/"\s*,/g, ' ')                            // Remove vírgula depois de aspas
    .replace(/^[,"\s]+|[,"\s]+$/g, '')                 // Remove vírgulas/aspas do início e fim
    .replace(/\s+/g, ' ')                              // Normaliza espaços
    .trim();
  
  return text;
}

// ============== FUNÇÃO ATUALIZADA: Ler BLOB com encoding correto ==============
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
            // Concatena todos os chunks em um único Buffer
            const fullBuffer = Buffer.concat(chunks);
            
            // Detecta e converte o encoding correto
            const text = detectAndConvertEncoding(fullBuffer);
            
            // Extrai texto limpo do HTML
            const cleanText = extractTextFromHtml(text);
            
            console.log(`[BLOB] ✓ BLOB processado: ${cleanText.substring(0, 100)}...`);
            resolve(cleanText || null);
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

// Função para processar uma linha e ler todos os BLOBs
async function processRow(row: any, transaction: any): Promise<any> {
  const processedRow: any = {};
  const blobPromises: Array<Promise<void>> = [];

  console.log(`[PROCESSROW] Iniciando processamento da linha`);
  console.log(`[PROCESSROW] Campos da linha:`, Object.keys(row));

  for (const key in row) {
    const value = row[key];
    const valueType = typeof value;
    
    console.log(`[PROCESSROW] Campo: ${key}, Tipo: ${valueType}, Callable:`, typeof value === 'function' || (value && typeof value.call === 'function'));

    // Se for uma função (BLOB padrão)
    if (valueType === 'function') {
      console.log(`[BLOB] ✓ Detectado campo ${key} como função BLOB`);
      const promise = readBlob(value, transaction).then((blobContent) => {
        processedRow[key] = blobContent;
      });
      blobPromises.push(promise);
    }
    // Se for object não-nulo e callable (BLOB como objeto - caso do OBS_OS)
    else if (valueType === 'object' && value !== null && value.call) {
      console.log(`[BLOB] ✓ Detectado campo ${key} como objeto BLOB callable`);
      const promise = readBlob(value, transaction).then((blobContent) => {
        processedRow[key] = blobContent;
      });
      blobPromises.push(promise);
    }
    // Se for string, verifica se precisa correção de encoding
    else if (valueType === 'string' && value) {
      // Detecta se contém caracteres problemáticos de encoding
      const hasEncodingIssue = /[�ý¿À-ÿ]{1}[a-z]/.test(value) || value.includes('�');
      
      if (hasEncodingIssue) {
        console.log(`[ENCODING] ✓ Corrigindo encoding do campo ${key}: "${value}"`);
        try {
          // Converte de volta para bytes e reinterpreta como latin1/ISO-8859-1
          const bytes = [];
          for (let i = 0; i < value.length; i++) {
            bytes.push(value.charCodeAt(i) & 0xff);
          }
          const correctedValue = Buffer.from(bytes).toString('latin1');
          console.log(`[ENCODING] ✓ Valor corrigido: "${correctedValue}"`);
          processedRow[key] = correctedValue;
        } catch (error) {
          console.error(`[ENCODING] Erro ao corrigir ${key}:`, error);
          processedRow[key] = value;
        }
      } else {
        processedRow[key] = value;
      }
    }
    // Outros tipos, apenas copia o valor
    else {
      processedRow[key] = value;
    }
  }

  console.log(`[PROCESSROW] Total de BLOBs detectados: ${blobPromises.length}`);

  // Aguarda todas as leituras de BLOB terminarem
  await Promise.all(blobPromises);
  
  console.log(`[PROCESSROW] Linha processada com sucesso`);
  return processedRow;
}

export function queryFirebird<T = any>(
  sql: string,
  params: any[] = []
): Promise<T[]> {
  console.log('[FIREBIRD] ========== QUERY INICIADA ==========');
  console.log('[FIREBIRD] SQL:', sql.substring(0, 100) + '...');
  return new Promise((resolve, reject) => {
    Firebird.attach(firebirdOptions, (err, db) => {
      if (err) return reject(err);

      // Inicia uma transação para ler os BLOBs
      db.transaction(Firebird.ISOLATION_READ_COMMITTED, (err, transaction) => {
        if (err) {
          db.detach();
          return reject(err);
        }

        transaction.query(sql, params, async (err, result) => {
          if (err) {
            transaction.rollback(() => {
              db.detach();
            });
            return reject(err);
          }

          try {
            console.log(`[FIREBIRD] Processando ${result.length} linhas`);
            
            // Processa todas as linhas e lê os BLOBs ANTES de fechar
            const processedResults = await Promise.all(
              result.map((row: any, index: number) => {
                console.log(`[FIREBIRD] Processando linha ${index + 1}`);
                return processRow(row, transaction);
              })
            );

            console.log(`[FIREBIRD] Todas as linhas processadas`);

            // Commit e fecha a conexão
            transaction.commit((err) => {
              db.detach();
              if (err) return reject(err);
              resolve(processedResults as T[]);
            });
          } catch (error) {
            console.error('[FIREBIRD] Erro ao processar:', error);
            transaction.rollback(() => {
              db.detach();
            });
            reject(error);
          }
        });
      });
    });
  });
}