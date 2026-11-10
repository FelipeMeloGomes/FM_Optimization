# 🛡️ Checklist de Correção — Dependabot Security

Lista dos **100 alertas de segurança** abertos no Dependabot do repositório `FelipeMeloGomes/FM_Optimization`.
Use este arquivo para ir corrigindo cada pacote, acessando o link do alerta para ver a **versão corrigida** e o **CVE**.

> 📅 Gerado automaticamente com o token do `.env.local`.
> 🔄 O arquivo `.github/dependabot.yml` está configurado para verificar atualizações **todos os dias**, então o Dependabot abrirá PRs automáticos à medida que novas versões corrigidas forem lançadas.

---

## Como usar este checklist

Para cada pacote abaixo:

1. Clique no link do alerta (ex: `.../security/dependabot/186`).
2. Anote a **versão corrigida** indicada pelo Dependabot.
3. Atualize o `package.json` com a versão corrigida.
4. Rode `pnpm install` para atualizar o `pnpm-lock.yaml`.
5. Rode o gate de qualidade: `bun run lint && bun run typecheck && bun run test`.
6. Se passar, commit e abra um PR com a correção.
7. Marque a coluna **Status** como `✅ Corrigido` e preencha o **PR**.

---

## Sumário por pacote

| Pacote                   | Quantidade | Tipo          | Versão atual (`package.json`) |
| ------------------------ | ---------- | ------------- | ----------------------------- |
| electron                 | 41         | devDependency | `^35.0.0`                     |
| tar                      | 8          | transitive    | —                             |
| @xmldom/xmldom           | 8          | transitive    | —                             |
| vite                     | 5          | devDependency | `^6.0.0`                      |
| ip-address               | 3          | transitive    | —                             |
| brace-expansion          | 3          | transitive    | —                             |
| extract-zip              | 3          | transitive    | —                             |
| @vitest/mocker           | 2          | transitive    | —                             |
| systeminformation        | 2          | dependency    | `^5.33.13`                    |
| minimatch                | 2          | transitive    | —                             |
| vitest                   | 1          | devDependency | `^4.1.10`                     |
| baseline-browser-mapping | 1          | transitive    | —                             |
| source-map-js            | 1          | transitive    | —                             |
| js-yaml                  | 1          | transitive    | —                             |
| zod                      | 1          | dependency    | `^4.4.3`                      |
| app-builder-lib          | 1          | transitive    | —                             |
| builder-util-runtime     | 1          | transitive    | —                             |

**Total: 100 alertas abertos**

---

## 1. electron (41 alertas)

**Versão atual:** `^35.0.0` (devDependency) — esta é a dependência com mais alertas, prioridade alta.

| Alerta | Severidade | Versão corrigida | Status | PR  | Link                                                                         |
| ------ | ---------- | ---------------- | ------ | --- | ---------------------------------------------------------------------------- |
| #186   |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/186> |
| #185   |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/185> |
| #184   |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/184> |
| #183   |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/183> |
| #182   |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/182> |
| #181   |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/181> |
| #180   |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/180> |
| #179   |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/179> |
| #178   |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/178> |
| #177   |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/177> |
| #176   |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/176> |
| #175   |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/175> |
| #174   |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/174> |
| #171   |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/171> |
| #170   |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/170> |
| #169   |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/169> |
| #168   |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/168> |
| #167   |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/167> |
| #166   |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/166> |
| #165   |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/165> |
| #164   |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/164> |
| #163   |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/163> |
| #162   |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/162> |
| #161   |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/161> |
| #160   |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/160> |
| #159   |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/159> |
| #158   |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/158> |
| #157   |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/157> |
| #148   |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/148> |
| #146   |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/146> |
| #145   |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/145> |
| #144   |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/144> |
| #143   |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/143> |
| #142   |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/142> |
| #141   |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/141> |
| #140   |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/140> |
| #139   |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/139> |
| #138   |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/138> |
| #137   |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/137> |
| #136   |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/136> |
| #135   |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/135> |
| #134   |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/134> |
| #133   |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/133> |
| #132   |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/132> |
| #121   |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/121> |
| #119   |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/119> |
| #118   |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/118> |
| #117   |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/117> |
| #116   |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/116> |
| #115   |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/115> |
| #114   |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/114> |
| #111   |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/111> |
| #93    |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/93>  |
| #92    |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/92>  |
| #91    |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/91>  |
| #90    |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/90>  |
| #89    |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/89>  |

