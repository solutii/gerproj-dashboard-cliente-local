import { useClienteIA } from '@/hooks/useClienteIA';
import { useAuthStore } from '@/store/useAuthStore';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { IconType } from 'react-icons';
import { FaBook } from 'react-icons/fa';
import {
    IoAddCircle,
    IoCall,
    IoClose,
    IoHome,
    IoKey,
    IoLogOut,
    IoMenu,
    IoSparkles,
} from 'react-icons/io5';
import { PiTimerFill } from 'react-icons/pi';
import { useFiltersStore } from '../store/useFiltersStore';
import { ModalAbrirChamado } from './abrir-chamado/Modal_Abrir_Chamado';
import { ModalAlterarSenha } from './alterar-senha/Modal_Alterar_Senha';
import { ModalSaldoHoras } from './saldo-horas/Modal_Saldo_Horas';

// Chave única para reativar o botão "Abrir Chamado" quando o fluxo for liberado.
const ABRIR_CHAMADO_DISPONIVEL = true;

// Tempo que o mouse precisa ficar sobre a sidebar recolhida antes dela expandir.
const HOVER_EXPAND_DELAY_MS = 300;

// Tamanho do quadrado do logo (e das camadas de fundo atrás dele) por estado.
function LOGO_SIZE_CLASS(isMobile: boolean, showLabel: boolean): string {
    if (isMobile) return 'h-16 w-16';
    return showLabel ? 'h-20 w-20' : 'h-11 w-11';
}

// ================================================================================
// SUBCOMPONENTES
// ================================================================================

interface NavItemProps {
    href: string;
    label: string;
    icon: IconType;
    active: boolean;
    loading: boolean;
    showLabel: boolean;
    onClick: (e: React.MouseEvent<HTMLAnchorElement>) => void;
}

function NavItem({ href, label, icon: Icon, active, loading, showLabel, onClick }: NavItemProps) {
    return (
        <Link
            href={href}
            onClick={onClick}
            title={showLabel ? undefined : label}
            className={`group relative flex items-center rounded-lg border p-4 transition-all duration-200 ${
                showLabel ? 'justify-start gap-4' : 'justify-center gap-0'
            } ${
                active
                    ? '-translate-y-0.5 border-purple-500 bg-gradient-to-b from-purple-300 to-purple-200 shadow-[0_6px_14px_rgba(126,34,206,0.35),0_2px_4px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.7)]'
                    : 'border-transparent bg-transparent hover:-translate-y-0.5 hover:border-purple-300 hover:bg-gradient-to-b hover:from-purple-50 hover:to-purple-100/50 hover:shadow-md hover:shadow-purple-900/10'
            } ${loading ? 'pointer-events-none opacity-60' : 'cursor-pointer'}`}
        >
            {active && (
                <span className="absolute top-1/2 left-0 h-9 w-1.5 -translate-y-1/2 rounded-r-full bg-gradient-to-b from-purple-500 to-purple-700 shadow-sm" />
            )}

            {loading ? (
                <div className="relative h-7 w-7 flex-shrink-0">
                    <div className="absolute inset-0 animate-spin rounded-full bg-[conic-gradient(from_0deg,transparent_0deg,#06b6d4_120deg,#9333ea_240deg,transparent_360deg)]" />
                    <div className="absolute inset-[2.5px] rounded-full bg-white" />
                </div>
            ) : active ? (
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-white/80 shadow-sm ring-1 ring-purple-200">
                    <Icon className="h-6 w-6 text-purple-700" />
                </div>
            ) : (
                <Icon className="h-7 w-7 flex-shrink-0 text-teal-300/70 transition-colors duration-200 group-hover:text-purple-700" />
            )}

            <span
                className={`overflow-hidden text-left text-base font-extrabold tracking-widest transition-all duration-200 select-none ${
                    active ? 'text-purple-900' : 'text-teal-100 group-hover:text-purple-900'
                } ${showLabel ? 'w-auto flex-1 opacity-100' : 'w-0 opacity-0'}`}
            >
                {label}
            </span>
        </Link>
    );
}

