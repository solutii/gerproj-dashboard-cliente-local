import { describe, expect, it } from 'vitest';
import { assinarClienteToken, resolveCodClienteSeguro } from './cliente-token';
import { assinarSessao, type SessaoPayloadCliente, type SessaoPayloadConsultor } from './session';

function criarRequest(headers: Record<string, string> = {}) {
    return new Request('http://localhost/api/qualquer', { headers });
}

const sessaoCliente: SessaoPayloadCliente = {
    loginType: 'cliente',
    codCliente: '10',
    codRecurso: null,
    nomeRecurso: null,
    userEmail: 'cliente@teste.com',
    exp: Date.now() + 60_000,
};

const sessaoAdm: SessaoPayloadConsultor = {
    loginType: 'consultor',
    codUsuario: 1,
    idUsuario: 'admteste',
    nomeUsuario: 'Admin Teste',
    tipoUsuario: 'ADM',
    permissoes: { permtar: true, perproj1: true, perproj2: true },
    userEmail: 'admin@solutii.com.br',
    exp: Date.now() + 60_000,
};

describe('resolveCodClienteSeguro', () => {
    it('IDOR: com sessão de cliente válida, ignora o parâmetro e sempre usa o codCliente da sessão', async () => {
        const token = await assinarSessao(sessaoCliente);
        const request = criarRequest({ cookie: `sessao=${token}` });

        // Tentativa de ler dados de outro cliente (99) trocando o parâmetro —
        // a sessão de cliente (10) precisa vencer, não o parâmetro adulterado.
        const codCliente = await resolveCodClienteSeguro(request, '99');

        expect(codCliente).toBe('10');
    });

    it('sem sessão, usa o codCliente do x-cliente-token quando presente', async () => {
        const token = assinarClienteToken('20');
        const request = criarRequest({ 'x-cliente-token': token ?? '' });

        const codCliente = await resolveCodClienteSeguro(request, '99');

        expect(codCliente).toBe('20');
    });

    it('sem sessão e sem token, cai no parâmetro recebido (fluxo de ADM sem sessão de cliente)', async () => {
        const request = criarRequest();

        const codCliente = await resolveCodClienteSeguro(request, '30');

        expect(codCliente).toBe('30');
    });

    it('sessão de consultor (ADM) não é tratada como sessão de cliente — cai no parâmetro', async () => {
        const token = await assinarSessao(sessaoAdm);
        const request = criarRequest({ cookie: `sessao=${token}` });

        const codCliente = await resolveCodClienteSeguro(request, '40');

        expect(codCliente).toBe('40');
    });

    it('sessão de cliente expirada não é usada — cai no comportamento sem sessão', async () => {
        const token = await assinarSessao({ ...sessaoCliente, exp: Date.now() - 1000 });
        const request = criarRequest({ cookie: `sessao=${token}` });

        const codCliente = await resolveCodClienteSeguro(request, '50');

        expect(codCliente).toBe('50');
    });
});
