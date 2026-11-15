# Consumo em execução — FM Optimize

Registro do que o app consome com a janela aberta e ociosa e com a janela
fechada na bandeja. Todas as linhas abaixo são medidas em build de produção
local (`bun run build` + Electron 45.3.0), não estimativas.

## Como foi medido

Harness em Python (`psutil` + `ctypes`/`SetForegroundWindow`) que:

1. lança o app com `--user-data-dir` descartável e perfil limpo;
2. força a janela para o primeiro plano a cada amostra — janela ocluída faz o
   Chromium estrangular renderização e GPU e produz medição falsa;
3. espera 40 s de assentamento (boot, `systeminformation`, primeiros renders) e
   coleta 20 amostras de 1 s de CPU por processo e memória;
4. compara versões em **trials intercalados**, invertendo a ordem a cada rodada,
   e aplica teste de permutação exato sobre as médias por trial.

A CPU é derivada de `cpu_times` (user + system) por processo, então mede o app,
não a carga da máquina. O `renderer` do Chromium oscila com ciclos de GC; por
isso a estatística de referência é o **piso** (menor média móvel de 5 s) e não a
média do período. A mediana bruta aparece só como contexto.

## Janela aberta e ociosa

O fundo animado (canvas do `CircuitBackground`, e o `BatmanBackground` no tema
Gotham) redesenhava a grade a cada frame. A/B com a mesma build, única diferença
o canvas removido do `AppLayout`, 6 trials intercalados por lado:

| Métrica (1 núcleo) | com fundo       | sem fundo        |
| ------------------ | --------------- | ---------------- |
| CPU, piso mediano  | 16,7% (13,1–21) | **3,5% (3,1–5)** |
| CPU, mediana bruta | 23,6%           | 8,4%             |
| GPU process        | 8,7%            | **0,6%**         |
| Renderer           | 5,3%            | **0,6%**         |
| Main               | 0,8%            | 0,5%             |
| RAM privada        | ~260 MB         | **~218 MB**      |

p = 0,0022 (permutação exata sobre os pisos). O fundo respondia por ~13 pontos
percentuais de um núcleo — cerca de 80% do CPU ocioso — e ~40 MB.

Depois da remoção, medida no build final com o mesmo protocolo (3 trials, 40 s de
assentamento):

| Métrica               | Valor medido                      |
| --------------------- | --------------------------------- |
| CPU, piso mediano     | 5,2% (4,8 / 5,2 / 6,4)            |
| CPU, mediana bruta    | 9,1% (6,8 / 9,1 / 13,6)           |
| Amostras ≤ 1%         | 5–20% do tempo — trechos de 0,0%  |
| GPU / renderer / main | 0,9% / 1,5% / 0,9% (piso mediano) |
| RAM privada           | 232 MB mediana (228–290)          |
| Working set           | ~525 MB                           |

O piso residual é o ocioso normal do Chromium (timers, GC, composição), não um
laço de animação: com CDP, o build final reporta `document.querySelectorAll
('canvas').length === 0` e `document.getAnimations().length === 0`.

## Janela fechada (bandeja)

Com a limpeza automática ligada, fechar a janela roda `destroy()`. A janela
deixa de existir; o app fica no main + tray.

| Métrica     | escondida (antes) | fechada na bandeja |
| ----------- | ----------------- | ------------------ |
| Processos   | 4                 | **3**              |
| RAM privada | 241–272 MB        | **89–93 MB**       |
| Working set | 394–403 MB        | **~210 MB**        |
| CPU         | 0,9–1,3%          | **0,0–0,2%**       |

Scripts finalizados com a janela fechada avisam por notificação nativa do
Windows; execuções agendadas mantêm o aviso próprio do agendador, sem duplicar.

## O que ainda não foi otimizado

- Minimizar a janela continua custando o mesmo que mantê-la aberta: o Chromium
  estrangula, mas não libera. O ganho chega ao fechar (ou esconder, quando a
  janela é destruída).
- O piso de ~5% com a janela aberta está no ocioso do Chromium. Baixar disso
  exigiria medir e cortar timers específicos, não remover UI.

## Contrato de regressão

`src/layout/AppLayout.test.tsx` renderiza o layout em SSR e falha se aparecer
`<canvas>` ou qualquer `backgroundComponent` — o teste foi verificado vermelho
antes da correção e verde depois.