interface ActionButtonProps {
    label: string;
    icon: IconType;
    onClick: () => void;
    showLabel: boolean;
    disabled?: boolean;
    title?: string;
    variant?: 'default' | 'danger';
}

function ActionButton({
    label,
    icon: Icon,
    onClick,
    showLabel,
    disabled = false,
    title,
    variant = 'default',
}: ActionButtonProps) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            title={title ?? (showLabel ? undefined : label)}
            className={`group relative flex w-full items-center rounded-lg border p-4 transition-all duration-200 ${
                showLabel ? 'justify-start gap-4' : 'justify-center gap-0'
            } ${
                disabled
                    ? 'cursor-not-allowed border-transparent bg-transparent opacity-50'
                    : variant === 'danger'
                      ? 'cursor-pointer border-red-400 bg-red-100 shadow-sm hover:-translate-y-0.5 hover:border-red-500 hover:bg-gradient-to-b hover:from-red-200 hover:to-red-300/60 hover:shadow-md hover:shadow-red-900/10'
                      : 'cursor-pointer border-transparent bg-transparent hover:-translate-y-0.5 hover:border-purple-300 hover:bg-gradient-to-b hover:from-purple-50 hover:to-purple-100/50 hover:shadow-md hover:shadow-purple-900/10'
            }`}
        >
            <Icon
                className={`h-7 w-7 flex-shrink-0 transition-colors duration-200 ${
                    disabled
                        ? 'text-teal-300/40'
                        : variant === 'danger'
                          ? 'text-red-600 group-hover:text-red-700'
                          : 'text-teal-300/70 group-hover:text-purple-700'
                }`}
            />
            <span
                className={`overflow-hidden text-left text-base font-extrabold tracking-widest transition-all duration-200 select-none ${
                    disabled
                        ? 'text-teal-300/40'
                        : variant === 'danger'
                          ? 'text-red-600'
                          : 'text-teal-100 group-hover:text-purple-900'
                } ${showLabel ? 'w-auto flex-1 opacity-100' : 'w-0 opacity-0'}`}
            >
                {label}
            </span>
        </button>
    );
}

