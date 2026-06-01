// src/app/api/login/route.ts
import { firebirdQuery } from '@/lib/firebird/firebird-client';
import bcrypt from 'bcryptjs';
import fs from 'fs/promises';
import { NextResponse } from 'next/server';
import path from 'path';

// ==================== TIPOS ====================
interface LoginRequest {
    email: string;
    password: string;
    loginType?: 'auto' | 'cliente' | 'consultor'; // auto detecta automaticamente
}

interface Usuario {
    email: string;
    password: string;
    cod_cliente?: string | null;
    codrec_os?: string | null;
    nome?: string | null;
}

interface UsuarioConsultor {
    COD_USUARIO: number;
    NOME_USUARIO: string;
    ID_USUARIO: string;
    SENHA: string;
    TIPO_USUARIO: 'USU' | 'ADM';
    PERMTAR_USUARIO: string;
    ALTSEN_USUARIO: number;
    PERPROJ1_USUARIO: string;
    PERPROJ2_USUARIO: string;
}

interface LoginResponse {
    success: boolean;
    message?: string;
    loginType: 'cliente' | 'consultor';
    codCliente?: string | null;
    codRecOS?: string | null;
    nomeRecurso?: string | null;
    // Dados do consultor
    codUsuario?: number;
    nomeUsuario?: string;
    idUsuario?: string;
    tipoUsuario?: 'USU' | 'ADM';
    permissoes?: {
        permtar: boolean;
        perproj1: boolean;
        perproj2: boolean;
    };
}

// ==================== CONSTANTES ====================
const USERS_FILE_PATH = path.join(process.cwd(), 'users', 'usuarios.json');
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

const ERROR_MESSAGES = {
    INVALID_CREDENTIALS: 'Usuário ou senha inválidos',
    USER_NOT_FOUND: 'Usuário não encontrado',
    INVALID_PASSWORD: 'Senha incorreta',
    INVALID_REQUEST: 'Email/usuário e senha são obrigatórios',
    SERVER_ERROR: 'Erro interno do servidor',
    FILE_READ_ERROR: 'Erro ao ler arquivo de usuários',
    DATABASE_ERROR: 'Erro ao consultar banco de dados',
} as const;

// ==================== CACHE DE USUÁRIOS (CLIENTES) ====================
interface CacheEntry {
    usuarios: Map<string, Usuario>;
    timestamp: number;
    fileStats: { mtime: number };
}

let usuariosCache: CacheEntry | null = null;

async function getFileModifiedTime(): Promise<number> {
    try {
        const stats = await fs.stat(USERS_FILE_PATH);
        return stats.mtimeMs;
    } catch {
        return 0;
    }
}

async function isCacheValido(): Promise<boolean> {
    if (!usuariosCache) return false;

    const agora = Date.now();
    const cacheExpirado = agora - usuariosCache.timestamp > CACHE_TTL;

    if (cacheExpirado) return false;

    const mtime = await getFileModifiedTime();
    return mtime === usuariosCache.fileStats.mtime;
}

async function carregarUsuarios(): Promise<Map<string, Usuario>> {
    if (await isCacheValido()) {
        return usuariosCache!.usuarios;
    }

    try {
        const data = await fs.readFile(USERS_FILE_PATH, 'utf-8');
        const usuarios: Usuario[] = JSON.parse(data);

        const usuariosMap = new Map<string, Usuario>();

        for (let i = 0; i < usuarios.length; i++) {
            const u = usuarios[i];
            const emailNormalizado = u.email.toLowerCase().trim();
            usuariosMap.set(emailNormalizado, u);
        }

        const mtime = await getFileModifiedTime();
        usuariosCache = {
            usuarios: usuariosMap,
            timestamp: Date.now(),
            fileStats: { mtime },
        };

        return usuariosMap;
    } catch (error) {
        console.error('[Login] Erro ao ler arquivo de usuários:', error);
        throw new Error(ERROR_MESSAGES.FILE_READ_ERROR);
    }
}

