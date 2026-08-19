// src/app/api/chamados/upload/route.ts
import { firebirdQuery } from '@/lib/firebird/firebird-client';
import fs from 'fs';
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';

const ALLOWED_MIME_TYPES = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/bmp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 5;

function sanitizeFileName(name: string): string {
    return name
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .replace(/_+/g, '_')
        .trim();
}

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const codChamado = formData.get('cod_chamado');
        const files = formData.getAll('arquivos') as File[];

        if (!codChamado) {
            return NextResponse.json(
                { error: 'Codigo do chamado nao informado.' },
                { status: 400 }
            );
        }
        if (!files || files.length === 0) {
            return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 });
        }
        if (files.length > MAX_FILES) {
            return NextResponse.json(
                { error: `Maximo de ${MAX_FILES} arquivos por chamado.` },
                { status: 400 }
            );
        }

        for (const file of files) {
            if (!ALLOWED_MIME_TYPES.includes(file.type)) {
                return NextResponse.json(
                    { error: `Tipo nao permitido: ${file.name}` },
                    { status: 400 }
                );
            }
            if (file.size > MAX_FILE_SIZE) {
                return NextResponse.json(
                    { error: `Arquivo muito grande: ${file.name} (maximo 10MB)` },
                    { status: 400 }
                );
            }
        }

        // Em desenvolvimento usa UPLOAD_PATH_DEV do .env
        // Em producao busca o caminho na tabela PARAMETROS, igual ao Delphi
        let pastaBase: string;

        if (process.env.NODE_ENV !== 'production' && process.env.UPLOAD_PATH_DEV) {
            pastaBase = process.env.UPLOAD_PATH_DEV;
        } else {
            const paramRows = await firebirdQuery(
                `SELECT VALOR_PARAMETRO FROM PARAMETROS WHERE DESCR_PARAMETRO = 'PASTA'`,
                []
            );
            pastaBase = (
                (paramRows[0] as Record<string, unknown>)?.VALOR_PARAMETRO as string
            )?.trim();

            if (!pastaBase) {
                return NextResponse.json(
                    { error: 'Caminho de armazenamento nao configurado no banco.' },
                    { status: 500 }
                );
            }
        }

        // Monta e cria o diretorio PASTA\CALLTECH\{COD_CHAMADO}
        // Bug conhecido do Node/libuv no Windows com caminhos UNC (\\servidor\share\...):
        // o mkdirSync às vezes cria a pasta no servidor mas ainda assim lança um erro
        // "UNKNOWN". Por isso, se o mkdir falhar, confirma se a pasta existe de fato
        // antes de considerar falha real.
        function garantirPasta(dir: string) {
            if (fs.existsSync(dir)) return;
            try {
                fs.mkdirSync(dir);
            } catch (err) {
                if (!fs.existsSync(dir)) throw err;
            }
        }

        const dirCalltech = path.join(pastaBase, 'CALLTECH');
        garantirPasta(dirCalltech);

        const dirChamado = path.join(dirCalltech, String(codChamado));
        garantirPasta(dirChamado);

        const salvos: string[] = [];

        for (const file of files) {
            const nomeSeguro = sanitizeFileName(file.name);
            const ext = path.extname(nomeSeguro);
            const base = path.basename(nomeSeguro, ext);

            let caminhoFinal = path.join(dirChamado, nomeSeguro);
            let contador = 1;
            while (fs.existsSync(caminhoFinal)) {
                caminhoFinal = path.join(dirChamado, `${base}_${contador}${ext}`);
                contador++;
            }

            const buffer = Buffer.from(await file.arrayBuffer());
            try {
                fs.writeFileSync(caminhoFinal, buffer);
            } catch (err) {
                if (!fs.existsSync(caminhoFinal)) throw err;
            }
            salvos.push(path.basename(caminhoFinal));
        }

        return NextResponse.json({ salvos }, { status: 201 });
    } catch (error) {
        console.error('Erro ao salvar anexos:', error);
        return NextResponse.json({ error: 'Erro interno ao salvar arquivos.' }, { status: 500 });
    }
}
