// src/app/validar/[token]/page.tsx
//
// Página pública (sem login) acessada pelo botão do email de "chamado
// aguardando validação" — verifica o token server-side (precisa de
// node:crypto, por isso Server Component) e renderiza a tela de validação
// só se o token for válido e ainda não tiver expirado.
import { verificarLinkValidacao } from '@/lib/auth/link-validacao';
import Image from 'next/image';
import Link from 'next/link';
import { IoAlertCircle } from 'react-icons/io5';
import { ValidarChamadoClient } from './ValidarChamadoClient';

interface PageProps {
    params: Promise<{ token: string }>;
}

export default async function ValidarChamadoPage({ params }: PageProps) {
    const { token } = await params;
    const verificado = verificarLinkValidacao(token);

    if (!verificado) {
        return <LinkInvalido />;
    }

    return (
        <ValidarChamadoClient
            token={token}
            codChamado={verificado.codChamado}
            codCliente={verificado.codCliente}
        />
    );
}

function LinkInvalido() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-stone-100 px-4">
            <div className="flex max-w-md flex-col items-center gap-4 rounded-xl bg-white p-8 text-center shadow-md shadow-black">
                <Image
                    src="/logo-solutii.png"
                    alt="Solutii"
                    width={140}
                    height={40}
                    priority
                    style={{ width: '140px', height: 'auto' }}
                />
                <IoAlertCircle className="text-red-600" size={48} />
                <h1 className="text-xl font-extrabold tracking-widest text-black">
                    Link inválido ou expirado
                </h1>
                <p className="text-sm font-semibold tracking-wide text-gray-500">
                    Esse link de validação não é mais válido. Faça login normalmente pra acessar o
                    chamado.
                </p>
                <Link
                    href="/"
                    className="mt-2 cursor-pointer rounded-md bg-teal-600 px-6 py-2 font-semibold text-white shadow-md shadow-black transition-all duration-300 hover:-translate-y-1 hover:bg-teal-500 hover:shadow-none active:scale-95"
                >
                    Ir para o login
                </Link>
            </div>
        </div>
    );
}
