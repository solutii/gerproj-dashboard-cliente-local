// src/components/login/Login.tsx
'use client';

import { useAuthStore } from '@/store/useAuthStore';
import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
    FaArrowRight,
    FaClipboardList,
    FaEye,
    FaEyeSlash,
    FaLock,
    FaTicketAlt,
} from 'react-icons/fa';
import { FiLoader } from 'react-icons/fi';
import { ImSpinner2 } from 'react-icons/im';
import { IoIosMail, IoIosTime } from 'react-icons/io';
import { IoBarChart, IoChevronDown, IoClose, IoSearch } from 'react-icons/io5';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ==================== Variantes de animação ====================
const fadeUp = (delay = 0) => ({
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5, ease: 'easeOut' as const, delay },
});

const fadeIn = (delay = 0) => ({
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    transition: { duration: 0.5, ease: 'easeOut' as const, delay },
});

const slideRight = (delay = 0) => ({
    initial: { opacity: 0, x: 24 },
    animate: { opacity: 1, x: 0 },
    transition: { duration: 0.45, ease: 'easeOut' as const, delay },
});

// ==================== Dropdown de cliente com busca ====================
interface ClienteDropdownProps {
    clientes: { cod: string; nome: string }[];
    value: string;
    onChange: (cod: string) => void;
    loading: boolean;
}

