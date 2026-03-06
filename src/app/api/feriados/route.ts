// app/api/feriados/route.ts

import { buscarFeriados } from '@/lib/os/feriados-service';
import { NextResponse } from 'next/server';

/**
 * GET /api/feriados?year=2026
 *
 * Expõe os feriados (nacionais + estaduais + municipais configurados)
 * para consumo no cliente (hooks, componentes).
 *
 * Retorna array de strings no formato "DD/MM/YYYY".
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const yearParam = searchParams.get('year');
        const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();

        if (isNaN(year) || year < 2000 || year > 3000) {
            return NextResponse.json({ error: "Parâmetro 'year' inválido" }, { status: 400 });
        }

        const feriados = await buscarFeriados({ year });

        return NextResponse.json(
            { year, feriados },
            {
                headers: {
                    // Cache de 24h no browser, revalidação de 24h no servidor
                    'Cache-Control': 'public, max-age=86400, stale-while-revalidate=86400',
                },
            }
        );
    } catch (error) {
        console.error('[API /feriados] Erro:', error);
        return NextResponse.json({ error: 'Erro ao buscar feriados' }, { status: 500 });
    }
}
