// scripts/gerenciador_usuario.ts
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

// ==================== CONFIGURAÇÕES ====================
const CONFIG = {
  filePath: path.join(process.cwd(), 'users', 'usuarios.json'),
  backupDir: path.join(process.cwd(), 'users', 'backups'),
  logDir: path.join(process.cwd(), 'scripts', 'logs'),
  maxBackups: 30, // Manter apenas últimos 30 backups
  lockTimeout: 5000, // 5 segundos timeout para lock
};

// ==================== TIPOS ====================
interface Usuario {
  email: string;
  password: string;
  cod_cliente: string | null;
  isAdmin: boolean;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// ==================== VALIDAÇÕES ====================
function validarEmail(email: string): ValidationResult {
  const errors: string[] = [];

  // Regex robusta para email
  const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  if (!regex.test(email)) {
    errors.push('Formato de email inválido');
  }

  // Validações adicionais
  if (email.includes('..'))
    errors.push('Email não pode ter pontos consecutivos');
  if (email.startsWith('.')) errors.push('Email não pode começar com ponto');
  if (email.endsWith('.')) errors.push('Email não pode terminar com ponto');
  if (email.split('@').length !== 2) errors.push('Email deve ter apenas um @');

  // Verificar tamanho
  if (email.length > 254) errors.push('Email muito longo (máx 254 caracteres)');

  // Verificar domínio
  const domain = email.split('@')[1];
  if (domain && domain.split('.').some((part) => part.length === 0)) {
    errors.push('Domínio inválido');
  }

  return { valid: errors.length === 0, errors };
}

function validarSenha(senha: string): ValidationResult {
  const errors: string[] = [];

  if (senha.length < 8) {
    errors.push('Senha deve ter no mínimo 8 caracteres');
  }
  if (!/[A-Z]/.test(senha)) {
    errors.push('Senha deve ter pelo menos uma letra MAIÚSCULA');
  }
  if (!/[a-z]/.test(senha)) {
    errors.push('Senha deve ter pelo menos uma letra minúscula');
  }
  if (!/[0-9]/.test(senha)) {
    errors.push('Senha deve ter pelo menos um número');
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};:'",.<>?/\\|`~]/.test(senha)) {
    errors.push(
      'Senha deve ter pelo menos um caractere especial (!@#$%^&* etc)',
    );
  }

  return { valid: errors.length === 0, errors };
}

// ==================== BACKUP AUTOMÁTICO ====================
function criarBackup(): void {
  if (!fs.existsSync(CONFIG.filePath)) {
    console.log('⚠️  Nenhum arquivo para backup');
    return;
  }

  // Criar pasta de backup se não existir
  if (!fs.existsSync(CONFIG.backupDir)) {
    fs.mkdirSync(CONFIG.backupDir, { recursive: true });
  }

  const timestamp = new Date()
    .toISOString()
    .replace(/:/g, '-')
    .replace(/\..+/, '');
  const backupPath = path.join(CONFIG.backupDir, `usuarios_${timestamp}.json`);

  fs.copyFileSync(CONFIG.filePath, backupPath);
  console.log(`💾 Backup criado: ${path.basename(backupPath)}`);

  // Limpar backups antigos
  limparBackupsAntigos();
}

function limparBackupsAntigos(): void {
  if (!fs.existsSync(CONFIG.backupDir)) return;

  const backups = fs
    .readdirSync(CONFIG.backupDir)
    .filter((f) => f.startsWith('usuarios_') && f.endsWith('.json'))
    .map((f) => ({
      name: f,
      path: path.join(CONFIG.backupDir, f),
      time: fs.statSync(path.join(CONFIG.backupDir, f)).mtime.getTime(),
    }))
    .sort((a, b) => b.time - a.time);

  // Manter apenas os mais recentes
  if (backups.length > CONFIG.maxBackups) {
    backups.slice(CONFIG.maxBackups).forEach((backup) => {
      fs.unlinkSync(backup.path);
      console.log(`🗑️  Backup antigo removido: ${backup.name}`);
    });
  }
}

// ==================== SISTEMA DE LOCK ====================
class FileLock {
  private lockPath: string;

  constructor(filePath: string) {
    this.lockPath = filePath + '.lock';
  }