function ClienteDropdown({ clientes, value, onChange, loading }: ClienteDropdownProps) {
    const [open, setOpen] = useState(false);
    const [busca, setBusca] = useState('');
    const ref = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const clienteSelecionado = clientes.find((c) => c.cod === value);
    const clientesFiltrados = clientes.filter((c) =>
        c.nome.toLowerCase().includes(busca.toLowerCase())
    );

    useEffect(() => {
        function onClickOutside(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
                setBusca('');
            }
        }
        document.addEventListener('mousedown', onClickOutside);
        return () => document.removeEventListener('mousedown', onClickOutside);
    }, []);

    useEffect(() => {
        if (open) setTimeout(() => inputRef.current?.focus(), 50);
    }, [open]);

    const handleSelect = (cod: string) => {
        onChange(cod);
        setOpen(false);
        setBusca('');
    };

    return (
        <div ref={ref} className="relative z-10">
            <button
                type="button"
                onClick={() => setOpen((p) => !p)}
                disabled={loading}
                className="flex h-12 w-full items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-4 text-sm text-white transition-all duration-200 hover:border-blue-500/50 hover:bg-white/8 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            >
                <span
                    className={`flex-1 truncate text-left ${clienteSelecionado ? 'text-white' : 'text-white/40'}`}
                >
                    {loading
                        ? 'Carregando...'
                        : (clienteSelecionado?.nome ?? 'Selecione um cliente...')}
                </span>
                {loading ? (
                    <ImSpinner2 className="h-4 w-4 shrink-0 animate-spin text-white/40" />
                ) : (
                    <motion.span
                        animate={{ rotate: open ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        <IoChevronDown className="h-4 w-4 text-white/40" />
                    </motion.span>
                )}
            </button>

            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: -6, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.97 }}
                        transition={{ duration: 0.18, ease: 'easeOut' }}
                        className="absolute z-50 mt-1.5 w-full overflow-hidden rounded-xl border border-white/10 bg-[#0d1424] shadow-2xl shadow-black/60"
                    >
                        <div className="flex items-center gap-2 border-b border-white/8 px-3 py-2.5">
                            <IoSearch className="h-4 w-4 shrink-0 text-white/30" />
                            <input
                                ref={inputRef}
                                type="text"
                                value={busca}
                                onChange={(e) => setBusca(e.target.value)}
                                placeholder="Buscar cliente..."
                                className="flex-1 bg-transparent text-sm text-white placeholder-white/30 focus:outline-none"
                            />
                            {busca && (
                                <button
                                    type="button"
                                    onClick={() => setBusca('')}
                                    className="text-white/30 hover:text-white/60"
                                >
                                    <IoClose className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                        <ul className="max-h-48 overflow-y-auto">
                            {clientesFiltrados.length === 0 ? (
                                <li className="px-4 py-3 text-sm text-white/30 select-none">
                                    Nenhum cliente encontrado
                                </li>
                            ) : (
                                clientesFiltrados.map((c) => (
                                    <li
                                        key={c.cod}
                                        onClick={() => handleSelect(c.cod)}
                                        className={`cursor-pointer px-4 py-2.5 text-sm transition-colors select-none hover:bg-blue-500/15 ${c.cod === value ? 'bg-blue-500/15 font-semibold text-blue-300' : 'text-white/70'}`}
                                    >
                                        {c.nome}
                                    </li>
                                ))
                            )}
                        </ul>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ==================== Dados visuais do painel esquerdo ====================
// const stats = [
//     { value: '98%', label: 'SLA cumprido' },
//     { value: '4.9', label: 'Satisfação' },
//     { value: '24/7', label: 'Monitoramento' },
// ];

const features = [
    {
        icon: <FaTicketAlt className="h-5 w-5 text-white/60" />,
        text: 'Acompanhe chamados em tempo real',
    },
    {
        icon: <FaClipboardList className="h-5 w-5 text-white/60" />,
        text: 'Ordens de serviço detalhadas',
    },
    {
        icon: <IoBarChart className="h-5 w-5 text-white/60" />,
        text: 'Dashboard com métricas e relatórios',
    },
    { icon: <IoIosTime className="h-5 w-5 text-white/60" />, text: 'Controle de horas e SLA' },
];

// ================================================================================
// COMPONENTE PRINCIPAL
// ================================================================================
export function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const [adminMode, setAdminMode] = useState(false);
    const [clientes, setClientes] = useState<{ cod: string; nome: string }[]>([]);
    const [clienteSelecionado, setClienteSelecionado] = useState('');
    const [loadingClientes, setLoadingClientes] = useState(false);

    const router = useRouter();
    const { login, setAdminCodCliente } = useAuthStore();

    useEffect(() => {
        const rememberedEmail = localStorage.getItem('rememberedEmail');
        if (rememberedEmail) {
            setEmail(rememberedEmail);
            setRememberMe(true);
        }
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (adminMode) {
            if (!clienteSelecionado) {
                setError('Selecione um cliente para continuar.');
                return;
            }
            setIsLoading(true);
            setAdminCodCliente(clienteSelecionado);
            router.push('/paginas/dashboard');
            return;
        }

        setIsLoading(true);

        try {
            const userData = await login(email, password);

            if (userData) {
                if (rememberMe) {
                    localStorage.setItem('rememberedEmail', email);
                } else {
                    localStorage.removeItem('rememberedEmail');
                }

                if (userData.loginType === 'consultor' && userData.tipoUsuario === 'ADM') {
                    setLoadingClientes(true);
                    setIsLoading(false);
                    try {
                        const res = await fetch('/api/admin/clientes');
                        if (!res.ok) throw new Error(`HTTP ${res.status}`);
                        const data = await res.json();
                        setClientes(data);
                        setAdminMode(true);
                    } catch {
                        setError('Erro ao carregar lista de clientes.');
                    } finally {
                        setLoadingClientes(false);
                    }
                    return;
                }

                await sleep(1000);

                if (userData.loginType === 'consultor') {
                    router.push('/paginas/gerproj/chamados');
                } else {
                    if (userData.codCliente) {
                        router.push('/paginas/dashboard');
                    } else if (userData.codRecurso) {
                        router.push('/paginas/tabela-chamados-abertos');
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

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !isLoading) handleSubmit(e as any);
    };

    return (
        <div
            className="relative flex h-screen overflow-hidden"
            style={{
                background: 'linear-gradient(140deg, #060c18 0%, #0a1228 50%, #07101f 100%)',
            }}
        >
            {/* ── Fundo global animado com Motion ── */}

            {/* Grid animado */}
            <motion.div
                className="pointer-events-none absolute inset-0 bg-purple-900 opacity-[0.09]"
                style={{
                    backgroundImage:
                        'linear-gradient(rgba(99,179,237,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(99,179,237,0.6) 1px, transparent 1px)',
                    backgroundSize: '60px 60px',
                }}
                animate={{ backgroundPosition: ['0px 0px', '60px 60px'] }}
                transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
            />

            {/* Orb central */}
            <motion.div
                className="pointer-events-none absolute top-1/2 left-1/2 h-[360px] w-[360px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-600/6 blur-3xl"
                animate={{ scale: [1, 1.08, 0.94, 1], opacity: [0.6, 1, 0.6, 0.6] }}
                transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
            />

            {/* Texto de fundo decorativo */}
            <motion.div
                className="pointer-events-none absolute inset-0 flex items-center justify-center select-none"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 2, delay: 0.5 }}
            >
                <span className="text-[200px] font-black tracking-tighter text-white/[0.025]">
                    PORTAL CLIENTES
                </span>
            </motion.div>

            {/* ══════════════════════════════════════════════
                PAINEL ESQUERDO — branding
            ══════════════════════════════════════════════ */}
            <div className="relative flex w-1/2 overflow-hidden pl-92">
                <div className="relative z-10 flex flex-col justify-center">
                    <div className="space-y-10">
                        {/* Bloco 1 */}
                        <motion.div {...fadeUp(0.1)} className="flex items-center gap-4">
                            <div className="relative">
                                <Image
                                    src="/logo-solutii.png"
                                    alt="Solutii"
                                    width={50}
                                    height={50}
                                    className="rounded-xl"
                                />
                            </div>
                            <div>
                                <p className="font-bold tracking-widest text-white uppercase select-none">
                                    Solutii Sistemas
                                </p>
                                <p className="inline-flex gap-1 text-sm font-semibold tracking-wider text-white select-none">
                                    <p className="text-cyan-500">Tecnologia</p> &amp;{' '}
                                    <p className="text-orange-500">Consultoria</p>
                                </p>
                            </div>
                        </motion.div>

                        {/* Bloco 2 */}
                        <motion.div {...fadeUp(0.2)}>
                            <div className="inline-flex animate-pulse items-center gap-2.5 rounded-full border border-emerald-400/50 bg-emerald-400/10 px-6 py-1.5 shadow-md shadow-emerald-700">
                                <motion.span
                                    className="h-2 w-2 rounded-full bg-emerald-400"
                                    animate={{ opacity: [1, 0.3, 1] }}
                                    transition={{
                                        duration: 2,
                                        repeat: Infinity,
                                        ease: 'easeInOut',
                                    }}
                                />
                                <span className="text-xs font-semibold tracking-widest text-emerald-400 uppercase">
                                    Sistema Online
                                </span>
                            </div>
                        </motion.div>

                        {/* Bloco 3 */}
                        <motion.div {...fadeUp(0.3)} className="space-y-4">
                            <h1 className="text-5xl leading-[1.1] font-black tracking-tight text-white xl:text-6xl">
                                Gestão de
                                <br />
                                <span
                                    style={{
                                        background:
                                            'linear-gradient(90deg, #60a5fa, #818cf8, #a78bfa)',
                                        WebkitBackgroundClip: 'text',
                                        WebkitTextFillColor: 'transparent',
                                    }}
                                >
                                    Chamados
                                </span>
                                <br />
                                <span className="text-5xl text-white/50 select-none">
                                    e Suporte Técnico
                                </span>
                            </h1>
                            <p className="max-w-md text-base tracking-wider text-white/50 select-none">
                                Acompanhe seus chamados, ordens de serviço e indicadores de
                                atendimento em tempo real.
                            </p>
                        </motion.div>

                        {/* Bloco 4 */}
                        <motion.div {...fadeUp(0.5)} className="space-y-3">
                            {features.map(({ icon, text }, i) => (
                                <motion.div
                                    key={text}
                                    initial={{ opacity: 0, x: -16 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ duration: 0.4, delay: 0.55 + i * 0.07 }}
                                    className="flex items-center gap-3"
                                >
                                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/20 bg-white/5">
                                        {icon}
                                    </span>
                                    <span className="text-sm tracking-wider text-white/50 select-none">
                                        {text}
                                    </span>
                                </motion.div>
                            ))}
                        </motion.div>
                    </div>
                </div>

                {/* Borda divisória */}
                <div className="absolute top-0 right-0 h-full w-px bg-gradient-to-b from-transparent via-cyan-500/50 to-transparent" />
            </div>

            {/* ══════════════════════════════════════════════
                PAINEL DIREITO — formulário
            ══════════════════════════════════════════════ */}
            <div
                className="relative flex w-1/2 flex-col items-center justify-center overflow-hidden pr-60"
                onKeyDown={handleKeyDown}
            >
                <div className="relative z-10 w-full max-w-sm">
                    {/* Logo — só mobile */}
                    <motion.div
                        {...fadeUp(0.1)}
                        className="mb-8 flex flex-col items-center lg:hidden"
                    >
                        <div className="relative mb-3">
                            <div className="absolute inset-0 rounded-2xl bg-blue-500/15 blur-lg" />
                            <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10">
                                <Image
                                    src="/logo-solutii.png"
                                    alt="Solutii"
                                    width={40}
                                    height={40}
                                    className="rounded-xl"
                                />
                            </div>
                        </div>
                        <p className="text-xs font-bold tracking-[0.3em] text-blue-400 uppercase">
                            Solutii
                        </p>
                    </motion.div>

                    {/* Cabeçalho do form */}
                    <motion.div {...fadeUp(0.15)} className="mb-8">
                        <AnimatePresence mode="wait">
                            <motion.h2
                                key={adminMode ? 'admin' : 'login'}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.3 }}
                                className="text-3xl font-black tracking-tight text-white"
                            >
                                {adminMode ? 'Selecionar Cliente' : 'Acessar conta'}
                            </motion.h2>
                        </AnimatePresence>
                        <p className="mt-1.5 text-sm tracking-wider text-white/50 select-none">
                            {adminMode
                                ? 'Selecione o cliente para carregar o dashboard'
                                : 'Insira suas credenciais para continuar'}
                        </p>
                    </motion.div>

                    {/* Formulário */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Email */}
                        <motion.div {...slideRight(0.25)} className="space-y-1.5">
                            <label className="block text-xs font-semibold tracking-wider text-white/50">
                                Email ou Usuário
                            </label>
                            <div className="relative">
                                <IoIosMail className="absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-white/25" />
                                <input
                                    type="text"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="seu@email.com ou usuário"
                                    required
                                    disabled={adminMode}
                                    className="h-12 w-full rounded-lg border border-white/10 bg-white/[0.04] py-3 pr-4 pl-10 text-sm tracking-widest text-white placeholder-white/25 transition-all duration-200 hover:border-white/15 focus:border-blue-500/60 focus:bg-white/[0.06] focus:ring-2 focus:ring-blue-500/15 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40"
                                />
                            </div>
                        </motion.div>

                        {/* Dropdown admin */}
                        <AnimatePresence>
                            {adminMode && (
                                <motion.div
                                    initial={{ opacity: 0, y: -8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -8 }}
                                    transition={{ duration: 0.25, ease: 'easeOut' }}
                                    className="relative z-10"
                                >
                                    <div className="space-y-1.5 pt-0.5">
                                        <label className="block text-xs font-semibold tracking-wider text-white/50 uppercase">
                                            Cliente
                                        </label>
                                        <ClienteDropdown
                                            clientes={clientes}
                                            value={clienteSelecionado}
                                            onChange={setClienteSelecionado}
                                            loading={loadingClientes}
                                        />
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Senha */}
                        <AnimatePresence>
                            {!adminMode && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ duration: 0.3, ease: 'easeOut' }}
                                    className="overflow-hidden"
                                >
                                    <div className="space-y-1.5 pt-0.5">
                                        <label className="block text-xs font-semibold tracking-wider text-white/50">
                                            Senha
                                        </label>
                                        <div className="relative">
                                            <FaLock className="absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-white/25" />
                                            <input
                                                type={showPassword ? 'text' : 'password'}
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                placeholder="••••••••"
                                                required
                                                className="h-12 w-full rounded-lg border border-white/10 bg-white/[0.04] py-3 pr-11 pl-10 text-sm tracking-widest text-white placeholder-white/25 transition-all duration-200 hover:border-white/15 focus:border-blue-500/60 focus:bg-white/[0.06] focus:ring-2 focus:ring-blue-500/15 focus:outline-none"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                tabIndex={-1}
                                                className="absolute top-1/2 right-3.5 -translate-y-1/2 text-white/25 transition-colors hover:text-white/60"
                                            >
                                                {showPassword ? (
                                                    <FaEyeSlash size={16} />
                                                ) : (
                                                    <FaEye size={16} />
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Lembrar */}
                        <AnimatePresence>
                            {!adminMode && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="flex items-center gap-2.5 pt-0.5"
                                >
                                    <input
                                        id="remember"
                                        type="checkbox"
                                        checked={rememberMe}
                                        onChange={() => setRememberMe(!rememberMe)}
                                        className="h-4 w-4 cursor-pointer rounded shadow-md shadow-black"
                                    />
                                    <label
                                        htmlFor="remember"
                                        className="cursor-pointer text-sm tracking-wider text-white/50 select-none hover:text-white/60"
                                    >
                                        Lembrar de mim
                                    </label>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Erro */}
                        <AnimatePresence>
                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, y: -8, scale: 0.97 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: -8, scale: 0.97 }}
                                    transition={{ duration: 0.25 }}
                                    className="flex items-start gap-3 rounded-xl border border-red-500/15 bg-red-500/8 px-4 py-3"
                                >
                                    <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-red-400" />
                                    <p className="text-sm text-red-300/90">{error}</p>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Botão */}
                        <motion.button
                            {...slideRight(0.35)}
                            type="submit"
                            disabled={isLoading || loadingClientes}
                            className="group relative mt-2 flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg border-none bg-cyan-800 py-4 font-semibold tracking-widest text-white shadow-md shadow-black transition-all duration-300 hover:bg-cyan-600 active:scale-95 disabled:cursor-not-allowed disabled:bg-cyan-600"
                        >
                            {isLoading ? (
                                <span className="relative flex items-center gap-2">
                                    <FiLoader className="animate-spin" size={16} />
                                    {adminMode ? 'Acessando...' : 'Entrando...'}
                                </span>
                            ) : (
                                <span className="relative flex items-center gap-2">
                                    {adminMode ? 'Confirmar Cliente' : 'Entrar'}
                                    <FaArrowRight
                                        className="transition-transform duration-300 group-hover:translate-x-2"
                                        size={16}
                                    />
                                </span>
                            )}
                        </motion.button>
                    </form>

                    <motion.p {...fadeIn(0.6)} className="mt-10 text-center text-xs text-white/20">
                        © {new Date().getFullYear()} Solutii Tecnologia. Todos os direitos
                    </motion.p>
                </div>
            </div>
        </div>
    );
}
