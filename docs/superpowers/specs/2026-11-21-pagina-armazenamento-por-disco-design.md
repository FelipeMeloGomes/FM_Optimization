# Página Armazenamento por disco — design

## Intenção

O usuário aprovou o redesenho da página **Armazenamento** para seguir o mesmo padrão do Monitor ("Padrão B"), trocando a lista de monitores por uma lista de unidades de disco. Cada unidade deve exibir o quanto está ocupada (atual e total) e sua identidade (HD, SSD, SSD NVMe), permitir selecionar discos, executar a **Limpeza de Disco do Windows** e — quando for SSD — aplicar a otimização que os tweaks da página já fazem. A lista de tweaks existente continua abaixo dos cards. O banner passa a seguir o mesmo padrão visual de Mouse, Monitor e Teclado: foto de HD/SSD, brilho e descrição animada, substituindo o `AnimatedStorage` antigo.

## Goals

- Um card por disco usando `SettingsPreviewLayout`: prévia à esquerda, controles compactos à direita, ações em rodapé; em telas estreitas a prévia empilha acima dos controles.
- Prévia com: letra/volume do disco, badge do tipo (`SSD NVMe`, `SSD`, `HD`), barra de ocupação com percentual, e capacidade total/espaço livre vindos do backend (`size` e `free`, como texto).
- Controles com checkbox **Selecionar para limpeza** e, apenas para SSD, **Incluir otimização SSD (TRIM)**.
- Ações: **Limpeza de disco** por unidade, **Otimizar SSD** por unidade (somente SSD) e uma barra em lote **Executar limpeza nos selecionados**.
- Trocar o hero pelo padrão `DeviceHero`: badge Ferramentas, ícone `HardDrive`, título Armazenamento, descrição atual revelada com `BlurText` e a foto `src/assets/storage-drives.jpg` com brilho (`GlareHover`); manter os cinco tweaks (`util-2`, `util-4`, `util-5`, `builtin-88`, `util-6`) exatamente como hoje, inclusive o filtro que esconde `util-4`/`builtin-88` quando não há SSD.

## Non-goals

- Não alterar `scripts.json`, o runner de scripts nem a lista de tweaks. Em `TweaksPage`, só são permitidas props passivas de conteúdo (`beforeContent` e `heroContent`); o comportamento da barra, da lista e da confirmação permanece o mesmo.
- Não alterar a navegação nem a ordem da categoria Sistema. `AnimatedStorage` continua disponível para outras páginas, mas deixa de ser usado na Armazenamento.
- Não introduzir dependências novas; usar apenas os componentes de UI já existentes (`Button`, `SettingsPreviewLayout`, `AnimatedNumber`).
- Não transformar a limpeza em operação silenciosa: a ação abre a interface da Limpeza de Disco do Windows para a unidade escolhida.

## Anti-goals

- Mostrar dados falsos de disco quando a leitura falha: estados de carregamento e erro são obrigatórios.
- Interpolar a letra da unidade em comandos sem validação no main process.
- Duplicar a detecção de mídia (HD/SSD/NVMe) no renderer — ela já existe no backend.

## Constraints

- Electron + TypeScript, React 19, Tailwind CSS 4, electron-vite, bun, Biome, Vitest.
- Gate antes de commit: `bun run lint && bun run typecheck && bun run test`.
- Todo código novo precisa de teste que cubra o comportamento real; correção de bug precisa de teste de regressão.
- `.env.local` contém `GITHUB_TOKEN` e nunca deve ser commitado.
- Existe uma edição pendente no `README.md` (ordem da barra lateral: Meu PC, Monitor, Mouse, Teclado) vinda do plano anterior; deve entrar na mesma entrega.

## Decisões já tomadas

1. **Fonte dos dados.** A página Início já captura tudo isso. `useSystemContext()` (`src/contexts/SystemContext.tsx:100-158`) devolve `AsyncState<DashboardData>` com `drives: StorageDrive[]` vindos de `getSystemInfoCache()` e atualizáveis por `getSystemInfo()`. Cada `StorageDrive` traz `letter`, `label`, `size`, `free`, `usedPercent`, `type` (`SSD NVMe` / `SSD` / `HD`, com fallback para o sistema de arquivos) e `fileSystem` — a formatação vem de `getStorageDrives()` / `formatDriveMediaType()` em `electron/main/services/system-info.ts:230-236,548-581`. O próprio Dashboard já usa esse pacote em `src/pages/DashboardPage.tsx:250-261`. Reaproveitar exatamente esse caminho, sem nova leitura WMI/PowerShell no renderer. `hasSolidStateDrive()` (`:583-598`) continua sendo usado pela página para o filtro dos tweaks.

2. **Leitura no renderer — sem canal novo.** Usar `useSystemContext()` diretamente, como Início e Meu PC fazem. O badge de mídia segue o conjunto `DRIVE_MEDIA_TYPES = new Set(['SSD NVMe', 'SSD', 'HD'])` de `DashboardPage.tsx:25`, e a cor da barra segue `getDriveStatus()` (`:48-52`: `<70` bom, `<90` atenção, senão crítico). Se o contexto estiver `loading`, mostrar esqueleto; se `error`, mostrar mensagem com ação de `refresh()`. Não criar canal `getStorageDrives` nem hook de busca próprio. Decisão do builder.

