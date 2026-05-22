// src/store/useAuthStore.ts
import { create } from 'zustand';

// ==================== TIPOS ====================
type UserDataCliente = {
    loginType: 'cliente';
    codCliente: string | null;
    codRecurso: string | null;
    nomeRecurso: string | null;
};

type UserDataConsultor = {
    loginType: 'consultor';
    codUsuario: number;
    nomeUsuario: string;
    idUsuario: string;
    tipoUsuario: 'USU' | 'ADM';
    permissoes: {
        permtar: boolean;
        perproj1: boolean;
        perproj2: boolean;
    };
};

export type UserData = UserDataCliente | UserDataConsultor;

type AuthState = {
    isLoggedIn: boolean;
    isLoading: boolean;
    loginType: 'cliente' | 'consultor' | null;

    // Dados de Cliente
    codCliente: string | null;
    codRecurso: string | null;
    nomeRecurso: string | null;

    // Dados de Consultor
    codUsuario: number | null;
    nomeUsuario: string | null;
    idUsuario: string | null;
    tipoUsuario: 'USU' | 'ADM' | null;
    permissoes: {
        permtar: boolean;
        perproj1: boolean;
        perproj2: boolean;
    } | null;

    // Ações
    login: (email: string, password: string) => Promise<UserData | null>;
    logout: () => void;
    hydrate: () => void;
};

// ==================== HELPERS ====================
const getStoredAuthData = (): (UserData & { isLoggedIn: boolean }) | { isLoggedIn: false } => {
    if (typeof window === 'undefined') return { isLoggedIn: false };

    try {
        const storedLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
        if (!storedLoggedIn) return { isLoggedIn: false };

        const loginType = localStorage.getItem('loginType') as 'cliente' | 'consultor' | null;

        if (loginType === 'consultor') {
            const codUsuario = localStorage.getItem('codUsuario');
            const nomeUsuario = localStorage.getItem('nomeUsuario');
            const idUsuario = localStorage.getItem('idUsuario');
            const tipoUsuario = localStorage.getItem('tipoUsuario') as 'USU' | 'ADM';
            const permtar = localStorage.getItem('permtar') === 'true';
            const perproj1 = localStorage.getItem('perproj1') === 'true';
            const perproj2 = localStorage.getItem('perproj2') === 'true';

            return {
                isLoggedIn: true,
                loginType: 'consultor',
                codUsuario: codUsuario ? parseInt(codUsuario) : 0,
                nomeUsuario: nomeUsuario || '',
                idUsuario: idUsuario || '',
                tipoUsuario,
                permissoes: { permtar, perproj1, perproj2 },
            };
        } else {
            const storedCodCliente = localStorage.getItem('codCliente');
            const storedCodRecurso = localStorage.getItem('codRecOS');
            const storedNomeRecurso = localStorage.getItem('nomeRecurso');

            return {
                isLoggedIn: true,
                loginType: 'cliente',
                codCliente: storedCodCliente || null,
                codRecurso: storedCodRecurso || null,
                nomeRecurso: storedNomeRecurso || null,
            };
        }
    } catch (error) {
        console.error('Erro ao carregar dados do localStorage:', error);
        return { isLoggedIn: false };
    }
};

