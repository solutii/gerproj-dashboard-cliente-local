import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    assinarSessao,
    renovarSessao,
    verificarSessao,
    type SessaoPayloadCliente,
} from './session';

const payloadCliente: SessaoPayloadCliente = {
    loginType: 'cliente',
    codCliente: '9',
    codRecurso: null,
    nomeRecurso: null,
    userEmail: 'cliente@teste.com',
    exp: Date.now() + 60_000,
};

describe('session (HMAC de sessão)', () => {
    it('assina e verifica um payload válido', async () => {
        const token = await assinarSessao(payloadCliente);
        expect(token).toBeTruthy();

        const verificado = await verificarSessao(token);
        expect(verificado).toEqual(payloadCliente);
    });

    it('retorna null quando o token foi adulterado', async () => {
        const token = await assinarSessao(payloadCliente);
        // Muta um caractere no meio do token (não o último) — o último
        // caractere de uma assinatura base64url de SHA-256 cai em bits de
        // padding e nem sempre muda o valor decodificado.
        const meio = Math.floor(token!.length / 2);
        const charNovo = token![meio] === 'A' ? 'B' : 'A';
        const adulterado = token!.slice(0, meio) + charNovo + token!.slice(meio + 1);

        expect(await verificarSessao(adulterado)).toBeNull();
    });

    it('retorna null quando a sessão está expirada', async () => {
        const token = await assinarSessao({ ...payloadCliente, exp: Date.now() - 1000 });

        expect(await verificarSessao(token)).toBeNull();
    });

    it('retorna null para token malformado ou ausente', async () => {
        expect(await verificarSessao('nao-e-um-token-valido')).toBeNull();
        expect(await verificarSessao(null)).toBeNull();
        expect(await verificarSessao(undefined)).toBeNull();
    });

    it('renovarSessao gera um novo token com expiração adiante no tempo', async () => {
        const original = await assinarSessao(payloadCliente);
        const renovado = await renovarSessao(payloadCliente);

        expect(renovado).toBeTruthy();
        expect(renovado).not.toBe(original);

        const payloadRenovado = await verificarSessao(renovado);
        expect(payloadRenovado?.exp).toBeGreaterThan(payloadCliente.exp);
    });

    describe('sem SESSAO_SECRET configurado', () => {
        beforeEach(() => {
            vi.stubEnv('SESSAO_SECRET', '');
        });

        afterEach(() => {
            vi.unstubAllEnvs();
        });

        it('assinarSessao retorna null', async () => {
            expect(await assinarSessao(payloadCliente)).toBeNull();
        });

        it('verificarSessao retorna null mesmo com um token válido de antes', async () => {
            vi.stubEnv('SESSAO_SECRET', 'outro-valor-temporario');
            const token = await assinarSessao(payloadCliente);
            vi.stubEnv('SESSAO_SECRET', '');

            expect(await verificarSessao(token)).toBeNull();
        });
    });
});
