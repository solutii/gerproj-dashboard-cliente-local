// scripts/gerador_senha_usuario.ts
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

// ==================== CONFIGURAÇÕES ====================
const CONFIG = {
  logDir: path.join(process.cwd(), 'scripts', 'logs'),
  saltRounds: 10,
};

// ==================== TIPOS ====================
interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// ==================== VALIDAÇÕES ====================
function validarSenha(senha: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validações obrigatórias
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

  // Validações de segurança adicional (warnings)
  if (senha.length < 12) {
    warnings.push(
      'Senha tem menos de 12 caracteres - considere usar uma senha mais longa',
    );
  }

  // Verificar padrões comuns fracos
  const padroesFracos = [
    /^[0-9]+$/,
    /^[a-zA-Z]+$/,
    /123456/,
    /password/i,
    /qwerty/i,
    /abc123/i,
    /(\w)\1{2,}/,
  ];

  padroesFracos.forEach((padrao) => {
    if (padrao.test(senha)) {
      warnings.push(
        'Senha contém padrões comuns ou repetições - não recomendado',
      );
    }
  });

  // Verificar sequências
  if (
    /(?:abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz)/i.test(
      senha,
    )
  ) {
    warnings.push(
      'Senha contém sequências alfabéticas - considere variação maior',
    );
  }

  if (/(?:012|123|234|345|456|567|678|789)/.test(senha)) {
    warnings.push(
      'Senha contém sequências numéricas - considere variação maior',
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

function calcularForcaSenha(senha: string): {
  forca: number;
  nivel: string;
  cor: string;
} {
  let pontos = 0;

  // Comprimento
  if (senha.length >= 8) pontos += 1;
  if (senha.length >= 12) pontos += 1;
  if (senha.length >= 16) pontos += 1;

  // Variedade de caracteres
  if (/[a-z]/.test(senha)) pontos += 1;
  if (/[A-Z]/.test(senha)) pontos += 1;
  if (/[0-9]/.test(senha)) pontos += 1;
  if (/[!@#$%^&*()_+\-=\[\]{};:'",.<>?/\\|`~]/.test(senha)) pontos += 1;

  // Complexidade extra
  const tiposCaracteres = [
    /[a-z]/.test(senha),
    /[A-Z]/.test(senha),
    /[0-9]/.test(senha),
    /[!@#$%^&*()_+\-=\[\]{};:'",.<>?/\\|`~]/.test(senha),
  ].filter(Boolean).length;

  if (tiposCaracteres >= 3) pontos += 1;
  if (tiposCaracteres === 4) pontos += 1;

  // Determinar nível
  let nivel: string;
  let cor: string;

  if (pontos <= 3) {
    nivel = 'FRACA';
    cor = '🔴';
  } else if (pontos <= 5) {
    nivel = 'MÉDIA';
    cor = '🟡';
  } else if (pontos <= 7) {
    nivel = 'FORTE';
    cor = '🟢';
  } else {
    nivel = 'MUITO FORTE';
    cor = '🟢';
  }

  return { forca: pontos, nivel, cor };
}

// ==================== LOGS ====================
function getLogPath(): string {
  const now = new Date();
  const ano = now.getFullYear();
  const mes = String(now.getMonth() + 1).padStart(2, '0');

  if (!fs.existsSync(CONFIG.logDir)) {
    fs.mkdirSync(CONFIG.logDir, { recursive: true });
  }

  return path.join(CONFIG.logDir, `gerador_senha_${ano}-${mes}.log`);
}

function log(
  mensagem: string,
  tipo: 'INFO' | 'ERROR' | 'WARNING' = 'INFO',
): void {
  const timestamp = new Date().toLocaleString('pt-BR');
  const logPath = getLogPath();
  const linha = `[${timestamp}] [${tipo}] ${mensagem}\n`;

  fs.appendFileSync(logPath, linha, 'utf8');
}

// ==================== GERAÇÃO DE HASH ====================
async function gerarHash(
  senha: string,
  verbose: boolean = false,
): Promise<void> {
  console.log('╔═════════════════════════════════════════════╗');
  console.log('║       🔐 GERADOR DE HASH DE SENHA          ║');
  console.log('╚═════════════════════════════════════════════╝\n');

  // Validar senha
  const validation = validarSenha(senha);

  if (!validation.valid) {
    console.error('❌ SENHA INVÁLIDA\n');
    validation.errors.forEach((erro) => {
      console.error(`   └─ ${erro}`);
    });
    console.error('');
    log(
      `Tentativa de gerar hash com senha inválida: ${validation.errors.join(', ')}`,
      'ERROR',
    );
    process.exit(1);
  }

  // Mostrar warnings se houver
  if (validation.warnings.length > 0) {
    console.warn('⚠️  AVISOS DE SEGURANÇA\n');
    validation.warnings.forEach((warning) => {
      console.warn(`   └─ ${warning}`);
    });
    console.warn('');
  }

  // Calcular força da senha
  const { forca, nivel, cor } = calcularForcaSenha(senha);

  console.log('📊 ANÁLISE DA SENHA\n');
  console.log(`   └─ Comprimento: ${senha.length} caracteres`);
  console.log(`   └─ Força: ${cor} ${nivel} (${forca}/9 pontos)`);
  console.log('');

  if (verbose) {
    console.log('🔍 DETALHES DA SENHA\n');
    console.log(
      `   └─ Letras minúsculas: ${/[a-z]/.test(senha) ? '✅' : '❌'}`,
    );
    console.log(
      `   └─ Letras MAIÚSCULAS: ${/[A-Z]/.test(senha) ? '✅' : '❌'}`,
    );
    console.log(`   └─ Números: ${/[0-9]/.test(senha) ? '✅' : '❌'}`);
    console.log(
      `   └─ Caracteres especiais: ${/[!@#$%^&*()_+\-=\[\]{};:'",.<>?/\\|`~]/.test(senha) ? '✅' : '❌'}`,
    );
    console.log('');
  }

  // Gerar hash
  try {
    console.log('⏳ Gerando hash bcrypt...\n');
    const hash = await bcrypt.hash(senha, CONFIG.saltRounds);

    console.log('✅ HASH GERADO COM SUCESSO\n');
    console.log('═════════════════════════════════════════════');
    console.log(hash);
    console.log('═════════════════════════════════════════════\n');

    if (verbose) {
      console.log('ℹ️  INFORMAÇÕES TÉCNICAS\n');
      console.log(`   └─ Algoritmo: bcrypt`);
      console.log(`   └─ Salt rounds: ${CONFIG.saltRounds}`);
      console.log(`   └─ Tamanho do hash: ${hash.length} caracteres`);
      console.log('');
    }

    console.log('💡 PRÓXIMOS PASSOS\n');
    console.log('   1. Copie o hash acima');
    console.log('   2. Use no arquivo usuarios.json ou no gerenciador');
    console.log('   3. Nunca compartilhe a senha original');
    console.log('');

    log(`Hash gerado com sucesso (força: ${nivel})`, 'INFO');
  } catch (error) {
    console.error('❌ ERRO AO GERAR HASH\n');
    console.error(`   └─ ${error}\n`);
    log(`Erro ao gerar hash: ${error}`, 'ERROR');
    process.exit(1);
  }
}

// ==================== GERAÇÃO DE SENHA SEGURA ====================
function gerarSenhaSegura(comprimento: number = 16): string {
  const minusculas = 'abcdefghijklmnopqrstuvwxyz';
  const maiusculas = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numeros = '0123456789';
  const especiais = '!@#$%^&*()_+-=[]{};<>?';

  const todosCaracteres = minusculas + maiusculas + numeros + especiais;

  // Garantir pelo menos um de cada tipo
  let senha = '';
  senha += minusculas[Math.floor(Math.random() * minusculas.length)];
  senha += maiusculas[Math.floor(Math.random() * maiusculas.length)];
  senha += numeros[Math.floor(Math.random() * numeros.length)];
  senha += especiais[Math.floor(Math.random() * especiais.length)];

  // Preencher o resto
  for (let i = senha.length; i < comprimento; i++) {
    senha +=
      todosCaracteres[Math.floor(Math.random() * todosCaracteres.length)];
  }

  // Embaralhar
  return senha
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('');
}

async function gerarSenhaEHash(comprimento: number): Promise<void> {
  console.log('╔═════════════════════════════════════════════╗');
  console.log('║     🎲 GERADOR DE SENHA SEGURA + HASH      ║');
  console.log('╚═════════════════════════════════════════════╝\n');

  const senha = gerarSenhaSegura(comprimento);

  console.log('✅ SENHA GERADA\n');
  console.log('═════════════════════════════════════════════');
  console.log(senha);
  console.log('═════════════════════════════════════════════\n');

  // Analisar força
  const { forca, nivel, cor } = calcularForcaSenha(senha);

  console.log('📊 ANÁLISE DA SENHA\n');
  console.log(`   └─ Comprimento: ${senha.length} caracteres`);
  console.log(`   └─ Força: ${cor} ${nivel} (${forca}/9 pontos)`);
  console.log('');

  // Gerar hash
  console.log('⏳ Gerando hash bcrypt...\n');
  const hash = await bcrypt.hash(senha, CONFIG.saltRounds);

  console.log('✅ HASH GERADO\n');
  console.log('═════════════════════════════════════════════');
  console.log(hash);
  console.log('═════════════════════════════════════════════\n');

  console.log('⚠️  IMPORTANTE\n');
  console.log('   └─ Guarde a SENHA original em local seguro');
  console.log('   └─ Use o HASH no sistema');
  console.log('   └─ Nunca compartilhe a senha original');
  console.log('');

  log(
    `Senha segura gerada (comprimento: ${comprimento}, força: ${nivel})`,
    'INFO',
  );
}

// ==================== VERIFICAÇÃO DE HASH ====================
async function verificarHash(senha: string, hash: string): Promise<void> {
  console.log('╔═════════════════════════════════════════════╗');
  console.log('║       🔍 VERIFICADOR DE HASH BCRYPT        ║');
  console.log('╚═════════════════════════════════════════════╝\n');

  try {
    const match = await bcrypt.compare(senha, hash);

    if (match) {
      console.log('✅ SENHA CORRETA\n');
      console.log('   └─ A senha corresponde ao hash fornecido');
      log('Verificação de hash: senha correta', 'INFO');
    } else {
      console.log('❌ SENHA INCORRETA\n');
      console.log('   └─ A senha NÃO corresponde ao hash fornecido');
      log('Verificação de hash: senha incorreta', 'WARNING');
    }
    console.log('');
  } catch (error) {
    console.error('❌ ERRO NA VERIFICAÇÃO\n');
    console.error(`   └─ ${error}\n`);
    log(`Erro na verificação de hash: ${error}`, 'ERROR');
    process.exit(1);
  }
}

// ==================== MAIN ====================
async function main() {
  const args = process.argv.slice(2);
  const comando = args[0]?.toLowerCase();

  if (!comando || !['hash', 'generate', 'verify', 'help'].includes(comando)) {
    console.log(`
╔═════════════════════════════════════════════╗
║    🔐 GERADOR DE SENHA E HASH - v2.0       ║
╚═════════════════════════════════════════════╝

📖 COMANDOS DISPONÍVEIS:

  🔐 Gerar hash de senha existente:
     npx ts-node scripts/gerador_senha_usuario.ts hash <senha> [--verbose]
     Exemplo: npx ts-node scripts/gerador_senha_usuario.ts hash "Minha@Senha123"

  🎲 Gerar senha segura + hash:
     npx ts-node scripts/gerador_senha_usuario.ts generate [comprimento]
     Exemplo: npx ts-node scripts/gerador_senha_usuario.ts generate 16

  🔍 Verificar se senha corresponde a hash:
     npx ts-node scripts/gerador_senha_usuario.ts verify <senha> <hash>
     Exemplo: npx ts-node scripts/gerador_senha_usuario.ts verify "Senha123" "$2b$10$..."

  ❓ Ajuda:
     npx ts-node scripts/gerador_senha_usuario.ts help

═════════════════════════════════════════════

💡 DICAS:

   • Use senhas com no mínimo 12 caracteres
   • Combine letras, números e símbolos
   • Evite padrões óbvios ou palavras comuns
   • Nunca reutilize senhas importantes

═════════════════════════════════════════════
`);
    process.exit(1);
  }

  try {
    if (comando === 'hash') {
      const senha = args[1];
      const verbose = args.includes('--verbose') || args.includes('-v');

      if (!senha) {
        console.error('❌ Erro: Senha não fornecida\n');
        console.error(
          'Uso: npx ts-node scripts/gerador_senha_usuario.ts hash <senha> [--verbose]\n',
        );
        process.exit(1);
      }

      await gerarHash(senha, verbose);
    } else if (comando === 'generate') {
      const comprimento = parseInt(args[1]) || 16;

      if (comprimento < 8) {
        console.error('❌ Erro: Comprimento mínimo é 8 caracteres\n');
        process.exit(1);
      }

      if (comprimento > 128) {
        console.error('❌ Erro: Comprimento máximo é 128 caracteres\n');
        process.exit(1);
      }

      await gerarSenhaEHash(comprimento);
    } else if (comando === 'verify') {
      const senha = args[1];
      const hash = args[2];

      if (!senha || !hash) {
        console.error('❌ Erro: Senha e hash são obrigatórios\n');
        console.error(
          'Uso: npx ts-node scripts/gerador_senha_usuario.ts verify <senha> <hash>\n',
        );
        process.exit(1);
      }

      await verificarHash(senha, hash);
    } else if (comando === 'help') {
      // Reexibir o help
      process.argv = [process.argv[0], process.argv[1]];
      await main();
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`\n❌ ERRO: ${errorMsg}\n`);
    log(`Erro no comando ${comando}: ${errorMsg}`, 'ERROR');
    process.exit(1);
  }
}

main();

// =================== INSTRUÇÕES DE USO ===================
// Rode o comando "npx ts-node scripts/gerador_senha_usuario.ts generate 8", para gerar uma senha segura de 8 caracteres e seu hash bcrypt correspondente.


// ====================== OBSERVAÇÕES ======================
// Ao gerar a senha, deve-se copiar a SENHA GERADA e NÂO O HASH DA SENHA
// Após gerar e copiar a senha, deve-se executar o scripts\gerenciador_usuario.bat e informar a senha copiada
// O HASH da senha, pode ser informado diretamente no arquivo users/usuarios.json, caso não queira usar o scripts\gerenciador_usuario.bat

