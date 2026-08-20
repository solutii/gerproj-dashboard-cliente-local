// app/api/base-conhecimento/[slug]/route.ts
import { buscarArtigoPorSlug } from '@/lib/kb/kb-service';
import { NextRequest, NextResponse } from 'next/server';

interface RouteParams {
    params: {
        slug: string;
    };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const { slug } = await params;
        const artigo = buscarArtigoPorSlug(slug);

        if (!artigo) {
            return NextResponse.json({ error: 'Artigo não encontrado' }, { status: 404 });
        }

        return NextResponse.json({ success: true, artigo });
    } catch (error) {
        console.error('[API BASE CONHECIMENTO] Erro ao buscar artigo:', error);
        return NextResponse.json({ error: 'Erro ao carregar o artigo' }, { status: 500 });
    }
}
