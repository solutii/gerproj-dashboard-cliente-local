// src/components/alterar-senha/Modal_Alterar_Senha.tsx

'use client';

import { alertError, alertSuccess, alertWarning } from '@/store/useAlertDialogStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useState } from 'react';
import { FaKey } from 'react-icons/fa';
import { IoClose } from 'react-icons/io5';

const inputClass =
    'w-full border-0 border-b border-gray-300 bg-white pb-2 text-lg tracking-widest text-black outline-none transition-all duration-100 placeholder:text-gray-400 placeholder:text-sm focus:border-b-[3px] focus:border-teal-600';

const labelClass =
    'block select-none text-base font-semibold tracking-wider text-black uppercase mb-2';

// Mesmos critérios de scripts/gerador_senha_usuario.ts.
function validarForcaSenha(senha: string): string[] {
    const erros: string[] = [];
    if (senha.length < 8) erros.push('mínimo 8 caracteres');
    if (!/[A-Z]/.test(senha)) erros.push('uma letra MAIÚSCULA');
    if (!/[a-z]/.test(senha)) erros.push('uma letra minúscula');
    if (!/[0-9]/.test(senha)) erros.push('um número');
    if (!/[!@#$%^&*()_+\-=[\]{};:'",.<>?/\\|`~]/.test(senha)) erros.push('um caractere especial');
    return erros;
}

interface ModalAlterarSenhaProps {
    isOpen: boolean;
    onClose: () => void;
}

export function ModalAlterarSenha({ isOpen, onClose }: ModalAlterarSenhaProps) {
    const userEmail = useAuthStore((state) => state.userEmail);

    const [senhaAtual, setSenhaAtual] = useState('');
    const [senhaNova, setSenhaNova] = useState('');
    const [confirmarSenha, setConfirmarSenha] = useState('');
    const [loading, setLoading] = useState(false);

    const resetFormulario = () => {
        setSenhaAtual('');
        setSenhaNova('');
        setConfirmarSenha('');
    };

    const handleFecharLimpar = () => {
        resetFormulario();
        onClose();
    };

    const handleSubmit = async () => {
        if (!senhaAtual.trim()) {
            alertWarning('Informe a senha atual.');
            return;
        }

        const errosForca = validarForcaSenha(senhaNova);
        if (errosForca.length > 0) {
            alertWarning(`A nova senha precisa ter: ${errosForca.join(', ')}.`);
            return;
        }

        if (senhaNova !== confirmarSenha) {
            alertWarning('A confirmação não corresponde à nova senha digitada.');
            return;
        }

        if (!userEmail) {
            alertError('Usuário não identificado. Faça login novamente e repita a operação.');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/alterar-senha', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: userEmail, senhaAtual, senhaNova }),
            });
            const d = await res.json();
            if (!res.ok) {
                alertError(
                    d.error ??
                        'Não foi possível alterar a senha. Verifique se a senha atual está correta.'
                );
                return;
            }
            await alertSuccess('Senha alterada com sucesso!');
            handleFecharLimpar();
        } catch {
            alertError(
                'Falha de conexão ao tentar alterar a senha. Verifique sua internet e tente novamente.'
            );
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center p-2 transition-all duration-200 ease-out sm:p-4">
            <div
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                onClick={handleFecharLimpar}
            />

            <div className="animate-in slide-in-from-bottom-4 relative z-10 flex w-full max-w-xl flex-col overflow-hidden rounded-xl bg-white transition-all duration-200 ease-out">
                <header className="relative flex flex-shrink-0 items-center justify-between bg-teal-700 p-6 shadow-md shadow-black">
                    <div className="flex items-center gap-4">
                        <FaKey className="flex-shrink-0 text-white" size={34} />
                        <h1 className="text-2xl font-extrabold tracking-widest text-white select-none">
                            ALTERAR SENHA
                        </h1>
                    </div>
                    <button
                        onClick={handleFecharLimpar}
                        disabled={loading}
                        className="mr-1 flex-shrink-0 cursor-pointer rounded-md bg-gradient-to-br from-red-600 to-red-700 shadow-md shadow-black transition-all duration-200 hover:scale-125 hover:bg-red-500 hover:shadow-xl hover:shadow-black active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                        aria-label="Fechar modal"
                    >
                        <IoClose className="text-white" size={30} />
                    </button>
                </header>

                <div className="flex flex-col gap-7 px-10 py-8">
                    <div>
                        <label className={labelClass}>Senha atual:</label>
                        <input
                            type="password"
                            value={senhaAtual}
                            onChange={(e) => setSenhaAtual(e.target.value)}
                            className={inputClass}
                            autoComplete="current-password"
                        />
                    </div>

                    <div>
                        <label className={labelClass}>Nova senha:</label>
                        <input
                            type="password"
                            value={senhaNova}
                            onChange={(e) => setSenhaNova(e.target.value)}
                            className={inputClass}
                            autoComplete="new-password"
                        />
                        <p className="mt-2 text-sm tracking-wide text-gray-400 select-none">
                            Mínimo 8 caracteres, com maiúscula, minúscula, número e caractere
                            especial.
                        </p>
                    </div>

                    <div>
                        <label className={labelClass}>Confirmar nova senha:</label>
                        <input
                            type="password"
                            value={confirmarSenha}
                            onChange={(e) => setConfirmarSenha(e.target.value)}
                            className={inputClass}
                            autoComplete="new-password"
                        />
                    </div>

                    <div className="flex gap-5">
                        <button
                            onClick={handleFecharLimpar}
                            disabled={loading}
                            className="flex flex-1 items-center justify-center rounded-md bg-red-600 py-3 text-lg font-semibold text-white shadow-md shadow-black transition-all duration-300 hover:-translate-y-1 hover:bg-red-400 hover:shadow-none active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={loading || !senhaAtual || !senhaNova || !confirmarSenha}
                            className="flex flex-1 items-center justify-center rounded-md bg-teal-700 py-3 text-lg font-semibold text-white shadow-md shadow-black transition-all duration-300 hover:-translate-y-1 hover:bg-teal-600 hover:shadow-none active:scale-95 disabled:cursor-not-allowed disabled:bg-teal-400 disabled:shadow-none"
                        >
                            {loading ? 'Salvando...' : 'Salvar'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
