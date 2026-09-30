// src/instrumentation.ts
//
// Hook nativo do Next.js — roda uma única vez quando o processo do servidor
// sobe (não a cada requisição). A lógica de verdade (warm-up do pool do
// Firebird) fica em instrumentation-node.ts, importado só aqui dentro do
// branch 'nodejs' — ver o comentário lá pra entender o motivo.
export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        const { aquecerPoolFirebird } = await import('./instrumentation-node');
        await aquecerPoolFirebird();
    }
}
