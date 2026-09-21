import { assinarSessao } from '@/lib/auth/session';
import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

const { firebirdQueryMock, firebirdExecuteMock } = vi.hoisted(() => ({
    firebirdQueryMock: vi.fn(),
    firebirdExecuteMock: vi.fn(),
}));

vi.mock('@/lib/firebird/firebird-client', () => ({
    firebirdQuery: firebirdQueryMock,
    firebirdExecute: firebirdExecuteMock,
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

async function cookieConsultor() {
    const token = await assinarSessao({
        loginType: 'consultor',
        codUsuario: 1,
        idUsuario: 'u',
        nomeUsuario: 'U',
        tipoUsuario: 'USU',
        permissoes: { permtar: true, perproj1: true, perproj2: true },
        userEmail: 'u@s.com',
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

    it('retorna 401 sem sessão (não confia em codCliente solto nem em link)', async () => {
        const response = await POST(
            criarRequest({ cod_os: 10, concordaPagar: true, codCliente: '9', linkToken: 'x' })
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

    it('retorna 404 quando a OS não existe', async () => {
        firebirdQueryMock.mockResolvedValueOnce([]);

        const response = await POST(
            criarRequest({ cod_os: 10, concordaPagar: true }, await cookieCliente('9'))
        );

        expect(response.status).toBe(404);
        expect(firebirdExecuteMock).not.toHaveBeenCalled();
    });

    it('retorna 409 quando o chamado já foi finalizado', async () => {
        firebirdQueryMock.mockResolvedValueOnce([{ ...DONO_OK, STATUS_CHAMADO: 'FINALIZADO' }]);

        const response = await POST(
            criarRequest(
                { cod_os: 10, concordaPagar: false, observacao: 'x' },
                await cookieCliente('9')
            )
        );

        expect(response.status).toBe(409);
        expect(firebirdExecuteMock).not.toHaveBeenCalled();
    });

    it('retorna 400 quando reprova sem informar observação', async () => {
        firebirdQueryMock.mockResolvedValueOnce([DONO_OK]);

        const response = await POST(
            criarRequest(
                { cod_os: 10, concordaPagar: false, observacao: '  ' },
                await cookieCliente('9')
            )
        );

        expect(response.status).toBe(400);
        expect(firebirdExecuteMock).not.toHaveBeenCalled();
    });

    it('aprova a OS e grava VALCLI_OS=SIM, OBSCLI_OS=null', async () => {
        firebirdQueryMock.mockResolvedValueOnce([DONO_OK]);
        firebirdExecuteMock.mockResolvedValueOnce(undefined);

        const response = await POST(
            criarRequest(
                { cod_os: 10, concordaPagar: true, observacao: '' },
                await cookieCliente('9')
            )
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
        firebirdQueryMock.mockResolvedValueOnce([DONO_OK]);
        firebirdExecuteMock.mockResolvedValueOnce(undefined);

        const response = await POST(
            criarRequest(
                {
                    cod_os: 10,
                    concordaPagar: false,
                    observacao: 'Horas divergentes do combinado',
                },
                await cookieCliente('9')
            )
        );

        expect(response.status).toBe(200);
        const [, params] = firebirdExecuteMock.mock.calls[0];
        expect(params[0]).toBe('NAO');
        expect(params[1]).toBe('Horas divergentes do combinado');
    });

    it('consultor logado usa o codCliente do body (cliente selecionado nos filtros)', async () => {
        firebirdQueryMock.mockResolvedValueOnce([DONO_OK]);
        firebirdExecuteMock.mockResolvedValueOnce(undefined);

        const response = await POST(
            criarRequest(
                { cod_os: 10, concordaPagar: true, codCliente: '9' },
                await cookieConsultor()
            )
        );

        expect(response.status).toBe(200);
    });
});
