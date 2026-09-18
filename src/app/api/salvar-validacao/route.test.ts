import { assinarSessao } from '@/lib/auth/session';
import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

const { firebirdQueryMock, firebirdExecuteMock, verificarLinkValidacaoMock } = vi.hoisted(() => ({
    firebirdQueryMock: vi.fn(),
    firebirdExecuteMock: vi.fn(),
    verificarLinkValidacaoMock: vi.fn(),
}));

vi.mock('@/lib/firebird/firebird-client', () => ({
    firebirdQuery: firebirdQueryMock,
    firebirdExecute: firebirdExecuteMock,
}));

vi.mock('@/lib/auth/link-validacao', () => ({
    verificarLinkValidacao: verificarLinkValidacaoMock,
}));

function criarRequest(body: unknown, cookie?: string) {
    return new NextRequest('http://localhost/api/salvar-validacao', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: cookie ? { cookie } : undefined,
    });
}

const DONO_OK = { COD_CLIENTE: 9, COD_CHAMADO: 55, STATUS_CHAMADO: 'AGUARDANDO VALIDACAO' };

async function cookieCliente(codCliente: string) {
    const token = await assinarSessao({
        loginType: 'cliente',
        codCliente,
        codRecurso: null,
        nomeRecurso: null,
        userEmail: 'c@teste.com',
        exp: Date.now() + 60_000,
    });
    return `sessao=${token}`;
}

