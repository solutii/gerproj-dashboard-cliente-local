// src/lib/auth/cliente-token.ts
//
// Token assinado (HMAC-SHA256) que amarra um login do tipo "cliente" ao seu
// codCliente real. Emitido uma vez no login (route.ts) e enviado pelo front
// no header `x-cliente-token` em toda leitura escopada por cliente — as
// rotas passam a confiar no codCliente DE DENTRO do token verificado em vez
// do parâmetro solto na URL/body, que qualquer um pode editar no DevTools.
//
// Não é uma sessão completa (sem cookie, sem middleware, sem expiração por
// logout no servidor) — é deliberadamente mais simples que isso: só fecha a
// brecha de um cliente logado conseguir ler dados de outro cliente trocando
// o parâmetro. O fluxo do ADM (que escolhe qual cliente visualizar) não usa
// esse token e continua funcionando exatamente como antes.
import crypto from 'crypto';

const SECRET = process.env.CLIENTE_TOKEN_SECRET;
const VALIDADE_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias

interface ClienteTokenPayload {
    codCliente: string;
    exp: number;
}

function base64UrlEncode(input: string): string {
    return Buffer.from(input, 'utf-8').toString('base64url');
}

function base64UrlDecode(input: string): string {
    return Buffer.from(input, 'base64url').toString('utf-8');
}

function assinar(payloadB64: string): string {
    // SECRET só pode ser undefined aqui se o chamador não checou antes —
    // os dois pontos de entrada (assinarClienteToken/verificarClienteToken)
    // já retornam cedo quando SECRET está ausente.
    return crypto
        .createHmac('sha256', SECRET as string)
        .update(payloadB64)
        .digest('base64url');
}

/**
 * Gera o token pro codCliente informado. Retorna null se o segredo não
 * estiver configurado no ambiente — nesse caso o login continua funcionando
 * normalmente, só sem essa proteção extra (comportamento igual ao de antes
 * dessa feature existir).
 */
export function assinarClienteToken(codCliente: string): string | null {
    if (!SECRET) return null;

    const payload: ClienteTokenPayload = {
        codCliente,
        exp: Date.now() + VALIDADE_MS,
    };

    const payloadB64 = base64UrlEncode(JSON.stringify(payload));
    const assinatura = assinar(payloadB64);
    return `${payloadB64}.${assinatura}`;
}

/**
 * Verifica um token e devolve o codCliente nele contido — ou null se o
 * token for ausente, malformado, com assinatura inválida, expirado, ou se
 * o segredo não estiver configurado no ambiente.
 */
export function verificarClienteToken(token: string | null | undefined): string | null {
    if (!token || !SECRET) return null;

    const partes = token.split('.');
    if (partes.length !== 2) return null;
    const [payloadB64, assinatura] = partes;
    if (!payloadB64 || !assinatura) return null;

    const assinaturaEsperada = assinar(payloadB64);

    const bufAssinatura = Buffer.from(assinatura);
    const bufEsperada = Buffer.from(assinaturaEsperada);
    if (bufAssinatura.length !== bufEsperada.length) return null;
    if (!crypto.timingSafeEqual(bufAssinatura, bufEsperada)) return null;

    try {
        const payload: ClienteTokenPayload = JSON.parse(base64UrlDecode(payloadB64));
        if (typeof payload.codCliente !== 'string' || typeof payload.exp !== 'number') return null;
        if (Date.now() > payload.exp) return null;
        return payload.codCliente;
    } catch {
        return null;
    }
}

/**
 * Resolve o codCliente autoritativo pra uma requisição de leitura: se o
 * header `x-cliente-token` trouxer um token válido, usa o codCliente DE
 * DENTRO dele (ignora o parâmetro solto — é exatamente isso que impede a
 * adulteração). Sem token válido (fluxo de ADM, requisição antiga, ou
 * segredo não configurado), cai de volta pro parâmetro recebido, mantendo
 * o comportamento anterior a essa feature.
 */
export function resolveCodClienteSeguro(
    request: Request,
    codClienteParam: string | null | undefined
): string | null | undefined {
    const codClienteToken = verificarClienteToken(request.headers.get('x-cliente-token'));
    return codClienteToken ?? codClienteParam;
}
