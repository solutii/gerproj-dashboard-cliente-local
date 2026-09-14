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

function criarRequest(body: unknown) {
    return new NextRequest('http://localhost/api/salvar-validacao', {
        method: 'POST',
        body: JSON.stringify(body),
    });
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
        firebirdQueryMock.mockResolvedValueOnce([{ COD_CLIENTE: 999 }]);

        const response = await POST(
            criarRequest({ cod_os: 10, concordaPagar: true, linkToken: 'token-valido' })
        );

        expect(response.status).toBe(403);
        expect(firebirdExecuteMock).not.toHaveBeenCalled();
    });

    it('retorna 400 quando reprova sem informar observação', async () => {
        verificarLinkValidacaoMock.mockReturnValue({ codChamado: 55, codCliente: '9' });
        firebirdQueryMock.mockResolvedValueOnce([{ COD_CLIENTE: 9 }]);

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
        firebirdQueryMock.mockResolvedValueOnce([{ COD_CLIENTE: 9 }]);
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
        firebirdQueryMock.mockResolvedValueOnce([{ COD_CLIENTE: 9 }]);
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
