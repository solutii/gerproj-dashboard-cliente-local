# Encoding corrompido (WIN1252 → `�`) em campos VARCHAR/CHAR do Firebird

## Sintoma

Texto acentuado gravado no banco (por sistemas legados Delphi/Windows) chega
corrompido na aplicação Node, com caracteres de substituição:

```
CRIAÇÃO DAS REGRAS  ->  CRIA��O DAS REGRAS
VALIDAÇÕES          ->  VALIDA��ES
USUÁRIO             ->  USU�RIO
```

Isso acontece em campos `VARCHAR`/`CHAR` comuns (não em `BLOB`). Só aparece em
palavras com acento — texto sem acentuação sai normal.

## Causa raiz

O driver **`node-firebird`** (pelo menos até a versão `1.1.9`, que é a
instalada neste projeto — a versão atual do pacote é `2.14.4`) **ignora a
option `encoding`** passada na conexão quando decodifica colunas de texto do
resultado da query.

O código responsável (`node_modules/node-firebird/lib/wire/xsqlvar.js`) chama:

```js
ret = data.readText(this.length, Const.DEFAULT_ENCODING);
```

E `Const.DEFAULT_ENCODING` (`lib/wire/const.js`) é uma constante **fixa**:

```js
DEFAULT_ENCODING: 'UTF8'
```

Ou seja: não importa o que você configure em `firebirdOptions.encoding` — essa
função sempre decodifica como UTF-8.

O banco (Firebird legado, criado por aplicação Delphi no Windows) grava texto
em **WIN1252**. Um caractere acentuado nesse charset é **1 byte só** (ex:
`ç` = `0xE7`, `ã` = `0xE3`). Só que `0xE7` sozinho **não é uma sequência UTF-8
válida** — um byte alto (`0x80`–`0xFF`) sinaliza o início de uma sequência
multi-byte que precisa de bytes de continuação. Como não tem continuação,
`Buffer.toString('utf8', ...)` **descarta o byte original** e devolve o
caractere de substituição Unicode `U+FFFD` (`�`).

**Esse é o ponto crítico: a perda é irreversível.** Uma vez que o driver já
devolveu `�`, não existe mais informação de qual dos 256 valores de byte
era o caractere original — não dá pra "consertar" isso depois com regex ou
heurística de texto, porque o dado já foi jogado fora nessa conversão.

### Por que a solução óbvia (`encoding: 'WIN1252'` na conexão) não funciona

A option `encoding` do `node-firebird` é usada só na negociação inicial da
conexão (dpb `isc_dpb_lc_ctype`, avisando o *charset do cliente* pro
servidor). Ela:

1. Não afeta a função `xsqlvar.js` que decodifica os valores de coluna (bug do
   driver, hardcoded pra UTF8 como mostrado acima).
2. Mesmo se afetasse: se a coluna no banco foi criada sem `CHARACTER SET`
   explícito (comum em bancos legados, charset da coluna = `NONE`), o
   servidor Firebird não faz nenhuma transliteração — manda os bytes crus,
   do jeito que foram gravados, não importa o charset de cliente pedido.

Testei isso (setar `encoding: 'WIN1252'`) e não mudou nada — confirma o
diagnóstico acima.

## Correção aplicada

Como a decodificação errada acontece **dentro do driver**, antes do nosso
código sequer ver o valor, a única forma de corrigir é interceptar a função
de leitura de texto do driver e forçar ela a decodificar como `latin1`
(ISO-8859-1) em vez de `utf8`.

`latin1` foi escolhido porque, no intervalo `0xA0`–`0xFF` (onde ficam os
caracteres acentuados), ele é **byte a byte idêntico ao WIN1252** — mapeamento
direto de 1 byte para 1 code point, sem nenhuma lógica de sequência
multi-byte, então nunca descarta nada.

### O mesmo bug existe simetricamente na escrita

Não é só leitura. `SQLParamString.encode` (mesmo arquivo `xsqlvar.js`) grava
parâmetros de string chamando:

```js
data.addText(this.value, Const.DEFAULT_ENCODING); // sempre 'UTF8'
```

Ou seja: ao mandar `"Ç"` como parâmetro `?` num INSERT/UPDATE, o driver grava
os bytes UTF-8 de `"Ç"` (`0xC3 0x87` — **2 bytes**) numa coluna que só espera
**1 byte** por caractere (WIN1252/NONE). Isso não é só um problema de exibição
— é **dado errado gravado no banco**. Ao reler depois (mesmo já com o patch de
leitura acima, decodificando como `latin1`), esses 2 bytes viram 2 caracteres
errados (`"Ã‡"`), não o `"Ç"` original.

Confirmei isso gravando e relendo via `XdrWriter`/`XdrReader` isoladamente
(sem banco real): sem o patch de escrita, `"CRIAÇÃO"` grava como
`43 52 49 41 c3 87 c3 83` (9 bytes pra 7 caracteres) e volta corrompido mesmo
com o patch de leitura. Com o patch de escrita, grava como
`43 52 49 41 c7 c3 4f` (7 bytes, 1 por caractere) e o round-trip fica
perfeito.

**Por causa disso, antes desse patch de escrita existir, a aplicação tinha
uma função `removerAcentos()` aplicada nos campos de texto antes de gravar**
(ex: no formulário de abertura de chamado) — um contorno pra evitar que
acentos corrompessem o banco, sacrificando a acentuação. Com o patch de
escrita em vigor, gravar acentuado direto já funciona certo, então essa
função deixou de ser necessária nesses campos e foi removida.

### Patch aplicado (leitura + escrita)

Arquivo: `src/lib/firebird/firebird.ts` — logo depois do `import Firebird`:

```ts
// Patch: encoding de texto do driver (leitura E escrita)
//
// node-firebird@1.1.9 IGNORA a option `encoding` ao decodificar/codificar
// colunas VARCHAR/CHAR — lib/wire/xsqlvar.js usa a constante fixa
// Const.DEFAULT_ENCODING = 'UTF8' (lib/wire/const.js) tanto pra ler quanto
// pra escrever, não o que configuramos na conexão. O banco (legado
// Delphi/Windows) grava em WIN1252: um caractere acentuado é 1 byte só (ex:
// 0xE7 = "ç"). Na LEITURA, esse byte sozinho não é uma sequência UTF-8
// válida, então Buffer.toString('utf8', ...) descarta o byte original e
// devolve "�" — perda de dado irrecuperável depois. Na ESCRITA, o driver faz
// o inverso: grava um "ç" do JS como 2 bytes UTF-8 numa coluna de 1 byte por
// caractere, corrompendo o dado gravado. WIN1252 e latin1 são idênticos no
// intervalo 0xA0–0xFF (onde ficam os acentos), então forçar 'latin1' dos
// dois lados resolve os dois problemas. Isso é um patch no protótipo do
// driver, não uma option pública — se um dia atualizarmos o node-firebird
// (a versão instalada é bem antiga), vale checar se a versão nova já
// respeita `encoding` nos dois sentidos e remover o patch.
{
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- caminho interno do driver, sem types públicos
    const { XdrReader, XdrWriter } = require('node-firebird/lib/wire/serialize');

    const readTextOriginal = XdrReader.prototype.readText;
    XdrReader.prototype.readText = function (len: number) {
        return readTextOriginal.call(this, len, 'latin1');
    };

    const addTextOriginal = XdrWriter.prototype.addText;
    XdrWriter.prototype.addText = function (s: string) {
        return addTextOriginal.call(this, s, 'latin1');
    };
}
```

Esse patch precisa rodar **uma vez, antes de qualquer query** — por isso fica
solto no topo do módulo que centraliza a conexão (roda no import).

`XdrReader.prototype.readString` também é corrigido de graça na leitura,
porque só delega pra `readText`:

