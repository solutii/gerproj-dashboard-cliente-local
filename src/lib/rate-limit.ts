// Rate limiter simples em memória, por IP + rota. Suficiente para uma
// instância única do Next.js (não distribuído) — o objetivo é frear abuso
// óbvio (força bruta de login, spam de chamados/uploads), não é uma defesa
// de nível CDN/WAF. Zera ao reiniciar o processo; aceitável para este caso.
interface Bucket {
    count: number;
    resetAt: number;
}

const buckets = new Map<string, Bucket>();

// Evita crescimento ilimitado do Map em produção de longa duração.
function limparExpirados(agora: number) {
    for (const [key, bucket] of buckets) {
        if (bucket.resetAt <= agora) buckets.delete(key);
    }
}

/**
 * Retorna true se a requisição deve ser BLOQUEADA (limite excedido).
 * `chave` deve identificar a rota + o IP (ex: `login:203.0.113.4`).
 */
export function excedeuLimite(chave: string, maxTentativas: number, janelaMs: number): boolean {
    const agora = Date.now();
    if (buckets.size > 5000) limparExpirados(agora);

    const bucket = buckets.get(chave);
    if (!bucket || bucket.resetAt <= agora) {
        buckets.set(chave, { count: 1, resetAt: agora + janelaMs });
        return false;
    }

    bucket.count += 1;
    return bucket.count > maxTentativas;
}

/** IP do requisitante, considerando proxy reverso (nginx/Vercel/etc). */
export function obterIp(request: Request): string {
    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) return forwarded.split(',')[0].trim();
    return request.headers.get('x-real-ip') ?? 'desconhecido';
}
