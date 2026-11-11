# Desenvolvimento — FM Optimize

## Setup

```bash
cd fm-optimize-electron
npm install
npm run dev     # modo desenvolvimento (Electron + Vite HMR)
```

> O app precisa de **administrador** para algumas funções (DNS, pontos de restauração). Sem admin, essas ações retornam erro amigável ou oferecem elevação.

## Scripts

| Script              | Descrição                                 |
| ------------------- | ----------------------------------------- |
| `npm run dev`       | Desenvolvimento                           |
| `npm run build`     | Build de produção (gera em `out/`)        |
| `npm run typecheck` | Typecheck do main (node) + renderer (web) |
| `npm run lint`      | Biome (check)                             |
| `npm run lint:fix`  | Biome (write)                             |
| `npm run test`      | Testes do main process (Vitest)           |

## Convenções

- **Commits**: Conventional Commits (`feat:`, `fix:`, `refactor:`, `test:`, `a11y:`, `docs:`).
- **Branches**: `feat/sprint-X-descricao`, `fix/descricao`.
- **Lint/typecheck** devem passar antes de commitar.
- **Markdown**: o Biome formata `.md` (tabelas, listas e blocos de código embutidos); `bun run lint:fix` aplica.
- **README.md** (raiz) deve ser atualizado se houver mudança funcional/visual.

## Adicionando um novo handler IPC

1. **Schema** em `electron/main/validation.ts` (ou `branded-types.ts`):

   ```ts
   export const mySchema = z.object({ id: ScriptIdSchema });
   ```

   Adicione ao `IpcSchemas` (se recebe input) ou use `handleIpcNoInput`.

2. **Handler** em `electron/main/ipc-handlers.ts`:

   ```ts
   ipcMain.handle('meu-canal', (_e, input) =>
     handleIpc('meu-canal', input, (validated) => fazerAlgo(validated))
   );
   ```

3. **Preload** em `electron/preload/index.ts`:

   ```ts
   meuCanal: (id) => ipc<Result>('meu-canal', id),
   ```

   E adicione ao tipo `ElectronAPI` em `electron/shared/ipc-types.ts`.

4. **Renderer**: consuma via context/provider ou `window.electronAPI.meuCanal()`.

## Executando comandos PowerShell

- Prefira `execPowerShellSafe(command, ...args)` — args são escapados automaticamente.
- Só use `execPowerShell(script)` para scripts internos conhecidos (passam por sanitize).
- Nunca interpole entrada do usuário em um script inline sem antes validar (Zod) e escapar (`psEscape`).

## Testes

```bash
npm test
```

Testes ficam em `electron/main/**/*.test.ts`, ambiente Node. Cobrem:

- `rate-limit.test.ts` — janela deslizante e limites por canal
- `powershell.test.ts` — `psEscape` e bloqueio de injeção
- `branded-types.test.ts` — validação de IDs de domínio
- `validation.test.ts` — `IpcSchemas` e `validateIpcInput`
