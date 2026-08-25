// app/api/cliente-ia/route.ts

import { safeErrorMessage } from '@/lib/api-error';
import { firebirdQuery } from '@/lib/firebird/firebird-client';
import { NextRequest, NextResponse } from 'next/server';

interface ClienteIARaw {
    CLIENTE_EXIBE_IA: number | null;
    CLIENTE_IA: string | null;
}

// ==================== HANDLER ====================
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const codCliente = searchParams.get('codCliente')?.trim();

        if (!codCliente) {
            return NextResponse.json(
                { error: "Parâmetro 'codCliente' obrigatório" },
                { status: 400 }
            );
        }

        const codClienteNum = parseInt(codCliente, 10);
        if (isNaN(codClienteNum)) {
            return NextResponse.json({ error: "Parâmetro 'codCliente' inválido" }, { status: 400 });
        }

        // rawBlobs: true — CLIENTE_IA guarda HTML (ex: <iframe>) que precisa
        // ser preservado, ao contrário de outros BLOBs (ex: descrição de
        // chamado) onde o HTML é limpo e convertido em texto puro.
        const result = await firebirdQuery<ClienteIARaw>(
            'SELECT CLIENTE_EXIBE_IA, CLIENTE_IA FROM CLIENTE WHERE COD_CLIENTE = ?',
            [codClienteNum],
            { rawBlobs: true }
        );

        const row = result[0];
        const exibe = row?.CLIENTE_EXIBE_IA === 1;

        return NextResponse.json(
            {
                success: true,
                exibe,
                conteudo: exibe ? (row?.CLIENTE_IA ?? null) : null,
            },
            { status: 200 }
        );
    } catch (error) {
        console.error('[API CLIENTE-IA] Erro:', error instanceof Error ? error.message : error);

        return NextResponse.json(
            {
                success: false,
                error: 'Erro interno do servidor',
                message: safeErrorMessage(error),
            },
            { status: 500 }
        );
    }
}
