import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { IsLoggedIn } from './IsLoggedIn';

export function ProtecaoRotas({ children }: { children: React.ReactNode }) {
    const { isLoggedIn, isLoading } = useAuth();
    const router = useRouter();
    const [shouldRender, setShouldRender] = useState(false);

    useEffect(() => {
        // Aguarda o carregamento inicial
        if (isLoading) return;

        if (!isLoggedIn) {
            console.log('Usuário não logado, redirecionando para /login');
            router.push('/paginas/login');
            return;
        }

        // Se chegou até aqui, usuário está logado
        setShouldRender(true);
    }, [isLoggedIn, isLoading, router]);

    // Mostra loading enquanto verifica autenticação
    if (isLoading) {
        return <IsLoggedIn isLoading={isLoading} />;
    }

    // Se não está logado, não renderiza nada (redirecionamento em andamento)
    if (!isLoggedIn) {
        return null;
    }

    // Só renderiza os filhos quando tiver certeza que deve renderizar
    if (!shouldRender) {
        return null;
    }

    return <>{children}</>;
}
