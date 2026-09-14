// src/middleware.ts
//
// Gate de sessão pra /api/* — fecha os achados críticos 1 e 2 do
// levantamento de segurança de 2026-09-14 (nenhuma rota verificava sessão
// no servidor). Roda em runtime Edge por padrão no Next.js; session.ts usa
// Web Crypto exatamente por isso.
import {
    renovarSessao,
    SESSAO_COOKIE_NOME,
    SESSAO_MAX_AGE_SEGUNDOS,
    verificarSessao,
} from '@/lib/auth/session';
import { excedeuLimite, obterIp } from '@/lib/rate-limit';
import { NextRequest, NextResponse } from 'next/server';

// Limite geral por IP, cobrindo TODA /api/* — inclusive as rotas que hoje
// não chamam excedeuLimite() por conta própria. Rotas com limite próprio
// mais restrito (login, upload, etc.) continuam aplicando o delas por cima
// disso, em camadas.
const LIMITE_GERAL_MAX_REQUISICOES = 120;
const LIMITE_GERAL_JANELA_MS = 60_000;

// Protegidas por mecanismo próprio (chave interna, token HMAC do link de
// e-mail), são o próprio ponto de entrada, ou precisam funcionar mesmo sem
// sessão (logout). /os é usada tanto pela tela logada quanto pelo fluxo
// público /validar/[token] (ver spec — correção pós-brainstorm).
const ROTAS_PUBLICAS = new Set([
    '/api/login',
    '/api/esqueci-senha',
    '/api/logout',
    '/api/gerar-link-validacao',
    '/api/salvar-validacao',
]);

const REGEX_VALIDAR_TUDO = /^\/api\/chamados\/\d+\/validar-tudo$/;
const REGEX_OS = /^\/api\/chamados\/\d+\/os$/;

function isRotaPublica(pathname: string): boolean {
    return (
        ROTAS_PUBLICAS.has(pathname) || REGEX_VALIDAR_TUDO.test(pathname) || REGEX_OS.test(pathname)
    );
}

// Além de sessão válida, exigem loginType='consultor' && tipoUsuario='ADM'.
const ROTAS_ADM = new Set([
    '/api/usuarios',
    '/api/admin/clientes',
    '/api/clientes-ativos',
    '/api/recursos-ativos',
]);

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    const chaveLimite = `geral:${obterIp(request)}`;
    if (excedeuLimite(chaveLimite, LIMITE_GERAL_MAX_REQUISICOES, LIMITE_GERAL_JANELA_MS)) {
        return NextResponse.json(
            { error: 'Muitas requisições. Tente novamente em instantes.' },
            { status: 429 }
        );
    }

    if (isRotaPublica(pathname)) {
        return NextResponse.next();
    }

    const token = request.cookies.get(SESSAO_COOKIE_NOME)?.value;
    const sessao = await verificarSessao(token);

    if (!sessao) {
        return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    if (
        ROTAS_ADM.has(pathname) &&
        !(sessao.loginType === 'consultor' && sessao.tipoUsuario === 'ADM')
    ) {
        return NextResponse.json({ error: 'Acesso restrito a administradores.' }, { status: 403 });
    }

    const response = NextResponse.next();

    const novoToken = await renovarSessao(sessao);
    if (novoToken) {
        response.cookies.set(SESSAO_COOKIE_NOME, novoToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: SESSAO_MAX_AGE_SEGUNDOS,
        });
    }

    return response;
}

export const config = {
    matcher: ['/api/:path*'],
};
