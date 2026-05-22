// src/hooks/useUserType.ts

import { useAuthStore } from '@/store/useAuthStore';

/**
 * Hook para verificar se o usuário logado é um consultor
 */
export function useIsConsultor() {
    const { loginType } = useAuthStore();
    return loginType === 'consultor';
}

/**
 * Hook para verificar se o usuário logado é um cliente
 */
export function useIsCliente() {
    const { loginType } = useAuthStore();
    return loginType === 'cliente';
}

/**
 * Hook para obter os dados do consultor (null se não for consultor)
 */
export function useConsultorData() {
    const { loginType, codUsuario, nomeUsuario, idUsuario, tipoUsuario, permissoes } =
        useAuthStore();

    if (loginType !== 'consultor') {
        return null;
    }

    return {
        codUsuario: codUsuario!,
        nomeUsuario: nomeUsuario!,
        idUsuario: idUsuario!,
        tipoUsuario: tipoUsuario!,
        permissoes: permissoes!,
    };
}

/**
 * Hook para obter os dados do cliente (null se não for cliente)
 */
export function useClienteData() {
    const { loginType, codCliente, codRecurso, nomeRecurso } = useAuthStore();

    if (loginType !== 'cliente') {
        return null;
    }

    return {
        codCliente,
        codRecurso,
        nomeRecurso,
    };
}

/**
 * Hook para obter o nome do usuário logado (independente do tipo)
 */
export function useUserName() {
    const { loginType, nomeUsuario, nomeRecurso } = useAuthStore();

    if (loginType === 'consultor') {
        return nomeUsuario;
    } else if (loginType === 'cliente') {
        return nomeRecurso;
    }

    return null;
}

/**
 * Hook para verificar permissões específicas (apenas para consultores)
 */
export function usePermissions() {
    const { loginType, permissoes } = useAuthStore();

    if (loginType !== 'consultor' || !permissoes) {
        return {
            hasPermtar: false,
            hasPerproj1: false,
            hasPerproj2: false,
        };
    }

    return {
        hasPermtar: permissoes.permtar,
        hasPerproj1: permissoes.perproj1,
        hasPerproj2: permissoes.perproj2,
    };
}
