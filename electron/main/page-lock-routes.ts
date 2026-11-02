/**
 * Migracao das rotas de Page Lock.
 *
 * A reorganizacao removeu `/tweaks` (Ajustes) e `/apps` (Aplicativos). Sem esta
 * migracao, um `lockedPages` antigo continuaria valido em disco mas nao
 * corresponderia a nenhuma pagina: o bloqueio simplesmente pararia de valer e o
 * usuario nao seria avisado. A conversao e feita na leitura das configuracoes,
 * com expansao das rotas removidas para todas as paginas que herdaram os seus
 * scripts — bloquear mais e seguro, desbloquear em silencio nao e.
 *
 * `/tweaks` deu origem a quatro paginas: os scripts da antiga pagina Ajustes
 * foram redistribuidos entre Desempenho (`/cpu`), Rede, Utilitarios e
 * Personalizacao. `/apps` virou Privacidade, que absorveu `apps-1`/`apps-2`.
 *
 * Rota desconhecida nao e descartada nem convertida em `/`: fica exatamente como
 * esta. Assim uma configuracao de outra versao (ou editada a mao) nao perde
 * bloqueios por causa de uma migracao que nao conhece o destino.
 */
const LEGACY_PAGE_ROUTES: Record<string, string[]> = {
  '/tweaks': ['/cpu', '/rede', '/utilities', '/personalizacao'],
  '/apps': ['/privacidade-seguranca'],
};

export interface LockedPagesMigration {
  lockedPages: string[];
  /** True quando a lista mudou e precisa ser regravada. */
  changed: boolean;
}

/**
 * Idempotente: rodar de novo sobre o resultado nao altera nada e devolve
 * `changed: false`. Duplicatas tambem sao removidas, preservando a ordem da
 * primeira ocorrencia.
 */
export function migrateLockedPages(lockedPages: readonly string[]): LockedPagesMigration {
  const seen = new Set<string>();
  const migrated: string[] = [];

  for (const page of lockedPages) {
    if (seen.has(page)) continue;

    const replacements = LEGACY_PAGE_ROUTES[page];
    if (!replacements) {
      seen.add(page);
      migrated.push(page);
      continue;
    }

    for (const replacement of replacements) {
      if (seen.has(replacement)) continue;
      seen.add(replacement);
      migrated.push(replacement);
    }
  }

  const changed =
    migrated.length !== lockedPages.length || migrated.some((page, i) => page !== lockedPages[i]);

  return { lockedPages: migrated, changed };
}