---

## 2. tar (8 alertas)

| Alerta | Severidade | Versão corrigida | Status | PR  | Link                                                                         |
| ------ | ---------- | ---------------- | ------ | --- | ---------------------------------------------------------------------------- |
| #153   |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/153> |
| #149   |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/149> |
| #131   |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/131> |
| #130   |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/130> |
| #129   |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/129> |
| #128   |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/128> |
| #127   |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/127> |
| #126   |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/126> |

---

## 3. @xmldom/xmldom (8 alertas)

| Alerta | Severidade | Versão corrigida | Status | PR  | Link                                                                        |
| ------ | ---------- | ---------------- | ------ | --- | --------------------------------------------------------------------------- |
| #85    |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/85> |
| #84    |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/84> |
| #83    |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/83> |
| #82    |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/82> |
| #81    |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/81> |
| #80    |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/80> |
| #78    |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/78> |
| #71    |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/71> |

---

## 4. vite (5 alertas)

**Versão atual:** `^6.0.0` (devDependency)

| Alerta | Severidade | Versão corrigida | Status | PR  | Link                                                                         |
| ------ | ---------- | ---------------- | ------ | --- | ---------------------------------------------------------------------------- |
| #110   |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/110> |
| #109   |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/109> |
| #108   |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/108> |
| #107   |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/107> |
| #106   |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/106> |

---

## 5. extract-zip (3 alertas)

| Alerta | Severidade | Versão corrigida | Status | PR  | Link                                                                         |
| ------ | ---------- | ---------------- | ------ | --- | ---------------------------------------------------------------------------- |
| #173   |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/173> |
| #172   |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/172> |
| #74    |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/74>  |

---

## 6. ip-address (3 alertas)

| Alerta | Severidade | Versão corrigida | Status | PR  | Link                                                                         |
| ------ | ---------- | ---------------- | ------ | --- | ---------------------------------------------------------------------------- |
| #104   |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/104> |
| #88    |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/88>  |
| #87    |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/87>  |

---

## 7. brace-expansion (3 alertas)

| Alerta | Severidade | Versão corrigida | Status | PR  | Link                                                                         |
| ------ | ---------- | ---------------- | ------ | --- | ---------------------------------------------------------------------------- |
| #102   |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/102> |
| #101   |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/101> |
| #100   |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/100> |

---

## 8. @vitest/mocker (2 alertas)

| Alerta | Severidade | Versão corrigida | Status | PR  | Link                                                                         |
| ------ | ---------- | ---------------- | ------ | --- | ---------------------------------------------------------------------------- |
| #112   |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/112> |
| #75    |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/75>  |

---

## 9. systeminformation (2 alertas)

**Versão atual:** `^5.33.13` (dependency direta)

| Alerta | Severidade | Versão corrigida | Status | PR  | Link                                                                         |
| ------ | ---------- | ---------------- | ------ | --- | ---------------------------------------------------------------------------- |
| #123   |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/123> |
| #122   |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/122> |

---

## 10. minimatch (2 alertas)

| Alerta | Severidade | Versão corrigida | Status | PR  | Link                                                                         |
| ------ | ---------- | ---------------- | ------ | --- | ---------------------------------------------------------------------------- |
| #188   |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/188> |
| #125   |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/125> |

---

## 11. vitest (1 alerta)

**Versão atual:** `^4.1.10` (devDependency)

| Alerta | Severidade | Versão corrigida | Status | PR  | Link                                                                        |
| ------ | ---------- | ---------------- | ------ | --- | --------------------------------------------------------------------------- |
| #76    |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/76> |

---

## 12. baseline-browser-mapping (1 alerta)

| Alerta | Severidade | Versão corrigida | Status | PR  | Link                                                                        |
| ------ | ---------- | ---------------- | ------ | --- | --------------------------------------------------------------------------- |
| #73    |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/73> |

---

## 13. source-map-js (1 alerta)

| Alerta | Severidade | Versão corrigida | Status | PR  | Link                                                                         |
| ------ | ---------- | ---------------- | ------ | --- | ---------------------------------------------------------------------------- |
| #105   |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/105> |

---

## 14. js-yaml (1 alerta)

| Alerta | Severidade | Versão corrigida | Status | PR  | Link                                                                        |
| ------ | ---------- | ---------------- | ------ | --- | --------------------------------------------------------------------------- |
| #86    |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/86> |

---

## 15. zod (1 alerta)

