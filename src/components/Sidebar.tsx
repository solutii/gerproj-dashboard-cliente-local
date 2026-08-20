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
    IoLogOut,
    IoMenu,
    IoSparkles,
} from 'react-icons/io5';
import { PiTimerFill } from 'react-icons/pi';
import { useFiltersStore } from '../store/useFiltersStore';
import { ModalAbrirChamado } from './abrir-chamado/Modal_Abrir_Chamado';
import { ModalSaldoHoras } from './saldo-horas/Modal_Saldo_Horas';

// Chave única para reativar o botão "Abrir Chamado" quando o fluxo for liberado.
const ABRIR_CHAMADO_DISPONIVEL = true;

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
            className={`group relative flex items-center gap-4 rounded-xl border p-4 shadow-sm shadow-black/25 transition-all duration-200 ${
                active
                    ? 'border-[oklch(0.75_0.14_200)]/55 bg-[oklch(0.24_0.05_250)] shadow-md shadow-black/35'
                    : 'border-[oklch(0.30_0.02_250)] bg-[oklch(0.205_0.02_250)] hover:border-[oklch(0.75_0.14_200)]/50 hover:bg-[oklch(0.255_0.025_250)]'
            } ${loading ? 'pointer-events-none opacity-60' : 'cursor-pointer'}`}
        >
            {active && (
                <span className="absolute top-1/2 left-0 h-8 w-1 -translate-y-1/2 rounded-r-full bg-[oklch(0.75_0.14_200)]" />
            )}

            {loading ? (
                <div className="h-7 w-7 flex-shrink-0 animate-spin rounded-full border-3 border-white/20 border-t-white" />
            ) : (
                <Icon
                    className={`h-7 w-7 flex-shrink-0 ${
                        active ? 'text-[oklch(0.75_0.14_200)]' : 'text-[oklch(0.72_0.01_250)]'
                    }`}
                />
            )}

            <span
                className={`overflow-hidden text-left text-base font-extrabold tracking-widest transition-all duration-200 select-none ${
                    active ? 'text-white' : 'text-[oklch(0.85_0.01_250)] group-hover:text-white'
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
            title={title}
            className={`group relative flex w-full items-center gap-4 rounded-xl border p-4 shadow-sm shadow-black/25 transition-all duration-200 ${
                disabled
                    ? 'cursor-not-allowed border-[oklch(0.26_0.015_250)] bg-[oklch(0.19_0.015_250)] opacity-50'
                    : variant === 'danger'
                      ? 'cursor-pointer border-red-900/50 bg-red-950/40 hover:border-red-500/60 hover:bg-red-950/60'
                      : 'cursor-pointer border-[oklch(0.30_0.02_250)] bg-[oklch(0.205_0.02_250)] hover:border-[oklch(0.75_0.14_200)]/50 hover:bg-[oklch(0.255_0.025_250)]'
            }`}
        >
            <Icon
                className={`h-7 w-7 flex-shrink-0 ${
                    disabled
                        ? 'text-[oklch(0.72_0.01_250)]'
                        : variant === 'danger'
                          ? 'text-red-400'
                          : 'text-[oklch(0.72_0.01_250)] group-hover:text-white'
                }`}
            />
            <span
                className={`overflow-hidden text-left text-base font-extrabold tracking-widest transition-all duration-200 select-none ${
                    disabled
                        ? 'text-[oklch(0.72_0.01_250)]'
                        : variant === 'danger'
                          ? 'text-red-400'
                          : 'text-[oklch(0.85_0.01_250)] group-hover:text-white'
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
    const [isExpanded, setIsExpanded] = useState(false);
    const [isModalSaldoOpen, setIsModalSaldoOpen] = useState(false);
    const [isModalAbrirChamadoOpen, setIsModalAbrirChamadoOpen] = useState(false);
    const collapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const { logout, codCliente } = useAuthStore();

    const clearFilters = useFiltersStore((state) => state.clearFilters);
    const cliente = useFiltersStore((state) => state.filters.cliente);

    // Verifica se há cliente selecionado
    const hasClienteSelecionado = cliente && cliente.trim() !== '';

    const { data: clienteIA } = useClienteIA(codCliente);
    const exibeBotaoIA = clienteIA?.exibe ?? false;

    const showLabel = isMobile || isExpanded;

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

    const handleMouseEnter = () => {
        if (isMobile) return;
        if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
        setIsExpanded(true);
    };

    const handleMouseLeave = () => {
        if (isMobile) return;
        collapseTimerRef.current = setTimeout(() => setIsExpanded(false), 300);
    };

    const toggleSidebar = () => {
        setIsOpen(!isOpen);
    };

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
        if (!codCliente) return;

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
                    className="fixed top-4 left-4 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-black shadow-lg shadow-black/40 transition-transform active:scale-90"
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
                className={`flex h-full flex-col overflow-hidden rounded-xl bg-black text-white transition-all duration-300 ease-in-out ${
                    isMobile
                        ? `fixed top-0 left-0 z-50 h-screen ${isOpen ? 'translate-x-0' : '-translate-x-full'} w-64 p-4`
                        : `relative ${isExpanded ? 'w-60 p-4' : 'w-[72px] p-3'}`
                }`}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                onClick={(e) => e.stopPropagation()}
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
                    <div className="absolute inset-0 z-[9999] flex items-center justify-center rounded-xl bg-black/95 backdrop-blur-md">
                        <div className="flex flex-col items-center gap-4">
                            <div className="relative h-12 w-12">
                                <div className="absolute inset-0 animate-spin rounded-full border-3 border-transparent border-t-[oklch(0.75_0.14_200)]" />
                            </div>
                            <span className="text-xs font-bold tracking-widest text-white/80 select-none">
                                Carregando...
                            </span>
                        </div>
                    </div>
                )}

                {/* Conteúdo da sidebar */}
                <div
                    className={`relative z-10 flex h-full w-full flex-col ${isMobile ? 'pt-14' : ''}`}
                >
                    {/* Logo */}
                    <div
                        className={`mb-6 flex items-center gap-3 ${isMobile ? '' : 'justify-center'}`}
                    >
                        <div className="relative flex-shrink-0 overflow-hidden rounded-xl bg-[oklch(0.75_0.14_200)] p-1.5">
                            <Image
                                src="/logo-solutii.png"
                                alt="Logo Solutii"
                                width={isMobile ? 44 : 32}
                                height={isMobile ? 44 : 32}
                                className="rounded-lg"
                                priority
                            />
                        </div>
                        {showLabel && (
                            <div className="flex flex-col overflow-hidden">
                                <span className="truncate text-sm font-extrabold tracking-widest text-white select-none">
                                    SOLUTII
                                </span>
                                <span className="truncate text-[11px] font-semibold tracking-widest text-[oklch(0.65_0.01_250)] select-none">
                                    Portal Cliente
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Divisor */}
                    <div className="mb-4 h-px w-full bg-[oklch(0.28_0.02_250)]" />

                    {/* Links de Navegação */}
                    <div className="flex w-full flex-1 flex-col gap-3 overflow-y-auto">
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

                        {/* Divisor entre navegação e ações */}
                        <div className="my-3 h-px w-full bg-[oklch(0.28_0.02_250)]" />

                        <ActionButton
                            label="Abrir Chamado"
                            icon={IoAddCircle}
                            onClick={handleOpenAbrirChamadoModal}
                            showLabel={showLabel}
                            disabled={!ABRIR_CHAMADO_DISPONIVEL || !codCliente}
                            title={
                                !ABRIR_CHAMADO_DISPONIVEL
                                    ? 'Indisponível no momento'
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
                                <div className="my-3 h-px w-full bg-[oklch(0.28_0.02_250)]" />
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

                    {/* Divisor antes do logout */}
                    <div className="mt-3 mb-1 h-px w-full bg-[oklch(0.28_0.02_250)]" />

                    {/* Botão de Logout */}
                    <ActionButton
                        label="Sair"
                        icon={IoLogOut}
                        onClick={handleLogout}
                        showLabel={showLabel}
                        variant="danger"
                    />
                </div>
            </nav>

            {/* Modal de Saldo de Horas */}
            <ModalSaldoHoras isOpen={isModalSaldoOpen} onClose={() => setIsModalSaldoOpen(false)} />

            {/* Modal de Abrir Chamado */}
            <ModalAbrirChamado
                isOpen={isModalAbrirChamadoOpen}
                onClose={() => setIsModalAbrirChamadoOpen(false)}
            />
        </>
    );
}
