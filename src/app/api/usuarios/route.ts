// src/app/api/usuarios/route.ts
import { readFile, stat } from 'fs/promises';
import { NextResponse } from 'next/server';
import path from 'path';

// ==================== TIPOS ====================
interface Usuario {
    email: string;
    password: string;
    cod_cliente?: string | null;
    codrec_os?: string | null;
    nome?: string | null;
}

interface UsuarioSeguro {
    email: string;
    cod_cliente: string | null;
    codrec_os: string | null;
    nome: string | null;
}

// ==================== CONSTANTES ====================
const USERS_FILE_PATH = path.join(process.cwd(), 'users', 'usuarios.json');
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

const ERROR_MESSAGES = {
    FILE_READ_ERROR: 'Erro ao ler arquivo de usuários',
    FILE_PARSE_ERROR: 'Erro ao processar dados dos usuários',
    SERVER_ERROR: 'Erro ao carregar usuários',
} as const;

// ==================== CACHE ====================
// ✅ OTIMIZAÇÃO: Cache em memória para evitar leituras e processamento repetidos
interface CacheEntry {
    usuarios: UsuarioSeguro[];
    timestamp: number;
    mtime: number; // Timestamp de modificação do arquivo
}

let usuariosCache: CacheEntry | null = null;

async function getFileMtime(): Promise<number> {
    try {
        const stats = await stat(USERS_FILE_PATH);
        return stats.mtimeMs;
    } catch {
        return 0;
    }
}

async function isCacheValido(): Promise<boolean> {
    if (!usuariosCache) return false;

    const agora = Date.now();

    // Verifica expiração do TTL
    if (agora - usuariosCache.timestamp > CACHE_TTL) {
        return false;
    }

    // Verifica se arquivo foi modificado
    const mtime = await getFileMtime();
    return mtime === usuariosCache.mtime;
}

// ==================== LEITURA E PROCESSAMENTO ====================
// ✅ OTIMIZAÇÃO: Leitura e sanitização em single-pass
async function carregarESanitizarUsuarios(): Promise<UsuarioSeguro[]> {
    // Verifica cache primeiro
    if (await isCacheValido()) {
        if (process.env.NODE_ENV === 'development') {
            console.log('[Usuarios] Usando cache');
        }
        return usuariosCache!.usuarios;
    }

    try {
        if (process.env.NODE_ENV === 'development') {
            console.log('[Usuarios] Lendo arquivo:', USERS_FILE_PATH);
        }

        const data = await readFile(USERS_FILE_PATH, 'utf-8');
        const usuarios: Usuario[] = JSON.parse(data);

        // ✅ OTIMIZAÇÃO: Validação inline durante o map
        if (!Array.isArray(usuarios)) {
            throw new Error('Dados não são um array');
        }

        // ✅ OTIMIZAÇÃO: Single-pass - valida e sanitiza simultaneamente
        const usuariosSeguro: UsuarioSeguro[] = [];

        for (let i = 0; i < usuarios.length; i++) {
            const u = usuarios[i];

            // Validação inline
            if (!u || typeof u !== 'object' || typeof u.email !== 'string') {
                console.error(`[Usuarios] Usuário inválido no índice ${i}`);
                continue; // Pula usuário inválido ao invés de falhar tudo
            }

            // Sanitiza removendo senha
            usuariosSeguro.push({
                email: u.email,
                cod_cliente: u.cod_cliente ?? null,
                codrec_os: u.codrec_os ?? null,
                nome: u.nome ?? null,
            });
        }

        // Atualiza cache
        const mtime = await getFileMtime();
        usuariosCache = {
            usuarios: usuariosSeguro,
            timestamp: Date.now(),
            mtime,
        };

        if (process.env.NODE_ENV === 'development') {
            console.log(`[Usuarios] ${usuariosSeguro.length} usuários carregados e cacheados`);
        }

        return usuariosSeguro;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            console.error('[Usuarios] Arquivo não encontrado:', USERS_FILE_PATH);
            throw new Error('Arquivo de usuários não encontrado');
        }

        console.error('[Usuarios] Erro ao processar:', error);
        throw error;
    }
}

// ==================== RESPOSTAS DE ERRO ====================
// ✅ OTIMIZAÇÃO: Função simplificada
function respostaErroServidor(error: unknown, customMessage?: string): NextResponse {
    console.error('[Usuarios] Erro:', error instanceof Error ? error.message : error);

    const message = customMessage || ERROR_MESSAGES.SERVER_ERROR;

    return NextResponse.json(
        {
            error: message,
            details:
                process.env.NODE_ENV === 'development'
                    ? error instanceof Error
                        ? error.message
                        : 'Erro desconhecido'
                    : undefined,
        },
        { status: 500 }
    );
}

// ==================== HANDLER PRINCIPAL ====================
export async function GET() {
    try {
        // ✅ OTIMIZAÇÃO: Single-pass - carrega, valida e sanitiza em uma operação
        const usuariosSeguro = await carregarESanitizarUsuarios();

        // ✅ OTIMIZAÇÃO: Retorna direto sem logs desnecessários em produção
        return NextResponse.json(usuariosSeguro, {
            status: 200,
            headers: {
                'Cache-Control': 'private, max-age=300', // 5 minutos no client
            },
        });
    } catch (error) {
        if (error instanceof Error && error.message === 'Dados não são um array') {
            return respostaErroServidor(error, ERROR_MESSAGES.FILE_PARSE_ERROR);
        }
        return respostaErroServidor(error);
    }
}

// ==================== FUNÇÕES AUXILIARES ====================
// ✅ Função para limpar cache manualmente
export function limparCache(): void {
    usuariosCache = null;
    if (process.env.NODE_ENV === 'development') {
        console.log('[Usuarios] Cache limpo');
    }
}

// ✅ Função para pré-carregar usuários (útil no startup)
export async function preloadUsuarios(): Promise<void> {
    try {
        await carregarESanitizarUsuarios();
        if (process.env.NODE_ENV === 'development') {
            console.log('[Usuarios] Usuários pré-carregados no cache');
        }
    } catch (error) {
        console.error('[Usuarios] Erro ao pré-carregar:', error);
    }
}

// ✅ Função para invalidar e recarregar cache
export async function recarregarUsuarios(): Promise<UsuarioSeguro[]> {
    limparCache();
    return carregarESanitizarUsuarios();
}