**Versão atual:** `^4.4.3` (dependency direta)

| Alerta | Severidade | Versão corrigida | Status | PR  | Link                                                                         |
| ------ | ---------- | ---------------- | ------ | --- | ---------------------------------------------------------------------------- |
| #120   |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/120> |

---

## 16. app-builder-lib (1 alerta)

| Alerta | Severidade | Versão corrigida | Status | PR  | Link                                                                         |
| ------ | ---------- | ---------------- | ------ | --- | ---------------------------------------------------------------------------- |
| #154   |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/154> |

---

## 17. builder-util-runtime (1 alerta)

| Alerta | Severidade | Versão corrigida | Status | PR  | Link                                                                         |
| ------ | ---------- | ---------------- | ------ | --- | ---------------------------------------------------------------------------- |
| #155   |            |                  | ⬜     |     | <https://github.com/FelipeMeloGomes/FM_Optimization/security/dependabot/155> |

---

## Procedimento de correção (TDD + gate)

Siga o ciclo para cada pacote:

1. **Acesse o alerta** pelo link acima e anote:
   - Severidade
   - Versão corrigida indicada pelo Dependabot
   - CVE (se houver)

2. **Atualize o `package.json`** com a versão corrigida.

3. **Rode `pnpm install`** para atualizar o `pnpm-lock.yaml`.

4. **Rode o gate de qualidade** na raiz do repo:

   ```powershell
   bun run lint && bun run typecheck && bun run test
   ```

5. **Se passar**, commit e abra um PR:

   ```powershell
   git add package.json pnpm-lock.yaml
   git commit -m "fix(deps): atualizar <pacote> para <versao>"
   git push origin beta
   ```

6. **Marque este checklist** como `✅ Corrigido` e preencha o número do PR.

---

## Prioridade sugerida

| Prioridade | Pacote                | Motivo                                                       |
| ---------- | --------------------- | ------------------------------------------------------------ |
| 🔴 Alta    | **electron**          | Dependência direta do app, 41 alertas, afeta o binário final |
| 🔴 Alta    | **systeminformation** | Dependency direta usada para detecção de hardware            |
| 🔴 Alta    | **zod**               | Dependency direta usada para validação de tipos              |
| 🟠 Média   | **vite**              | Build tool, 5 alertas                                        |
| 🟠 Média   | **vitest**            | Test runner, 1 alerta                                        |
| 🟡 Baixa   | Demais                | Dependências transitivas de build (tar, extract-zip, etc.)   |

---

**Última atualização:** $(Get-Date) — total de 100 alertas abertos.

## ✅ Já corrigido nesta sessão

| Pacote                   | Versão antes | Versão depois | Alertas fechados                               |
| ------------------------ | ------------ | ------------- | ---------------------------------------------- |
| systeminformation        | ^5.33.13     | ^5.33.16      | #123, #122                                     |
| zod                      | ^4.4.3       | ^4.6.6        | #120                                           |
| vite                     | ^6.0.0       | ^6.4.4        | #110, #109, #108, #107, #106                   |
| vitest                   | ^4.1.10      | ^4.1.11       | #76                                            |
| source-map-js            | 1.2.1        | 1.2.2         | #105                                           |
| js-yaml                  | 4.2.0        | 4.3.2         | #86                                            |
| ip-address               | 10.2.0       | 10.7.1        | #104, #88, #87                                 |
| brace-expansion          | 1.1.15       | 1.1.21        | #102                                           |
| brace-expansion          | 5.0.6        | 5.0.12        | #100                                           |
| @vitest/mocker           | 4.1.10       | 4.1.12        | #112                                           |
| baseline-browser-mapping | 2.10.38      | 2.11.0        | #73                                            |
| @xmldom/xmldom           | 0.9.10       | 0.9.12        | #85, #84, #83, #82, #81, #80, #78, #71         |
| builder-util-runtime     | 9.2.10       | 9.7.0         | #155                                           |
| minimatch                | 10.2.6       | 11.0.1        | #188                                           |
| minimatch                | 9.0.9        | 11.0.1        | #125                                           |
| tar                      | 6.2.1        | 7.5.18        | #153, #149, #131, #130, #129, #128, #127, #126 |
| app-builder-lib          | 25.1.8       | 26.15.0       | #154                                           |
| extract-zip              | 2.0.1        | 2.0.1         | #173, #172, #74 (sem versão corrigida)         |

Gate verde: `bun run lint && bun run typecheck && bun run test` ✅
