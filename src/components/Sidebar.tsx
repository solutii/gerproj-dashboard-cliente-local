import { useClienteIA } from '@/hooks/useClienteIA';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { useSair } from '@/hooks/useSair';
import { useAuthStore } from '@/store/useAuthStore';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
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
import { IsLoading } from './IsLoading';
import { TITULO_LOADING_POR_ROTA, ZOOM_PAGINAS } from './loading-titles';
import { ModalSaldoHoras } from './saldo-horas/Modal_Saldo_Horas';

// Chave única para reativar o botão "Abrir Chamado" quando o fluxo for liberado.
const ABRIR_CHAMADO_DISPONIVEL = true;

// Tamanho do quadrado do logo (e do glow atrás dele) por estado.
function LOGO_SIZE_CLASS(isMobile: boolean, showLabel: boolean): string {
    if (isMobile) return 'h-16 w-16';
    return showLabel ? 'h-20 w-20' : 'h-14 w-14';
}

// ================================================================================
// SUBCOMPONENTES
// ================================================================================

// Rótulo pequeno de seção ("NAVEGAÇÃO", "AÇÕES") — só aparece com o sidebar
// expandido, marca a hierarquia da navegação sem pesar visualmente.
function SectionLabel({ children, showLabel }: { children: string; showLabel: boolean }) {
    if (!showLabel) return null;
    return (
        <span className="px-3 pb-2 text-base font-extrabold tracking-[0.15em] text-orange-300 select-none">
            {children}
        </span>
    );
}

interface NavItemProps {
    href: string;
    label: string;
    icon: IconType;
    active: boolean;
    showLabel: boolean;
    onClick: (e: React.MouseEvent<HTMLAnchorElement>) => void;
}