// ==================== DETECÇÃO DE TIPO DE LOGIN ====================
function detectarTipoLogin(identificador: string): 'email' | 'username' {
    // Email contém @ e ponto
    if (identificador.includes('@') && identificador.includes('.')) {
        return 'email';
    }
    return 'username';
}

// ==================== LOGIN DE CONSULTORES (FIREBIRD) ====================
async function buscarConsultorPorId(idUsuario: string): Promise<UsuarioConsultor | null> {
    try {
        const sql = `
            SELECT
                COD_USUARIO,
                NOME_USUARIO,
                ID_USUARIO,
                SENHA,
                TIPO_USUARIO,
                PERMTAR_USUARIO,
                ALTSEN_USUARIO,
                PERPROJ1_USUARIO,
                PERPROJ2_USUARIO
            FROM USUARIO
            WHERE UPPER(TRIM(ID_USUARIO)) = UPPER(?)
        `;

        const resultado = await firebirdQuery<UsuarioConsultor>(sql, [idUsuario.trim()]);

        if (resultado && resultado.length > 0) {
            return resultado[0];
        }

        return null;
    } catch (error) {
        console.error('[Login] Erro ao buscar consultor:', error);
        throw new Error(ERROR_MESSAGES.DATABASE_ERROR);
    }
}

function encodeSenhaConsultor(senha: string): string {
    // O GERPROJ subtrai 11 do código ASCII de cada caractere ao salvar a senha.
    // Ex: '1' (49) é armazenado como '&' (38).
    return senha
        .split('')
        .map((c) => String.fromCharCode(c.charCodeAt(0) - 11))
        .join('');
}

function validarSenhaConsultor(senhaDigitada: string, senhaArmazenada: string): boolean {
    const senhaBanco = senhaArmazenada.trim();
    const senhaEncodada = encodeSenhaConsultor(senhaDigitada.trim());
    return senhaEncodada === senhaBanco;
}

function construirRespostaConsultor(consultor: UsuarioConsultor): LoginResponse {
    return {
        success: true,
        loginType: 'consultor',
        codUsuario: consultor.COD_USUARIO,
        nomeUsuario: consultor.NOME_USUARIO,
        idUsuario: consultor.ID_USUARIO,
        tipoUsuario: consultor.TIPO_USUARIO,
        permissoes: {
            permtar: consultor.PERMTAR_USUARIO === 'SIM',
            perproj1: consultor.PERPROJ1_USUARIO === 'SIM',
            perproj2: consultor.PERPROJ2_USUARIO === 'SIM',
        },
    };
}

// ==================== LOGIN DE CLIENTES (JSON) ====================
function buscarUsuarioPorEmail(
    usuariosMap: Map<string, Usuario>,
    email: string
): Usuario | undefined {
    const emailNormalizado = email.toLowerCase().trim();
    return usuariosMap.get(emailNormalizado);
}

async function validarSenhaCliente(senhaPlana: string, senhaHash: string): Promise<boolean> {
    try {
        return await bcrypt.compare(senhaPlana, senhaHash);
    } catch (error) {
        console.error('[Login] Erro ao validar senha:', error);
        return false;
    }
}

function construirRespostaCliente(usuario: Usuario): LoginResponse {
    return {
        success: true,
        loginType: 'cliente',
        codCliente: usuario.cod_cliente ?? null,
        codRecOS: usuario.codrec_os ?? null,
        nomeRecurso: usuario.nome ?? null,
    };
}

// ==================== VALIDAÇÕES ====================
function validarCredenciais(email: string, password: string): NextResponse | null {
    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
        return NextResponse.json(
            {
                success: false,
                message: ERROR_MESSAGES.INVALID_REQUEST,
            },
            { status: 400 }
        );
    }

    return null;
}

