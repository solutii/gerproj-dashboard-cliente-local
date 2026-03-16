// app/api/chamados/horas-adicionais/route.ts

import { firebirdQuery } from '@/lib/firebird/firebird-client';
import {
    agregarHorasAdicionais,
    calcularHorasComAdicionalAsync,
} from '@/lib/os/calcular-horas-adicionais';
import { NextRequest, NextResponse } from 'next/server';

// ==================== TIPOS ====================

export interface HorasAdicionaisChamado {
    horasAdicionalGerado: number;
    totalHorasEquivalente: number;
    totalHorasBruto: number;
}

export type HorasAdicionaisMap = Record<number, HorasAdicionaisChamado>;

interface OSRaw {
    COD_CHAMADO: number;
    DTINI_OS: Date;
    HRINI_OS: string;
    HRFIM_OS: string;
}

// ==================== VALIDAÇÕES ====================

const validarParametros = (sp: URLSearchParams): { ids: number[] } | NextResponse => {
    const raw = sp.get('ids')?.trim();

    if (!raw) {
        return NextResponse.json({ error: "Parâmetro 'ids' é obrigatório" }, { status: 400 });
    }

    const ids = raw
        .split(',')
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n) && n > 0);

    if (ids.length === 0) {
        return NextResponse.json(
            { error: "Parâmetro 'ids' não contém valores válidos" },
            { status: 400 }
        );
    }

    if (ids.length > 500) {
        return NextResponse.json({ error: 'Máximo de 500 IDs por requisição' }, { status: 400 });
    }

    return { ids };
};

// ==================== QUERY ====================

const buscarOSPorChamados = async (ids: number[]): Promise<OSRaw[]> => {
    const placeholders = ids.map(() => '?').join(',');

    const sql = `
        SELECT
            CAST(OS.CHAMADO_OS AS INTEGER) AS COD_CHAMADO,
            OS.DTINI_OS,
            OS.HRINI_OS,
            OS.HRFIM_OS
        FROM OS
        INNER JOIN TAREFA ON OS.CODTRF_OS = TAREFA.COD_TAREFA
            AND TAREFA.EXIBECHAM_TAREFA = 1
        WHERE
            OS.CHAMADO_OS IS NOT NULL
            AND TRIM(OS.CHAMADO_OS) <> ''
            AND CAST(OS.CHAMADO_OS AS INTEGER) IN (${placeholders})
            AND OS.DTINI_OS IS NOT NULL
            AND OS.HRINI_OS IS NOT NULL
            AND OS.HRFIM_OS IS NOT NULL
        ORDER BY
            COD_CHAMADO,
            OS.DTINI_OS
    `;

    return firebirdQuery<OSRaw>(sql, ids);
};

// ==================== HANDLER ====================

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);

        const params = validarParametros(searchParams);
        if (params instanceof NextResponse) return params;

        const osRows = await buscarOSPorChamados(params.ids);

        // Agrupa OS por chamado
        const osPorChamado = new Map<number, OSRaw[]>();
        for (const os of osRows) {
            const lista = osPorChamado.get(os.COD_CHAMADO) ?? [];
            lista.push(os);
            osPorChamado.set(os.COD_CHAMADO, lista);
        }

        // Calcula horas adicionais para cada OS e agrega por chamado
        const map: HorasAdicionaisMap = {};

        await Promise.all(
            Array.from(osPorChamado.entries()).map(async ([codChamado, osList]) => {
                const resultados = await Promise.all(
                    osList.map((os) =>
                        calcularHorasComAdicionalAsync(os.DTINI_OS, os.HRINI_OS, os.HRFIM_OS)
                    )
                );

                const agregado = agregarHorasAdicionais(resultados);

                map[codChamado] = {
                    horasAdicionalGerado: agregado.horasAdicionalGerado,
                    totalHorasEquivalente: agregado.totalHorasEquivalente,
                    totalHorasBruto: agregado.totalHorasBruto,
                };
            })
        );

        return NextResponse.json({ success: true, data: map }, { status: 200 });
    } catch (error) {
        console.error(
            '[API HORAS-ADICIONAIS] Erro:',
            error instanceof Error ? error.message : error
        );

        return NextResponse.json(
            {
                success: false,
                error: 'Erro interno do servidor',
                message: error instanceof Error ? error.message : 'Erro desconhecido',
                details: process.env.NODE_ENV === 'development' ? error : undefined,
            },
            { status: 500 }
        );
    }
}