describe('POST /api/salvar-validacao', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('retorna 400 quando cod_os não é informado', async () => {
        const response = await POST(criarRequest({ concordaPagar: true }));
        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.error).toBe('Número da OS é obrigatório');
        expect(firebirdQueryMock).not.toHaveBeenCalled();
    });

    it('retorna 401 sem link e sem sessão (não confia em codCliente solto)', async () => {
        const response = await POST(
            criarRequest({ cod_os: 10, concordaPagar: true, codCliente: '9' })
        );

        expect(response.status).toBe(401);
        expect(firebirdQueryMock).not.toHaveBeenCalled();
    });

    it('com sessão de cliente, usa o codCliente da sessão e ignora o do body', async () => {
        firebirdQueryMock.mockResolvedValueOnce([DONO_OK]);

        const response = await POST(
            criarRequest(
                { cod_os: 10, concordaPagar: true, codCliente: '9' },
                await cookieCliente('777')
            )
        );

        expect(response.status).toBe(403);
        expect(firebirdExecuteMock).not.toHaveBeenCalled();
    });

    it('com sessão de cliente dono da OS, salva mesmo com o chamado finalizado', async () => {
        firebirdQueryMock.mockResolvedValueOnce([{ ...DONO_OK, STATUS_CHAMADO: 'FINALIZADO' }]);
        firebirdExecuteMock.mockResolvedValueOnce(undefined);

        const response = await POST(
            criarRequest({ cod_os: 10, concordaPagar: true }, await cookieCliente('9'))
        );

        expect(response.status).toBe(200);
    });

    it('retorna 409 pelo link quando o chamado já foi finalizado', async () => {
        verificarLinkValidacaoMock.mockReturnValue({ codChamado: 55, codCliente: '9' });
        firebirdQueryMock.mockResolvedValueOnce([{ ...DONO_OK, STATUS_CHAMADO: 'FINALIZADO' }]);

        const response = await POST(
            criarRequest({ cod_os: 10, concordaPagar: false, observacao: 'x', linkToken: 't' })
        );

        expect(response.status).toBe(409);
        expect(firebirdExecuteMock).not.toHaveBeenCalled();
    });

    it('retorna 403 quando a OS é de outro chamado do mesmo cliente que o do link', async () => {
        verificarLinkValidacaoMock.mockReturnValue({ codChamado: 55, codCliente: '9' });
        firebirdQueryMock.mockResolvedValueOnce([{ ...DONO_OK, COD_CHAMADO: 56 }]);

        const response = await POST(
            criarRequest({ cod_os: 10, concordaPagar: true, linkToken: 't' })
        );

        expect(response.status).toBe(403);
        expect(firebirdExecuteMock).not.toHaveBeenCalled();
    });

    it('retorna 403 quando o link de validação é inválido', async () => {
        verificarLinkValidacaoMock.mockReturnValue(null);

        const response = await POST(
            criarRequest({ cod_os: 10, concordaPagar: true, linkToken: 'token-invalido' })
        );

        expect(response.status).toBe(403);
        expect(firebirdQueryMock).not.toHaveBeenCalled();
    });

    it('retorna 404 quando a OS não existe', async () => {
        verificarLinkValidacaoMock.mockReturnValue({ codChamado: 55, codCliente: '9' });
        firebirdQueryMock.mockResolvedValueOnce([]);

        const response = await POST(
            criarRequest({ cod_os: 10, concordaPagar: true, linkToken: 'token-valido' })
        );

        expect(response.status).toBe(404);
        expect(firebirdExecuteMock).not.toHaveBeenCalled();
    });

    it('retorna 403 quando a OS pertence a outro cliente', async () => {
        verificarLinkValidacaoMock.mockReturnValue({ codChamado: 55, codCliente: '9' });
        firebirdQueryMock.mockResolvedValueOnce([{ ...DONO_OK, COD_CLIENTE: 999 }]);

        const response = await POST(
            criarRequest({ cod_os: 10, concordaPagar: true, linkToken: 'token-valido' })
        );

        expect(response.status).toBe(403);
        expect(firebirdExecuteMock).not.toHaveBeenCalled();
    });

    it('retorna 400 quando reprova sem informar observação', async () => {
        verificarLinkValidacaoMock.mockReturnValue({ codChamado: 55, codCliente: '9' });
        firebirdQueryMock.mockResolvedValueOnce([DONO_OK]);

        const response = await POST(
            criarRequest({
                cod_os: 10,
                concordaPagar: false,
                observacao: '  ',
                linkToken: 'token-valido',
            })
        );

        expect(response.status).toBe(400);
        expect(firebirdExecuteMock).not.toHaveBeenCalled();
    });

    it('aprova a OS e grava VALCLI_OS=SIM, OBSCLI_OS=null', async () => {
        verificarLinkValidacaoMock.mockReturnValue({ codChamado: 55, codCliente: '9' });
        firebirdQueryMock.mockResolvedValueOnce([DONO_OK]);
        firebirdExecuteMock.mockResolvedValueOnce(undefined);

        const response = await POST(
            criarRequest({
                cod_os: 10,
                concordaPagar: true,
                observacao: '',
                linkToken: 'token-valido',
            })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.success).toBe(true);
        expect(body.data.valcli_os).toBe('SIM');

        expect(firebirdExecuteMock).toHaveBeenCalledTimes(1);
        const [sql, params] = firebirdExecuteMock.mock.calls[0];
        expect(sql).toContain('UPDATE OS');
        expect(params[0]).toBe('SIM');
        expect(params[1]).toBeNull();
        expect(params[3]).toBe(10);
    });

    it('reprova a OS e grava VALCLI_OS=NAO com a observação informada', async () => {
        verificarLinkValidacaoMock.mockReturnValue({ codChamado: 55, codCliente: '9' });
        firebirdQueryMock.mockResolvedValueOnce([DONO_OK]);
        firebirdExecuteMock.mockResolvedValueOnce(undefined);

        const response = await POST(
            criarRequest({
                cod_os: 10,
                concordaPagar: false,
                observacao: 'Horas divergentes do combinado',
                linkToken: 'token-valido',
            })
        );

        expect(response.status).toBe(200);
        const [, params] = firebirdExecuteMock.mock.calls[0];
        expect(params[0]).toBe('NAO');
        expect(params[1]).toBe('Horas divergentes do combinado');
    });
});
