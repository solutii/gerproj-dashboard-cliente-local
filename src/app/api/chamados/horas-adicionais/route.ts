// app/api/chamados/horas-adicionais/route.ts

import { safeErrorMessage } from '@/lib/api-error';
import { resolveCodClienteSeguro } from '@/lib/auth/cliente-token';
import { firebirdQuery } from '@/lib/firebird/firebird-client';
import {
    agregarHorasAdicionais,
    calcularHorasComAdicional,
    CONFIG_PADRAO_ADICIONAL,
} from '@/lib/os/calcular-horas-adicionais';
import { buscarFeriados } from '@/lib/os/feriados-service';
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

const validarParametros = (
    request: NextRequest,
    sp: URLSearchParams
): { ids: number[]; codCliente?: string } | NextResponse => {
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

    const codCliente = resolveCodClienteSeguro(request, sp.get('codCliente'))?.trim() || undefined;

    return { ids, codCliente };
};

// ==================== QUERY ====================

const buscarOSPorChamados = async (ids: number[], codCliente?: string): Promise<OSRaw[]> => {
    const placeholders = ids.map(() => '?').join(',');

    // Só entra no JOIN com CHAMADO quando há um codCliente pra filtrar
    // (fluxo de cliente) — sem isso (ex.: ADM), mantém o comportamento
    // anterior sem exigir o join extra.
    let sql = `
        SELECT
            CAST(OS.CHAMADO_OS AS INTEGER) AS COD_CHAMADO,
            OS.DTINI_OS,
            OS.HRINI_OS,
            OS.HRFIM_OS
        FROM OS
        INNER JOIN TAREFA ON OS.CODTRF_OS = TAREFA.COD_TAREFA
            AND TAREFA.EXIBECHAM_TAREFA = 1
    `;

    if (codCliente) {
        sql += ` INNER JOIN CHAMADO ON CAST(OS.CHAMADO_OS AS INTEGER) = CHAMADO.COD_CHAMADO `;
    }

    sql += `
        WHERE
            OS.CHAMADO_OS IS NOT NULL
            AND TRIM(OS.CHAMADO_OS) <> ''
            AND CAST(OS.CHAMADO_OS AS INTEGER) IN (${placeholders})
            AND OS.DTINI_OS IS NOT NULL
            AND OS.HRINI_OS IS NOT NULL
            AND OS.HRFIM_OS IS NOT NULL
    `;

    const sqlParams: (number | string)[] = [...ids];

    if (codCliente) {
        sql += ` AND CHAMADO.COD_CLIENTE = ? `;
        sqlParams.push(codCliente);
    }

    sql += `
        ORDER BY
            COD_CHAMADO,
            OS.DTINI_OS
    `;

    return firebirdQuery<OSRaw>(sql, sqlParams);
};

// ==================== HANDLER ====================

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);

        const params = validarParametros(request, searchParams);
        if (params instanceof NextResponse) return params;

        const osRows = await buscarOSPorChamados(params.ids, params.codCliente);

        // ── Passo 1: busca feriados por ano antes de qualquer cálculo ──────────
        //
        // Coleta os anos únicos presentes nas OSs e busca os feriados uma única
        // vez por ano. O cache de Promises do feriados-service garante que anos
        // repetidos (ou requisições concorrentes) não disparem fetches extras.
        //
        // Resultado: no máximo N fetches HTTP, onde N = anos distintos nas OSs
        // (normalmente 1 ou 2), independente de quantos chamados/OSs existam.

        const anosUnicos = [...new Set(osRows.map((os) => new Date(os.DTINI_OS).getFullYear()))];

        const feriadosPorAno = new Map<number, string[]>();
        await Promise.all(
            anosUnicos.map(async (year) => {
                feriadosPorAno.set(year, await buscarFeriados({ year }));
            })
        );

        // ── Passo 2: agrupa OSs por chamado ────────────────────────────────────

        const osPorChamado = new Map<number, OSRaw[]>();
        for (const os of osRows) {
            const lista = osPorChamado.get(os.COD_CHAMADO) ?? [];
            lista.push(os);
            osPorChamado.set(os.COD_CHAMADO, lista);
        }

        // ── Passo 3: calcula horas usando a versão síncrona ────────────────────
        //
        // Com os feriados já em memória, usa calcularHorasComAdicional (síncrona)
        // em vez de calcularHorasComAdicionalAsync. Elimina todos os fetches
        // dentro do loop e torna o cálculo puramente em memória.

        const map: HorasAdicionaisMap = {};

        for (const [codChamado, osList] of osPorChamado.entries()) {
            const resultados = osList.map((os) => {
                const year = new Date(os.DTINI_OS).getFullYear();
                const feriados = feriadosPorAno.get(year) ?? [];

                return calcularHorasComAdicional(os.DTINI_OS, os.HRINI_OS, os.HRFIM_OS, {
                    ...CONFIG_PADRAO_ADICIONAL,
                    feriados,
                });
            });

            const agregado = agregarHorasAdicionais(resultados);

            map[codChamado] = {
                horasAdicionalGerado: agregado.horasAdicionalGerado,
                totalHorasEquivalente: agregado.totalHorasEquivalente,
                totalHorasBruto: agregado.totalHorasBruto,
            };
        }

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
                message: safeErrorMessage(error),
            },
            { status: 500 }
        );
    }
}