function NavItem({ href, label, icon: Icon, active, showLabel, onClick }: NavItemProps) {
    return (
        <Link
            href={href}
            onClick={onClick}
            title={showLabel ? undefined : label}
            className={`group relative flex items-center rounded-xl p-3.5 transition-all duration-150 ${
                showLabel ? 'justify-start gap-3.5' : 'justify-center gap-0'
            } ${
                active
                    ? 'bg-teal-500/35 shadow-[inset_0_0_0_1.5px_rgba(45,212,191,0.7),0_0_28px_-4px_rgba(20,184,166,0.6)]'
                    : 'cursor-pointer hover:bg-slate-400/25 hover:shadow-[inset_0_0_0_1.5px_rgba(148,163,184,0.45)]'
            } cursor-pointer`}
        >
            {active ? (
                <span className="absolute top-1/2 left-0 h-8 w-1.5 -translate-y-1/2 rounded-r-full bg-teal-300 shadow-[0_0_16px_rgba(45,212,191,1)]" />
            ) : (
                <span className="absolute top-1/2 left-0 h-6 w-1.5 -translate-y-1/2 rounded-r-full bg-slate-300 opacity-0 shadow-[0_0_12px_rgba(203,213,225,0.9)] transition-opacity duration-150 group-hover:opacity-100" />
            )}

            <div
                className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg transition-all duration-150 ${
                    active
                        ? ''
                        : 'bg-white/[0.06] group-hover:bg-slate-400/35 group-hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.2)]'
                }`}
            >
                <Icon
                    className={`h-8 w-8 text-white transition-colors duration-150 ${
                        active ? '' : 'group-hover:text-slate-200'
                    }`}
                />
            </div>

            <span
                className={`overflow-hidden text-left text-[15px] font-bold tracking-wide text-white transition-all duration-150 select-none ${
                    active ? '' : 'group-hover:text-slate-200'
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
            className={`group relative flex w-full items-center rounded-xl p-3.5 transition-all duration-150 ${
                showLabel ? 'justify-start gap-3.5' : 'justify-center gap-0'
            } ${
                disabled
                    ? 'cursor-not-allowed opacity-30'
                    : variant === 'danger'
                      ? 'cursor-pointer hover:bg-red-500/30 hover:shadow-[inset_0_0_0_1.5px_rgba(248,113,113,0.55)]'
                      : 'cursor-pointer hover:bg-slate-400/25 hover:shadow-[inset_0_0_0_1.5px_rgba(148,163,184,0.45)]'
            }`}
        >
            {!disabled && (
                <span
                    className={`absolute top-1/2 left-0 h-6 w-1.5 -translate-y-1/2 rounded-r-full opacity-0 transition-opacity duration-150 group-hover:opacity-100 ${
                        variant === 'danger'
                            ? 'bg-red-300 shadow-[0_0_12px_rgba(248,113,113,0.9)]'
                            : 'bg-slate-300 shadow-[0_0_12px_rgba(203,213,225,0.9)]'
                    }`}
                />
            )}

            <div
                className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg transition-all duration-150 ${
                    disabled
                        ? 'bg-white/[0.04]'
                        : variant === 'danger'
                          ? 'bg-red-500/20 group-hover:bg-red-500/40 group-hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.15)]'
                          : 'bg-white/[0.06] group-hover:bg-slate-400/35 group-hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.2)]'
                }`}
            >
                <Icon
                    className={`h-8 w-8 transition-colors duration-150 ${
                        disabled
                            ? 'text-slate-600'
                            : variant === 'danger'
                              ? 'text-white group-hover:text-red-200'
                              : 'text-white group-hover:text-slate-200'
                    }`}
                />
            </div>
            <span
                className={`overflow-hidden text-left text-[15px] font-bold tracking-wide transition-all duration-150 select-none ${
                    disabled
                        ? 'text-slate-600'
                        : variant === 'danger'
                          ? 'text-white group-hover:text-red-200'
                          : 'text-white group-hover:text-slate-200'
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
    const [isModalSaldoOpen, setIsModalSaldoOpen] = useState(false);
    const [isModalAbrirChamadoOpen, setIsModalAbrirChamadoOpen] = useState(false);
    const [isModalAlterarSenhaOpen, setIsModalAlterarSenhaOpen] = useState(false);

    // Seletores individuais (em vez de desestruturar a store inteira) —
    // Sidebar e os modais sempre montados dentro dele (Saldo, Abrir
    // Chamado, Alterar Senha) não podem re-renderizar a cada mudança de
    // QUALQUER campo da store de auth, só quando os campos que eles
    // realmente usam mudam.
    const sair = useSair();
    const codCliente = useAuthStore((state) => state.codCliente);
    const loginType = useAuthStore((state) => state.loginType);
    const tipoUsuario = useAuthStore((state) => state.tipoUsuario);
    const podeAlterarSenha = loginType === 'cliente';
    // Abrir chamado é restrito a clientes e consultores do tipo ADM.
    const podeAbrirChamado = loginType === 'cliente' || tipoUsuario === 'ADM';

    const clearFilters = useFiltersStore((state) => state.clearFilters);
    const cliente = useFiltersStore((state) => state.filters.cliente);

    // Verifica se há cliente selecionado
    const hasClienteSelecionado = cliente && cliente.trim() !== '';

    const { data: clienteIA } = useClienteIA(codCliente);
    const exibeBotaoIA = clienteIA?.exibe ?? false;

    const isDesktop = useIsDesktop();
    const showLabel = isMobile || isHovered || isNavigating;

    // Ao ir para uma página com overlay próprio (Chamados, Dashboard, Base de
    // Conhecimento), já mostra o overlay dela em vez do spinner do sidebar — sem
    // dois loadings em sequência com um vão entre eles.
    const tituloOverlay =
        isNavigating && targetRoute ? TITULO_LOADING_POR_ROTA[targetRoute] : undefined;

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
        // Já navegando: ignora cliques extras (evita dois router.push seguidos).
        if (isNavigating) return;
        setIsNavigating(true);
        setTargetRoute(route);

        if (isMobile) {
            setIsOpen(false);
        }

        router.push(route);
    };

    const toggleSidebar = () => {
        setIsOpen(!isOpen);
    };

    const handleSidebarMouseEnter = () => {
        setIsHovered(true);
    };

    const handleSidebarMouseLeave = () => {
        setIsHovered(false);
    };

    const handleLogout = sair;

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
                    className="fixed top-4 left-4 z-50 flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-[#0b0f1a]/90 shadow-[0_8px_24px_-4px_rgba(0,0,0,0.6)] backdrop-blur-md transition-transform active:scale-90"
                    aria-label="Abrir menu"
                >
                    <IoMenu className="h-6 w-6 text-cyan-300" />
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
                    className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm"
                    onClick={() => setIsOpen(false)}
                />
            )}

            <nav
                className={`relative flex h-full flex-col overflow-hidden rounded-xl bg-black text-white shadow-md shadow-orange-300 transition-all duration-100 ${
                    isMobile
                        ? `fixed top-0 left-0 z-50 h-screen ${isOpen ? 'translate-x-0' : '-translate-x-full'} w-72 p-4`
                        : `${isHovered || isNavigating ? 'w-80 p-4' : 'w-20 p-3'}`
                }`}
                onClick={(e) => e.stopPropagation()}
                onMouseEnter={!isMobile ? handleSidebarMouseEnter : undefined}
                onMouseLeave={!isMobile ? handleSidebarMouseLeave : undefined}
            >
                {/* Glow decorativo — mesmo vocabulário visual do login/cabeçalho de
                    validação (orbs suaves em ciano/roxo sobre fundo escuro). */}
                <div
                    aria-hidden
                    className="pointer-events-none absolute -top-16 -left-10 h-48 w-48 rounded-full bg-cyan-500/[0.08] blur-3xl"
                />
                <div
                    aria-hidden
                    className="pointer-events-none absolute -right-10 -bottom-20 h-56 w-56 rounded-full bg-purple-600/[0.1] blur-3xl"
                />

                {/* Botão de Fechar (Mobile) */}
                {isMobile && (
                    <button
                        onClick={toggleSidebar}
                        className="absolute top-4 right-4 z-[100] flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] transition-colors hover:bg-white/[0.12] active:scale-90"
                        aria-label="Fechar menu"
                    >
                        <IoClose className="h-5 w-5 text-white" />
                    </button>
                )}

                {/* Loading Overlay — indeterminado: gira enquanto navega, some
                    exatamente quando a página nova estiver pronta. Sem número
                    fingindo saber um progresso que o Next.js não expõe. */}
                {tituloOverlay &&
                    createPortal(
                        <div style={{ zoom: isDesktop ? ZOOM_PAGINAS : 1 }}>
                            <IsLoading isLoading title={tituloOverlay} fade={false} />
                        </div>,
                        document.body
                    )}

                {/* Conteúdo da sidebar */}
                <div
                    className={`relative z-10 flex h-full w-full flex-col ${isMobile ? 'pt-14' : ''}`}
                >
                    {/* Logo */}
                    <div className="mb-6 flex flex-col items-center gap-3">
                        <div className="relative flex items-center justify-center">
                            {/* Glow forte atrás do badge */}
                            <div
                                className={`absolute rounded-2xl bg-cyan-400/50 blur-lg transition-all duration-300 ${LOGO_SIZE_CLASS(isMobile, showLabel)}`}
                            />

                            <div
                                className={`relative flex flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-cyan-300/40 bg-white/[0.09] shadow-[0_8px_28px_-4px_rgba(34,211,238,0.5)] backdrop-blur-sm transition-all duration-300 ${LOGO_SIZE_CLASS(isMobile, showLabel)}`}
                            >
                                <Image
                                    src="/logo-solutii.png"
                                    alt="Logo Solutii"
                                    width={64}
                                    height={64}
                                    className="h-full w-full rounded-xl object-contain p-2.5"
                                    priority
                                />
                            </div>
                        </div>
                        {showLabel && (
                            <div className="flex flex-col items-center overflow-hidden">
                                <span className="truncate text-2xl font-extrabold tracking-widest text-white drop-shadow-[0_0_12px_rgba(45,212,191,0.7)] select-none">
                                    SOLUTII
                                </span>
                                <span className="truncate text-sm font-bold tracking-widest text-white select-none">
                                    Portal Cliente
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Divisor */}
                    <div className="my-4 h-[1.5px] w-full bg-white/25" />

                    {/* Links de Navegação */}
                    <div className="flex w-full flex-1 flex-col overflow-x-hidden overflow-y-auto pt-1">
                        <SectionLabel showLabel={showLabel}>Navegação</SectionLabel>
                        <div className="flex flex-col gap-1.5">
                            <NavItem
                                href="/paginas/dashboard"
                                label="Dashboard"
                                icon={IoHome}
                                active={pathname === '/paginas/dashboard'}
                                showLabel={showLabel}
                                onClick={(e) => handleNavigation(e, '/paginas/dashboard')}
                            />

                            <NavItem
                                href="/paginas/chamados"
                                label="Chamados"
                                icon={IoCall}
                                active={pathname === '/paginas/chamados'}
                                showLabel={showLabel}
                                onClick={(e) => handleNavigation(e, '/paginas/chamados')}
                            />

                            <NavItem
                                href="/paginas/base-conhecimento"
                                label="Base de Conhecimento"
                                icon={FaBook}
                                active={pathname === '/paginas/base-conhecimento'}
                                showLabel={showLabel}
                                onClick={(e) => handleNavigation(e, '/paginas/base-conhecimento')}
                            />

                            {exibeBotaoIA && (
                                <NavItem
                                    href="/paginas/ia"
                                    label="IA"
                                    icon={IoSparkles}
                                    active={pathname === '/paginas/ia'}
                                    showLabel={showLabel}
                                    onClick={handleOpenIA}
                                />
                            )}
                        </div>

                        <div className="my-4 h-[1.5px] w-full bg-white/25" />

                        <SectionLabel showLabel={showLabel}>Ações</SectionLabel>
                        <div className="flex flex-col gap-1.5">
                            <ActionButton
                                label="Abrir Chamado"
                                icon={IoAddCircle}
                                onClick={handleOpenAbrirChamadoModal}
                                showLabel={showLabel}
                                disabled={
                                    !ABRIR_CHAMADO_DISPONIVEL || !codCliente || !podeAbrirChamado
                                }
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
                        </div>
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
                    <div className="my-4 h-[1.5px] w-full bg-white/25" />

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
