'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react';

type UserData = {
  isAdmin: boolean;
  codCliente: string | null;
  codRecurso: string | null;
  nomeRecurso: string | null;
};

type AuthContextType = {
  isLoggedIn: boolean;
  isLoading: boolean;
  isAdmin: boolean;
  codCliente: string | null;
  codRecurso: string | null;
  nomeRecurso: string | null;
  login: (email: string, password: string) => Promise<UserData | null>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Função para buscar dados do localStorage
const getStoredAuthData = (): UserData & { isLoggedIn: boolean } => {
  // Verifica se está no browser
  if (typeof window === 'undefined') {
    return {
      isLoggedIn: false,
      isAdmin: false,
      codCliente: null,
      codRecurso: null,
      nomeRecurso: null,
    };
  }

  try {
    const storedLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    const storedIsAdmin = localStorage.getItem('isAdmin') === 'true';
    const storedCodCliente = localStorage.getItem('codCliente');
    const storedCodRecurso = localStorage.getItem('codRecOS');
    const storedNomeRecurso = localStorage.getItem('nomeRecurso');

    return {
      isLoggedIn: storedLoggedIn,
      isAdmin: storedIsAdmin,
      codCliente: storedCodCliente || null,
      codRecurso: storedCodRecurso || null,
      nomeRecurso: storedNomeRecurso || null,
    };
  } catch (error) {
    console.error('Erro ao carregar dados do localStorage:', error);
    return {
      isLoggedIn: false,
      isAdmin: false,
      codCliente: null,
      codRecurso: null,
      nomeRecurso: null,
    };
  }
};

// Função para fazer login na API
const loginApi = async ({
  email,
  password,
}: {
  email: string;
  password: string;
}): Promise<UserData> => {
  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();

  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Falha ao fazer login');
  }

  const userData: UserData = {
    isAdmin: data.isAdmin ?? false,
    codCliente: data.codCliente ?? null,
    codRecurso: data.codRecOS ?? null,
    nomeRecurso: data.nomeRecurso ?? null,
  };

  // Salvar no localStorage
  localStorage.setItem('isLoggedIn', 'true');
  localStorage.setItem('userEmail', email);
  localStorage.setItem('isAdmin', String(userData.isAdmin));
  localStorage.setItem('codCliente', userData.codCliente ?? '');
  localStorage.setItem('codRecOS', userData.codRecurso ?? '');
  localStorage.setItem('nomeRecurso', userData.nomeRecurso ?? '');

  return userData;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [isHydrated, setIsHydrated] = useState(false);

  // Estados locais para sincronizar com o query
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [codCliente, setCodCliente] = useState<string | null>(null);
  const [codRecurso, setCodRecurso] = useState<string | null>(null);
  const [nomeRecurso, setNomeRecurso] = useState<string | null>(null);

  // Carrega dados do localStorage apenas no cliente
  useEffect(() => {
    const storedData = getStoredAuthData();
    setIsLoggedIn(storedData.isLoggedIn);
    setIsAdmin(storedData.isAdmin);
    setCodCliente(storedData.codCliente);
    setCodRecurso(storedData.codRecurso);
    setNomeRecurso(storedData.nomeRecurso);
    setIsHydrated(true);
  }, []);

  // Query para manter dados em cache
  const { isLoading } = useQuery({
    queryKey: ['auth', 'stored'],
    queryFn: getStoredAuthData,
    enabled: isHydrated, // Só executa depois da hidratação
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  // Mutation para login
  const loginMutation = useMutation({
    mutationFn: loginApi,
    onSuccess: (userData) => {
      // Atualizar o cache com os novos dados
      queryClient.setQueryData(['auth', 'stored'], {
        isLoggedIn: true,
        ...userData,
      });

      // Atualizar estados locais
      setIsLoggedIn(true);
      setIsAdmin(userData.isAdmin);
      setCodCliente(userData.codCliente);
      setCodRecurso(userData.codRecurso);
      setNomeRecurso(userData.nomeRecurso);
    },
    onError: (error) => {
      console.error('Erro ao fazer login:', error);
    },
  });

  // Função de login que retorna Promise
  const login = async (
    email: string,
    password: string,
  ): Promise<UserData | null> => {
    try {
      const userData = await loginMutation.mutateAsync({ email, password });
      return userData;
    } catch (error) {
      console.error('Erro ao fazer login:', error);
      return null;
    }
  };

  // Função de logout
  const logout = () => {
    // Limpar estados locais
    setIsLoggedIn(false);
    setIsAdmin(false);
    setCodCliente(null);
    setCodRecurso(null);
    setNomeRecurso(null);

    // Limpar localStorage
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('isAdmin');
    localStorage.removeItem('codCliente');
    localStorage.removeItem('codRecOS');
    localStorage.removeItem('nomeRecurso');

    // Atualizar cache do query
    queryClient.setQueryData(['auth', 'stored'], {
      isLoggedIn: false,
      isAdmin: false,
      codCliente: null,
      codRecurso: null,
      nomeRecurso: null,
    });

    // Invalidar queries relacionadas
    queryClient.invalidateQueries({ queryKey: ['auth'] });
  };

  return (
    <AuthContext.Provider
      value={{
        isLoggedIn,
        isLoading: !isHydrated || isLoading,
        isAdmin,
        codCliente,
        codRecurso,
        nomeRecurso,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
}