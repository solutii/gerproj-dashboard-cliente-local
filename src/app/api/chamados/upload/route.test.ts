import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

const { firebirdQueryMock, excedeuLimiteMock, existsSyncMock, mkdirSyncMock, writeFileSyncMock } =
    vi.hoisted(() => ({
        firebirdQueryMock: vi.fn(),
        excedeuLimiteMock: vi.fn(),
        existsSyncMock: vi.fn(),
        mkdirSyncMock: vi.fn(),
        writeFileSyncMock: vi.fn(),
    }));

vi.mock('@/lib/firebird/firebird-client', () => ({
    firebirdQuery: firebirdQueryMock,
}));

vi.mock('@/lib/rate-limit', () => ({
    excedeuLimite: excedeuLimiteMock,
    obterIp: () => '127.0.0.1',
}));

vi.mock('fs', () => ({
    default: {
        existsSync: existsSyncMock,
        mkdirSync: mkdirSyncMock,
        writeFileSync: writeFileSyncMock,
    },
}));

function criarRequest(formData: FormData) {
    return new NextRequest('http://localhost/api/chamados/upload', {
        method: 'POST',
        body: formData,
    });
}

function formDataComArquivos(codChamado: string, arquivos: File[], codCliente?: string) {
    const formData = new FormData();
    formData.set('cod_chamado', codChamado);
    if (codCliente) formData.set('codCliente', codCliente);
    for (const arquivo of arquivos) formData.append('arquivos', arquivo);
    return formData;
}

describe('POST /api/chamados/upload', () => {
    beforeEach(() => {
        excedeuLimiteMock.mockReturnValue(false);
        existsSyncMock.mockReturnValue(false);
        mkdirSyncMock.mockReturnValue(undefined);
        writeFileSyncMock.mockReturnValue(undefined);
        vi.stubEnv('UPLOAD_PATH_DEV', 'C:\\uploads-teste');
    });

    afterEach(() => {
        vi.clearAllMocks();
        vi.unstubAllEnvs();
    });

    it('retorna 429 quando o rate limit foi excedido', async () => {
        excedeuLimiteMock.mockReturnValue(true);

        const response = await POST(
            criarRequest(
                formDataComArquivos('55', [new File(['a'], 'a.txt', { type: 'text/plain' })])
            )
        );

        expect(response.status).toBe(429);
        expect(firebirdQueryMock).not.toHaveBeenCalled();
    });

    it('retorna 400 quando o código do chamado não é numérico', async () => {
        const response = await POST(
            criarRequest(
                formDataComArquivos('abc', [new File(['a'], 'a.txt', { type: 'text/plain' })])
            )
        );

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.error).toBe('Codigo do chamado invalido.');
    });

    it('retorna 400 quando nenhum arquivo é enviado', async () => {
        const response = await POST(criarRequest(formDataComArquivos('55', [])));

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.error).toBe('Nenhum arquivo enviado.');
    });

    it('retorna 400 quando excede o máximo de 5 arquivos', async () => {
        const arquivos = Array.from(
            { length: 6 },
            (_, i) => new File(['conteudo'], `arquivo${i}.txt`, { type: 'text/plain' })
        );

        const response = await POST(criarRequest(formDataComArquivos('55', arquivos)));

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.error).toBe('Maximo de 5 arquivos por chamado.');
    });

    it('retorna 404 quando o chamado informado não existe (com codCliente)', async () => {
        firebirdQueryMock.mockResolvedValueOnce([]);

        const response = await POST(
            criarRequest(
                formDataComArquivos('55', [new File(['a'], 'a.txt', { type: 'text/plain' })], '9')
            )
        );

        expect(response.status).toBe(404);
    });

    it('retorna 403 quando o codCliente não é o dono do chamado', async () => {
        firebirdQueryMock.mockResolvedValueOnce([{ COD_CLIENTE: 999 }]);

        const response = await POST(
            criarRequest(
                formDataComArquivos('55', [new File(['a'], 'a.txt', { type: 'text/plain' })], '9')
            )
        );

        expect(response.status).toBe(403);
        expect(writeFileSyncMock).not.toHaveBeenCalled();
    });

    it('retorna 400 quando o tipo de arquivo não é permitido', async () => {
        const response = await POST(
            criarRequest(
                formDataComArquivos('55', [
                    new File(['conteudo'], 'malicioso.zip', { type: 'application/zip' }),
                ])
            )
        );

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.error).toBe('Tipo nao permitido: malicioso.zip');
    });

    it('retorna 400 quando o arquivo excede 10MB', async () => {
        const conteudoGrande = new Uint8Array(10 * 1024 * 1024 + 1);
        const arquivoGrande = new File([conteudoGrande], 'grande.txt', { type: 'text/plain' });

        const response = await POST(criarRequest(formDataComArquivos('55', [arquivoGrande])));

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.error).toContain('Arquivo muito grande');
    });

    it('retorna 400 quando o conteúdo não corresponde ao tipo declarado (magic bytes)', async () => {
        const arquivoFalsoPng = new File(['isso não é um PNG de verdade'], 'foto.png', {
            type: 'image/png',
        });

        const response = await POST(criarRequest(formDataComArquivos('55', [arquivoFalsoPng])));

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.error).toBe('Conteudo do arquivo nao corresponde ao tipo declarado: foto.png');
    });

    it('salva o arquivo com sucesso e sanitiza o nome com acento', async () => {
        const arquivo = new File(['conteúdo do anexo'], 'relatório é ótimo.txt', {
            type: 'text/plain',
        });

        const response = await POST(criarRequest(formDataComArquivos('55', [arquivo])));

        expect(response.status).toBe(201);
        const body = await response.json();
        expect(body.salvos).toEqual(['relatorio_e_otimo.txt']);
        expect(mkdirSyncMock).toHaveBeenCalledTimes(2);
        expect(writeFileSyncMock).toHaveBeenCalledTimes(1);
    });

    it('renomeia o arquivo quando já existe um com o mesmo nome', async () => {
        existsSyncMock.mockImplementation(
            (p: unknown) => typeof p === 'string' && p.endsWith('documento.txt')
        );

        const arquivo = new File(['conteudo'], 'documento.txt', { type: 'text/plain' });

        const response = await POST(criarRequest(formDataComArquivos('55', [arquivo])));

        expect(response.status).toBe(201);
        const body = await response.json();
        expect(body.salvos).toEqual(['documento_1.txt']);
    });

    it('retorna 500 quando o caminho de armazenamento não está configurado', async () => {
        vi.unstubAllEnvs();
        firebirdQueryMock.mockResolvedValueOnce([]);

        const response = await POST(
            criarRequest(
                formDataComArquivos('55', [new File(['a'], 'a.txt', { type: 'text/plain' })])
            )
        );

        expect(response.status).toBe(500);
        const body = await response.json();
        expect(body.error).toBe('Caminho de armazenamento nao configurado no banco.');
    });
});
