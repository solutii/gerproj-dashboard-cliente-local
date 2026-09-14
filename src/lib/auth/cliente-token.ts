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
import { SESSAO_COOKIE_NOME, verificarSessao } from './session';

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

function extrairCookie(request: Request, nome: string): string | undefined {
    const cookieHeader = request.headers.get('cookie');
    if (!cookieHeader) return undefined;
    const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${nome}=([^;]+)`));
    return match?.[1];
}

/**
 * Resolve o codCliente autoritativo pra uma requisição de leitura.
 *
 * Prioridade 1 — sessão real do servidor (session.ts): se o cookie `sessao`
 * trouxer uma sessão válida de `loginType='cliente'`, usa o codCliente DE
 * DENTRO da sessão, sempre — ignora qualquer parâmetro solto ou o token
 * legado. É essa checagem que fecha o IDOR: um cliente logado nunca mais
 * consegue ler dados de outro cliente trocando `codCliente` na URL/body,
 * porque o valor usado não vem mais de entrada controlada pelo cliente.
 *
 * Prioridade 2 — sem sessão de cliente (sessão de ADM, ou nenhuma sessão):
 * mantém o comportamento anterior — usa o `x-cliente-token` (HMAC legado)
 * se presente e válido, senão cai no parâmetro recebido. É esse caminho que
 * permite o ADM continuar escolhendo qual cliente visualizar.
 */
export async function resolveCodClienteSeguro(
    request: Request,
    codClienteParam: string | null | undefined
): Promise<string | null | undefined> {
    const sessao = await verificarSessao(extrairCookie(request, SESSAO_COOKIE_NOME));
    if (sessao?.loginType === 'cliente') {
        return sessao.codCliente;
    }

    const codClienteToken = verificarClienteToken(request.headers.get('x-cliente-token'));
    return codClienteToken ?? codClienteParam;
}
