import { useFilters } from '@/context/FiltersContext';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  IoCall,
  IoChevronBack,
  IoChevronForward,
  IoClose,
  IoHome,
  IoLogOut,
  IoMenu,
  IoTimeOutline,
} from 'react-icons/io5';
import { useAuth } from '../../context/AuthContext';
import { ModalSaldoHoras } from '../saldo-horas/Modal_Saldo_Horas';

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);
  const [targetRoute, setTargetRoute] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isModalSaldoOpen, setIsModalSaldoOpen] = useState(false);

  const { logout } = useAuth();
  const { clearFilters } = useFilters();

  useEffect(() => {
    setIsNavigating(false);
    setTargetRoute(null);
  }, [pathname]);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);

      if (mobile) {
        setIsOpen(false);
      } else if (window.innerWidth < 1024) {
        setIsCollapsed(true);
      } else {
        setIsCollapsed(false);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleNavigation = (
    e: React.MouseEvent<HTMLAnchorElement>,
    route: string,
  ) => {
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
    if (isMobile) {
      setIsOpen(!isOpen);
    } else {
      setIsCollapsed(!isCollapsed);
    }
  };

  const handleLogout = () => {
    logout();
    clearFilters();
    router.push('/paginas/login');
  };

  const handleOpenSaldoModal = () => {
    setIsModalSaldoOpen(true);
    if (isMobile) {
      setIsOpen(false);
    }
  };

  if (isMobile && !isOpen) {
    return (
      <>
        <button
          onClick={toggleSidebar}
          className="fixed top-4 left-4 z-50 flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-purple-600 to-purple-800 shadow-lg shadow-black/40 active:scale-90 transition-transform"
          aria-label="Abrir menu"
        >
          <IoMenu className="h-7 w-7 text-white" />
        </button>
      </>
    );
  }

  return (
    <>
      {isMobile && isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        />
      )}

      <nav
        className={`flex h-full flex-col items-center rounded-xl shadow-md shadow-black bg-purple-900 text-white overflow-hidden transition-all duration-300 ease-in-out ${
          isMobile
            ? `fixed top-0 left-0 z-50 h-screen ${isOpen ? 'translate-x-0' : '-translate-x-full'} w-64`
            : `relative ${isCollapsed ? 'w-20 lg:w-[75px] p-3' : 'w-64 lg:w-[260px] p-5 lg:p-6'}`
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Botão de Toggle */}
        <button
          onClick={toggleSidebar}
          className={`absolute z-[100] group transition-all duration-300 ${
            isMobile
              ? 'top-4 right-4 w-10 h-10'
              : '-top-0.5 left-1/2 -translate-x-1/2 w-16 lg:w-[72px]'
          }`}
          aria-label={
            isMobile
              ? 'Fechar menu'
              : isCollapsed
                ? 'Expandir sidebar'
                : 'Recolher sidebar'
          }
        >
          {isMobile ? (
            <div className="relative flex items-center justify-center w-full h-full">
              <div className="absolute inset-0 bg-gradient-to-br from-red-500 to-red-700 rounded-full shadow-lg shadow-black/60 transition-all duration-300 group-active:scale-90" />
              <IoClose className="relative z-10 h-6 w-6 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]" />
            </div>
          ) : (
            <div className="relative flex flex-col items-center h-14 lg:h-16 group-hover:h-16 lg:group-hover:h-[68px] transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-b from-teal-500 via-teal-600 to-teal-700 rounded-b-[20px] shadow-lg shadow-black/60 border border-teal-300/40 transition-all duration-300 group-hover:border-teal-200/60 group-hover:shadow-xl group-hover:shadow-teal-500/30 group-active:scale-95" />

              <div className="relative z-10 flex items-center justify-center w-full h-full pb-2">
                {isCollapsed ? (
                  <IoChevronForward className="h-5 w-5 lg:h-6 lg:w-6 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)] transition-all duration-300 group-hover:scale-110" />
                ) : (
                  <IoChevronBack className="h-5 w-5 lg:h-6 lg:w-6 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)] transition-all duration-300 group-hover:scale-110" />
                )}
              </div>
            </div>
          )}

          {!isMobile && (
            <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-gray-900 text-white text-xs font-semibold rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none">
              {isCollapsed ? 'Expandir' : 'Recolher'}
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45" />
            </div>
          )}
        </button>

        {/* Loading Overlay */}
        {isNavigating && (
          <div className="absolute inset-0 z-[9999] flex items-center justify-center bg-gradient-to-br from-purple-900/95 via-indigo-900/95 to-blue-900/95 backdrop-blur-md rounded-xl">
            <div className="flex flex-col items-center gap-4">
              <div
                className={`relative ${isCollapsed && !isMobile ? 'h-16 w-16' : 'h-20 w-20'}`}
              >
                <div className="absolute inset-0 animate-ping rounded-full border-3 border-purple-400/30"></div>
                <div className="absolute inset-2 animate-spin rounded-full border-3 border-transparent border-t-purple-400 border-r-blue-400"></div>
                <div className="absolute inset-4 animate-pulse rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20"></div>
              </div>

              {(!isCollapsed || isMobile) && (
                <div className="flex flex-col items-center gap-2 px-2">
                  <h3 className="text-white text-lg font-extrabold tracking-widest select-none">
                    Aguarde
                  </h3>
                  <p className="text-sm font-semibold text-white/80 tracking-wider select-none text-center">
                    {targetRoute === '/paginas/dashboard' && 'Dashboard'}
                    {targetRoute === '/paginas/chamados' && 'Chamados'}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Conteúdo da sidebar */}
        <div
          className={`relative z-10 flex h-full w-full flex-col items-center ${
            isMobile ? 'pt-20' : 'pt-12 lg:pt-14'
          }`}
        >
          {/* Logo */}
          <div
            className={`group relative transition-all duration-300 ${
              isCollapsed && !isMobile ? 'mb-5 mt-3' : 'mb-8 mt-5'
            }`}
          >
            <div className="absolute inset-0 rounded-full bg-blue-500 blur-sm opacity-50"></div>
            <div
              className={`relative overflow-hidden rounded-2xl bg-gradient-to-br from-white/50 to-white/10 ring-2 ring-white/20 transition-all group-hover:ring-purple-400/50 ${
                isCollapsed && !isMobile ? 'p-2' : 'p-2.5'
              }`}
            >
              <Image
                src="/logo-solutii.png"
                alt="Logo Solutii"
                width={isCollapsed && !isMobile ? 40 : 70}
                height={isCollapsed && !isMobile ? 40 : 70}
                className="relative z-10 rounded-xl transition-all duration-300"
                priority
              />
            </div>
          </div>

          {/* Divisor */}
          <div
            className={`h-px w-full bg-gradient-to-r from-transparent via-white/80 to-transparent transition-all duration-300 ${
              isCollapsed && !isMobile ? 'mb-5' : 'mb-8'
            }`}
          ></div>

          {/* Links de Navegação */}
          <div
            className={`flex w-full flex-1 flex-col transition-all duration-300 ${
              isCollapsed && !isMobile ? 'gap-3' : 'gap-4'
            }`}
          >
            {/* Dashboard Link */}
            <Link
              href="/paginas/dashboard"
              onClick={(e) => handleNavigation(e, '/paginas/dashboard')}
              className={`group relative flex items-center justify-center rounded-xl transition-all ${
                isCollapsed && !isMobile ? 'p-3' : 'px-5 py-3.5'
              } ${
                pathname === '/paginas/dashboard'
                  ? 'bg-gradient-to-r from-purple-950 to-blue-950 ring-2 ring-teal-500'
                  : 'bg-white/20 hover:bg-white/30 shadow-md shadow-black'
              } ${
                isNavigating && targetRoute === '/paginas/dashboard'
                  ? 'pointer-events-none opacity-60'
                  : 'hover:scale-[1.02] active:scale-95'
              }`}
              title={isCollapsed && !isMobile ? 'Dashboard' : ''}
            >
              {pathname === '/paginas/dashboard' &&
                (!isCollapsed || isMobile) && (
                  <div className="absolute left-0 top-1/2 h-3/4 w-1.5 -translate-y-1/2 rounded-r-full bg-teal-500 shadow-lg shadow-black animate-pulse"></div>
                )}

              {pathname === '/paginas/dashboard' &&
                isCollapsed &&
                !isMobile && (
                  <div className="absolute -left-1 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-teal-500 shadow-lg shadow-teal-500/50 animate-pulse"></div>
                )}

              <div
                className={`relative flex items-center ${
                  isCollapsed && !isMobile ? 'justify-center' : 'gap-4 w-full'
                }`}
              >
                {isNavigating && targetRoute === '/paginas/dashboard' ? (
                  <div className="h-7 w-7 animate-spin rounded-full border-3 border-white/20 border-t-white"></div>
                ) : (
                  <IoHome
                    className={`transition-all h-7 w-7 ${
                      pathname === '/paginas/dashboard'
                        ? 'text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]'
                        : 'text-white/80 group-hover:text-white'
                    }`}
                  />
                )}

                {(!isCollapsed || isMobile) && (
                  <span
                    className={`text-base font-extrabold tracking-widest select-none transition-all ${
                      pathname === '/paginas/dashboard'
                        ? 'text-white'
                        : 'text-white/80 group-hover:text-white'
                    }`}
                  >
                    Dashboard
                  </span>
                )}
              </div>
            </Link>

            {/* Chamados Link */}
            <Link
              href="/paginas/chamados"
              onClick={(e) => handleNavigation(e, '/paginas/chamados')}
              className={`group relative flex items-center justify-center rounded-xl transition-all ${
                isCollapsed && !isMobile ? 'p-3' : 'px-5 py-3.5'
              } ${
                pathname === '/paginas/chamados'
                  ? 'bg-gradient-to-r from-purple-950 to-blue-950 ring-2 ring-teal-500'
                  : 'bg-white/20 hover:bg-white/30 shadow-md shadow-black'
              } ${
                isNavigating && targetRoute === '/paginas/chamados'
                  ? 'pointer-events-none opacity-60'
                  : 'hover:scale-[1.02] active:scale-95'
              }`}
              title={isCollapsed && !isMobile ? 'Chamados' : ''}
            >
              {pathname === '/paginas/chamados' &&
                (!isCollapsed || isMobile) && (
                  <div className="absolute left-0 top-1/2 h-3/4 w-1.5 -translate-y-1/2 rounded-r-full bg-teal-500 shadow-lg shadow-black animate-pulse"></div>
                )}

              {pathname === '/paginas/chamados' && isCollapsed && !isMobile && (
                <div className="absolute -left-1 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-teal-500 shadow-lg shadow-teal-500/50 animate-pulse"></div>
              )}

              <div
                className={`relative flex items-center ${
                  isCollapsed && !isMobile ? 'justify-center' : 'gap-4 w-full'
                }`}
              >
                {isNavigating && targetRoute === '/paginas/chamados' ? (
                  <div className="h-7 w-7 animate-spin rounded-full border-3 border-white/20 border-t-white"></div>
                ) : (
                  <IoCall
                    className={`transition-all h-7 w-7 ${
                      pathname === '/paginas/chamados'
                        ? 'text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]'
                        : 'text-white/80 group-hover:text-white'
                    }`}
                  />
                )}

                {(!isCollapsed || isMobile) && (
                  <span
                    className={`text-base font-extrabold tracking-widest select-none transition-all ${
                      pathname === '/paginas/chamados'
                        ? 'text-white'
                        : 'text-white/80 group-hover:text-white'
                    }`}
                  >
                    Chamados
                  </span>
                )}
              </div>
            </Link>

            {/* Botão Saldo de Horas (Modal) */}
            {/* <button
              onClick={handleOpenSaldoModal}
              className={`group relative flex items-center justify-center rounded-xl transition-all ${
                isCollapsed && !isMobile ? 'p-3' : 'px-5 py-3.5'
              } bg-white/20 hover:bg-white/30 shadow-md shadow-black hover:scale-[1.02] active:scale-95`}
              title={isCollapsed && !isMobile ? 'Saldo de Horas' : ''}
            >
              <div
                className={`relative flex items-center ${
                  isCollapsed && !isMobile ? 'justify-center' : 'gap-4 w-full'
                }`}
              >
                <IoTimeOutline
                  className="transition-all h-7 w-7 text-white/80 group-hover:text-white"
                />

                {(!isCollapsed || isMobile) && (
                  <span className="text-base font-extrabold tracking-widest select-none transition-all text-white/80 group-hover:text-white">
                    Saldo
                  </span>
                )}
              </div>
            </button> */}
          </div>

          {/* Divisor antes do logout */}
          <div
            className={`h-px w-full bg-gradient-to-r from-transparent via-white/80 to-transparent transition-all duration-300 ${
              isCollapsed && !isMobile ? 'my-3' : 'my-5'
            }`}
          ></div>

          {/* Botão de Logout */}
          <div className="w-full pb-4">
            <button
              onClick={handleLogout}
              className={`group relative flex w-full items-center justify-center rounded-xl bg-white/10 shadow-md shadow-black transition-all hover:bg-white/20 hover:shadow-lg hover:scale-105 active:scale-95 ${
                isCollapsed && !isMobile ? 'p-3' : 'px-5 py-3'
              }`}
              title={isCollapsed && !isMobile ? 'Sair' : ''}
            >
              <div
                className={`relative flex items-center ${
                  isCollapsed && !isMobile ? 'justify-center' : 'gap-4 w-full'
                }`}
              >
                <IoLogOut
                  className={`transition-all group-hover:scale-110 h-7 w-7 text-white/80 group-hover:text-white`}
                />

                {(!isCollapsed || isMobile) && (
                  <span className="font-extrabold tracking-widest select-none text-base text-white/80 group-hover:text-white transition-colors">
                    Sair
                  </span>
                )}
              </div>
            </button>
          </div>
        </div>
      </nav>

      {/* Modal de Saldo de Horas */}
      <ModalSaldoHoras
        isOpen={isModalSaldoOpen}
        onClose={() => setIsModalSaldoOpen(false)}
      />
    </>
  );
}