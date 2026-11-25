import {
  AlertTriangle,
  CalendarClock,
  FolderOpen,
  Loader2,
  Power,
  RefreshCw,
  Rocket,
  Search,
  Server,
  ShieldAlert,
  ShieldCheck,
  Square,
} from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import type {
  ScheduledTaskEntry,
  StartupAppEntry,
  StartupAppSource,
  StartupServiceEntry,
} from '../../electron/shared/ipc-types';
import { HeroBanner, HeroDescription } from '../components/hero/HeroBanner';
import { RouteIcon } from '../components/hero/RouteIcon';
import { PageSkeleton } from '../components/PageSkeleton';
import { PageRefreshBar } from '../components/RefreshButton';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Input,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
} from '../components/ui';
import { useStartup } from '../hooks/use-startup';
import { useVirtualRows } from '../hooks/use-virtual-rows';
import { HERO_ART } from '../lib/hero-art';
import { cn } from '../lib/utils';

type TabId = 'apps' | 'tasks' | 'services';

type PendingAction =
  | { type: 'disable-app'; entry: StartupAppEntry }
  | { type: 'disable-task'; entry: ScheduledTaskEntry }
  | { type: 'disable-service'; entry: StartupServiceEntry }
  | { type: 'stop-service'; entry: StartupServiceEntry };

const SOURCE_LABELS: Record<StartupAppSource, string> = {
  'registry-user': 'Usuário (Run)',
  'registry-machine': 'Sistema (Run)',
  'registry-user-32': 'Usuário (32 bits)',
  'registry-machine-32': 'Sistema (32 bits)',
  'folder-user': 'Pasta do usuário',
  'folder-machine': 'Pasta do sistema',
};

const START_MODE_LABELS: Record<StartupServiceEntry['startMode'], string> = {
  Automatic: 'Automático',
  AutomaticDelayed: 'Automático (atrasado)',
  Manual: 'Manual',
  Disabled: 'Desativado',
  Unknown: 'Desconhecido',
};

const SERVICE_STATE_LABELS: Record<StartupServiceEntry['state'], string> = {
  Running: 'Em execução',
  Stopped: 'Parado',
  Paused: 'Pausado',
  Unknown: 'Desconhecido',
};

const TABLE_ROW_HEIGHT = 69;

function normalize(value: string): string {
  return value.toLocaleLowerCase('pt-BR');
}

function matches(haystack: string[], query: string): boolean {
  if (!query) return true;
  const needle = normalize(query);
  return haystack.some((value) => normalize(value).includes(needle));
}

function pendingCopy(action: PendingAction): { title: string; description: string } {
  switch (action.type) {
    case 'disable-app':
      return {
        title: `Desativar ${action.entry.name}?`,
        description:
          'O aplicativo deixa de abrir junto com o Windows, mas continua instalado. Você pode reativar nesta mesma página.',
      };
    case 'disable-task':
      return {
        title: `Desativar ${action.entry.name}?`,
        description:
          'A tarefa deixa de rodar no logon/inicialização, mas continua registrada no Windows. Você pode reativar nesta mesma página.',
      };
    case 'disable-service':
      return {
        title: `Desativar ${action.entry.displayName}?`,
        description:
          'O serviço não inicia mais com o Windows. O tipo de início original fica guardado para a reativação ser fiel. Pode ser preciso reiniciar o PC para o efeito completo.',
      };
    case 'stop-service':
      return {
        title: `Parar ${action.entry.displayName} agora?`,
        description:
          'O serviço é interrompido apenas nesta sessão. O tipo de início não muda e ele volta a iniciar no próximo boot.',
      };
  }
}

