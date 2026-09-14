import { encodeSenhaConsultor } from '@/lib/auth/senha-consultor';
import bcrypt from 'bcryptjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { limparCaches, POST } from './route';

const { firebirdQueryMock, statMock, readFileMock, excedeuLimiteMock } = vi.hoisted(() => ({
    firebirdQueryMock: vi.fn(),
    statMock: vi.fn(),
    readFileMock: vi.fn(),
    excedeuLimiteMock: vi.fn(),
}));

vi.mock('@/lib/firebird/firebird-client', () => ({
    firebirdQuery: firebirdQueryMock,
}));

vi.mock('fs/promises', () => ({
    default: {
        stat: statMock,
        readFile: readFileMock,
    },
}));

vi.mock('@/lib/rate-limit', () => ({
    excedeuLimite: excedeuLimiteMock,
    obterIp: () => '127.0.0.1',
}));

function criarRequest(body: unknown) {
    return new Request('http://localhost/api/login', {
        method: 'POST',
        body: JSON.stringify(body),
    });
}

describe('POST /api/login', () => {
    beforeEach(() => {
        excedeuLimiteMock.mockReturnValue(false);
        statMock.mockResolvedValue({ mtimeMs: 1 });
        readFileMock.mockResolvedValue(JSON.stringify([]));
        limparCaches();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('retorna 429 quando o rate limit foi excedido', async () => {
        excedeuLimiteMock.mockReturnValue(true);

        const response = await POST(criarRequest({ email: 'a', password: 'b' }));

        expect(response.status).toBe(429);
    });

    it('retorna 400 quando faltam credenciais', async () => {
        const response = await POST(criarRequest({ email: 'a' }));

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.message).toBe('Email/usuário e senha são obrigatórios');
    });

    it('autentica um consultor ADM com sucesso', async () => {
        firebirdQueryMock.mockResolvedValueOnce([
            {
                COD_USUARIO: 1,
                NOME_USUARIO: 'João Silva',
                ID_USUARIO: 'jsilva',
                SENHA: encodeSenhaConsultor('MinhaSenha1'),
                TIPO_USUARIO: 'ADM',
                PERMTAR_USUARIO: 'SIM',
                ALTSEN_USUARIO: 0,
                PERPROJ1_USUARIO: 'NAO',
                PERPROJ2_USUARIO: 'SIM',
            },
        ]);

        const response = await POST(criarRequest({ email: 'jsilva', password: 'MinhaSenha1' }));

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.success).toBe(true);
        expect(body.loginType).toBe('consultor');
        expect(body.tipoUsuario).toBe('ADM');
        expect(body.permissoes).toEqual({ permtar: true, perproj1: false, perproj2: true });
    });

    it('bloqueia consultor autenticado que não é ADM', async () => {
        firebirdQueryMock.mockResolvedValueOnce([
            {
                COD_USUARIO: 2,
                NOME_USUARIO: 'Maria Souza',
                ID_USUARIO: 'msouza',
                SENHA: encodeSenhaConsultor('OutraSenha1'),
                TIPO_USUARIO: 'USU',
                PERMTAR_USUARIO: 'NAO',
                ALTSEN_USUARIO: 0,
                PERPROJ1_USUARIO: 'NAO',
                PERPROJ2_USUARIO: 'NAO',
            },
        ]);

        const response = await POST(criarRequest({ email: 'msouza', password: 'OutraSenha1' }));

        expect(response.status).toBe(403);
        const body = await response.json();
        expect(body.message).toBe('Acesso restrito a administradores.');
    });

    it('rejeita consultor com senha incorreta', async () => {
        firebirdQueryMock.mockResolvedValueOnce([
            {
                COD_USUARIO: 1,
                NOME_USUARIO: 'João Silva',
                ID_USUARIO: 'jsilva',
                SENHA: encodeSenhaConsultor('SenhaCorreta1'),
                TIPO_USUARIO: 'ADM',
                PERMTAR_USUARIO: 'SIM',
                ALTSEN_USUARIO: 0,
                PERPROJ1_USUARIO: 'SIM',
                PERPROJ2_USUARIO: 'SIM',
            },
        ]);

        const response = await POST(
            criarRequest({ email: 'jsilva', password: 'SenhaErrada', loginType: 'consultor' })
        );

        expect(response.status).toBe(401);
        const body = await response.json();
        expect(body.message).toBe('Usuário ou senha inválidos');
    });

    it('autentica um cliente com sucesso', async () => {
        readFileMock.mockResolvedValueOnce(
            JSON.stringify([
                {
                    email: 'cliente@teste.com',
                    password: bcrypt.hashSync('Senha123!', 8),
                    cod_cliente: '10',
                    codrec_os: '5',
                    nome: 'Cliente Teste',
                },
            ])
        );

        const response = await POST(
            criarRequest({ email: 'cliente@teste.com', password: 'Senha123!' })
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.success).toBe(true);
        expect(body.loginType).toBe('cliente');
        expect(body.codCliente).toBe('10');
        expect(body.nomeRecurso).toBe('Cliente Teste');
        expect(firebirdQueryMock).not.toHaveBeenCalled();
    });

    it('rejeita cliente com senha incorreta', async () => {
        readFileMock.mockResolvedValueOnce(
            JSON.stringify([
                {
                    email: 'cliente@teste.com',
                    password: bcrypt.hashSync('Senha123!', 8),
                    cod_cliente: '10',
                    codrec_os: '5',
                    nome: 'Cliente Teste',
                },
            ])
        );

        const response = await POST(
            criarRequest({ email: 'cliente@teste.com', password: 'SenhaErrada' })
        );

        expect(response.status).toBe(401);
    });

    it('retorna 401 quando o usuário não existe em nenhum sistema', async () => {
        readFileMock.mockResolvedValueOnce(JSON.stringify([]));

        const response = await POST(
            criarRequest({ email: 'desconhecido@teste.com', password: 'QualquerSenha1' })
        );

        expect(response.status).toBe(401);
        const body = await response.json();
        expect(body.message).toBe('Usuário ou senha inválidos');
    });
});
