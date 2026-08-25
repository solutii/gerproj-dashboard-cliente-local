// src/lib/auth/usuarios-cliente.ts
//
// Leitura/escrita segura de users/usuarios.json (usuários cliente, senha em
// bcrypt) — usado por "Alterar Senha" e "Esqueci minha senha". Segue o mesmo
// padrão de lock + backup já usado em scripts/gerenciador_usuario.ts, porque
// aqui pode haver requisições concorrentes (CLI é uma pessoa por vez; a API
// web não).
import fs from 'fs';
import path from 'path';

export interface UsuarioCliente {
    email: string;
    password: string;
    cod_cliente?: string | null;
    codrec_os?: string | null;
    nome?: string | null;
}

const FILE_PATH = path.join(process.cwd(), 'users', 'usuarios.json');
const BACKUP_DIR = path.join(process.cwd(), 'users', 'backups');
const MAX_BACKUPS = 30;
const LOCK_TIMEOUT_MS = 5000;
const LOCK_PATH = `${FILE_PATH}.lock`;

async function adquirirLock(): Promise<void> {
    const inicio = Date.now();
    while (fs.existsSync(LOCK_PATH)) {
        if (Date.now() - inicio > LOCK_TIMEOUT_MS) {
            throw new Error('Timeout ao tentar acessar o arquivo de usuários.');
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
    }
    fs.writeFileSync(LOCK_PATH, String(process.pid));
}

function liberarLock(): void {
    if (fs.existsSync(LOCK_PATH)) fs.unlinkSync(LOCK_PATH);
}

function criarBackup(): void {
    if (!fs.existsSync(FILE_PATH)) return;
    if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
    fs.copyFileSync(FILE_PATH, path.join(BACKUP_DIR, `usuarios_${timestamp}.json`));

    const backups = fs
        .readdirSync(BACKUP_DIR)
        .filter((f) => f.startsWith('usuarios_') && f.endsWith('.json'))
        .map((f) => ({
            name: f,
            path: path.join(BACKUP_DIR, f),
            time: fs.statSync(path.join(BACKUP_DIR, f)).mtime.getTime(),
        }))
        .sort((a, b) => b.time - a.time);

    if (backups.length > MAX_BACKUPS) {
        backups.slice(MAX_BACKUPS).forEach((b) => fs.unlinkSync(b.path));
    }
}

function lerUsuarios(): UsuarioCliente[] {
    if (!fs.existsSync(FILE_PATH)) return [];
    const raw = fs.readFileSync(FILE_PATH, 'utf8');
    const usuarios = JSON.parse(raw);
    if (!Array.isArray(usuarios)) {
        throw new Error('Arquivo de usuários corrompido: não é um array.');
    }
    return usuarios;
}

function salvarUsuarios(usuarios: UsuarioCliente[]): void {
    criarBackup();
    fs.writeFileSync(FILE_PATH, JSON.stringify(usuarios, null, 2), 'utf8');
}

/**
 * Lê o arquivo, encontra o usuário pelo e-mail e aplica `mutar` no array —
 * tudo sob lock, pra evitar duas requisições concorrentes pisando uma na
 * escrita da outra. Só regrava o arquivo (com backup) se `mutar` sinalizar
 * `alterou: true` — evita reescrever/criar backup à toa em tentativas que
 * falham (ex: senha atual incorreta).
 */
export async function comUsuarioPorEmail<T>(
    email: string,
    mutar: (
        usuarios: UsuarioCliente[],
        usuario: UsuarioCliente | undefined
    ) => { resultado: T; alterou: boolean }
): Promise<T> {
    await adquirirLock();
    try {
        const usuarios = lerUsuarios();
        const emailNormalizado = email.trim().toLowerCase();
        const usuario = usuarios.find((u) => u.email.toLowerCase().trim() === emailNormalizado);
        const { resultado, alterou } = mutar(usuarios, usuario);
        if (alterou) salvarUsuarios(usuarios);
        return resultado;
    } finally {
        liberarLock();
    }
}

// Critérios replicados de scripts/gerador_senha_usuario.ts.
export function validarForcaSenha(senha: string): string[] {
    const erros: string[] = [];
    if (senha.length < 8) erros.push('Senha deve ter no mínimo 8 caracteres');
    if (!/[A-Z]/.test(senha)) erros.push('Senha deve ter pelo menos uma letra MAIÚSCULA');
    if (!/[a-z]/.test(senha)) erros.push('Senha deve ter pelo menos uma letra minúscula');
    if (!/[0-9]/.test(senha)) erros.push('Senha deve ter pelo menos um número');
    if (!/[!@#$%^&*()_+\-=[\]{};:'",.<>?/\\|`~]/.test(senha)) {
        erros.push('Senha deve ter pelo menos um caractere especial (!@#$%^&* etc)');
    }
    return erros;
}

// Gera uma senha temporária aleatória (pra "Esqueci minha senha"), já
// garantindo que passa em validarForcaSenha.
export function gerarSenhaTemporaria(comprimento = 12): string {
    const minusculas = 'abcdefghijklmnopqrstuvwxyz';
    const maiusculas = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numeros = '0123456789';
    const especiais = '!@#$%^&*()_+-=';
    const todos = minusculas + maiusculas + numeros + especiais;

    let senha =
        minusculas[Math.floor(Math.random() * minusculas.length)] +
        maiusculas[Math.floor(Math.random() * maiusculas.length)] +
        numeros[Math.floor(Math.random() * numeros.length)] +
        especiais[Math.floor(Math.random() * especiais.length)];

    for (let i = senha.length; i < comprimento; i++) {
        senha += todos[Math.floor(Math.random() * todos.length)];
    }

    return senha
        .split('')
        .sort(() => Math.random() - 0.5)
        .join('');
}