export default function StartupPage() {
  const { state, reload, toggle, stopService, openLocation, elevate, busy } = useStartup();
  const [tab, setTab] = useState<TabId>('apps');
  const [query, setQuery] = useState('');
  const [onlyEnabled, setOnlyEnabled] = useState(true);
  const [pending, setPending] = useState<PendingAction | null>(null);

  const snapshot = state.status === 'success' ? state.data : null;

  const apps = useMemo(() => {
    if (!snapshot) return [];
    return snapshot.apps.filter(
      (app) =>
        (!onlyEnabled || app.enabled) &&
        matches([app.name, app.command, SOURCE_LABELS[app.source]], query)
    );
  }, [snapshot, onlyEnabled, query]);

  const tasks = useMemo(() => {
    if (!snapshot) return [];
    return snapshot.tasks.filter(
      (task) =>
        (!onlyEnabled || task.enabled) && matches([task.name, task.path, task.action], query)
    );
  }, [snapshot, onlyEnabled, query]);

  const services = useMemo(() => {
    if (!snapshot) return [];
    return snapshot.services.filter(
      (service) =>
        (!onlyEnabled || service.startMode !== 'Disabled') &&
        matches([service.name, service.displayName], query)
    );
  }, [snapshot, onlyEnabled, query]);

  // null = usa a rolagem da própria página (#main-content). O ref da tabela
  // é necessário para descontar a distância até o início da lista.
  const appsListRef = useRef<HTMLTableSectionElement>(null);
  const tasksListRef = useRef<HTMLTableSectionElement>(null);
  const servicesListRef = useRef<HTMLTableSectionElement>(null);

  const appsV = useVirtualRows(apps, null, TABLE_ROW_HEIGHT, appsListRef);
  const tasksV = useVirtualRows(tasks, null, TABLE_ROW_HEIGHT, tasksListRef);
  const servicesV = useVirtualRows(services, null, TABLE_ROW_HEIGHT, servicesListRef);

  if (state.status === 'loading') {
    return <PageSkeleton layout="startup" label="Carregando inicialização…" />;
  }

  if (state.status === 'error') {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-20 text-center text-muted-foreground">
        <AlertTriangle className="size-8 text-warning" />
        <p className="text-sm">Erro ao ler a inicialização do Windows</p>
        <p className="max-w-md text-xs text-destructive">{state.error}</p>
        <Button variant="outline" size="sm" onClick={reload} className="mt-2 gap-1.5">
          <RefreshCw className="size-3.5" />
          Tentar novamente
        </Button>
      </div>
    );
  }

  const data = state.data;

  const tabItems = [
    {
      id: 'apps',
      label: 'Inicialização',
      count: data.apps.length,
      icon: <Rocket className="size-3.5" />,
    },
    {
      id: 'tasks',
      label: 'Tarefas agendadas',
      count: data.tasks.length,
      icon: <CalendarClock className="size-3.5" />,
    },
    {
      id: 'services',
      label: 'Serviços',
      count: data.services.length,
      icon: <Server className="size-3.5" />,
    },
  ];

  const confirmPending = async () => {
    if (!pending) return;
    const action = pending;

    const success =
      action.type === 'stop-service'
        ? await stopService(action.entry.id, action.entry.displayName)
        : await toggle(
            {
              kind:
                action.type === 'disable-app'
                  ? 'app'
                  : action.type === 'disable-task'
                    ? 'task'
                    : 'service',
              id: action.entry.id,
              enabled: false,
            },
            action.type === 'disable-service' ? action.entry.displayName : action.entry.name
          );

    if (success) setPending(null);
  };

  const copy = pending ? pendingCopy(pending) : null;

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <HeroBanner {...HERO_ART['/inicializacao']}>
        <div className="relative p-6">
          <div className="flex items-center gap-2 mb-2">
            <RouteIcon path="/inicializacao" />
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">
              Inicialização
            </span>
          </div>
          <h2 className="text-lg font-bold text-foreground">Controle o que abre com o Windows</h2>
          <HeroDescription text="Aplicativos, tarefas agendadas e serviços que iniciam junto com o sistema. Tudo é reversível: nada é desinstalado, e cada item pode voltar ao estado anterior." />
        </div>
      </HeroBanner>

      <PageRefreshBar onRefresh={reload} />

      {/* Admin notice */}
      {!data.isAdmin && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-warning/20 bg-warning/5 p-4">
          <ShieldAlert className="size-5 shrink-0 text-warning" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-warning">Sem permissão de administrador</p>
            <p className="text-xs text-muted-foreground">
              Itens do sistema (HKLM, pastas de todos os usuários, tarefas e serviços) aparecem, mas
              não podem ser alterados. Reinicie o app elevado para controlá-los.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={elevate} className="gap-1.5">
            <ShieldCheck className="size-3.5" />
            Reiniciar como admin
          </Button>
        </div>
      )}

      {/* Tabs + filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          ariaLabel="Seções da inicialização"
          items={tabItems}
          value={tab}
          onChange={(id) => {
            setTab(id as TabId);
            setQuery('');
            setOnlyEnabled(true);
          }}
        />
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <div className="relative w-full sm:w-56">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar…"
              className="h-9 w-full pl-8"
              aria-label="Buscar na lista"
            />
          </div>
          <Button
            variant={onlyEnabled ? 'default' : 'outline'}
            size="sm"
            onClick={() => setOnlyEnabled((value) => !value)}
            aria-pressed={onlyEnabled}
          >
            <Power className="size-3.5" />
            {tab === 'services' ? 'Só automáticos' : 'Só ativos'}
          </Button>
        </div>
      </div>

      {/* Apps */}
      {tab === 'apps' && (
        <div className="rounded-xl border border-border bg-card">
          {apps.length === 0 ? (
            <EmptyState
              icon={<Rocket className="size-8" />}
              title="Nenhum aplicativo encontrado"
              description={
                query
                  ? 'Ajuste a busca ou limpe o filtro para ver a lista completa.'
                  : 'O Windows não tem aplicativos registrados na inicialização.'
              }
            />
          ) : (
            <Table className="table-fixed" containerClassName="overflow-visible">
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow>
                  <TableHead>Aplicativo</TableHead>
                  <TableHead className="w-32 sm:w-40">Origem</TableHead>
                  <TableHead className="w-28 sm:w-36">Status</TableHead>
                  <TableHead className="w-20 text-right sm:w-28">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody ref={appsListRef}>
                {appsV.paddingTop > 0 && (
                  <tr style={{ height: appsV.paddingTop }}>
                    <td colSpan={4} />
                  </tr>
                )}
                {appsV.virtualItems.map((virtualRow) => {
                  const app = apps[virtualRow.index];
                  const locked = app.requiresAdmin && !data.isAdmin;
                  return (
                    <TableRow key={app.id} data-index={virtualRow.index} ref={appsV.measureElement}>
                      <TableCell>
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="truncate font-medium text-foreground" title={app.name}>
                            {app.name}
                          </span>
                          {app.requiresAdmin && (
                            <Badge
                              variant="outline"
                              className="shrink-0 border-warning/40 text-[10px] text-warning"
                            >
                              Admin
                            </Badge>
                          )}
                        </div>
                        <span
                          className="block truncate font-mono text-[10px] text-muted-foreground"
                          title={app.command}
                        >
                          {app.command || '—'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="whitespace-nowrap text-[10px]">
                          {SOURCE_LABELS[app.source]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={app.enabled}
                            disabled={busy[app.id] === true || locked}
                            onCheckedChange={(checked) => {
                              if (!checked) {
                                setPending({ type: 'disable-app', entry: app });
                              } else {
                                void toggle({ kind: 'app', id: app.id, enabled: true }, app.name);
                              }
                            }}
                            aria-label={`${app.enabled ? 'Desativar' : 'Ativar'} ${app.name}`}
                          />
                          <span className="whitespace-nowrap text-[11px] text-muted-foreground">
                            {app.enabled ? 'Ativo' : 'Desativado'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={!app.location}
                          onClick={() => void openLocation(app.id)}
                          className="gap-1.5"
                          title="Abrir local"
                        >
                          <FolderOpen className="size-3.5 shrink-0" />
                          <span className="hidden sm:inline">Local</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {appsV.paddingBottom > 0 && (
                  <tr style={{ height: appsV.paddingBottom }}>
                    <td colSpan={4} />
                  </tr>
                )}
              </TableBody>
            </Table>
          )}
        </div>
      )}

      {/* Scheduled tasks */}
      {tab === 'tasks' && (
        <div className="rounded-xl border border-border bg-card">
          {tasks.length === 0 ? (
            <EmptyState
              icon={<CalendarClock className="size-8" />}
              title="Nenhuma tarefa encontrada"
              description={
                query
                  ? 'Ajuste a busca ou limpe o filtro para ver a lista completa.'
                  : 'Nenhuma tarefa com gatilho de logon ou inicialização foi encontrada.'
              }
            />
          ) : (
            <Table className="table-fixed" containerClassName="overflow-visible">
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow>
                  <TableHead>Tarefa</TableHead>
                  <TableHead className="w-28 sm:w-36">Gatilho</TableHead>
                  <TableHead className="hidden w-40 lg:table-cell xl:w-64">Ação</TableHead>
                  <TableHead className="w-28 sm:w-36">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody ref={tasksListRef}>
                {tasksV.paddingTop > 0 && (
                  <tr style={{ height: tasksV.paddingTop }}>
                    <td colSpan={4} />
                  </tr>
                )}
                {tasksV.virtualItems.map((virtualRow) => {
                  const task = tasks[virtualRow.index];
                  const locked = !data.isAdmin;
                  return (
                    <TableRow
                      key={task.id}
                      data-index={virtualRow.index}
                      ref={tasksV.measureElement}
                    >
                      <TableCell>
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="truncate font-medium text-foreground" title={task.name}>
                            {task.name}
                          </span>
                          {task.isMicrosoft && (
                            <Badge variant="outline" className="shrink-0 text-[10px]">
                              Microsoft
                            </Badge>
                          )}
                          {locked && (
                            <Badge
                              variant="outline"
                              className="shrink-0 border-warning/40 text-[10px] text-warning"
                            >
                              Admin
                            </Badge>
                          )}
                        </div>
                        <span
                          className="block truncate font-mono text-[10px] text-muted-foreground"
                          title={task.path}
                        >
                          {task.path}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="whitespace-nowrap text-[10px]">
                          {task.trigger === 'logon' ? 'No logon' : 'Na inicialização'}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <span
                          className="block truncate font-mono text-[11px] text-muted-foreground"
                          title={task.action}
                        >
                          {task.action || '—'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={task.enabled}
                            disabled={busy[task.id] === true || locked}
                            onCheckedChange={(checked) => {
                              if (!checked) {
                                setPending({ type: 'disable-task', entry: task });
                              } else {
                                void toggle(
                                  { kind: 'task', id: task.id, enabled: true },
                                  task.name
                                );
                              }
                            }}
                            aria-label={`${task.enabled ? 'Desativar' : 'Ativar'} ${task.name}`}
                          />
                          <span className="whitespace-nowrap text-[11px] text-muted-foreground">
                            {task.enabled ? 'Ativa' : 'Desativada'}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {tasksV.paddingBottom > 0 && (
                  <tr style={{ height: tasksV.paddingBottom }}>
                    <td colSpan={4} />
                  </tr>
                )}
              </TableBody>
            </Table>
          )}
        </div>
      )}

      {/* Services */}
      {tab === 'services' && (
        <div className="rounded-xl border border-border bg-card">
          {services.length === 0 ? (
            <EmptyState
              icon={<Server className="size-8" />}
              title="Nenhum serviço encontrado"
              description={
                query
                  ? 'Ajuste a busca ou limpe o filtro para ver a lista completa.'
                  : 'Nenhum serviço automático ou desativado foi encontrado.'
              }
            />
          ) : (
            <Table className="table-fixed" containerClassName="overflow-visible">
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow>
                  <TableHead>Serviço</TableHead>
                  <TableHead className="w-32 sm:w-40">Início</TableHead>
                  <TableHead className="hidden w-32 lg:table-cell">Estado</TableHead>
                  <TableHead className="w-28 sm:w-36">Status</TableHead>
                  <TableHead className="w-20 text-right sm:w-28">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody ref={servicesListRef}>
                {servicesV.paddingTop > 0 && (
                  <tr style={{ height: servicesV.paddingTop }}>
                    <td colSpan={5} />
                  </tr>
                )}
                {servicesV.virtualItems.map((virtualRow) => {
                  const service = services[virtualRow.index];
                  const locked = !data.isAdmin || service.protected;
                  return (
                    <TableRow
                      key={service.id}
                      data-index={virtualRow.index}
                      ref={servicesV.measureElement}
                    >
                      <TableCell>
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className="truncate font-medium text-foreground"
                            title={service.displayName}
                          >
                            {service.displayName}
                          </span>
                          {service.protected && (
                            <Badge
                              variant="outline"
                              className="shrink-0 gap-1 border-success/40 text-[10px] text-success"
                            >
                              <ShieldCheck className="size-3" />
                              Protegido
                            </Badge>
                          )}
                          {!service.protected && !data.isAdmin && (
                            <Badge
                              variant="outline"
                              className="shrink-0 border-warning/40 text-[10px] text-warning"
                            >
                              Admin
                            </Badge>
                          )}
                        </div>
                        <span className="block truncate font-mono text-[10px] text-muted-foreground">
                          {service.name}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={cn(
                            'whitespace-nowrap text-[10px]',
                            service.startMode === 'Disabled' && 'text-muted-foreground'
                          )}
                        >
                          {START_MODE_LABELS[service.startMode]}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1.5 whitespace-nowrap text-[11px]',
                            service.state === 'Running' ? 'text-success' : 'text-muted-foreground'
                          )}
                        >
                          <span
                            className={cn(
                              'size-1.5 shrink-0 rounded-full',
                              service.state === 'Running' ? 'bg-success' : 'bg-muted-foreground'
                            )}
                          />
                          {SERVICE_STATE_LABELS[service.state]}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={service.startMode !== 'Disabled'}
                            disabled={busy[service.id] === true || locked}
                            onCheckedChange={(checked) => {
                              if (!checked) {
                                setPending({ type: 'disable-service', entry: service });
                              } else {
                                void toggle(
                                  { kind: 'service', id: service.id, enabled: true },
                                  service.displayName
                                );
                              }
                            }}
                            aria-label={`${service.startMode === 'Disabled' ? 'Ativar' : 'Desativar'} ${service.displayName}`}
                          />
                          <span className="whitespace-nowrap text-[11px] text-muted-foreground">
                            {service.startMode === 'Disabled' ? 'Desativado' : 'Ativo'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={
                            service.protected ||
                            !data.isAdmin ||
                            service.state !== 'Running' ||
                            busy[service.id] === true
                          }
                          onClick={() => setPending({ type: 'stop-service', entry: service })}
                          className="gap-1.5"
                          title="Parar agora"
                        >
                          {busy[service.id] ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Square className="size-3.5 shrink-0" />
                          )}
                          <span className="hidden sm:inline">
                            {busy[service.id] ? 'Carregando…' : 'Parar'}
                          </span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {servicesV.paddingBottom > 0 && (
                  <tr style={{ height: servicesV.paddingBottom }}>
                    <td colSpan={5} />
                  </tr>
                )}
              </TableBody>
            </Table>
          )}
        </div>
      )}

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        As alterações valem para o próximo logon/inicialização. Serviços protegidos (RPC, segurança,
        áudio, rede e afins) ficam somente leitura para evitar que o Windows deixe de iniciar. Nada
        é desinstalado: desativar apenas impede o início automático.
      </p>

      {/* Confirm dialog */}
      <Dialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="mb-1 flex size-10 items-center justify-center rounded-xl bg-warning/10">
              <AlertTriangle className="size-5 text-warning" />
            </div>
            <DialogTitle>{copy?.title}</DialogTitle>
            <DialogDescription>{copy?.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setPending(null)}>
              Cancelar
            </Button>
            <Button
              variant={pending?.type === 'stop-service' ? 'destructive' : 'default'}
              size="sm"
              onClick={() => void confirmPending()}
              disabled={pending !== null && busy[pending.entry.id] === true}
              className="gap-1.5"
            >
              {pending !== null && busy[pending.entry.id] ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : pending?.type === 'stop-service' ? (
                <Square className="size-3.5" />
              ) : (
                <Power className="size-3.5" />
              )}
              {pending !== null && busy[pending.entry.id]
                ? 'Carregando…'
                : pending?.type === 'stop-service'
                  ? 'Parar agora'
                  : 'Desativar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
