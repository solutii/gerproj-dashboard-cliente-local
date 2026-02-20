'use client';

import { useRouter } from 'next/navigation';
import { IoLogOut } from 'react-icons/io5';
import { useAuth } from '../context/AuthContext';
import { useFiltersStore } from '../store/useFiltersStore';

// Componente funcional para o botão de logout
export function ButtonLogout() {
    const { logout } = useAuth(); // Obtém a função de logout do contexto de autenticação
    const clearFilters = useFiltersStore((state) => state.clearFilters);
    const router = useRouter(); // Inicializa o hook de navegação para redirecionamento

    // Função chamada ao clicar no botão de logout
    const handleLogout = () => {
        logout(); // Realiza o logout do usuário
        clearFilters(); // Limpa os filtros aplicados
        router.push('/paginas/login'); // Redireciona o usuário para a página de login
    };

    // Renderiza o botão de logout com estilos aprimorados
    return (
        <button
            onClick={handleLogout}
            className="group relative flex w-full items-center justify-center gap-4 rounded-2xl bg-white/10 px-6 py-3 tracking-widest shadow-md shadow-black transition-all hover:scale-105 hover:bg-white/20 hover:shadow-lg hover:shadow-black active:scale-95"
        >
            {/* Ícone de logout */}
            <IoLogOut
                className="text-white/80 group-hover:scale-105 group-active:scale-90 hover:text-white"
                size={32}
            />

            {/* Texto do botão */}
            <span className="text-lg font-extrabold tracking-widest text-white/80 select-none hover:text-white">
                Sair
            </span>
        </button>
    );
}