// ================================================================================
// COMPONENTE PRINCIPAL
// ================================================================================
export function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const [isNavigating, setIsNavigating] = useState(false);
    const [targetRoute, setTargetRoute] = useState<string | null>(null);
    const [isMobile, setIsMobile] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const hoverExpandTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [isModalSaldoOpen, setIsModalSaldoOpen] = useState(false);
    const [isModalAbrirChamadoOpen, setIsModalAbrirChamadoOpen] = useState(false);
    const [isModalAlterarSenhaOpen, setIsModalAlterarSenhaOpen] = useState(false);

    const { logout, codCliente, loginType, tipoUsuario } = useAuthStore();
    const podeAlterarSenha = loginType === 'cliente';
    // Abrir chamado é restrito a clientes e consultores do tipo ADM.
    const podeAbrirChamado = loginType === 'cliente' || tipoUsuario === 'ADM';

    const clearFilters = useFiltersStore((state) => state.clearFilters);
    const cliente = useFiltersStore((state) => state.filters.cliente);

    // Verifica se há cliente selecionado
    const hasClienteSelecionado = cliente && cliente.trim() !== '';

    const { data: clienteIA } = useClienteIA(codCliente);
    const exibeBotaoIA = clienteIA?.exibe ?? false;

    const showLabel = isMobile || isHovered || isNavigating;

    useEffect(() => {
        if (!isNavigating) return;

        // Pathname mudou -> a navegação real terminou, fecha o overlay.
        // Nada de barra fingindo progresso: o indicador some exatamente
        // quando a página nova está pronta, não antes nem depois.
        setIsNavigating(false);
        setTargetRoute(null);
    }, [pathname]);

    useEffect(() => {
        const handleResize = () => {
            const mobile = window.innerWidth < 1024;
            setIsMobile(mobile);

            if (mobile) {
                setIsOpen(false);
            }
        };

        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const handleNavigation = (e: React.MouseEvent<HTMLAnchorElement>, route: string) => {
        if (pathname === route) return;
        e.preventDefault();
        setIsNavigating(true);
        setTargetRoute(route);

        if (isMobile) {
            setIsOpen(false);
        }

        setTimeout(() => {
            router.push(route);
        }, 300);
    };

    const toggleSidebar = () => {
        setIsOpen(!isOpen);
    };

    const handleSidebarMouseEnter = () => {
        if (hoverExpandTimeoutRef.current) clearTimeout(hoverExpandTimeoutRef.current);
        hoverExpandTimeoutRef.current = setTimeout(() => {
            setIsHovered(true);
        }, HOVER_EXPAND_DELAY_MS);
    };

    const handleSidebarMouseLeave = () => {
        if (hoverExpandTimeoutRef.current) clearTimeout(hoverExpandTimeoutRef.current);
        setIsHovered(false);
    };

    useEffect(() => {
        return () => {
            if (hoverExpandTimeoutRef.current) clearTimeout(hoverExpandTimeoutRef.current);
        };
    }, []);

    const handleLogout = () => {
        logout();
        clearFilters();
        router.push('/paginas/login');
    };

    const handleOpenSaldoModal = () => {
        if (!hasClienteSelecionado) return;

        setIsModalSaldoOpen(true);
        if (isMobile) {
            setIsOpen(false);
        }
    };

    const handleOpenAbrirChamadoModal = () => {
        if (!codCliente || !podeAbrirChamado) return;

        setIsModalAbrirChamadoOpen(true);
        if (isMobile) {
            setIsOpen(false);
        }
    };

    const handleOpenIA = (e: React.MouseEvent<HTMLAnchorElement>) => {
        handleNavigation(e, '/paginas/ia');
    };

    if (isMobile && !isOpen) {
        return (
            <>
                <button
                    onClick={toggleSidebar}
                    className="fixed top-4 left-4 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-cyan-600 shadow-lg shadow-black/25 transition-transform active:scale-90"
                    aria-label="Abrir menu"
                >
                    <IoMenu className="h-7 w-7 text-white" />
                </button>

                {/* Modais precisam continuar montados mesmo com a sidebar
                    recolhida — handleOpenAbrirChamadoModal/handleOpenSaldoModal
                    fecham a sidebar (isMobile) no mesmo clique que abre o modal. */}
                <ModalSaldoHoras
                    isOpen={isModalSaldoOpen}
                    onClose={() => setIsModalSaldoOpen(false)}
                />
                <ModalAbrirChamado
                    isOpen={isModalAbrirChamadoOpen}
                    onClose={() => setIsModalAbrirChamadoOpen(false)}
                />
                {podeAlterarSenha && (
                    <ModalAlterarSenha
                        isOpen={isModalAlterarSenhaOpen}
                        onClose={() => setIsModalAlterarSenhaOpen(false)}
                    />
                )}
            </>
        );
    }

    // ================================================================================
    // RENDERIZAÇÃO PRINCIPAL
    // ================================================================================
    return (
        <>
            {isMobile && isOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
                    onClick={() => setIsOpen(false)}
                />
            )}

            <nav
                className={`flex h-full flex-col rounded-lg bg-teal-900 text-white shadow-xl shadow-black transition-all duration-300 ease-in-out ${
                    isMobile
                        ? `fixed top-0 left-0 z-50 h-screen ${isOpen ? 'translate-x-0' : '-translate-x-full'} w-64 p-4`
                        : `relative ${isHovered || isNavigating ? 'w-64 p-4' : 'w-20 p-3'}`
                }`}
                onClick={(e) => e.stopPropagation()}
                onMouseEnter={!isMobile ? handleSidebarMouseEnter : undefined}
                onMouseLeave={!isMobile ? handleSidebarMouseLeave : undefined}
            >
                {/* Botão de Fechar (Mobile) */}
                {isMobile && (
                    <button
                        onClick={toggleSidebar}
                        className="absolute top-4 right-4 z-[100] flex h-9 w-9 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20 active:scale-90"
                        aria-label="Fechar menu"
                    >
                        <IoClose className="h-5 w-5 text-white" />
                    </button>
                )}

                {/* Loading Overlay — indeterminado: gira enquanto navega, some
                    exatamente quando a página nova estiver pronta. Sem número
                    fingindo saber um progresso que o Next.js não expõe. */}
                {isNavigating && (
                    <div className="absolute inset-0 z-[9999] flex items-center justify-center rounded-lg bg-teal-900 backdrop-blur-md">
                        <div className="flex flex-col items-center gap-6">
                            <div className="relative h-28 w-28">
                                {/* Halo desfocado atrás do spinner */}
                                <div className="absolute inset-0 animate-pulse rounded-full bg-gradient-to-br from-cyan-400 to-purple-600 opacity-40 blur-xl" />

                                {/* Anel externo — gira em sentido horário */}
                                <div className="absolute inset-0 animate-spin rounded-full bg-[conic-gradient(from_0deg,transparent_0deg,#22d3ee_90deg,#a855f7_180deg,transparent_270deg)] shadow-[0_0_18px_rgba(168,85,247,0.55)]" />
                                <div className="absolute inset-[7px] rounded-full bg-teal-900" />

                                {/* Anel interno — gira em sentido anti-horário, mais rápido */}
                                <div className="absolute inset-[13px] animate-[spin_1.1s_linear_infinite_reverse] rounded-full bg-[conic-gradient(from_0deg,transparent_0deg,#67e8f9_140deg,transparent_280deg)]" />
                                <div className="absolute inset-[19px] rounded-full bg-teal-900" />

                                {/* Núcleo pulsante */}
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="h-4 w-4 animate-pulse rounded-full bg-gradient-to-br from-cyan-300 to-purple-500 shadow-[0_0_14px_rgba(168,85,247,0.85)]" />
                                </div>
                            </div>
                            {showLabel && (
                                <span className="flex items-baseline text-xs font-bold tracking-[0.3em] text-cyan-200/90 select-none">
                                    CARREGANDO
                                    <span
                                        className="ml-1 animate-bounce"
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
                            )}
                        </div>
                    </div>
                )}

                {/* Conteúdo da sidebar */}
                <div
                    className={`relative z-10 flex h-full w-full flex-col ${isMobile ? 'pt-14' : ''}`}
                >
                    {/* Logo */}
                    <div className="mb-6 flex flex-col items-center gap-3">
                        <div className="relative flex items-center justify-center">
                            {/* Camadas de fundo — efeito de cartões empilhados atrás do logo */}
                            <div
                                className={`absolute rotate-[18deg] rounded-2xl bg-purple-500 shadow-md shadow-black/40 transition-all duration-300 ${LOGO_SIZE_CLASS(isMobile, showLabel)}`}
                            />
                            <div
                                className={`absolute -rotate-[12deg] rounded-2xl bg-purple-300 shadow-md shadow-black/40 transition-all duration-300 ${LOGO_SIZE_CLASS(isMobile, showLabel)}`}
                            />

                            <div
                                className={`relative flex flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-400 to-cyan-700 shadow-lg ring-1 shadow-black/40 ring-white/15 transition-all duration-300 ${LOGO_SIZE_CLASS(isMobile, showLabel)}`}
                            >
                                <Image
                                    src="/logo-solutii.png"
                                    alt="Logo Solutii"
                                    width={64}
                                    height={64}
                                    className="h-full w-full rounded-lg object-contain p-3"
                                    priority
                                />
                            </div>
                        </div>
                        {showLabel && (
                            <div className="flex flex-col items-center overflow-hidden">
                                <span className="truncate text-base font-extrabold tracking-widest text-white select-none">
                                    SOLUTII
                                </span>
                                <span className="truncate text-xs font-semibold tracking-widest text-teal-300/70 select-none">
                                    Portal Cliente
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Divisor */}
                    <div className="mb-4 h-px w-full bg-purple-300" />

                    {/* Links de Navegação */}
                    <div className="flex w-full flex-1 flex-col gap-4 overflow-x-hidden overflow-y-auto pt-1">
                        <NavItem
                            href="/paginas/dashboard"
                            label="Dashboard"
                            icon={IoHome}
                            active={pathname === '/paginas/dashboard'}
                            loading={isNavigating && targetRoute === '/paginas/dashboard'}
                            showLabel={showLabel}
                            onClick={(e) => handleNavigation(e, '/paginas/dashboard')}
                        />

                        <NavItem
                            href="/paginas/chamados"
                            label="Chamados"
                            icon={IoCall}
                            active={pathname === '/paginas/chamados'}
                            loading={isNavigating && targetRoute === '/paginas/chamados'}
                            showLabel={showLabel}
                            onClick={(e) => handleNavigation(e, '/paginas/chamados')}
                        />

                        <NavItem
                            href="/paginas/base-conhecimento"
                            label="Base de Conhecimento"
                            icon={FaBook}
                            active={pathname === '/paginas/base-conhecimento'}
                            loading={isNavigating && targetRoute === '/paginas/base-conhecimento'}
                            showLabel={showLabel}
                            onClick={(e) => handleNavigation(e, '/paginas/base-conhecimento')}
                        />

                        <ActionButton
                            label="Abrir Chamado"
                            icon={IoAddCircle}
                            onClick={handleOpenAbrirChamadoModal}
                            showLabel={showLabel}
                            disabled={!ABRIR_CHAMADO_DISPONIVEL || !codCliente || !podeAbrirChamado}
                            title={
                                !ABRIR_CHAMADO_DISPONIVEL
                                    ? 'Indisponível no momento'
                                    : !podeAbrirChamado
                                      ? 'Disponível apenas para clientes e consultores ADM'
                                      : !codCliente
                                        ? 'Selecione um cliente para abrir um chamado'
                                        : 'Abrir novo chamado'
                            }
                        />

                        <ActionButton
                            label="Saldo de Horas"
                            icon={PiTimerFill}
                            onClick={handleOpenSaldoModal}
                            showLabel={showLabel}
                            disabled={!hasClienteSelecionado}
                            title={
                                !hasClienteSelecionado
                                    ? 'Selecione um cliente nos filtros para visualizar o saldo'
                                    : 'Visualizar saldo de horas'
                            }
                        />

                        {exibeBotaoIA && (
                            <>
                                <div className="my-3 h-px w-full bg-purple-300" />
                                <NavItem
                                    href="/paginas/ia"
                                    label="IA"
                                    icon={IoSparkles}
                                    active={pathname === '/paginas/ia'}
                                    loading={isNavigating && targetRoute === '/paginas/ia'}
                                    showLabel={showLabel}
                                    onClick={handleOpenIA}
                                />
                            </>
                        )}
                    </div>

                    {/* Alterar Senha — só para usuários cliente */}
                    {podeAlterarSenha && (
                        <div className="mt-4">
                            <ActionButton
                                label="Alterar Senha"
                                icon={IoKey}
                                onClick={() => setIsModalAlterarSenhaOpen(true)}
                                showLabel={showLabel}
                            />
                        </div>
                    )}

                    {/* Divisor antes do logout */}
                    <div className="mt-4 mb-1 h-px w-full bg-purple-300" />

                    {/* Botão de Logout */}
                    <div className="mt-4">
                        <ActionButton
                            label="Sair"
                            icon={IoLogOut}
                            onClick={handleLogout}
                            showLabel={showLabel}
                            variant="danger"
                        />
                    </div>
                </div>
            </nav>

            {/* Modal de Saldo de Horas */}
            <ModalSaldoHoras isOpen={isModalSaldoOpen} onClose={() => setIsModalSaldoOpen(false)} />

            {/* Modal de Abrir Chamado */}
            <ModalAbrirChamado
                isOpen={isModalAbrirChamadoOpen}
                onClose={() => setIsModalAbrirChamadoOpen(false)}
            />

            {/* Modal de Alterar Senha */}
            {podeAlterarSenha && (
                <ModalAlterarSenha
                    isOpen={isModalAlterarSenhaOpen}
                    onClose={() => setIsModalAlterarSenhaOpen(false)}
                />
            )}
        </>
    );
}
