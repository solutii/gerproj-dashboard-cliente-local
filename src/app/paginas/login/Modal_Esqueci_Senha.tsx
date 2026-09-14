// src/app/paginas/login/Modal_Esqueci_Senha.tsx

'use client';

import { alertError, alertSuccess, alertWarning } from '@/store/useAlertDialogStore';
import { useState } from 'react';
import { FaEnvelope, FaKey } from 'react-icons/fa';
import { FiLoader } from 'react-icons/fi';
import { IoClose } from 'react-icons/io5';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface ModalEsqueciSenhaProps {
    isOpen: boolean;
    onClose: () => void;
}

export function ModalEsqueciSenha({ isOpen, onClose }: ModalEsqueciSenhaProps) {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);

    const handleFecharLimpar = () => {
        setEmail('');
        onClose();
    };

    const handleSubmit = async () => {
        if (!EMAIL_REGEX.test(email.trim())) {
            alertWarning('Informe um e-mail válido.');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/esqueci-senha', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim() }),
            });
            const d = await res.json();
            if (!res.ok) {
                alertError(
                    d.error ??
                        'Não foi possível solicitar uma nova senha agora. Tente novamente em instantes.'
                );
                return;
            }
            await alertSuccess(
                'Se o e-mail informado estiver cadastrado, enviaremos uma nova senha para ele em instantes.'
            );
            handleFecharLimpar();
        } catch {
            alertError(
                'Falha de conexão ao solicitar nova senha. Verifique sua internet e tente novamente.'
            );
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-200 ease-out">
            <div
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                onClick={handleFecharLimpar}
            />

            <div className="animate-in slide-in-from-bottom-4 relative z-10 flex w-full max-w-md flex-col overflow-hidden rounded-xl border border-white/10 bg-[#182238] shadow-2xl shadow-black/60 transition-all duration-200 ease-out">
                <header className="relative flex flex-shrink-0 items-center justify-between border-b border-white/10 p-5">
                    <div className="flex items-center gap-3">
                        <FaKey className="flex-shrink-0 text-cyan-400" size={22} />
                        <h1 className="text-lg font-semibold tracking-wide text-white">
                            Esqueci minha senha
                        </h1>
                    </div>
                    <button
                        onClick={handleFecharLimpar}
                        disabled={loading}
                        className="cursor-pointer text-white/40 transition-colors hover:text-white disabled:cursor-not-allowed"
                        aria-label="Fechar"
                    >
                        <IoClose size={22} />
                    </button>
                </header>

                <div className="flex flex-col gap-5 p-6">
                    <p className="text-sm text-white/50">
                        Informe o e-mail usado no login. Vamos gerar uma nova senha e enviar para
                        ele.
                    </p>

                    <div className="space-y-1.5">
                        <label className="block text-xs font-semibold tracking-wider text-white/50">
                            E-mail
                        </label>
                        <div className="relative">
                            <FaEnvelope className="absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-white/25" />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSubmit();
                                }}
                                placeholder="seuemail@empresa.com"
                                className="h-12 w-full rounded-lg border border-white/10 bg-white/[0.04] py-3 pr-4 pl-10 text-sm tracking-widest text-white placeholder-white/25 transition-all duration-200 hover:border-white/15 focus:border-blue-500/60 focus:bg-white/[0.06] focus:ring-2 focus:ring-blue-500/15 focus:outline-none"
                            />
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={handleFecharLimpar}
                            disabled={loading}
                            className="flex-1 cursor-pointer rounded-lg border border-white/10 bg-white/[0.04] py-3 text-sm font-semibold tracking-wide text-white/70 transition-all duration-200 hover:border-white/15 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={loading || !email.trim()}
                            className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg bg-cyan-800 py-3 text-sm font-semibold tracking-wide text-white shadow-md shadow-black transition-all duration-200 hover:bg-cyan-600 active:scale-95 disabled:cursor-not-allowed disabled:bg-cyan-900 disabled:opacity-60"
                        >
                            {loading ? (
                                <>
                                    <FiLoader className="animate-spin" size={16} />
                                    <span className="flex items-center">
                                        Enviando
                                        <span
                                            className="ml-0.5 animate-bounce"
                                            style={{ animationDelay: '0ms' }}
                                        >
                                            .
                                        </span>
                                        <span
                                            className="animate-bounce"
                                            style={{ animationDelay: '150ms' }}
                                        >
                                            .
                                        </span>
                                        <span
                                            className="animate-bounce"
                                            style={{ animationDelay: '300ms' }}
                                        >
                                            .
                                        </span>
                                    </span>
                                </>
                            ) : (
                                'Enviar nova senha'
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
