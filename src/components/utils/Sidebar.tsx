import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { IoCall, IoHome, IoChevronBack, IoChevronForward, IoLogOut } from 'react-icons/io5';
import { useAuth } from '../../context/AuthContext';
import { useFilters } from '@/context/FiltersContext';

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);
  const [targetRoute, setTargetRoute] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  // Hooks para logout
  const { logout } = useAuth();
  const { clearFilters } = useFilters();

  useEffect(() => {
    setIsNavigating(false);
    setTargetRoute(null);
  }, [pathname]);

  const handleNavigation = (
    e: React.MouseEvent<HTMLAnchorElement>,
    route: string,
  ) => {
    if (pathname === route) return;
    e.preventDefault();
    setIsNavigating(true);
    setTargetRoute(route);
    setTimeout(() => {
      router.push(route);
    }, 300);
  };

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  const handleLogout = () => {
    logout();
    clearFilters();
    router.push('/paginas/login');
  };

  return (
    <>
      {/* Sidebar Premium com largura dinâmica */}
      <nav
        className={`relative flex h-full flex-col items-center rounded-xl shadow-md shadow-black bg-purple-900 text-white overflow-hidden transition-all duration-500 ease-in-out ${
          isCollapsed ? 'w-[75px] p-3' : 'w-[260px] p-6'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Botão de Toggle - Aba tipo orelha de pasta no topo centralizada */}
        <button
          onClick={toggleSidebar}
          className="absolute -top-1 left-1/2 -translate-x-1/2 z-[100] flex h-12 w-20 items-end justify-center pb-2 bg-gradient-to-b from-teal-500 via-teal-600 to-purple-900 shadow-lg shadow-black/50 border-t-2 border-x-2 border-teal-400/50 transition-all hover:h-14 hover:border-teal-300 hover:shadow-xl hover:shadow-teal-500/40 active:scale-95 rounded-t-2xl"
          style={{
            clipPath: 'polygon(15% 0%, 85% 0%, 100% 100%, 0% 100%)'
          }}
          aria-label={isCollapsed ? 'Expandir sidebar' : 'Recolher sidebar'}
        >
          {isCollapsed ? (
            <IoChevronForward className="h-5 w-5 text-white drop-shadow-lg" />
          ) : (
            <IoChevronBack className="h-5 w-5 text-white drop-shadow-lg" />
          )}
        </button>

        {/* Loading Overlay */}
        {isNavigating && (
          <div className="absolute inset-0 z-[9999] flex items-center justify-center bg-gradient-to-br from-purple-900/95 via-indigo-900/95 to-blue-900/95 backdrop-blur-md rounded-xl">
            <div className="flex flex-col items-center gap-6">
              {/* Spinner com círculos concêntricos */}
              <div className="relative h-24 w-24">
                <div className="absolute inset-0 animate-ping rounded-full border-4 border-purple-400/30"></div>
                <div className="absolute inset-2 animate-spin rounded-full border-4 border-transparent border-t-purple-400 border-r-blue-400"></div>
                <div className="absolute inset-4 animate-pulse rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20"></div>
                <div
                  className="absolute inset-8 animate-spin rounded-full bg-gradient-to-br from-purple-400 to-blue-400"
                  style={{
                    animationDirection: 'reverse',
                    animationDuration: '1.5s',
                  }}
                ></div>
              </div>

              {/* Texto com gradiente - só quando expandido */}
              {!isCollapsed && (
                <div className="flex flex-col items-center gap-3">
                  <div className="flex items-center justify-center gap-1">
                    <h3 className="text-white text-2xl font-extrabold tracking-widest select-none">
                      Aguarde
                    </h3>
                    <div className="flex items-center justify-center gap-1">
                      <span className="h-2 w-2 animate-[bounce_1s_ease-in-out_infinite] rounded-full bg-white"></span>
                      <span className="h-2 w-2 animate-[bounce_1s_ease-in-out_0.2s_infinite] rounded-full bg-white"></span>
                      <span className="h-2 w-2 animate-[bounce_1s_ease-in-out_0.4s_infinite] rounded-full bg-white"></span>
                    </div>
                  </div>

                  <p className="animate-pulse text-sm font-semibold text-white tracking-widest select-none">
                    {targetRoute === '/paginas/dashboard' &&
                      'Carregando Dashboard'}
                    {targetRoute === '/paginas/tabela' && 'Carregando Tabela'}
                    {targetRoute === '/paginas/chamados' && 'Carregando Chamados'}
                  </p>
                </div>
              )}

              {/* Barra de progresso - só quando expandido */}
              {!isCollapsed && (
                <div className="h-1.5 w-48 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full w-full animate-pulse bg-gradient-to-r from-purple-400 via-blue-400 to-purple-400 bg-[length:200%_100%] shadow-md shadow-black"
                    style={{
                      animation:
                        'pulse 2s ease-in-out infinite, shimmer 2s linear infinite',
                    }}
                  ></div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Conteúdo da sidebar - com espaçamento superior maior para a aba */}
        <div className="relative z-10 flex h-full w-full flex-col items-center pt-8">
          {/* Logo com efeito de glow */}
          <div className={`group relative transition-all duration-500 ${
            isCollapsed ? 'mb-6 mt-8' : 'mb-10 mt-6'
          }`}>
            <div className="absolute inset-0 rounded-full bg-blue-500 blur-sm opacity-50"></div>
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-white/50 to-white/10 p-1.5 ring-2 ring-white/20 transition-all group-hover:ring-purple-400/50">
              <Image
                src="/logo-solutii.png"
                alt="Logo Solutii"
                width={isCollapsed ? 40 : 100}
                height={isCollapsed ? 40 : 100}
                className="relative z-10 rounded-xl transition-all duration-500"
                priority
              />
            </div>
          </div>

          {/* Divisor elegante */}
          <div className={`h-px w-full bg-gradient-to-r from-transparent via-white/80 to-transparent transition-all duration-500 ${
            isCollapsed ? 'mb-6' : 'mb-12'
          }`}></div>

          {/* Links de Navegação */}
          <div className={`flex w-full flex-1 flex-col transition-all duration-500 ${
            isCollapsed ? 'gap-3' : 'gap-6'
          }`}>
            {/* Dashboard Link */}
            <Link
              href="/paginas/dashboard"
              onClick={(e) => handleNavigation(e, '/paginas/dashboard')}
              className={`group relative flex items-center justify-center rounded-2xl transition-all ${
                isCollapsed ? 'p-2.5' : 'px-5 py-4'
              } ${
                pathname === '/paginas/dashboard'
                  ? 'bg-gradient-to-r from-purple-950 to-blue-950 ring-2 ring-teal-500'
                  : 'bg-white/20 hover:bg-white/30 shadow-md shadow-black hover:shadow-lg hover:shadow-black'
              } ${
                isNavigating && targetRoute === '/paginas/dashboard'
                  ? 'pointer-events-none opacity-60'
                  : 'hover:scale-[1.02] active:scale-95'
              }`}
              title={isCollapsed ? 'Dashboard' : ''}
            >
              {/* Indicador de página ativa - apenas quando expandido */}
              {pathname === '/paginas/dashboard' && !isCollapsed && (
                <div className="absolute left-0 top-1/2 h-3/4 w-1.5 -translate-y-1/2 rounded-r-full bg-teal-500 shadow-lg shadow-black animate-pulse"></div>
              )}

              {/* Indicador ponto para modo recolhido */}
              {pathname === '/paginas/dashboard' && isCollapsed && (
                <div className="absolute -left-1 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-teal-500 shadow-lg shadow-teal-500/50 animate-pulse"></div>
              )}

              <div className={`relative flex items-center ${isCollapsed ? 'justify-center' : 'gap-4 w-full'}`}>
                {isNavigating && targetRoute === '/paginas/dashboard' ? (
                  <div className="h-7 w-7 animate-spin rounded-full border-3 border-white/20 border-t-white"></div>
                ) : (
                  <IoHome
                    className={`transition-all ${isCollapsed ? 'h-7 w-7' : 'h-7 w-7'} ${
                      pathname === '/paginas/dashboard'
                        ? 'text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]'
                        : 'text-white/80 group-hover:text-white group-hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]'
                    }`}
                  />
                )}

                {/* Texto - só aparece quando expandido */}
                {!isCollapsed && (
                  <span
                    className={`text-lg font-extrabold tracking-widest select-none transition-all ${
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
              className={`group relative flex items-center justify-center rounded-2xl transition-all ${
                isCollapsed ? 'p-2.5' : 'px-5 py-4'
              } ${
                pathname === '/paginas/chamados'
                  ? 'bg-gradient-to-r from-purple-950 to-blue-950 ring-2 ring-teal-500'
                  : 'bg-white/20 hover:bg-white/30 shadow-md shadow-black hover:shadow-lg hover:shadow-black'
              } ${
                isNavigating && targetRoute === '/paginas/chamados'
                  ? 'pointer-events-none opacity-60'
                  : 'hover:scale-[1.02] active:scale-95'
              }`}
              title={isCollapsed ? 'Chamados' : ''}
            >
              {/* Indicador de página ativa - apenas quando expandido */}
              {pathname === '/paginas/chamados' && !isCollapsed && (
                <div className="absolute left-0 top-1/2 h-3/4 w-1.5 -translate-y-1/2 rounded-r-full bg-teal-500 shadow-lg shadow-black animate-pulse"></div>
              )}

              {/* Indicador ponto para modo recolhido */}
              {pathname === '/paginas/chamados' && isCollapsed && (
                <div className="absolute -left-1 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-teal-500 shadow-lg shadow-teal-500/50 animate-pulse"></div>
              )}

              <div className={`relative flex items-center ${isCollapsed ? 'justify-center' : 'gap-4 w-full'}`}>
                {isNavigating && targetRoute === '/paginas/chamados' ? (
                  <div className="h-7 w-7 animate-spin rounded-full border-3 border-white/20 border-t-white"></div>
                ) : (
                  <IoCall
                    className={`transition-all ${isCollapsed ? 'h-7 w-7' : 'h-7 w-7'} ${
                      pathname === '/paginas/chamados'
                        ? 'text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]'
                        : 'text-white/80 group-hover:text-white group-hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]'
                    }`}
                  />
                )}

                {/* Texto - só aparece quando expandido */}
                {!isCollapsed && (
                  <span
                    className={`text-lg font-extrabold tracking-widest select-none transition-all ${
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
          </div>

          {/* Divisor antes do logout */}
          <div className={`h-px w-full bg-gradient-to-r from-transparent via-white/80 to-transparent transition-all duration-500 ${
            isCollapsed ? 'my-3' : 'my-6'
          }`}></div>

          {/* Botão de Logout Integrado */}
          <div className="w-full">
            <button
              onClick={handleLogout}
              className={`group relative flex w-full items-center justify-center rounded-2xl bg-white/10 shadow-md shadow-black transition-all hover:bg-white/20 hover:shadow-lg hover:shadow-black hover:scale-105 active:scale-95 ${
                isCollapsed ? 'p-2.5' : 'px-6 py-3'
              }`}
              title={isCollapsed ? 'Sair' : ''}
            >
              <div className={`relative flex items-center ${isCollapsed ? 'justify-center' : 'gap-4 w-full'}`}>
                <IoLogOut
                  className={`transition-all group-hover:scale-110 group-active:scale-90 ${
                    isCollapsed ? 'h-7 w-7' : 'h-8 w-8'
                  } text-white/80 group-hover:text-white`}
                />

                {/* Texto - só aparece quando expandido */}
                {!isCollapsed && (
                  <span className="font-extrabold tracking-widest select-none text-lg text-white/80 group-hover:text-white transition-colors">
                    Sair
                  </span>
                )}
              </div>
            </button>
          </div>
        </div>
      </nav>

      {/* Animações CSS customizadas */}
      <style jsx>{`
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(200%);
          }
        }
      `}</style>
    </>
  );
}