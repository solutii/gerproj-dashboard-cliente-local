// src/lib/auth/senha-consultor.ts
//
// Esquema de senha do GERPROJ (sistema legado Delphi) para consultores —
// NÃO é hash, é uma cifra reversível: subtrai 11 do código ASCII de cada
// caractere ao salvar. Ex: '1' (49) é armazenado como '&' (38).
// Mantido aqui como único lugar que conhece esse esquema, usado tanto no
// login quanto na troca de senha — nunca duplicar essa lógica.

export function encodeSenhaConsultor(senha: string): string {
    return senha
        .split('')
        .map((c) => String.fromCharCode(c.charCodeAt(0) - 11))
        .join('');
}

export function validarSenhaConsultor(senhaDigitada: string, senhaArmazenada: string): boolean {
    const senhaBanco = senhaArmazenada.trim();
    const senhaEncodada = encodeSenhaConsultor(senhaDigitada.trim());
    return senhaEncodada === senhaBanco;
}