const loginApi = async (email: string, password: string): Promise<UserData> => {
    const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, loginType: 'auto' }),
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
        throw new Error(data.message || 'Falha ao fazer login');
    }

    if (data.loginType === 'consultor') {
        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('loginType', 'consultor');
        localStorage.setItem('userEmail', email);
        localStorage.setItem('codUsuario', String(data.codUsuario));
        localStorage.setItem('nomeUsuario', data.nomeUsuario);
        localStorage.setItem('idUsuario', data.idUsuario);
        localStorage.setItem('tipoUsuario', data.tipoUsuario);
        localStorage.setItem('permtar', String(data.permissoes.permtar));
        localStorage.setItem('perproj1', String(data.permissoes.perproj1));
        localStorage.setItem('perproj2', String(data.permissoes.perproj2));

        return {
            loginType: 'consultor',
            codUsuario: data.codUsuario,
            nomeUsuario: data.nomeUsuario,
            idUsuario: data.idUsuario,
            tipoUsuario: data.tipoUsuario,
            permissoes: data.permissoes,
        };
    } else {
        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('loginType', 'cliente');
        localStorage.setItem('userEmail', email);
        localStorage.setItem('codCliente', data.codCliente ?? '');
        localStorage.setItem('codRecOS', data.codRecOS ?? '');
        localStorage.setItem('nomeRecurso', data.nomeRecurso ?? '');

        return {
            loginType: 'cliente',
            codCliente: data.codCliente ?? null,
            codRecurso: data.codRecOS ?? null,
            nomeRecurso: data.nomeRecurso ?? null,
        };
    }
};

// ==================== STORE ====================
export const useAuthStore = create<AuthState>((set) => ({
    isLoggedIn: false,
    isLoading: true,
    loginType: null,

    // Dados de Cliente
    codCliente: null,
    codRecurso: null,
    nomeRecurso: null,

    // Dados de Consultor
    codUsuario: null,
    nomeUsuario: null,
    idUsuario: null,
    tipoUsuario: null,
    permissoes: null,

    // ── Hidratação a partir do localStorage ──
    hydrate: () => {
        const stored = getStoredAuthData();

        if (!stored.isLoggedIn) {
            set({ isLoading: false });
            return;
        }

        if (stored.loginType === 'consultor') {
            set({
                isLoggedIn: true,
                isLoading: false,
                loginType: 'consultor',
                codUsuario: stored.codUsuario,
                nomeUsuario: stored.nomeUsuario,
                idUsuario: stored.idUsuario,
                tipoUsuario: stored.tipoUsuario,
                permissoes: stored.permissoes,
            });
        } else {
            set({
                isLoggedIn: true,
                isLoading: false,
                loginType: 'cliente',
                codCliente: stored.codCliente,
                codRecurso: stored.codRecurso,
                nomeRecurso: stored.nomeRecurso,
            });
        }
    },

    // ── Login ──
    login: async (email, password) => {
        try {
            const userData = await loginApi(email, password);

            if (userData.loginType === 'consultor') {
                set({
                    isLoggedIn: true,
                    loginType: 'consultor',
                    codUsuario: userData.codUsuario,
                    nomeUsuario: userData.nomeUsuario,
                    idUsuario: userData.idUsuario,
                    tipoUsuario: userData.tipoUsuario,
                    permissoes: userData.permissoes,
                });
            } else {
                set({
                    isLoggedIn: true,
                    loginType: 'cliente',
                    codCliente: userData.codCliente,
                    codRecurso: userData.codRecurso,
                    nomeRecurso: userData.nomeRecurso,
                });
            }

            return userData;
        } catch (error) {
            console.error('Erro ao fazer login:', error);
            return null;
        }
    },

    // ── Logout ──
    logout: () => {
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('loginType');
        localStorage.removeItem('userEmail');
        localStorage.removeItem('codCliente');
        localStorage.removeItem('codRecOS');
        localStorage.removeItem('nomeRecurso');
        localStorage.removeItem('codUsuario');
        localStorage.removeItem('nomeUsuario');
        localStorage.removeItem('idUsuario');
        localStorage.removeItem('tipoUsuario');
        localStorage.removeItem('permtar');
        localStorage.removeItem('perproj1');
        localStorage.removeItem('perproj2');

        set({
            isLoggedIn: false,
            loginType: null,
            codCliente: null,
            codRecurso: null,
            nomeRecurso: null,
            codUsuario: null,
            nomeUsuario: null,
            idUsuario: null,
            tipoUsuario: null,
            permissoes: null,
        });
    },
}));
