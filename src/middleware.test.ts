import {
    assinarSessao,
    type SessaoPayloadCliente,
    type SessaoPayloadConsultor,
} from '@/lib/auth/session';
import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { middleware } from './middleware';

function criarRequest(pathname: string, cookie?: string) {
    return new NextRequest(`http://localhost${pathname}`, {
        headers: cookie ? { cookie } : undefined,
    });
}

const payloadCliente: SessaoPayloadCliente = {
    loginType: 'cliente',
    codCliente: '9',
    codRecurso: null,
    nomeRecurso: null,
    userEmail: 'cliente@teste.com',
    exp: Date.now() + 60_000,
};

const payloadAdm: SessaoPayloadConsultor = {
    loginType: 'consultor',
    codUsuario: 1,
    idUsuario: 'jsilva',
    nomeUsuario: 'João Silva',
    tipoUsuario: 'ADM',
    permissoes: { permtar: true, perproj1: true, perproj2: true },
    userEmail: 'jsilva@solutii.com.br',
    exp: Date.now() + 60_000,
};

const payloadUsu: SessaoPayloadConsultor = { ...payloadAdm, tipoUsuario: 'USU' };

describe('middleware', () => {
    it('deixa passar rotas públicas sem cookie', async () => {
        const response = await middleware(criarRequest('/api/login'));
        expect(response.status).toBe(200);
    });

    it('deixa passar /api/logout sem cookie', async () => {
        const response = await middleware(criarRequest('/api/logout'));
        expect(response.status).toBe(200);
    });

    it('deixa passar validar-tudo sem cookie (rota pública dinâmica)', async () => {
        const response = await middleware(criarRequest('/api/chamados/501/validar-tudo'));
        expect(response.status).toBe(200);
    });

    it('deixa passar a leitura de OS sem cookie (usada pelo fluxo público /validar/[token])', async () => {
        const response = await middleware(criarRequest('/api/chamados/501/os'));
        expect(response.status).toBe(200);
    });

    it('retorna 401 numa rota protegida sem cookie de sessão', async () => {
        const response = await middleware(criarRequest('/api/chamados'));
        expect(response.status).toBe(401);
    });

    it('retorna 401 quando o cookie de sessão é inválido', async () => {
        const response = await middleware(criarRequest('/api/chamados', 'sessao=token-forjado'));
        expect(response.status).toBe(401);
    });

    it('deixa passar uma rota comum com sessão válida', async () => {
        const token = await assinarSessao(payloadCliente);
        const response = await middleware(criarRequest('/api/chamados', `sessao=${token}`));
        expect(response.status).toBe(200);
    });

    it('renova o cookie de sessão numa requisição autenticada', async () => {
        const token = await assinarSessao(payloadCliente);
        const response = await middleware(criarRequest('/api/chamados', `sessao=${token}`));

        const novoCookie = response.cookies.get('sessao');
        expect(novoCookie?.value).toBeTruthy();
        expect(novoCookie?.value).not.toBe(token);
    });

    it('retorna 403 quando um cliente comum tenta acessar rota ADM-only', async () => {
        const token = await assinarSessao(payloadCliente);
        const response = await middleware(criarRequest('/api/usuarios', `sessao=${token}`));
        expect(response.status).toBe(403);
    });

    it('retorna 403 quando um consultor não-ADM tenta acessar rota ADM-only', async () => {
        const token = await assinarSessao(payloadUsu);
        const response = await middleware(criarRequest('/api/admin/clientes', `sessao=${token}`));
        expect(response.status).toBe(403);
    });

    it('deixa passar um consultor ADM numa rota ADM-only', async () => {
        const token = await assinarSessao(payloadAdm);
        const response = await middleware(criarRequest('/api/recursos-ativos', `sessao=${token}`));
        expect(response.status).toBe(200);
    });
});
