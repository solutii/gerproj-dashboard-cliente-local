// app/api/chamados/[codChamado]/historico/route.ts
import { safeErrorMessage } from '@/lib/api-error';
import { resolveCodClienteSeguro } from '@/lib/auth/cliente-token';
import { firebirdQuery } from '@/lib/firebird/firebird-client';
import { NextRequest, NextResponse } from 'next/server';

interface RouteParams {
    params: {
        codChamado: string;
    };
}

function validarCodChamado(codChamado: string): number | NextResponse {
    const cod = parseInt(codChamado);

    if (isNaN(cod) || cod <= 0) {
        return NextResponse.json(
            { error: "Parâmetro 'codChamado' deve ser um número válido" },
            { status: 400 }
        );
    }

    return cod;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const { codChamado } = await params;

        const codChamadoValidado = validarCodChamado(codChamado);
        if (codChamadoValidado instanceof NextResponse) {
            return codChamadoValidado;
        }

        const chamadoRows = await firebirdQuery<{ COD_CHAMADO: number; COD_CLIENTE: number }>(
            'SELECT COD_CHAMADO, COD_CLIENTE FROM CHAMADO WHERE COD_CHAMADO = ?',
            [codChamadoValidado]
        );

        if (chamadoRows.length === 0) {
            return NextResponse.json({ error: 'Chamado não encontrado' }, { status: 404 });
        }

        // Só valida dono quando o chamador manda um codCliente (fluxo de
        // cliente) — sem isso (ex.: ADM sem cliente selecionado ainda),
        // mantém o comportamento anterior.
        const { searchParams } = new URL(request.url);
        const codCliente = resolveCodClienteSeguro(request, searchParams.get('codCliente'));
        if (codCliente && String(chamadoRows[0].COD_CLIENTE) !== String(codCliente)) {
            return NextResponse.json(
                { error: 'Você não tem permissão para acessar este chamado' },
                { status: 403 }
            );
        }

        const historicoRows = await firebirdQuery<{
            COD_HISTCHAMADO: number;
            COD_CHAMADO: number;
            DATA_HISTCHAMADO: Date;
            HORA_HISTCHAMADO: string;
            DESC_HISTCHAMADO: string;
        }>(
            `SELECT COD_HISTCHAMADO, COD_CHAMADO, DATA_HISTCHAMADO, HORA_HISTCHAMADO, DESC_HISTCHAMADO
             FROM HISTCHAMADO
             WHERE COD_CHAMADO = ?
             ORDER BY COD_HISTCHAMADO ASC`,
            [codChamadoValidado]
        );

        const historico = historicoRows.map((row) => ({
            codHistchamado: row.COD_HISTCHAMADO,
            data: row.DATA_HISTCHAMADO,
            hora: row.HORA_HISTCHAMADO,
            descricao: row.DESC_HISTCHAMADO,
        }));

        return NextResponse.json(
            { success: true, codChamado: codChamadoValidado, historico },
            { status: 200 }
        );
    } catch (error) {
        console.error('[API HISTORICO CHAMADO] Erro:', error);
        return NextResponse.json(
            {
                error: 'Erro ao buscar histórico do chamado',
                message: safeErrorMessage(error),
            },
            { status: 500 }
        );
    }
}
