// src/store/useAuthStore.ts
import { create } from 'zustand';

// ==================== TIPOS ====================
type UserDataCliente = {
    loginType: 'cliente';
    userEmail: string | null;
    codCliente: string | null;
    codRecurso: string | null;
    nomeRecurso: string | null;
};

type UserDataConsultor = {
    loginType: 'consultor';
    userEmail: string | null;
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
    userEmail: string | null;

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
    setAdminCodCliente: (codCliente: string) => void;
};

// ==================== HELPERS ====================
// localStorage pode lançar em modo privado/com quota excedida — essas
// operações de escrita não podem quebrar o fluxo de login/logout no meio.
function safeSetItem(key: string, value: string): void {
    try {
        localStorage.setItem(key, value);
    } catch {
        // ignora — localStorage indisponível
    }
}

function safeRemoveItem(key: string): void {
    try {
        localStorage.removeItem(key);
    } catch {
        // ignora — localStorage indisponível
    }
}

function safeGetItem(key: string): string | null {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
}

const getStoredAuthData = (): (UserData & { isLoggedIn: boolean }) | { isLoggedIn: false } => {
    if (typeof window === 'undefined') return { isLoggedIn: false };

    try {
        const storedLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
        if (!storedLoggedIn) return { isLoggedIn: false };

        const loginType = localStorage.getItem('loginType') as 'cliente' | 'consultor' | null;
        const userEmail = localStorage.getItem('userEmail');

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
                userEmail,
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
                userEmail,
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
        safeSetItem('isLoggedIn', 'true');
        safeSetItem('loginType', 'consultor');
        safeSetItem('userEmail', email);
        safeSetItem('codUsuario', String(data.codUsuario));
        safeSetItem('nomeUsuario', data.nomeUsuario);
        safeSetItem('idUsuario', data.idUsuario);
        safeSetItem('tipoUsuario', data.tipoUsuario);
        safeSetItem('permtar', String(data.permissoes.permtar));
        safeSetItem('perproj1', String(data.permissoes.perproj1));
        safeSetItem('perproj2', String(data.permissoes.perproj2));

        return {
            loginType: 'consultor',
            userEmail: email,
            codUsuario: data.codUsuario,
            nomeUsuario: data.nomeUsuario,
            idUsuario: data.idUsuario,
            tipoUsuario: data.tipoUsuario,
            permissoes: data.permissoes,
        };
    } else {
        safeSetItem('isLoggedIn', 'true');
        safeSetItem('loginType', 'cliente');
        safeSetItem('userEmail', email);
        safeSetItem('codCliente', data.codCliente ?? '');
        safeSetItem('codRecOS', data.codRecOS ?? '');
        safeSetItem('nomeRecurso', data.nomeRecurso ?? '');
        if (data.clienteToken) safeSetItem('clienteToken', data.clienteToken);
        else safeRemoveItem('clienteToken');

        return {
            loginType: 'cliente',
            userEmail: email,
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
    userEmail: null,

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
            const codCliente = safeGetItem('codCliente') || null;
            set({
                isLoggedIn: true,
                isLoading: false,
                loginType: 'consultor',
                userEmail: stored.userEmail,
                codUsuario: stored.codUsuario,
                nomeUsuario: stored.nomeUsuario,
                idUsuario: stored.idUsuario,
                tipoUsuario: stored.tipoUsuario,
                permissoes: stored.permissoes,
                codCliente,
            });
        } else {
            set({
                isLoggedIn: true,
                isLoading: false,
                loginType: 'cliente',
                userEmail: stored.userEmail,
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
                    userEmail: userData.userEmail,
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
                    userEmail: userData.userEmail,
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

    // ── Selecionar cliente como admin ──
    setAdminCodCliente: (codCliente) => {
        safeSetItem('codCliente', codCliente);
        set({ codCliente });
    },

    // ── Logout ──
    logout: () => {
        safeRemoveItem('isLoggedIn');
        safeRemoveItem('loginType');
        safeRemoveItem('userEmail');
        safeRemoveItem('codCliente');
        safeRemoveItem('codRecOS');
        safeRemoveItem('nomeRecurso');
        safeRemoveItem('codUsuario');
        safeRemoveItem('nomeUsuario');
        safeRemoveItem('idUsuario');
        safeRemoveItem('tipoUsuario');
        safeRemoveItem('permtar');
        safeRemoveItem('perproj1');
        safeRemoveItem('perproj2');
        safeRemoveItem('clienteToken');

        set({
            isLoggedIn: false,
            loginType: null,
            userEmail: null,
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