// ==================== RESPOSTAS DE ERRO ====================
function respostaErroAutenticacao(): NextResponse {
    return NextResponse.json(
        {
            success: false,
            message: ERROR_MESSAGES.INVALID_CREDENTIALS,
        },
        { status: 401 }
    );
}

function respostaErroServidor(error: unknown): NextResponse {
    console.error('[Login] Erro no servidor:', error);

    return NextResponse.json(
        {
            success: false,
            message: ERROR_MESSAGES.SERVER_ERROR,
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
export async function POST(request: Request) {
    try {
        const body: LoginRequest = await request.json();
        const { email, password, loginType = 'auto' } = body;

        if (process.env.NODE_ENV === 'development') {
            console.log('[Login] Tentativa de login:', email, 'Tipo:', loginType);
        }

        // Validar credenciais
        const erroValidacao = validarCredenciais(email, password);
        if (erroValidacao) {
            return erroValidacao;
        }

        // Detectar tipo de login automaticamente
        const tipoDetectado = detectarTipoLogin(email);

        // Se for loginType='auto', tenta ambos os métodos
        // Se for 'cliente' ou 'consultor', força apenas aquele tipo

        // TENTATIVA 1: Login de Consultor
        if (loginType === 'auto' || loginType === 'consultor') {
            if (tipoDetectado === 'username' || loginType === 'consultor') {
                try {
                    const consultor = await buscarConsultorPorId(email);

                    if (consultor) {
                        const senhaValida = validarSenhaConsultor(password, consultor.SENHA);

                        if (senhaValida) {
                            if (process.env.NODE_ENV === 'development') {
                                console.log('[Login] Login de consultor bem-sucedido:', email);
                            }

                            const resposta = construirRespostaConsultor(consultor);
                            return NextResponse.json(resposta, { status: 200 });
                        }

                        // Se encontrou o usuário mas senha errada, retorna erro
                        if (loginType === 'consultor') {
                            return respostaErroAutenticacao();
                        }
                    }
                } catch (error) {
                    console.error('[Login] Erro ao tentar login de consultor:', error);
                    // Se forçou consultor, retorna erro
                    if (loginType === 'consultor') {
                        return respostaErroServidor(error);
                    }
                    // Se auto, continua para tentar cliente
                }
            }
        }

        // TENTATIVA 2: Login de Cliente
        if (loginType === 'auto' || loginType === 'cliente') {
            if (tipoDetectado === 'email' || loginType === 'cliente' || loginType === 'auto') {
                try {
                    const usuariosMap = await carregarUsuarios();
                    const usuario = buscarUsuarioPorEmail(usuariosMap, email);

                    if (usuario) {
                        const senhaValida = await validarSenhaCliente(password, usuario.password);

                        if (senhaValida) {
                            if (process.env.NODE_ENV === 'development') {
                                console.log('[Login] Login de cliente bem-sucedido:', email);
                            }

                            const resposta = construirRespostaCliente(usuario);
                            return NextResponse.json(resposta, { status: 200 });
                        }
                    }
                } catch (error) {
                    console.error('[Login] Erro ao tentar login de cliente:', error);
                    // Se forçou cliente, retorna erro
                    if (loginType === 'cliente') {
                        return respostaErroServidor(error);
                    }
                }
            }
        }

        // Se chegou aqui, não encontrou em nenhum dos dois
        if (process.env.NODE_ENV === 'development') {
            console.log('[Login] Usuário não encontrado em nenhum sistema:', email);
        }

        return respostaErroAutenticacao();
    } catch (error) {
        return respostaErroServidor(error);
    }
}

// ==================== LIMPEZA DE CACHE ====================
export function limparCaches(): void {
    usuariosCache = null;
    console.log('[Login] Caches limpos');
}

export async function preloadUsuarios(): Promise<void> {
    try {
        await carregarUsuarios();
        console.log('[Login] Usuários pré-carregados no cache');
    } catch (error) {
        console.error('[Login] Erro ao pré-carregar usuários:', error);
    }
}
