// src/app/api/esqueci-senha/route.ts
//
// "Esqueci minha senha" — apenas para usuários cliente (users/usuarios.json).
// Gera uma senha temporária, grava o hash e envia por e-mail. Responde com a
// mesma mensagem genérica exista ou não o e-mail, pra não revelar quais
// contas existem (enumeração de usuários).
import { comUsuarioPorEmail, gerarSenhaTemporaria } from '@/lib/auth/usuarios-cliente';
import { sendMail } from '@/lib/mail/mailer';
import { templateNovaSenha } from '@/lib/mail/templates';
import { excedeuLimite, obterIp } from '@/lib/rate-limit';
import bcrypt from 'bcryptjs';
import { NextRequest, NextResponse } from 'next/server';

const MENSAGEM_GENERICA =
    'Se o e-mail informado estiver cadastrado, enviaremos uma nova senha para ele.';

export async function POST(request: NextRequest) {
    try {
        const ip = obterIp(request);
        if (excedeuLimite(`esqueci-senha:${ip}`, 5, 15 * 60 * 1000)) {
            return NextResponse.json(
                { error: 'Muitas tentativas. Tente novamente em alguns minutos.' },
                { status: 429 }
            );
        }

        const body = await request.json();
        const { email } = body;

        if (!email || typeof email !== 'string' || !email.trim()) {
            return NextResponse.json({ error: 'Informe o e-mail.' }, { status: 400 });
        }

        const senhaTemporaria = gerarSenhaTemporaria();
        const emailNormalizado = email.trim().toLowerCase();

        const encontrado = await comUsuarioPorEmail(emailNormalizado, (usuarios, usuario) => {
            if (!usuario) return { resultado: false, alterou: false };

            const novoHash = bcrypt.hashSync(senhaTemporaria, 10);
            const index = usuarios.findIndex((u) => u === usuario);
            usuarios[index] = { ...usuario, password: novoHash };
            return { resultado: true, alterou: true };
        });

        if (encontrado) {
            try {
                await sendMail({
                    to: emailNormalizado,
                    subject: 'Solutii — Nova senha de acesso ao portal',
                    html: templateNovaSenha(senhaTemporaria),
                });
            } catch (mailErr) {
                console.error('[esqueci-senha] Falha ao enviar e-mail:', mailErr);
                // A senha já foi trocada no arquivo — se o e-mail falhar, o
                // usuário fica sem saber a senha nova. Melhor reportar erro
                // aqui do que devolver sucesso silencioso nesse caso.
                return NextResponse.json(
                    { error: 'Não foi possível enviar o e-mail. Tente novamente.' },
                    { status: 500 }
                );
            }
        }

        return NextResponse.json({ success: true, message: MENSAGEM_GENERICA }, { status: 200 });
    } catch (error) {
        console.error('[API ESQUECI-SENHA] Erro:', error);
        return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
    }
}
