// src/components/login/Login.tsx
'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ImSpinner2 } from 'react-icons/im';
import { IoEye, IoEyeOff, IoLockClosed, IoMail } from 'react-icons/io5';
import { MdOutlineKeyboardArrowRight } from 'react-icons/md';
import { useAuth } from '../../../context/AuthContext';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const router = useRouter();
    const { login } = useAuth();

    useEffect(() => {
        const rememberedEmail = localStorage.getItem('rememberedEmail');
        if (rememberedEmail) {
            setEmail(rememberedEmail);
            setRememberMe(true);
        }
    }, []);

    const handleSubmit = async (e: React.FormEvent<HTMLDivElement>) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const userData = await login(email, password);

            if (userData) {
                if (rememberMe) {
                    localStorage.setItem('rememberedEmail', email);
                } else {
                    localStorage.removeItem('rememberedEmail');
                }

                await sleep(1000);

                // Roteamento baseado no tipo de login
                if (userData.loginType === 'consultor') {
                    // Consultores sempre vão para a página de chamados
                    await router.push('/paginas/gerproj/chamados');
                } else {
                    // Cliente - lógica existente
                    if (userData.isAdmin) {
                        await router.push('/paginas/dashboard');
                    } else if (userData.codCliente) {
                        await router.push('/paginas/dashboard');
                    } else if (userData.codRecurso) {
                        await router.push('/paginas/tabela-chamados-abertos');
                    } else {
                        setError('Usuário autenticado, mas sem permissões definidas.');
                        setIsLoading(false);
                    }
                }
            } else {
                setError('Usuário não cadastrado ou senha inválida.');
                setIsLoading(false);
            }
        } catch (err) {
            setError('Erro ao tentar fazer login. Tente novamente.');
            setIsLoading(false);
            console.error(err);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !isLoading) {
            handleSubmit(e as any);
        }
    };

    return (
        <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-gray-900 via-purple-900 to-violet-900 p-4 sm:p-6">
            {/* Background Image */}
            <div
                className="absolute inset-0 bg-cover bg-center bg-no-repeat"
                style={{
                    backgroundImage: 'url(/imagem-fundo-login.avif)',
                    opacity: 0.15,
                }}
            ></div>

            {/* Overlay escuro para melhor contraste */}
            <div className="absolute inset-0 bg-gradient-to-br from-black/50 via-purple-900/30 to-black/50"></div>

            {/* Floating Orbs */}
            <div className="absolute top-1/4 left-1/4 h-16 w-16 animate-pulse rounded-full bg-gradient-to-r from-purple-400/30 to-pink-400/30 blur-xl sm:h-24 sm:w-24 lg:h-32 lg:w-32"></div>
            <div className="absolute top-3/4 right-1/4 h-20 w-20 animate-pulse rounded-full bg-gradient-to-r from-blue-400/25 to-purple-400/25 blur-2xl delay-1000 sm:h-32 sm:w-32 lg:h-40 lg:w-40"></div>
            <div className="absolute top-1/2 left-3/4 h-12 w-12 animate-pulse rounded-full bg-gradient-to-r from-pink-400/35 to-purple-400/35 blur-xl delay-500 sm:h-18 sm:w-18 lg:h-24 lg:w-24"></div>

            {/* Grid Pattern */}
            <div
                className="absolute inset-0 opacity-10"
                style={{
                    backgroundImage: `
                        linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
                    `,
                    backgroundSize: '50px 50px',
                }}
            ></div>

            {/* Radial Gradients */}
            <div
                className="absolute inset-0"
                style={{
                    backgroundImage: `
                        radial-gradient(circle at 20% 20%, rgba(168,85,247,0.2) 0%, transparent 50%),
                        radial-gradient(circle at 80% 80%, rgba(236,72,153,0.15) 0%, transparent 50%),
                        radial-gradient(circle at 60% 20%, rgba(59,130,246,0.12) 0%, transparent 50%)
                    `,
                }}
            ></div>

            {/* Login Card */}
            <div className="relative z-10 w-full max-w-md">
                <div className="rounded-2xl border border-white/20 bg-white/10 p-6 shadow-2xl backdrop-blur-xl sm:rounded-3xl sm:p-8 lg:p-10">
                    {/* Logo Header */}
                    <div className="relative mb-6 text-center sm:mb-8">
                        <div className="absolute inset-0 scale-110 rounded-full bg-gradient-to-r from-purple-400 to-pink-400 opacity-30 blur-lg"></div>
                        <div className="relative inline-block rounded-full border border-white/30 bg-white/20 p-3 backdrop-blur-sm sm:p-4">
                            <Image
                                src="/logo-solutii.png"
                                alt="Logo Solutii"
                                width={60}
                                height={60}
                                className="mx-auto rounded-full drop-shadow-lg sm:h-20 sm:w-20"
                                priority
                            />
                        </div>
                    </div>

                    {/* Welcome Title */}
                    <div className="mb-6 text-center sm:mb-8">
                        <h1 className="text-2xl font-bold text-white sm:text-3xl lg:text-4xl">
                            Bem-vindo de volta!
                        </h1>
                        <p className="mt-2 text-sm text-white/70 sm:text-base">
                            Entre com suas credenciais para continuar
                        </p>
                    </div>

                    {/* Form */}
                    <div className="space-y-5 sm:space-y-6" onKeyPress={handleKeyPress}>
                        {/* Email/Username Field */}
                        <div className="space-y-2 sm:space-y-3">
                            <label
                                htmlFor="email"
                                className="block text-sm font-semibold text-white/90"
                            >
                                Email ou Usuário
                            </label>
                            <div className="group relative">
                                <div className="pointer-events-none absolute inset-y-0 left-0 z-10 flex items-center pl-3 sm:pl-4">
                                    <IoMail className="h-4 w-4 text-white/60 transition-colors duration-200 group-focus-within:text-purple-300 sm:h-5 sm:w-5" />
                                </div>
                                <input
                                    type="text"
                                    id="email"
                                    name="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="seu@email.com ou usuário"
                                    required
                                    className="block w-full rounded-xl border border-white/20 bg-white/10 py-3 pr-3 pl-10 text-sm text-white placeholder-white/60 backdrop-blur-sm transition-all duration-200 hover:border-white/30 hover:bg-white/15 focus:border-transparent focus:ring-2 focus:ring-purple-400 focus:outline-none sm:rounded-2xl sm:py-4 sm:pr-4 sm:pl-12 sm:text-base"
                                />
                                <div className="absolute inset-0 -z-10 rounded-xl bg-gradient-to-r from-purple-400/20 to-pink-400/20 opacity-0 blur-sm transition-opacity duration-200 group-focus-within:opacity-100 sm:rounded-2xl"></div>
                            </div>
                        </div>

                        {/* Password Field */}
                        <div className="space-y-2 sm:space-y-3">
                            <label
                                htmlFor="password"
                                className="block text-sm font-semibold text-white/90"
                            >
                                Senha
                            </label>
                            <div className="group relative">
                                <div className="pointer-events-none absolute inset-y-0 left-0 z-10 flex items-center pl-3 sm:pl-4">
                                    <IoLockClosed className="h-4 w-4 text-white/60 transition-colors duration-200 group-focus-within:text-purple-300 sm:h-5 sm:w-5" />
                                </div>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    id="password"
                                    name="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Digite sua senha"
                                    required
                                    className="block w-full rounded-xl border border-white/20 bg-white/10 py-3 pr-10 pl-10 text-sm text-white placeholder-white/60 backdrop-blur-sm transition-all duration-200 hover:border-white/30 hover:bg-white/15 focus:border-transparent focus:ring-2 focus:ring-purple-400 focus:outline-none sm:rounded-2xl sm:py-4 sm:pr-12 sm:pl-12 sm:text-base"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 z-10 flex touch-manipulation items-center pr-3 transition-transform duration-200 hover:scale-110 sm:pr-4"
                                    tabIndex={-1}
                                >
                                    {showPassword ? (
                                        <IoEyeOff className="h-4 w-4 text-white/60 sm:h-5 sm:w-5" />
                                    ) : (
                                        <IoEye className="h-4 w-4 text-white/60 sm:h-5 sm:w-5" />
                                    )}
                                </button>
                                <div className="absolute inset-0 -z-10 rounded-xl bg-gradient-to-r from-purple-400/20 to-pink-400/20 opacity-0 blur-sm transition-opacity duration-200 group-focus-within:opacity-100 sm:rounded-2xl"></div>
                            </div>
                        </div>

                        {/* Remember Me */}
                        <div className="flex items-center justify-between pt-1 text-xs sm:pt-2 sm:text-sm">
                            <div className="group flex items-center">
                                <input
                                    id="remember-me"
                                    type="checkbox"
                                    checked={rememberMe}
                                    onChange={() => setRememberMe(!rememberMe)}
                                    className="h-3.5 w-3.5 rounded border-white/30 bg-white/10 text-purple-400 sm:h-4 sm:w-4"
                                />
                                <label
                                    htmlFor="remember-me"
                                    className="ml-2 cursor-pointer text-white/80 group-hover:text-white sm:ml-3"
                                >
                                    Lembrar de mim
                                </label>
                            </div>
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="rounded-xl border border-red-400/30 bg-red-500/20 p-3 backdrop-blur-sm">
                                <p className="text-center text-xs font-medium text-red-200 sm:text-sm">
                                    {error}
                                </p>
                            </div>
                        )}

                        {/* Submit Button */}
                        <button
                            type="button"
                            onClick={handleSubmit as any}
                            disabled={isLoading}
                            className={`group relative flex w-full transform items-center justify-center rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 px-4 py-3.5 text-sm font-semibold text-white shadow-xl transition-all duration-200 sm:rounded-2xl sm:px-6 sm:py-4 sm:text-base ${
                                isLoading
                                    ? 'cursor-not-allowed opacity-60'
                                    : 'hover:-translate-y-1 hover:scale-[1.02] hover:from-purple-600 hover:to-pink-600 hover:shadow-2xl active:scale-[0.98]'
                            }`}
                        >
                            <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-purple-400 to-pink-400 opacity-0 blur-lg transition-opacity duration-200 group-hover:opacity-30 sm:rounded-2xl" />

                            {isLoading ? (
                                <span className="relative z-10 flex items-center gap-2">
                                    <ImSpinner2 className="h-5 w-5 animate-spin" />
                                    Entrando...
                                </span>
                            ) : (
                                <>
                                    <span className="relative z-10 mr-2">Entrar</span>
                                    <MdOutlineKeyboardArrowRight className="relative z-10 h-4 w-4 transition-transform duration-200 group-hover:translate-x-2 sm:h-5 sm:w-5" />
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
