/**
 * Códigos de saída compartilhados entre o processo principal e o renderer.
 *
 * Estes valores são gravados no histórico de execução (persistido), então
 * precisam de um único dono: o `normalizeInteractiveExitCode` do main grava a
 * sentinela e a página de Histórico a interpreta para rotular a linha.
 */

/** Usuário interrompeu o script interativo (Ctrl+C / janela do console fechada). */
export const EXIT_INTERRUPTED_SENTINEL = -2;
