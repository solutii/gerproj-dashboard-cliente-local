@echo off
chcp 65001 >nul
title Gerenciador de Usuários - Sistema Melhorado

setlocal enabledelayedexpansion

:MENU
cls
echo ╔═════════════════════════════════════════════╗
echo ║     GERENCIADOR DE USUÁRIOS - v2.0         ║
echo ╚═════════════════════════════════════════════╝
echo.
echo  1. ➕ Adicionar novo usuário
echo  2. 🔄 Atualizar senha de usuário
echo  3. ❌ Deletar usuário
echo  4. 📋 Listar todos os usuários
echo  5. 🔍 Verificar integridade do arquivo
echo  6. 🚪 Sair
echo.
echo ═════════════════════════════════════════════
set /p opcao=Escolha uma opção (1-6):

if "%opcao%"=="1" goto ADD
if "%opcao%"=="2" goto UPDATE
if "%opcao%"=="3" goto DELETE
if "%opcao%"=="4" goto LIST
if "%opcao%"=="5" goto CHECK
if "%opcao%"=="6" goto END
goto MENU

:ADD
cls
echo ╔═════════════════════════════════════════════╗
echo ║        ➕ ADICIONAR NOVO USUÁRIO           ║
echo ╚═════════════════════════════════════════════╝
echo.

set /p email=📧 Email:
if "%email%"=="" (
    echo ❌ Email não pode ser vazio!
    timeout /t 2 >nul
    goto ADD
)

echo.
echo 🔐 REQUISITOS DE SENHA:
echo    • Mínimo 8 caracteres
echo    • Pelo menos 1 MAIÚSCULA
echo    • Pelo menos 1 minúscula
echo    • Pelo menos 1 número
echo    • Pelo menos 1 caractere especial (!@#$%% etc)
echo.
set /p senha=🔑 Senha:
if "%senha%"=="" (
    echo ❌ Senha não pode ser vazia!
    timeout /t 2 >nul
    goto ADD
)

echo.
set /p codCliente=👤 Código do cliente (ou 'null' para nenhum):
if "%codCliente%"=="" set codCliente=null

echo.
echo 👑 É administrador?
echo    1 - Sim
echo    2 - Nao
set /p adminOpcao=Escolha (1-2):
if "%adminOpcao%"=="1" (
    set isAdmin=true
) else (
    set isAdmin=false
)

echo.
echo ⏳ Processando...
echo.

REM Usando o comando correto sem --esm
npx ts-node scripts/gerenciador_usuario.ts add "%email%" "%senha%" "%codCliente%" "%isAdmin%"

echo.
echo ═════════════════════════════════════════════
echo Pressione qualquer tecla para voltar ao menu...
pause >nul
goto MENU

:UPDATE
cls
echo ╔═════════════════════════════════════════════╗
echo ║       🔄 ATUALIZAR SENHA DE USUÁRIO        ║
echo ╚═════════════════════════════════════════════╝
echo.

set /p email=📧 Email do usuário:
if "%email%"=="" (
    echo ❌ Email não pode ser vazio!
    timeout /t 2 >nul
    goto UPDATE
)

echo.
echo 🔐 REQUISITOS DE SENHA:
echo    • Mínimo 8 caracteres
echo    • Pelo menos 1 MAIÚSCULA
echo    • Pelo menos 1 minúscula
echo    • Pelo menos 1 número
echo    • Pelo menos 1 caractere especial (!@#$%% etc)
echo.
set /p novaSenha=🔑 Nova senha:
if "%novaSenha%"=="" (
    echo ❌ Senha não pode ser vazia!
    timeout /t 2 >nul
    goto UPDATE
)

echo.
echo ⏳ Processando...
echo.

npx ts-node scripts/gerenciador_usuario.ts update "%email%" "%novaSenha%"

echo.
echo ═════════════════════════════════════════════
echo Pressione qualquer tecla para voltar ao menu...
pause >nul
goto MENU

:DELETE
cls
echo ╔═════════════════════════════════════════════╗
echo ║          ❌ DELETAR USUÁRIO                ║
echo ╚═════════════════════════════════════════════╝
echo.
echo ⚠️  ATENÇÃO: Esta ação não pode ser desfeita!
echo.

REM Mostrar lista de usuários antes de deletar
echo 📋 Usuários cadastrados:
echo.
npx ts-node scripts/gerenciador_usuario.ts list
echo.

set /p email=📧 Email do usuário a deletar:
if "%email%"=="" (
    echo ❌ Email não pode ser vazio!
    timeout /t 2 >nul
    goto DELETE
)

echo.
set /p confirma=⚠️  Tem certeza? Digite 'SIM' para confirmar:
if /i not "%confirma%"=="SIM" (
    echo ❌ Operacao cancelada
    timeout /t 2 >nul
    goto MENU
)

echo.
echo ⏳ Processando...
echo.

npx ts-node scripts/gerenciador_usuario.ts delete "%email%"

echo.
echo ═════════════════════════════════════════════
echo Pressione qualquer tecla para voltar ao menu...
pause >nul
goto MENU

:LIST
cls
echo ╔═════════════════════════════════════════════╗
echo ║       📋 LISTAR TODOS OS USUÁRIOS          ║
echo ╚═════════════════════════════════════════════╝
echo.

npx ts-node scripts/gerenciador_usuario.ts list

echo.
echo ═════════════════════════════════════════════
echo Pressione qualquer tecla para voltar ao menu...
pause >nul
goto MENU

:CHECK
cls
echo ╔═════════════════════════════════════════════╗
echo ║     🔍 VERIFICAR INTEGRIDADE DO ARQUIVO    ║
echo ╚═════════════════════════════════════════════╝
echo.

npx ts-node scripts/gerenciador_usuario.ts check

echo.
echo ═════════════════════════════════════════════
echo Pressione qualquer tecla para voltar ao menu...
pause >nul
goto MENU

:END
cls
echo.
echo ╔═════════════════════════════════════════════╗
echo ║          👋 SAINDO DO SISTEMA...           ║
echo ╚═════════════════════════════════════════════╝
echo.
timeout /t 2 >nul
exit /b 0

rem scripts\gerenciador_usuario.bat