```js
XdrReader.prototype.readString = function(encoding) {
    var len = this.readInt();
    return this.readText(len, encoding);
};
```

### Por que não quebra outras coisas

`readText`/`readString` também são usados durante o handshake de conexão
(nomes de plugin de autenticação, nomes de coluna/tabela, plano de query
etc. — em `connection.js`), e `addText` (escrita) só tem **um** call site no
driver inteiro (parâmetros de string de SQL). Isso é seguro porque:

- Os valores de handshake são sempre ASCII puro (identificadores do
  protocolo/schema).
- ASCII (`0x00`–`0x7F`) é **idêntico** em UTF-8 e latin1 — o patch não muda
  nada pra esses casos.
- O único uso de `addText` é exatamente pra parâmetros de string do
  `?` — o caso que queremos corrigir.

### Camada extra (defesa em profundidade)

Além do patch, `src/lib/firebird/firebird.ts` também passa todo campo
`string` retornado por `processRow()` pela função
`corrigirTextoCorrompido()` (`src/formatters/formatar-texto-corrompido.ts`),
que já existia no projeto mas só era aplicada em BLOBs. Ela é uma heurística
de correção baseada em padrões de texto (útil pra dados que já foram gravados
errado no passado, ou fontes que passam por outro caminho de encoding). Ela
só age se o texto tiver caracteres suspeitos, e não mexe em texto já correto
(testado).

Importante: essa camada extra **não substitui o patch** — ela não consegue
recuperar bytes já perdidos (`�`), só serve pra outros tipos de corrupção
(ex: UTF-8 mal interpretado como Latin1 na gravação, que ainda preserva a
informação original em outro formato).

## Como replicar em outras aplicações da empresa

Se outra aplicação Node + `node-firebird` tiver o mesmo sintoma:

1. Confirma a versão do `node-firebird` instalada (`cat node_modules/node-firebird/package.json | grep version`).
   Se for uma versão bem mais nova (2.x), vale primeiro checar se
   `lib/wire/xsqlvar.js` naquela versão já usa `options.encoding` em vez da
   constante fixa — se sim, provavelmente já dá pra resolver só configurando
   `encoding: 'WIN1252'` (ou `'ISO8859_1'`) nas options de conexão, sem
   precisar de patch nenhum.
2. Se a versão instalada ainda tiver esse bug (hardcoded UTF8), copia o
   mesmo patch acima (leitura **e** escrita) pro módulo que centraliza a
   conexão Firebird daquela aplicação — precisa rodar antes de qualquer
   query.
3. Reinicia o servidor (o patch roda uma vez no import do módulo — hot
   reload pode não recarregar isso).
4. Testa: (a) ler um campo que já tinha caractere corrompido conhecido, e
   (b) gravar um registro novo com acento e reler — os dois precisam ficar
   certos.
5. Se aquela aplicação tiver algum contorno tipo `removerAcentos()` aplicado
   antes de gravar (pra evitar corromper o banco), só remove depois de
   confirmar que o patch de escrita está funcionando — senão volta a
   corromper dado novo.

**Limitação a documentar**: `latin1` só cobre o intervalo `0x00`–`0xFF`
(Unicode `U+0000`–`U+00FF`) — cobre acentuação latina (português, espanhol,
francês etc.) mas não emoji nem caracteres de outros alfabetos (cirílico,
CJK...). Se algum campo puder receber esse tipo de caractere, esse patch não
é suficiente.

## Como saber se é esse mesmo problema (e não outro)

Sinal característico: os caracteres virarem `�` (U+FFFD, "REPLACEMENT
CHARACTER") — não outro tipo de caractere estranho. Se o problema for
diferente (ex: `Ã©` no lugar de `é` — sinal de UTF-8 gravado e lido como
Latin1, SEM perda de dado), a correção é outra: nesse caso dá pra recuperar
via `decodeURIComponent(escape(texto))`, que é o que a função
`corrigirTextoCorrompido()` já faz — não precisa do patch do driver.
