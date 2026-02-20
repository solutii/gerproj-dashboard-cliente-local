// app/api/chamados/horas-por-mes/route.ts

import { firebirdQuery } from '@/lib/firebird/firebird-client';
import { NextRequest, NextResponse } from 'next/server';

// ==================== TIPOS ====================
export interface HorasMes {
    mes: number;
    ano: number;
    horasFaturadas: number;
}

export interface HorasPorChamado {
    codChamado: number;
    meses: HorasMes[];
}

export type HorasPorChamadoMap = Record<number, HorasMes[]>;

interface HorasRaw {
    COD_CHAMADO: number;
    MES_OS: number;
    ANO_OS: number;
    TOTAL_HORAS_FATURADAS: number;
}

// ==================== VALIDAÇÕES ====================
/**
 * Recebe: ?ids=1,2,3,4
 * Limite de 500 IDs por batch para não estourar o SQL.
 */
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
/**
 * Busca horas faturadas por mês para um conjunto de chamados.
 *
 * Agrupa por:
 *   - COD_CHAMADO  → para montar o map no frontend
 *   - MÊS/ANO da DTINI_OS → data real de lançamento da OS
 *
 * Inclui apenas OS faturadas (FATURADO_OS <> 'NAO').
 * Ignora OS sem DTINI_OS preenchido.
 */
const buscarHorasPorMes = async (ids: number[]): Promise<HorasRaw[]> => {
    // Firebird não suporta IN com parâmetros dinâmicos de forma nativa via ?
    // então montamos placeholders explícitos: ?,?,?
    const placeholders = ids.map(() => '?').join(',');

    const sql = `
        SELECT
            CAST(OS.CHAMADO_OS AS INTEGER)          AS COD_CHAMADO,
            EXTRACT(MONTH FROM OS.DTINI_OS)         AS MES_OS,
            EXTRACT(YEAR  FROM OS.DTINI_OS)         AS ANO_OS,
            SUM(
                (
                    CAST(SUBSTRING(OS.HRFIM_OS FROM 1 FOR 2) AS INTEGER) * 60 +
                    CAST(SUBSTRING(OS.HRFIM_OS FROM 3 FOR 2) AS INTEGER) -
                    CAST(SUBSTRING(OS.HRINI_OS FROM 1 FOR 2) AS INTEGER) * 60 -
                    CAST(SUBSTRING(OS.HRINI_OS FROM 3 FOR 2) AS INTEGER)
                ) / 60.0
            ) AS TOTAL_HORAS_FATURADAS
        FROM OS
        INNER JOIN TAREFA ON OS.CODTRF_OS = TAREFA.COD_TAREFA
            AND TAREFA.EXIBECHAM_TAREFA = 1
        WHERE
            OS.CHAMADO_OS IS NOT NULL
            AND TRIM(OS.CHAMADO_OS) <> ''
            AND CAST(OS.CHAMADO_OS AS INTEGER) IN (${placeholders})
            AND UPPER(OS.FATURADO_OS) <> 'NAO'
            AND OS.DTINI_OS IS NOT NULL
        GROUP BY
            CAST(OS.CHAMADO_OS AS INTEGER),
            EXTRACT(MONTH FROM OS.DTINI_OS),
            EXTRACT(YEAR  FROM OS.DTINI_OS)
        ORDER BY
            COD_CHAMADO,
            ANO_OS,
            MES_OS
    `;

    return firebirdQuery<HorasRaw>(sql, ids);
};

// ==================== HANDLER ====================
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);

        const params = validarParametros(searchParams);
        if (params instanceof NextResponse) return params;

        const raw = await buscarHorasPorMes(params.ids);

        // Agrupa os resultados em um map: { [codChamado]: HorasMes[] }
        const map: HorasPorChamadoMap = {};

        for (const row of raw) {
            const cod = row.COD_CHAMADO;
            if (!map[cod]) map[cod] = [];

            map[cod].push({
                mes: row.MES_OS,
                ano: row.ANO_OS,
                horasFaturadas: row.TOTAL_HORAS_FATURADAS ?? 0,
            });
        }

        return NextResponse.json({ success: true, data: map }, { status: 200 });
    } catch (error) {
        console.error('[API HORAS-POR-MES] Erro:', error instanceof Error ? error.message : error);

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
