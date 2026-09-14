import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

const { comUsuarioPorEmailMock, sendMailMock, excedeuLimiteMock } = vi.hoisted(() => ({
    comUsuarioPorEmailMock: vi.fn(),
    sendMailMock: vi.fn(),
    excedeuLimiteMock: vi.fn(),
}));

vi.mock('@/lib/auth/usuarios-cliente', () => ({
    comUsuarioPorEmail: comUsuarioPorEmailMock,
    gerarSenhaTemporaria: () => 'Senha-Temp@123',
}));

vi.mock('@/lib/mail/mailer', () => ({
    sendMail: sendMailMock,
}));

vi.mock('@/lib/rate-limit', () => ({
    excedeuLimite: excedeuLimiteMock,
    obterIp: () => '127.0.0.1',
}));

function criarRequest(body: unknown) {
    return new NextRequest('http://localhost/api/esqueci-senha', {
        method: 'POST',
        body: JSON.stringify(body),
    });
}

describe('POST /api/esqueci-senha', () => {
    beforeEach(() => {
        excedeuLimiteMock.mockReturnValue(false);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('retorna 429 quando o rate limit foi excedido', async () => {
        excedeuLimiteMock.mockReturnValue(true);

        const response = await POST(criarRequest({ email: 'a@a.com' }));

        expect(response.status).toBe(429);
        expect(comUsuarioPorEmailMock).not.toHaveBeenCalled();
    });

    it('retorna 400 quando o e-mail não é informado', async () => {
        const response = await POST(criarRequest({}));

        expect(response.status).toBe(400);
        expect(comUsuarioPorEmailMock).not.toHaveBeenCalled();
    });

    it('retorna a mensagem genérica e não envia e-mail quando o e-mail não está cadastrado', async () => {
        comUsuarioPorEmailMock.mockResolvedValueOnce(false);

        const response = await POST(criarRequest({ email: 'desconhecido@a.com' }));

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.success).toBe(true);
        expect(body.message).toContain('Se o e-mail informado estiver cadastrado');
        expect(sendMailMock).not.toHaveBeenCalled();
    });

    it('gera nova senha e envia e-mail quando o e-mail está cadastrado', async () => {
        comUsuarioPorEmailMock.mockResolvedValueOnce(true);
        sendMailMock.mockResolvedValueOnce(undefined);

        const response = await POST(criarRequest({ email: 'Cliente@Teste.com' }));

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.success).toBe(true);

        expect(sendMailMock).toHaveBeenCalledTimes(1);
        const opts = sendMailMock.mock.calls[0][0];
        expect(opts.to).toBe('cliente@teste.com');
        expect(opts.html).toContain('Senha-Temp@123');
    });

    it('retorna 500 quando o e-mail cadastrado existe mas o envio falha', async () => {
        comUsuarioPorEmailMock.mockResolvedValueOnce(true);
        sendMailMock.mockRejectedValueOnce(new Error('SMTP indisponível'));

        const response = await POST(criarRequest({ email: 'cliente@teste.com' }));

        expect(response.status).toBe(500);
        const body = await response.json();
        expect(body.error).toBe('Não foi possível enviar o e-mail. Tente novamente.');
    });
});
