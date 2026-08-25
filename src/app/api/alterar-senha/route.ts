// src/app/api/alterar-senha/route.ts
//
// Troca de senha para usuários cliente (users/usuarios.json, senha bcrypt).
// Consultores (tabela USUARIO no Firebird) não são cobertos por esta rota.
import { safeErrorMessage } from '@/lib/api-error';
import { comUsuarioPorEmail, validarForcaSenha } from '@/lib/auth/usuarios-cliente';
import { excedeuLimite, obterIp } from '@/lib/rate-limit';
import bcrypt from 'bcryptjs';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        const ip = obterIp(request);
        if (excedeuLimite(`alterar-senha:${ip}`, 5, 10 * 60 * 1000)) {
            return NextResponse.json(
                { error: 'Muitas tentativas. Tente novamente em alguns minutos.' },
                { status: 429 }
            );
        }

        const body = await request.json();
        const { email, senhaAtual, senhaNova } = body;

        if (
            !email ||
            typeof email !== 'string' ||
            !senhaAtual ||
            typeof senhaAtual !== 'string' ||
            !senhaNova ||
            typeof senhaNova !== 'string'
        ) {
            return NextResponse.json(
                { error: 'E-mail, senha atual e nova senha são obrigatórios.' },
                { status: 400 }
            );
        }

        const errosSenhaNova = validarForcaSenha(senhaNova);
        if (errosSenhaNova.length > 0) {
            return NextResponse.json({ error: errosSenhaNova.join(' ') }, { status: 400 });
        }

        const resultado = await comUsuarioPorEmail(email, (usuarios, usuario) => {
            if (!usuario) {
                return {
                    resultado: { error: 'Usuário não encontrado.', status: 404 },
                    alterou: false,
                };
            }
            // bcrypt.compareSync é aceitável aqui — corpo pequeno, chamada única.
            if (!bcrypt.compareSync(senhaAtual, usuario.password)) {
                return {
                    resultado: { error: 'Senha atual incorreta.', status: 400 },
                    alterou: false,
                };
            }

            const novoHash = bcrypt.hashSync(senhaNova, 10);
            const index = usuarios.findIndex((u) => u === usuario);
            usuarios[index] = { ...usuario, password: novoHash };
            return { resultado: null, alterou: true };
        });

        if (resultado) {
            const { error, status } = resultado as { error: string; status: number };
            return NextResponse.json({ error }, { status });
        }

        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error) {
        console.error('[API ALTERAR-SENHA] Erro:', error);
        return NextResponse.json(
            { error: 'Erro interno do servidor', message: safeErrorMessage(error) },
            { status: 500 }
        );
    }
}
