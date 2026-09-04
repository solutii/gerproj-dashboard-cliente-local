// src/app/api/gerar-link-validacao/route.ts
//
// Endpoint INTERNO — só o sistema Delphi deve chamar isso, ao disparar o
// email de "chamado aguardando validação" (quando STATUS_CHAMADO vira
// FINALIZADO). Protegido pelo header X-Internal-Key, comparado contra
// DELPHI_INTERNAL_API_KEY. Sem essa chave certa, qualquer um poderia gerar
// um link de acesso válido pra qualquer chamado de qualquer cliente.
import { assinarLinkValidacao } from '@/lib/auth/link-validacao';
import { firebirdQuery } from '@/lib/firebird/firebird-client';
import { excedeuLimite, obterIp } from '@/lib/rate-limit';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        const ip = obterIp(request);
        if (excedeuLimite(`gerar-link-validacao:${ip}`, 60, 10 * 60 * 1000)) {
            return NextResponse.json(
                { error: 'Muitas solicitações. Tente novamente em alguns minutos.' },
                { status: 429 }
            );
        }

        const chaveEsperada = process.env.DELPHI_INTERNAL_API_KEY;
        const chaveRecebida = request.headers.get('x-internal-key');
        if (!chaveEsperada || !chaveRecebida || chaveRecebida !== chaveEsperada) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }

        const body = await request.json();
        const codChamado = Number(body?.codChamado);
        if (!codChamado || isNaN(codChamado) || codChamado <= 0) {
            return NextResponse.json({ error: "Parâmetro 'codChamado' inválido" }, { status: 400 });
        }

        const chamadoRows = await firebirdQuery<{ COD_CLIENTE: number }>(
            'SELECT COD_CLIENTE FROM CHAMADO WHERE COD_CHAMADO = ?',
            [codChamado]
        );
        if (chamadoRows.length === 0) {
            return NextResponse.json({ error: 'Chamado não encontrado' }, { status: 404 });
        }

        const token = assinarLinkValidacao(codChamado, String(chamadoRows[0].COD_CLIENTE));
        if (!token) {
            return NextResponse.json(
                { error: 'Serviço de link de validação indisponível' },
                { status: 500 }
            );
        }

        const baseUrl = (process.env.APP_URL ?? '').replace(/\/+$/, '');
        if (!baseUrl) {
            return NextResponse.json(
                { error: 'APP_URL não configurado no servidor' },
                { status: 500 }
            );
        }

        return NextResponse.json({ url: `${baseUrl}/validar/${token}` }, { status: 200 });
    } catch (error) {
        console.error('[API GERAR-LINK-VALIDACAO] Erro:', error);
        return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
    }
}
