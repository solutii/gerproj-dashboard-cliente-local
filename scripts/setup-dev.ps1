# Script de Setup do Ambiente de Desenvolvimento
# Execute com: .\scripts\setup-dev.ps1

Write-Host "🚀 Iniciando configuração do ambiente de desenvolvimento..." -ForegroundColor Cyan

# Verifica se está em um projeto Next.js
if (-not (Test-Path "package.json")) {
    Write-Host "❌ Erro: package.json não encontrado. Execute este script na raiz do projeto Next.js" -ForegroundColor Red
    exit 1
}

# Cria pasta .vscode se não existir
if (-not (Test-Path ".vscode")) {
    New-Item -ItemType Directory -Path ".vscode" | Out-Null
    Write-Host "✅ Pasta .vscode criada" -ForegroundColor Green
}

# Cria settings.json
Write-Host "📝 Criando .vscode/settings.json..." -ForegroundColor Yellow
$settingsJson = @'
{
    "editor.fontSize": 14,
    "editor.tabSize": 4,
    "editor.guides.indentation": true,
    "editor.insertSpaces": true,
    "editor.wordWrap": "on",
    "editor.minimap.enabled": true,
    "editor.lineHeight": 22,
    "editor.fontFamily": "'Fira Code', 'Cascadia Code', Consolas, 'Courier New', monospace",
    "editor.fontLigatures": true,
    "editor.cursorBlinking": "smooth",
    "editor.cursorSmoothCaretAnimation": "on",
    "editor.bracketPairColorization.enabled": true,
    "editor.guides.bracketPairs": true,
    "editor.formatOnSave": true,
    "editor.formatOnPaste": true,
    "editor.defaultFormatter": "esbenp.prettier-vscode",
    "editor.codeActionsOnSave": {
        "source.fixAll.eslint": "explicit",
        "source.organizeImports": "explicit"
    },
    "prettier.configPath": "./prettier.config.js",
    "prettier.requireConfig": true,
    "prettier.singleQuote": true,
    "prettier.trailingComma": "es5",
    "prettier.semi": true,
    "prettier.printWidth": 100,
    "prettier.tabWidth": 4,
    "javascript.updateImportsOnFileMove.enabled": "always",
    "typescript.updateImportsOnFileMove.enabled": "always",
    "javascript.suggest.autoImports": true,
    "typescript.suggest.autoImports": true,
    "javascript.inlayHints.parameterNames.enabled": "all",
    "typescript.inlayHints.parameterNames.enabled": "all",
    "eslint.validate": ["javascript", "javascriptreact", "typescript", "typescriptreact"],
    "tailwindCSS.experimental.classRegex": [
        ["class:\\s*?[\"'`]([^\"'`]*).*?[\"'`]", "[\"'`]([^\"'`]*).*?[\"'`]"],
        ["className:\\s*?[\"'`]([^\"'`]*).*?[\"'`]", "[\"'`]([^\"'`]*).*?[\"'`]"]
    ],
    "[javascript]": {
        "editor.defaultFormatter": "esbenp.prettier-vscode",
        "editor.formatOnSave": true
    },
    "[javascriptreact]": {
        "editor.defaultFormatter": "esbenp.prettier-vscode",
        "editor.formatOnSave": true
    },
    "[typescript]": {
        "editor.defaultFormatter": "esbenp.prettier-vscode",
        "editor.formatOnSave": true
    },
    "[typescriptreact]": {
        "editor.defaultFormatter": "esbenp.prettier-vscode",
        "editor.formatOnSave": true
    },
    "[html]": {
        "editor.defaultFormatter": "esbenp.prettier-vscode"
    },
    "files.autoSave": "onFocusChange",
    "files.trimTrailingWhitespace": true,
    "files.insertFinalNewline": true,
    "files.exclude": {
        "**/.git": true,
        "**/.DS_Store": true,
        "**/node_modules": true,
        "**/dist": true,
        "**/build": true
    },
    "terminal.integrated.fontSize": 13,
    "terminal.integrated.fontFamily": "monospace",
    "explorer.confirmDelete": false,
    "explorer.confirmDragAndDrop": false,
    "explorer.compactFolders": false,
    "breadcrumbs.enabled": true,
    "emmet.includeLanguages": {
        "javascript": "javascriptreact",
        "typescript": "typescriptreact"
    },
    "git.autofetch": true,
    "git.confirmSync": false,
    "workbench.startupEditor": "none",
    "workbench.tree.indent": 30,
    "indentRainbow.colors": [
        "rgba(255,64,64,0.15)",
        "rgba(64,255,64,0.15)",
        "rgba(64,64,255,0.15)",
        "rgba(255,255,64,0.15)"
    ],
    "indentRainbow.errorColor": "rgba(255,0,0,0.3)",
    "indentRainbow.tabmixColor": "rgba(255,0,0,0.3)",
    "indentRainbow.ignoreLinePatterns": ["/[ \t]* [*]/g", "/[ \t]+[/]{2}/g"],
    "indentRainbow.ignoreErrorLanguages": ["markdown", "plaintext"],
    "indentRainbow.colorOnWhiteSpaceOnly": true
}
'@
$settingsJson | Out-File -FilePath ".vscode/settings.json" -Encoding UTF8
Write-Host "✅ settings.json criado" -ForegroundColor Green

# Cria prettier.config.js
Write-Host "📝 Criando prettier.config.js..." -ForegroundColor Yellow
$prettierConfig = @'
/** @type {import("prettier").Config} */
module.exports = {
    semi: true,
    singleQuote: true,
    trailingComma: 'es5',
    printWidth: 100,
    tabWidth: 4,
    useTabs: false,
    plugins: ['prettier-plugin-tailwindcss'],
};
'@
$prettierConfig | Out-File -FilePath "prettier.config.js" -Encoding UTF8
Write-Host "✅ prettier.config.js criado" -ForegroundColor Green

