import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

const { comUsuarioPorEmailMock, validarForcaSenhaMock, excedeuLimiteMock } = vi.hoisted(() => ({
    comUsuarioPorEmailMock: vi.fn(),
    validarForcaSenhaMock: vi.fn(),
    excedeuLimiteMock: vi.fn(),
}));

vi.mock('@/lib/auth/usuarios-cliente', () => ({
    comUsuarioPorEmail: comUsuarioPorEmailMock,
    validarForcaSenha: validarForcaSenhaMock,
}));

vi.mock('@/lib/rate-limit', () => ({
    excedeuLimite: excedeuLimiteMock,
    obterIp: () => '127.0.0.1',
}));

function criarRequest(body: unknown) {
    return new NextRequest('http://localhost/api/alterar-senha', {
        method: 'POST',
        body: JSON.stringify(body),
    });
}

describe('POST /api/alterar-senha', () => {
    beforeEach(() => {
        excedeuLimiteMock.mockReturnValue(false);
        validarForcaSenhaMock.mockReturnValue([]);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('retorna 429 quando o rate limit foi excedido', async () => {
        excedeuLimiteMock.mockReturnValue(true);

        const response = await POST(
            criarRequest({ email: 'a@a.com', senhaAtual: 'x', senhaNova: 'y' })
        );

        expect(response.status).toBe(429);
        expect(comUsuarioPorEmailMock).not.toHaveBeenCalled();
    });

    it('retorna 400 quando algum campo obrigatório está faltando', async () => {
        const response = await POST(criarRequest({ email: 'a@a.com', senhaAtual: 'x' }));

        expect(response.status).toBe(400);
        expect(comUsuarioPorEmailMock).not.toHaveBeenCalled();
    });

    it('retorna 400 quando a senha nova não atende aos critérios de força', async () => {
        validarForcaSenhaMock.mockReturnValue([
            'Senha deve ter no mínimo 8 caracteres',
            'Senha deve ter pelo menos um número',
        ]);

        const response = await POST(
            criarRequest({ email: 'a@a.com', senhaAtual: 'antiga', senhaNova: 'fraca' })
        );

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.error).toBe(
            'Senha deve ter no mínimo 8 caracteres Senha deve ter pelo menos um número'
        );
        expect(comUsuarioPorEmailMock).not.toHaveBeenCalled();
    });

    it('retorna 404 quando o usuário não é encontrado', async () => {
        comUsuarioPorEmailMock.mockResolvedValueOnce({
            error: 'Usuário não encontrado.',
            status: 404,
        });

        const response = await POST(
            criarRequest({
                email: 'inexistente@a.com',
                senhaAtual: 'antiga',
                senhaNova: 'Nova@123',
            })
        );

        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.error).toBe('Usuário não encontrado.');
    });

    it('retorna 400 quando a senha atual está incorreta', async () => {
        comUsuarioPorEmailMock.mockResolvedValueOnce({
            error: 'Senha atual incorreta.',
            status: 400,
        });

        const response = await POST(
            criarRequest({ email: 'a@a.com', senhaAtual: 'errada', senhaNova: 'Nova@123' })
        );

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.error).toBe('Senha atual incorreta.');
    });

    it('troca a senha com sucesso', async () => {
        comUsuarioPorEmailMock.mockResolvedValueOnce(null);

        const response = await POST(
            criarRequest({ email: 'a@a.com', senhaAtual: 'antiga', senhaNova: 'Nova@123' })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.success).toBe(true);
        expect(validarForcaSenhaMock).toHaveBeenCalledWith('Nova@123');
        expect(comUsuarioPorEmailMock).toHaveBeenCalledTimes(1);
        expect(comUsuarioPorEmailMock.mock.calls[0][0]).toBe('a@a.com');
    });
});