  async acquire(): Promise<void> {
    const startTime = Date.now();

    while (fs.existsSync(this.lockPath)) {
      if (Date.now() - startTime > CONFIG.lockTimeout) {
        throw new Error('Timeout: não foi possível obter lock do arquivo');
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    fs.writeFileSync(this.lockPath, process.pid.toString());
  }

  release(): void {
    if (fs.existsSync(this.lockPath)) {
      fs.unlinkSync(this.lockPath);
    }
  }
}

// ==================== LOGS COM ROTAÇÃO ====================
function getLogPath(): string {
  const now = new Date();
  const ano = now.getFullYear();
  const mes = String(now.getMonth() + 1).padStart(2, '0');

  if (!fs.existsSync(CONFIG.logDir)) {
    fs.mkdirSync(CONFIG.logDir, { recursive: true });
  }

  return path.join(CONFIG.logDir, `usuario_${ano}-${mes}.log`);
}

function log(
  mensagem: string,
  tipo: 'INFO' | 'ERROR' | 'WARNING' = 'INFO',
): void {
  const timestamp = new Date().toLocaleString('pt-BR');
  const logPath = getLogPath();
  const linha = `[${timestamp}] [${tipo}] ${mensagem}\n`;

  fs.appendFileSync(logPath, linha, 'utf8');

  // Também exibir no console
  if (tipo === 'ERROR') {
    console.error(linha.trim());
  } else if (tipo === 'WARNING') {
    console.warn(linha.trim());
  } else {
    console.log(linha.trim());
  }
}

// ==================== OPERAÇÕES COM ARQUIVO ====================
function lerUsuarios(): Usuario[] {
  if (!fs.existsSync(CONFIG.filePath)) {
    return [];
  }

  try {
    const raw = fs.readFileSync(CONFIG.filePath, 'utf8');
    const usuarios = JSON.parse(raw);

    if (!Array.isArray(usuarios)) {
      throw new Error('Arquivo de usuários corrompido: não é um array');
    }

    return usuarios;
  } catch (error) {
    throw new Error(`Erro ao ler arquivo de usuários: ${error}`);
  }
}

function salvarUsuarios(usuarios: Usuario[]): void {
  const json = JSON.stringify(usuarios, null, 2);
  fs.writeFileSync(CONFIG.filePath, json, 'utf8');
}

// ==================== COMANDOS ====================
async function adicionarUsuario(
  email: string,
  senha: string,
  cod_cliente: string | null,
  codrec_os: string | null,
  isAdmin: boolean,
): Promise<void> {
  // Validar email
  const emailValidation = validarEmail(email);
  if (!emailValidation.valid) {
    throw new Error(`Email inválido:\n${emailValidation.errors.join('\n')}`);
  }

  // Validar senha
  const senhaValidation = validarSenha(senha);
  if (!senhaValidation.valid) {
    throw new Error(`Senha fraca:\n${senhaValidation.errors.join('\n')}`);
  }

  const usuarios = lerUsuarios();

  // Verificar duplicata
  if (usuarios.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
    throw new Error('Já existe um usuário com este email');
  }

  // Criar hash da senha
  const password = await bcrypt.hash(senha, 10);

  // Adicionar usuário
  usuarios.push({
    email: email.trim(),
    password,
    cod_cliente,
    isAdmin,
  });

  salvarUsuarios(usuarios);

  log(
    `Usuario adicionado: ${email} (admin: ${isAdmin}, cod_cliente: ${cod_cliente}, codrec_os: ${codrec_os})`,
    'INFO',
  );
  console.log('✅ Usuário adicionado com sucesso!');
}

async function atualizarSenha(email: string, novaSenha: string): Promise<void> {
  // Validar nova senha
  const senhaValidation = validarSenha(novaSenha);
  if (!senhaValidation.valid) {
    throw new Error(`Senha fraca:\n${senhaValidation.errors.join('\n')}`);
  }

  const usuarios = lerUsuarios();

  const index = usuarios.findIndex(
    (u) => u.email.toLowerCase() === email.toLowerCase(),
  );
  if (index === -1) {
    throw new Error('Usuário não encontrado');
  }

  // Atualizar senha
  usuarios[index].password = await bcrypt.hash(novaSenha, 10);

  salvarUsuarios(usuarios);

  log(`Senha atualizada para: ${email}`, 'INFO');
  console.log('✅ Senha atualizada com sucesso!');
}

async function deletarUsuario(email: string): Promise<void> {
  const usuarios = lerUsuarios();

  const usuario = usuarios.find(
    (u) => u.email.toLowerCase() === email.toLowerCase(),
  );
  if (!usuario) {
    throw new Error('Usuário não encontrado');
  }

  // Confirmar exclusão de admin
  if (usuario.isAdmin) {
    console.warn('⚠️  ATENÇÃO: Você está deletando um usuário ADMINISTRADOR!');
  }

  const novaLista = usuarios.filter(
    (u) => u.email.toLowerCase() !== email.toLowerCase(),
  );

  salvarUsuarios(novaLista);

  log(`Usuario deletado: ${email}`, 'WARNING');
  console.log('✅ Usuário deletado com sucesso!');
}

// ==================== COMANDOS EXTRAS ====================
async function listarUsuarios(): Promise<void> {
  const usuarios = lerUsuarios();

  if (usuarios.length === 0) {
    console.log('📭 Nenhum usuário cadastrado');
    return;
  }

  console.log(`\n📋 Total de usuários: ${usuarios.length}\n`);

  usuarios.forEach((user, index) => {
    console.log(`${index + 1}. ${user.email}`);
    console.log(`   └─ Admin: ${user.isAdmin ? '✅ Sim' : '❌ Não'}`);
    console.log(`   └─ Cod Cliente: ${user.cod_cliente || 'N/A'}`);
    console.log('');
  });
}

async function verificarIntegridade(): Promise<void> {
  console.log('🔍 Verificando integridade do arquivo...\n');

  try {
    const usuarios = lerUsuarios();

    let erros = 0;

    usuarios.forEach((user, index) => {
      const problemas: string[] = [];

      if (!user.email) problemas.push('Email vazio');
      if (!user.password) problemas.push('Password vazio');
      if (!user.password?.startsWith('$2b$'))
        problemas.push('Hash bcrypt inválido');
      if (typeof user.isAdmin !== 'boolean')
        problemas.push('isAdmin não é boolean');

      if (problemas.length > 0) {
        erros++;
        console.error(
          `❌ Usuário ${index + 1} (${user.email || 'SEM EMAIL'}):`,
        );
        problemas.forEach((p) => console.error(`   └─ ${p}`));
      }
    });

    if (erros === 0) {
      console.log('✅ Arquivo íntegro! Todos os usuários estão válidos.');
    } else {
      console.error(`\n❌ Encontrados ${erros} usuário(s) com problemas.`);
      log(`Verificacao de integridade: ${erros} erros encontrados`, 'WARNING');
    }
  } catch (error) {
    console.error('❌ Erro crítico ao verificar integridade:', error);
    log(`Erro na verificacao de integridade: ${error}`, 'ERROR');
  }
}

// ==================== MAIN ====================
async function main() {
  const args = process.argv.slice(2);
  const action = args[0]?.toLowerCase();

  if (!['add', 'update', 'delete', 'list', 'check'].includes(action)) {
    console.error(`
❌ Ação inválida.

📖 USO:

  ➕ Adicionar usuário:
     npx ts-node scripts/gerenciador_usuario.ts add <email> <senha> <cod_cliente> <codrec_os> <isAdmin>
     Exemplo: npx ts-node scripts/gerenciador_usuario.ts add joao@empresa.com Senha@123 142 null false

  🔄 Atualizar senha:
     npx ts-node scripts/gerenciador_usuario.ts update <email> <novaSenha>
     Exemplo: npx ts-node scripts/gerenciador_usuario.ts update joao@empresa.com NovaSenha@456

  ❌ Deletar usuário:
     npx ts-node scripts/gerenciador_usuario.ts delete <email>
     Exemplo: npx ts-node scripts/gerenciador_usuario.ts delete joao@empresa.com

  📋 Listar usuários:
     npx ts-node scripts/gerenciador_usuario.ts list

  🔍 Verificar integridade:
     npx ts-node scripts/gerenciador_usuario.ts check
`);
    process.exit(1);
  }

  const lock = new FileLock(CONFIG.filePath);

  try {
    // Comandos que não modificam arquivo (sem lock e backup)
    if (action === 'list') {
      await listarUsuarios();
      return;
    }

    if (action === 'check') {
      await verificarIntegridade();
      return;
    }

    // Comandos que modificam (com lock e backup)
    await lock.acquire();
    console.log('🔒 Lock obtido\n');

    criarBackup();

    if (action === 'add') {
      const email = args[1];
      const senha = args[2];
      const cod_cliente = args[3] === 'null' ? null : args[3];
      const codrec_os = args[4] === 'null' ? null : args[4];
      const isAdmin = args[5] === 'true';

      if (!email || !senha) {
        throw new Error('Email e senha são obrigatórios');
      }

      await adicionarUsuario(email, senha, cod_cliente, codrec_os, isAdmin);
    } else if (action === 'update') {
      const email = args[1];
      const novaSenha = args[2];

      if (!email || !novaSenha) {
        throw new Error('Email e nova senha são obrigatórios');
      }

      await atualizarSenha(email, novaSenha);
    } else if (action === 'delete') {
      const email = args[1];

      if (!email) {
        throw new Error('Email é obrigatório');
      }

      await deletarUsuario(email);
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`\n❌ ERRO: ${errorMsg}\n`);
    log(`Erro na operacao ${action}: ${errorMsg}`, 'ERROR');
    process.exit(1);
  } finally {
    lock.release();
  }
}

// Executar
main();
