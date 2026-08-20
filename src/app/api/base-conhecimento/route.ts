// app/api/base-conhecimento/route.ts
import { listarArtigos } from '@/lib/kb/kb-service';
import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const artigos = listarArtigos();
        return NextResponse.json({ success: true, artigos });
    } catch (error) {
        console.error('[API BASE CONHECIMENTO] Erro ao listar artigos:', error);
        return NextResponse.json(
            { error: 'Erro ao carregar a base de conhecimento' },
            { status: 500 }
        );
    }
}