# Cria eslint.config.js
Write-Host "📝 Criando eslint.config.js..." -ForegroundColor Yellow
$eslintConfig = @'
import { FlatCompat } from '@eslint/eslintrc';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
    baseDirectory: __dirname,
});

const eslintConfig = [
    ...compat.config({
        extends: [
            'next/core-web-vitals',
            'plugin:@typescript-eslint/recommended',
            'plugin:prettier/recommended',
        ],
        rules: {
            'react/no-unescaped-entities': 'off',
            '@next/next/no-page-custom-font': 'off',
            'react/react-in-jsx-scope': 'off',
            'prettier/prettier': ['error'],
            '@typescript-eslint/no-unused-vars': [
                'warn',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    caughtErrorsIgnorePattern: '^_',
                },
            ],
        },
    }),
];

export default eslintConfig;
'@
$eslintConfig | Out-File -FilePath "eslint.config.js" -Encoding UTF8
Write-Host "✅ eslint.config.js criado" -ForegroundColor Green

# Instala dependências de desenvolvimento
Write-Host "`n📦 Instalando dependências de desenvolvimento..." -ForegroundColor Yellow

$devDependencies = @(
    "prettier@^3.7.4",
    "prettier-plugin-tailwindcss@^0.7.2",
    "eslint@^9",
    "eslint-config-next@16.1.1",
    "eslint-config-prettier@^9.1.0",
    "eslint-plugin-prettier@^5.2.1",
    "@typescript-eslint/eslint-plugin@^8.19.1",
    "@typescript-eslint/parser@^8.19.1"
)

Write-Host "Instalando pacotes de desenvolvimento: $($devDependencies -join ', ')" -ForegroundColor Cyan
npm install --save-dev $devDependencies

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Dependências de desenvolvimento instaladas com sucesso!" -ForegroundColor Green
} else {
    Write-Host "❌ Erro ao instalar dependências de desenvolvimento" -ForegroundColor Red
    exit 1
}

# Instala bibliotecas de ícones
Write-Host "`n📦 Instalando bibliotecas de ícones..." -ForegroundColor Yellow

$iconLibraries = @(
    "react-icons",
    "lucide-react"
)

Write-Host "Instalando: $($iconLibraries -join ', ')" -ForegroundColor Cyan
npm install $iconLibraries

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Bibliotecas de ícones instaladas com sucesso!" -ForegroundColor Green
} else {
    Write-Host "❌ Erro ao instalar bibliotecas de ícones" -ForegroundColor Red
    exit 1
}

# Cria .prettierignore
Write-Host "`n📝 Criando .prettierignore..." -ForegroundColor Yellow
$prettierIgnore = @'
node_modules
.next
out
dist
build
coverage
.env
.env.local
package-lock.json
yarn.lock
pnpm-lock.yaml
'@
$prettierIgnore | Out-File -FilePath ".prettierignore" -Encoding UTF8
Write-Host "✅ .prettierignore criado" -ForegroundColor Green

# Adiciona scripts ao package.json se não existirem
Write-Host "`n📝 Verificando scripts no package.json..." -ForegroundColor Yellow
$packageJson = Get-Content "package.json" | ConvertFrom-Json
$scriptsAdded = $false

if (-not $packageJson.scripts.format) {
    $packageJson.scripts | Add-Member -MemberType NoteProperty -Name "format" -Value "prettier --write ." -Force
    $scriptsAdded = $true
}

if (-not $packageJson.scripts.'format:check') {
    $packageJson.scripts | Add-Member -MemberType NoteProperty -Name "format:check" -Value "prettier --check ." -Force
    $scriptsAdded = $true
}

if ($scriptsAdded) {
    $packageJson | ConvertTo-Json -Depth 10 | Out-File -FilePath "package.json" -Encoding UTF8
    Write-Host "✅ Scripts adicionados ao package.json" -ForegroundColor Green
}

Write-Host "`n✨ Configuração concluída com sucesso!" -ForegroundColor Green
Write-Host "`n📋 Próximos passos:" -ForegroundColor Cyan
Write-Host "  1. Reinicie o VSCode (Ctrl+Shift+P → 'Reload Window')" -ForegroundColor White
Write-Host "  2. Instale as extensões necessárias:" -ForegroundColor White
Write-Host "     - ESLint (dbaeumer.vscode-eslint)" -ForegroundColor Gray
Write-Host "     - Prettier (esbenp.prettier-vscode)" -ForegroundColor Gray
Write-Host "     - Tailwind CSS IntelliSense (bradlc.vscode-tailwindcss)" -ForegroundColor Gray
Write-Host "  3. Teste formatando um arquivo ao salvar" -ForegroundColor White
Write-Host "`n💡 Comandos disponíveis:" -ForegroundColor Cyan
Write-Host "  npm run format        - Formata todos os arquivos" -ForegroundColor White
Write-Host "  npm run format:check  - Verifica formatação sem alterar" -ForegroundColor White
Write-Host "  npm run lint          - Executa o linter" -ForegroundColor White
Write-Host "`n📦 Bibliotecas instaladas:" -ForegroundColor Cyan
Write-Host "  - react-icons         - Biblioteca com diversos pacotes de ícones" -ForegroundColor White
Write-Host "  - lucide-react        - Ícones modernos e elegantes" -ForegroundColor White

##### Como executar o script #####
# .\scripts\setup-dev.ps1
# ou
# powershell -ExecutionPolicy Bypass -File .\scripts\setup-dev.ps1


##### Se houver erro de execução, libere scripts: #####
# Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
