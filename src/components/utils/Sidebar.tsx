import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { IoMdAnalytics } from 'react-icons/io';
import { IoHome } from 'react-icons/io5';
import { ButtonLogout } from './Button_Logout';

interface SidebarProps {
  setSidebarOpen: (open: boolean) => void;
}

export function Sidebar({ setSidebarOpen }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);
  const [targetRoute, setTargetRoute] = useState<string | null>(null);

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
    setSidebarOpen(false);
    setTimeout(() => {
      router.push(route);
    }, 300);
  };

  return (
    <>
      {/* Loading Overlay Premium */}
      {isNavigating && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-gradient-to-br from-purple-900/95 via-indigo-900/95 to-blue-900/95 backdrop-blur-md">
          <div className="flex flex-col items-center gap-6">
            {/* Spinner com círculos concêntricos */}
            <div className="relative h-24 w-24">
              {/* Círculo externo */}
              <div className="absolute inset-0 animate-ping rounded-full border-4 border-purple-400/30"></div>
              {/* Círculo do meio */}
              <div className="absolute inset-2 animate-spin rounded-full border-4 border-transparent border-t-purple-400 border-r-blue-400"></div>
              {/* Círculo interno */}
              <div className="absolute inset-4 animate-pulse rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20"></div>
              {/* Centro brilhante */}
              <div
                className="absolute inset-8 animate-spin rounded-full bg-gradient-to-br from-purple-400 to-blue-400"
                style={{
                  animationDirection: 'reverse',
                  animationDuration: '1.5s',
                }}
              ></div>
            </div>

            {/* Texto com gradiente */}
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
                {targetRoute === '/paginas/dashboard' && 'Carregando Dashboard'}
                {targetRoute === '/paginas/tabela' && "Carregando OS's"}
              </p>
            </div>

            {/* Barra de progresso */}
            <div className="h-1.5 w-48 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full w-full animate-pulse bg-gradient-to-r from-purple-400 via-blue-400 to-purple-400 bg-[length:200%_100%] shadow-md shadow-black"
                style={{
                  animation:
                    'pulse 2s ease-in-out infinite, shimmer 2s linear infinite',
                }}
              ></div>
            </div>
          </div>
        </div>
      )}
      {/* ===== */}

      {/* Sidebar Premium */}
      <nav
        className="relative flex h-full w-[260px] flex-col items-center rounded-xl shadow-md shadow-black bg-purple-900 p-6 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Conteúdo da sidebar */}
        <div className="relative z-10 flex h-full w-full flex-col items-center">
          {/* Logo com efeito de glow */}
          <div className="group relative mb-10">
            <div className="absolute inset-0 rounded-full bg-blue-500"></div>
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-white/50 to-white/10 p-1.5 ring-2 ring-white/20 transition-all group-hover:ring-purple-400/50">
              <Image
                src="/logo-solutii.png"
                alt="Logo Solutii"
                width={100}
                height={100}
                className="relative z-10 rounded-xl transition-all"
                priority
              />
            </div>
          </div>
          {/* ===== */}

          {/* Divisor elegante */}
          <div className="mb-12 h-px w-full bg-gradient-to-r from-transparent via-white/80 to-transparent"></div>

          {/* Links de Navegação */}
          <div className="flex w-full flex-1 flex-col gap-12">
            {/* Dashboard Link */}
            <Link
              href="/paginas/dashboard"
              onClick={(e) => handleNavigation(e, '/paginas/dashboard')}
              className={`group relative flex items-center rounded-2xl px-5 py-4 transition-all ${
                pathname === '/paginas/dashboard'
                  ? 'bg-gradient-to-r from-purple-950 to-blue-950 ring-2 ring-teal-500'
                  : 'bg-white/20 hover:bg-white/30 shadow-md shadow-black hover:shadow-lg hover:shadow-black hover:scale-105'
              } ${
                isNavigating && targetRoute === '/paginas/dashboard'
                  ? 'pointer-events-none opacity-60'
                  : 'hover:scale-[1.02] active:scale-95'
              }`}
            >

              {/* Barra lateral indicadora */}
              {pathname === '/paginas/dashboard' && (
                <div className="absolute left-0 top-1/2 h-3/4 w-1.5 -translate-y-1/2 rounded-r-full bg-teal-500 shadow-lg shadow-black animate-pulse"></div>
              )}

              {/* Ícone ou Spinner */}
              <div className="relative flex items-center justify-center">
                {isNavigating && targetRoute === '/paginas/dashboard' ? (
                  <div className="h-7 w-7 animate-spin rounded-full border-3 border-white/20 border-t-white"></div>
                ) : (
                  <IoHome
                    className={`h-7 w-7 transition-all ${
                      pathname === '/paginas/dashboard'
                        ? 'text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]'
                        : 'text-white/80 group-hover:text-white group-hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]'
                    }`}
                  />
                )}
              </div>

              {/* Label */}
              <span
                className={`ml-4 text-lg font-extrabold tracking-widest select-none transition-all ${
                  pathname === '/paginas/dashboard'
                    ? 'text-white'
                    : 'text-white/80'
                }`}
              >
                Dashboard
              </span>
            </Link>

            {/* Chamados Link */}
            <Link
              href="/paginas/tabela"
              onClick={(e) => handleNavigation(e, '/paginas/tabela')}
              className={`group relative flex items-center rounded-2xl px-5 py-4 transition-all ${
                pathname === '/paginas/tabela'
                  ? 'bg-gradient-to-r from-purple-950 to-blue-950 ring-2 ring-teal-500'
                  : 'bg-white/20 hover:bg-white/30 shadow-md shadow-black hover:shadow-lg hover:shadow-black hover:scale-105'
              } ${
                isNavigating && targetRoute === '/paginas/tabela'
                  ? 'pointer-events-none opacity-60'
                  : 'hover:scale-[1.02] active:scale-95'
              }`}
            >

              {/* Barra lateral indicadora */}
              {pathname === '/paginas/tabela' && (
                <div className="absolute left-0 top-1/2 h-3/4 w-1.5 -translate-y-1/2 rounded-r-full bg-teal-500 shadow-lg shadow-black animate-pulse"></div>
              )}

              {/* Ícone ou Spinner */}
              <div className="relative flex items-center justify-center">
                {isNavigating && targetRoute === '/paginas/tabela' ? (
                  <div className="h-7 w-7 animate-spin rounded-full border-3 border-white/20 border-t-white"></div>
                ) : (
                  <IoMdAnalytics
                    className={`h-7 w-7 transition-all ${
                      pathname === '/paginas/tabela'
                        ? 'text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]'
                        : 'text-white/80 group-hover:text-white group-hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]'
                    }`}
                  />
                )}
              </div>

              {/* Label */}
              <span
                className={`ml-4 text-lg font-extrabold tracking-widest select-none transition-all ${
                  pathname === '/paginas/tabela'
                    ? 'text-white'
                    : 'text-white/80'
                }`}
              >
                Ordens
              </span>
            </Link>
          </div>

          {/* Divisor antes do logout */}
          <div className="my-6 h-px w-full bg-gradient-to-r from-transparent via-white/80 to-transparent"></div>

          {/* Logout Button */}
          <div className="w-full">
            <ButtonLogout />
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
