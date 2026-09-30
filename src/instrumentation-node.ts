// src/instrumentation-node.ts
//
// Separado de instrumentation.ts de propósito: o Next.js compila
// instrumentation.ts também para o runtime Edge (o mesmo bundle usado por
// middleware.ts), e node-firebird (via srp.js) usa `require('crypto')`,
// indisponível lá — mesmo com o guard `NEXT_RUNTIME` dentro de register(),
// o bundler ainda tentava resolver esse import estaticamente, o que quebrava
// a build do bundle Edge inteiro e, com ele, TODAS as rotas (o middleware
// roda antes de qualquer requisição). Isolar em arquivo próprio, importado
// só dentro do branch 'nodejs', evita que esse módulo entre no grafo da
// compilação Edge.
import { queryFirebird } from '@/lib/firebird/firebird';

export async function aquecerPoolFirebird() {
    try {
        await queryFirebird('SELECT 1 FROM RDB$DATABASE');
        console.log('[FIREBIRD] Pool de conexões aquecido no boot.');
    } catch (err) {
        console.error('[FIREBIRD] Falha ao aquecer o pool no boot:', err);
    }
}