3. **Ações por unidade.** Os scripts atuais são globais ou fixos em `C:`: `util-6` roda `cleanmgr` sem `/d`, `util-4` roda `defrag C: /L` e `defrag C: /O`, `builtin-88` roda `defrag C: /O /L`. Como o card é por disco, adicionar dois canais no main:
   - `runDiskCleanup(letter)` → `cleanmgr /d <letra>`;
   - `optimizeDrive(letter)` → `defrag <letra>: /O /L` (equivalente ao que os dois tweaks de SSD fazem juntos).

   Validar a letra com `^[A-Za-z]$` no main antes de montar o comando. **Contrato de execução:** exigir administrador como `util-4`/`util-6` (`requiresAdmin: true`), reaproveitando a checagem e a mensagem de `script-executor.ts:70-77` (sem relançar em UAC). Usar o padrão de launch interativo desse mesmo arquivo (`:111-119`: wrapper oculto que espera o filho, janela visível do comando) — **não** `execPowerShell`, que é oculto e tem timeout de 30 s, o que mataria o `defrag` e deixaria a limpeza invisível. A Promise do IPC resolve no fechamento do processo (`completion`, `:140-190`), não no spawn, para que `busy` só limpe quando a janela do `cleanmgr` for fechada ou o `defrag` terminar. Não gravar histórico de script nem criar ponto de restauração para essas ações pontuais. Os scripts globais `util-4` e `builtin-88` permanecem na lista de tweaks para quem quiser a configuração global (`fsutil DisableDeleteNotify`). Decisão do builder.

4. **Estado e ações.** Novo hook `useStorageDrives` em `src/hooks/`, espelhando `useDisplaySettings`, mas **sem busca própria**: lê `drives` de `useSystemContext()` e gerencia apenas conjunto `selected`, conjunto `busy`, mapas `errors`/`applied` e as ações `toggle`, `cleanup`, `optimize`, `cleanupSelected`. Nenhuma seleção começa marcada; o botão em lote fica desabilitado até haver ao menos uma unidade selecionada. **`cleanupSelected` roda `cleanmgr /d` para todas as unidades selecionadas e, em seguida, `defrag /O /L` para as selecionadas que são SSD e estão com "Incluir otimização SSD (TRIM)" marcado** — o checkbox existe para ser honrado, inclusive no lote. O hook chama `refresh()` do contexto na montagem quando `!hasFetched` (como Dashboard e Meu PC) e novamente após cada ação bem-sucedida, para que a ocupação não fique obsoleta. Decisão do builder.

5. **UI.** Novo `StorageSettingsPanel` em `src/components/storage/` com um único cabeçalho **Ajustes do Windows** e pill **Por disco**, contendo um `DiskCard` por `StorageDrive`. O ícone da prévia é decorativo e usa só CSS/HTML. Os números de percentual usam `AnimatedNumber` com sufixo `%`; `size` e `free` já chegam formatados como texto (`"512 GB"`, `"N/A"`) e são exibidos como recebidos, sem parser próprio. Decisão do builder.

6. **Integração.** `StoragePage.tsx` continua usando `TweaksPage`, mas o slot `beforeList` atual só é renderizado no caminho de sucesso (`src/components/TweaksPage.tsx:154`) — ele desapareceria enquanto os tweaks carregam ou falham. Para manter o painel independente, adicionar uma prop opcional `beforeContent?: ReactNode` ao `TweaksPage`, renderizada no topo **antes** dos três caminhos (loading `:89`, erro `:103`, sucesso `:139`). Apenas a página Armazenamento passa essa prop; CpuPage e InputLagPage continuam usando `beforeList` inalterado. O painel trata o próprio `status` do contexto: esqueleto em `loading`, mensagem com "Tentar novamente" (`refresh()`) em `error`, e estado vazio "Nenhuma unidade encontrada" com o mesmo retry quando `drives` chega vazio — porque `getStorageDrives()` engole falhas do WMI e devolve `[]`. Decisão do builder.

7. **Testes.** Cobertura nova em quatro frentes: renderização e interação do `StorageSettingsPanel` (cards, tipo, barra, seleção, ações, HD sem botão de SSD, loading/erro do contexto), integração em `StoragePage.test.tsx` (painel antes da barra de tweaks; tweaks e filtro SSD intactos), handlers IPC no main (comando montado com a letra correta e rejeição de letra inválida) e o gate completo. Os testes de renderer mockam `useSystemContext` no mesmo estilo de `DashboardPage.test.tsx:27`, com `drives` no formato de `DashboardPage.test.tsx:71-80`.

8. **Hero compartilhado.** Extrair o banner de `DevicePage.tsx` para `src/components/hero/DeviceHero.tsx` com as props `badge`, `icon`, `title`, `description`, `image` e `imageAlt`, preservando exatamente `GlareHover` + `img` com máscara + gradiente + `BlurText`. `DevicePage` passa a usar o componente, e `StoragePage` usa o mesmo componente com a foto de HD/SSD e o texto atual. `TweaksPage` ganha `heroContent?: ReactNode`, renderizado no lugar do `HeroBanner` padrão no caminho de sucesso; o `hero` existente segue sendo o fallback das demais páginas. Decisão do builder, após pedido do usuário para trocar o banner antigo da Armazenamento.

## O que fica para o builder

Nomes exatos de classes Tailwind, textos de ajuda, detalhes de aria-label/htmlFor, formato dos arquivos de teste e a divisão dos commits são decisões do builder, desde que não alterem o comportamento descrito acima. Se aparecer algo que mude o que é construído — por exemplo, a limpeza precisar ser silenciosa em vez de abrir a janela do Windows — voltar ao usuário antes de implementar.
