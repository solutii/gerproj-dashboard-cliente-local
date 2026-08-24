import { formatarHorasRelogio } from '@/formatters/formatar-hora';
import { useClienteIA } from '@/hooks/useClienteIA';
import { useAuthStore } from '@/store/useAuthStore';
import { useQuery } from '@tanstack/react-query';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { IconType } from 'react-icons';
import { FaBook } from 'react-icons/fa';
import {
    IoAddCircle,
    IoCall,
    IoChevronBack,
    IoChevronForward,
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
            title={showLabel ? undefined : label}
            className={`group relative flex items-center rounded-xl border p-4 shadow-sm transition-all duration-200 ${
                showLabel ? 'justify-start gap-4' : 'justify-center gap-0'
            } ${
                active
                    ? '-translate-y-0.5 border-purple-400 bg-gradient-to-b from-purple-200 to-purple-100 shadow-[0_6px_14px_rgba(126,34,206,0.35),0_2px_4px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.7)]'
                    : 'border-gray-200 bg-white shadow-sm hover:-translate-y-0.5 hover:border-cyan-300 hover:bg-gradient-to-b hover:from-cyan-50 hover:to-cyan-100/50 hover:shadow-md hover:shadow-cyan-900/10'
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
                <Icon className="h-7 w-7 flex-shrink-0 text-gray-500 transition-colors duration-200 group-hover:text-cyan-700" />
            )}

            <span
                className={`overflow-hidden text-left text-base font-extrabold tracking-widest transition-all duration-200 select-none ${
                    active ? 'text-purple-900' : 'text-gray-600 group-hover:text-gray-900'
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
            className={`group relative flex w-full items-center rounded-xl border p-4 shadow-sm transition-all duration-200 ${
                showLabel ? 'justify-start gap-4' : 'justify-center gap-0'
            } ${
                disabled
                    ? 'cursor-not-allowed border-gray-200 bg-gray-100 opacity-50'
                    : variant === 'danger'
                      ? 'cursor-pointer border-red-200 bg-white shadow-sm hover:-translate-y-0.5 hover:border-red-300 hover:bg-gradient-to-b hover:from-red-50 hover:to-red-100/60 hover:shadow-md hover:shadow-red-900/10'
                      : 'cursor-pointer border-gray-200 bg-white shadow-sm hover:-translate-y-0.5 hover:border-cyan-300 hover:bg-gradient-to-b hover:from-cyan-50 hover:to-cyan-100/50 hover:shadow-md hover:shadow-cyan-900/10'
            }`}
        >
            <Icon
                className={`h-7 w-7 flex-shrink-0 transition-colors duration-200 ${
                    disabled
                        ? 'text-gray-400'
                        : variant === 'danger'
                          ? 'text-red-600 group-hover:text-red-700'
                          : 'text-gray-500 group-hover:text-cyan-700'
                }`}
            />
            <span
                className={`overflow-hidden text-left text-base font-extrabold tracking-widest transition-all duration-200 select-none ${
                    disabled
                        ? 'text-gray-400'
                        : variant === 'danger'
                          ? 'text-red-600'
                          : 'text-gray-600 group-hover:text-gray-900'
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

    const { logout, codCliente } = useAuthStore();

    const clearFilters = useFiltersStore((state) => state.clearFilters);
    const cliente = useFiltersStore((state) => state.filters.cliente);

    // Verifica se há cliente selecionado
    const hasClienteSelecionado = cliente && cliente.trim() !== '';

    const { data: clienteIA } = useClienteIA(codCliente);
    const exibeBotaoIA = clienteIA?.exibe ?? false;

    const showLabel = isMobile || isExpanded;

    const mesAtual = new Date().getMonth() + 1;
    const anoAtual = new Date().getFullYear();

    const { data: saldoHoras } = useQuery({
        queryKey: ['saldoHoras', mesAtual, anoAtual, codCliente],
        queryFn: async () => {
            const params = new URLSearchParams({
                codCliente: codCliente as string,
                mes: mesAtual.toString(),
                ano: anoAtual.toString(),
                mesesHistorico: '6',
            });
            const response = await fetch(`/api/saldo-horas?${params.toString()}`);
            if (!response.ok) throw new Error('Erro ao carregar saldo de horas');
            return response.json() as Promise<{
                nomeCliente: string;
                saldoTotalDisponivel: number;
                debitoTotal: number;
                resumo: { saldoGeral: number };
            }>;
        },
        enabled: !!hasClienteSelecionado && !!codCliente,
        staleTime: 5 * 60 * 1000,
    });

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

    const toggleExpanded = () => {
        setIsExpanded((prev) => !prev);
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
                className={`flex h-full flex-col rounded-2xl border border-purple-400 bg-purple-50 text-gray-900 shadow-[0_2px_4px_rgba(0,0,0,0.08),0_8px_16px_rgba(0,0,0,0.10),0_24px_48px_rgba(0,0,0,0.16),inset_0_1px_0_rgba(255,255,255,0.9),inset_0_-1px_0_rgba(0,0,0,0.06)] transition-all duration-300 ease-in-out ${
                    isMobile
                        ? `fixed top-0 left-0 z-50 h-screen ${isOpen ? 'translate-x-0' : '-translate-x-full'} w-64 p-4`
                        : `relative ${isExpanded ? 'w-60 p-4' : 'w-[72px] p-3'}`
                }`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Botão de Fechar (Mobile) */}
                {isMobile && (
                    <button
                        onClick={toggleSidebar}
                        className="absolute top-4 right-4 z-[100] flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 transition-colors hover:bg-gray-200 active:scale-90"
                        aria-label="Fechar menu"
                    >
                        <IoClose className="h-5 w-5 text-gray-700" />
                    </button>
                )}

                {/* Aba de Recolher/Expandir (Desktop) */}
                {!isMobile && (
                    <button
                        onClick={toggleExpanded}
                        className="absolute top-8 right-0 z-[100] flex h-16 w-6 translate-x-full cursor-pointer items-center justify-center rounded-r-lg border border-l-0 border-cyan-600 bg-cyan-600 text-white shadow-lg shadow-black/25 transition-all duration-150 hover:w-7 hover:bg-cyan-700 active:scale-95"
                        aria-label={isExpanded ? 'Recolher menu' : 'Expandir menu'}
                        title={isExpanded ? 'Recolher menu' : 'Expandir menu'}
                    >
                        {isExpanded ? (
                            <IoChevronBack className="h-5 w-5" />
                        ) : (
                            <IoChevronForward className="h-5 w-5" />
                        )}
                    </button>
                )}

                {/* Loading Overlay — indeterminado: gira enquanto navega, some
                    exatamente quando a página nova estiver pronta. Sem número
                    fingindo saber um progresso que o Next.js não expõe. */}
                {isNavigating && (
                    <div className="absolute inset-0 z-[9999] flex items-center justify-center rounded-2xl bg-white/90 backdrop-blur-md">
                        <div className="flex flex-col items-center gap-5">
                            <div className="relative h-16 w-16">
                                <div className="absolute inset-0 animate-spin rounded-full bg-[conic-gradient(from_0deg,transparent_0deg,#06b6d4_120deg,#9333ea_240deg,transparent_360deg)]" />
                                <div className="absolute inset-[3px] rounded-full bg-white" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 shadow-[0_0_10px_rgba(147,51,234,0.6)]" />
                                </div>
                            </div>
                            {showLabel && (
                                <span className="animate-pulse text-xs font-bold tracking-[0.25em] text-gray-500 select-none">
                                    CARREGANDO
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
                    <div
                        className={`mb-6 flex items-center gap-3 ${isMobile ? '' : 'justify-center'}`}
                    >
                        <div className="relative flex-shrink-0 overflow-hidden rounded-xl bg-cyan-600 p-1.5">
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
                                <span className="truncate text-sm font-extrabold tracking-widest text-gray-900 select-none">
                                    SOLUTII
                                </span>
                                <span className="truncate text-[11px] font-semibold tracking-widest text-gray-500 select-none">
                                    Portal Cliente
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Divisor */}
                    <div className="mb-4 h-px w-full bg-gray-200" />

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

                        {/* Divisor entre navegação e ações */}
                        <div className="my-3 h-px w-full bg-gray-200" />

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
                                <div className="my-3 h-px w-full bg-gray-200" />
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

                        {/* Card de saldo de horas — preenche o espaço vazio da navegação */}
                        {showLabel && hasClienteSelecionado && saldoHoras && (
                            <div className="mt-auto flex flex-col gap-3 rounded-xl border border-purple-300 bg-white p-4 shadow-md shadow-purple-900/10">
                                <div className="flex items-center gap-2">
                                    <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-purple-100">
                                        <PiTimerFill className="h-4 w-4 text-purple-700" />
                                    </div>
                                    <span className="truncate text-[11px] font-extrabold tracking-widest text-gray-700 uppercase select-none">
                                        {saldoHoras.nomeCliente}
                                    </span>
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-semibold tracking-wide text-gray-500 select-none">
                                            Créditos disponíveis
                                        </span>
                                        <span className="text-xs font-bold tracking-wide text-emerald-600 select-none">
                                            {formatarHorasRelogio(saldoHoras.saldoTotalDisponivel)}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-semibold tracking-wide text-gray-500 select-none">
                                            Débitos
                                        </span>
                                        <span className="text-xs font-bold tracking-wide text-red-600 select-none">
                                            {saldoHoras.debitoTotal > 0
                                                ? `-${formatarHorasRelogio(saldoHoras.debitoTotal)}`
                                                : formatarHorasRelogio(0)}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-1 border-t border-dashed border-purple-100 pt-2.5">
                                    <span
                                        className={`text-2xl font-extrabold tracking-wide select-none ${
                                            saldoHoras.resumo.saldoGeral >= 0
                                                ? 'text-emerald-600'
                                                : 'text-red-600'
                                        }`}
                                    >
                                        {formatarHorasRelogio(saldoHoras.resumo.saldoGeral)}
                                    </span>
                                    <span className="text-[11px] font-semibold tracking-wide text-gray-400 select-none">
                                        Saldo geral (créditos válidos − débitos)
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Divisor antes do logout */}
                    <div className="mt-3 mb-1 h-px w-full bg-gray-200" />

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
