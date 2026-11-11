# Desenvolvimento — FM Optimize

## Setup

```bash
bun install
bun run dev     # modo desenvolvimento (Electron + Vite HMR)
```

> O app precisa de **administrador** para algumas funções (DNS, pontos de restauração). Sem admin, essas ações retornam erro amigável ou oferecem elevação.

## Scripts

| Script              | Descrição                                 |
| ------------------- | ----------------------------------------- |
| `bun run dev`       | Desenvolvimento com hot reload            |
| `bun run build`     | Build de produção (gera em `out/`)        |
| `bun run typecheck` | Typecheck do main (node) + renderer (web) |
| `bun run lint`      | Biome (check)                             |
| `bun run lint:fix`  | Biome (correção automática)               |
| `bun run format`    | Formatação com Biome                      |
| `bun run test`      | Testes do main + renderer (Vitest)        |

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
bun run test
```

São duas suítes no mesmo Vitest: `electron/main/**/*.test.ts` (ambiente Node) e
`src/**/*.test.{ts,tsx}` (renderer). No main process cobrem:

- `rate-limit.test.ts` — janela deslizante e limites por canal
- `powershell.test.ts` — `psEscape` e bloqueio de injeção
- `branded-types.test.ts` — validação de IDs de domínio
- `validation.test.ts` — `IpcSchemas` e `validateIpcInput`
- `packaging-config.test.ts` — contrato de empacotamento (ver [OPTIMIZATION.md](OPTIMIZATION.md))
