import {
  AlertTriangle,
  Clock,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Shield,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AnimatedRestorePoints } from '../components/hero/AnimatedHero';
import { HeroBanner } from '../components/hero/HeroBanner';
import { RefreshButton } from '../components/RefreshButton';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui';
import { useRestorePointContext } from '../contexts/RestorePointContext';

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('pt-BR');
}

export default function RestorePointsPage() {
  const {
    state,
    creating,
    restoring,
    isAdmin,
    adminRequired,
    refresh,
    hasFetched,
    create,
    remove,
    restore,
  } = useRestorePointContext();
  const [newName, setNewName] = useState('');
  const [search, setSearch] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [confirmRestore, setConfirmRestore] = useState<number | null>(null);
  const [restoreDone, setRestoreDone] = useState(false);

  useEffect(() => {
    if (!hasFetched) refresh();
  }, [hasFetched, refresh]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await create(newName.trim());
    setNewName('');
  };

  const restorePoints = state.status === 'success' ? state.data : [];
  const filtered = useMemo(
    () => restorePoints.filter((rp) => rp.description.toLowerCase().includes(search.toLowerCase())),
    [restorePoints, search]
  );

  if (state.status === 'loading') {
    return (
      <div className="space-y-4">
        <div className="h-32 rounded-xl bg-muted animate-pulse" />
        <div className="h-64 rounded-xl bg-muted animate-pulse" />
      </div>
    );
  }

  if (state.status === 'error') {
    const needsAdmin = adminRequired || (!isAdmin && !state.error);
    if (needsAdmin) {
      return (
        <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
          <div className="flex size-14 items-center justify-center rounded-xl border border-warning/30 bg-warning/10">
            <ShieldAlert className="size-7 text-warning" />
          </div>
          <div className="max-w-md space-y-2">
            <p className="text-base font-semibold text-foreground">
              Permissão de administrador necessária
            </p>
            <p className="text-sm text-muted-foreground">
              Para visualizar, criar e restaurar pontos de restauração, o programa precisa ser
              executado como administrador. Feche o FM-Optimize e abra-o novamente com botão direito
              {' → '}
              <span className="font-medium text-foreground">"Executar como administrador"</span>.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={refresh}>
            Tentar novamente
          </Button>
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-20 text-muted-foreground">
        <p className="text-sm">Erro ao carregar pontos de restauração</p>
        <p className="text-xs text-destructive">{state.error}</p>
        <Button variant="outline" size="sm" onClick={refresh}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <HeroBanner visual={<AnimatedRestorePoints />}>
        <div className="relative p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Shield className="size-4 text-primary" />
                <span className="text-xs font-semibold text-primary uppercase tracking-wider">
                  Restauração
                </span>
              </div>
              <h2 className="text-lg font-bold text-foreground">
                Pontos de Restauração do Sistema
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Crie e gerencie pontos de restauração para reverter mudanças quando necessário.
              </p>
            </div>
            <Badge variant="secondary" className="text-xs px-3 py-1">
              {restorePoints.length} pontos
            </Badge>
          </div>
        </div>
      </HeroBanner>

      {/* Create Section */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="size-1.5 rounded-full bg-success" />
          <h3 className="text-sm font-semibold text-foreground">Criar Novo Ponto</h3>
        </div>
        <div className="flex items-center gap-3">
          <label htmlFor="rp-name" className="sr-only">
            Nome do ponto de restauração
          </label>
          <Input
            id="rp-name"
            placeholder="Nome do ponto de restauração…"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            className="flex-1"
          />
          <Button
            size="sm"
            onClick={handleCreate}
            disabled={creating || !newName.trim()}
            className="gap-1.5"
          >
            <Plus className="size-3.5" />
            {creating ? 'Criando…' : 'Criar'}
          </Button>
          <RefreshButton onRefresh={refresh} />
        </div>
      </div>

      <div aria-live="polite" className="sr-only">
        {creating ? 'Criando ponto de restauração…' : ''}
        {restoring ? 'Restaurando sistema…' : ''}
        {restoreDone ? 'Sistema restaurado com sucesso' : ''}
      </div>

      {/* Search and Table */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="size-1.5 rounded-full bg-primary" />
          <h3 className="text-sm font-semibold text-foreground">Pontos Existentes</h3>
        </div>

        <div className="relative mb-4">
          <Search
            className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <label htmlFor="rp-search" className="sr-only">
            Buscar pontos de restauração
          </label>
          <Input
            id="rp-search"
            placeholder="Buscar pontos de restauração…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm pl-9"
          />
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            title={
              search
                ? 'Nenhum ponto encontrado para esta busca'
                : 'Nenhum ponto de restauração encontrado'
            }
            description={
              search ? 'Tente ajustar sua busca' : 'Crie um ponto de restauração para começar'
            }
          />
        ) : (
          <div className="rounded-xl border border-border bg-card">
            <Table containerClassName="overflow-visible">
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Descrição</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((rp) => (
                  <TableRow key={rp.sequenceNumber}>
                    <TableCell className="font-medium">{rp.description}</TableCell>
                    <TableCell className="text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Clock className="size-3" />
                        {formatDate(rp.creationTime)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-[10px]">
                        {rp.eventType}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setConfirmRestore(rp.sequenceNumber)}
                          title="Restaurar sistema para este ponto"
                          aria-label={`Restaurar sistema para o ponto ${rp.description}`}
                          className="size-8"
                        >
                          <RotateCcw className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setConfirmDelete(rp.sequenceNumber)}
                          title="Excluir ponto de restauração"
                          aria-label={`Excluir o ponto ${rp.description}`}
                          className="size-8"
                        >
                          <Trash2 className="size-3.5 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Delete Dialog */}
      <Dialog
        open={confirmDelete !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmDelete(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-destructive/10">
              <AlertTriangle className="size-5 text-destructive" />
            </div>
            <p className="text-sm text-muted-foreground">
              Tem certeza que deseja excluir este ponto de restauração? Esta ação não pode ser
              desfeita.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setConfirmDelete(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={async () => {
                await remove(confirmDelete!);
                setConfirmDelete(null);
              }}
            >
              Excluir
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Restore Dialog */}
      <Dialog
        open={confirmRestore !== null || restoreDone}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmRestore(null);
            setRestoreDone(false);
          }
        }}
      >
        <DialogContent className="max-w-sm">
          {restoreDone ? (
            <>
              <DialogHeader>
                <DialogTitle>Restauração Iniciada</DialogTitle>
              </DialogHeader>
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                  <RefreshCw className="size-5 animate-spin text-primary" />
                </div>
                <p className="text-sm text-muted-foreground">
                  O sistema será restaurado e o computador será reiniciado em instantes.
                </p>
              </div>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Confirmar Restauração</DialogTitle>
              </DialogHeader>
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                  <AlertTriangle className="size-5 text-primary" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Tem certeza que deseja restaurar o sistema para este ponto? O computador será
                  reiniciado.
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setConfirmRestore(null)}>
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  disabled={restoring}
                  onClick={async () => {
                    await restore(confirmRestore!);
                    setConfirmRestore(null);
                    setRestoreDone(true);
                  }}
                >
                  {restoring ? 'Restaurando…' : 'Restaurar'}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
