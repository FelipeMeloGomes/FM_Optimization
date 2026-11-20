# Créditos e licenças de terceiros

O FM Optimize é um software proprietário — veja [LICENSE](LICENSE). Este
arquivo relaciona os componentes de terceiros usados no produto e as licenças
sob as quais eles são distribuídos.

Os avisos de copyright e os textos integrais de cada pacote também acompanham
o instalador: as dependências de produção são empacotadas pelo
`electron-builder` com seus arquivos de licença dentro do `app.asar`. As
licenças das fontes e os textos abaixo são reproduzidos neste arquivo porque
as fontes são compiladas junto com o renderer.

## Componentes incorporados

| Componente                                                                | Uso no app                | Licença |
| ------------------------------------------------------------------------- | ------------------------- | ------- |
| [Electron](https://github.com/electron/electron)                          | runtime desktop           | MIT     |
| [React](https://github.com/facebook/react)                                | interface                 | MIT     |
| [Radix UI](https://www.radix-ui.com/)                                     | primitivas de interface   | MIT     |
| [Lucide](https://lucide.dev/)                                             | ícones                    | ISC     |
| [React Router](https://reactrouter.com/)                                  | navegação                 | MIT     |
| [TanStack Virtual](https://tanstack.com/virtual)                          | listas virtualizadas      | MIT     |
| [Tailwind CSS](https://tailwindcss.com/)                                  | estilos                   | MIT     |
| [electron-updater](https://github.com/electron-userland/electron-builder) | atualização automática    | MIT     |
| [systeminformation](https://github.com/sebhildebrandt/systeminformation)  | leitura de hardware       | MIT     |
| [Zod](https://zod.dev/)                                                   | validação de IPC          | MIT     |
| [Inter Variable](https://rsms.me/inter/)                                  | tipografia                | OFL 1.1 |
| [JetBrains Mono Variable](https://www.jetbrains.com/lp/mono/)             | tipografia                | OFL 1.1 |
| [PresentMon](https://github.com/GameTechDev/PresentMon) 2.3.1             | captura de FPS do overlay | MIT     |

> O binário do PresentMon **não** vem dentro do instalador. Ele é baixado do
> release oficial na primeira captura e validado por SHA256 antes de ser
> executado, e fica em `%APPDATA%\fm-optimize\tools\`.

Ferramentas usadas apenas no desenvolvimento e no build (TypeScript — Apache-2.0,
Vitest — MIT, Biome — MIT, electron-vite e electron-builder — MIT) não são
distribuídas no produto.

## Fontes de dados

- **PassMark** — pontuações de desempenho usadas no comparador de placas de vídeo.
- **Technical City** — especificações usadas no comparador e link de consulta.
- **Steam** — capas dos jogos no overlay, obtidas da loja pública, sem chave de API.

Essas fontes são creditadas na interface do app e no README.

## Textos das licenças

### MIT

```
Copyright (c) dos respectivos autores e anos indicados em cada pacote.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### ISC

```
Copyright (c) dos respectivos autores e anos indicados em cada pacote.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
```

### SIL Open Font License 1.1

Aplicável às fontes Inter Variable e JetBrains Mono Variable empacotadas no
renderer.

```
Copyright 2016 The Inter Project Authors (https://github.com/rsms/inter) Inter-Italic[opsz,wght].ttf: Copyright 2016 The Inter Project Authors (https://github.com/rsms/inter)
Copyright 2020 The JetBrains Mono Project Authors (https://github.com/JetBrains/JetBrainsMono) JetBrainsMono-Italic[wght].ttf: Copyright 2020 The JetBrains Mono Project Authors (https://github.com/JetBrains/JetBrainsMono)

This Font Software is licensed under the SIL Open Font License, Version 1.1.
This license is copied below, and is also available with a FAQ at:
http://scripts.sil.org/OFL

-----------------------------------------------------------
SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007
-----------------------------------------------------------

PREAMBLE
The goals of the Open Font License (OFL) are to stimulate worldwide
development of collaborative font projects, to support the font creation
efforts of academic and linguistic communities, and to provide a free and
open framework in which fonts may be shared and improved in partnership
with others.

The OFL allows the licensed fonts to be used, studied, modified and
redistributed freely as long as they are not sold by themselves. The
fonts, including any derivative works, can be bundled, embedded,
redistributed and/or sold with any software provided that any reserved
names are not used by derivative works. The fonts and derivatives,
however, cannot be released under any other type of license. The
requirement for fonts to remain under this license does not apply
to any document created using the fonts or their derivatives.

DEFINITIONS
"Font Software" refers to the set of files released by the Copyright
Holder(s) under this license and clearly marked as such. This may
include source files, build scripts and documentation.

"Reserved Font Name" refers to any names specified as such after the
copyright statement(s).

"Original Version" refers to the collection of Font Software components as
distributed by the Copyright Holder(s).

"Modified Version" refers to any derivative made by adding to, deleting,
or substituting -- in part or in whole -- any of the components of the
Original Version, by changing formats or by porting the Font Software to a
new environment.

"Author" refers to any designer, engineer, programmer, technical
writer or other person who contributed to the Font Software.

PERMISSION & CONDITIONS
Permission is hereby granted, free of charge, to any person obtaining
a copy of the Font Software, to use, study, copy, merge, embed, modify,
redistribute, and sell modified and unmodified copies of the Font
Software, subject to the following conditions:

1) Neither the Font Software nor any of its individual components,
in Original or Modified Versions, may be sold by itself.

2) Original or Modified Versions of the Font Software may be bundled,
redistributed and/or sold with any software, provided that each copy
contains the above copyright notice and this license. These can be
included either as stand-alone text files, human-readable headers or
in the appropriate machine-readable metadata fields within text or
binary files as long as those fields can be easily viewed by the user.

3) No Modified Version of the Font Software may use the Reserved Font
Name(s) unless explicit written permission is granted by the corresponding
Copyright Holder. This restriction only applies to the primary font name as
presented to the users.

4) The name(s) of the Copyright Holder(s) or the Author(s) of the Font
Software shall not be used to promote, endorse or advertise any
Modified Version, except to acknowledge the contribution(s) of the
Copyright Holder(s) and the Author(s) or with their explicit written
permission.

5) The Font Software, modified or unmodified, in part or in whole,
must be distributed entirely under this license, and must not be
distributed under any other license. The requirement for fonts to
remain under this license does not apply to any document created
using the Font Software.

TERMINATION
This license becomes null and void if any of the above conditions are
not met.

DISCLAIMER
THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT
OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE
COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL
DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM
OTHER DEALINGS IN THE FONT SOFTWARE.
```
