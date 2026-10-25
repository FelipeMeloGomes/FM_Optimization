import { Eye, EyeOff, KeyRound, Lock, Unlock } from 'lucide-react';
import { useState } from 'react';
import { useSettingsContext } from '../../contexts/SettingsContext';
import { ALWAYS_VISIBLE_ROUTES } from '../../lib/page-lock';
import { Input, Toggle } from '../ui';

function PasswordField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input
        type={visible ? 'text' : 'password'}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pr-10"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

const PAGES = [
  { to: '/emuladores', label: 'Emuladores' },
  { to: '/apps', label: 'Aplicativos' },
  { to: '/debloat', label: 'Debloat' },
  { to: '/essenciais', label: 'Essenciais PC' },
  { to: '/rede', label: 'Rede' },
  { to: '/cpu', label: 'Processador' },
  { to: '/input-lag', label: 'Input Lag' },
  { to: '/cleaner', label: 'Limpeza' },
  { to: '/tweaks', label: 'Ajustes' },
  { to: '/utilities', label: 'Utilitarios' },
] as const;

export function PageLockSection() {
  const { settings, update } = useSettingsContext();
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [awaitingVerify, setAwaitingVerify] = useState(false);

  const pl = settings.pageLock;
  const hasPassword = !!pl.passwordHashCipher && !!pl.salt;

  const verify = async (): Promise<boolean> => {
    const ok = await window.electronAPI.verifyPageLockPassword({ password });
    if (!ok) setError('Senha incorreta.');
    else setError(null);
    return ok;
  };

  const lockablePages = PAGES.filter((p) => !ALWAYS_VISIBLE_ROUTES.includes(p.to));

  const togglePage = (to: string) => {
    const next = pl.lockedPages.includes(to)
      ? pl.lockedPages.filter((p) => p !== to)
      : [...pl.lockedPages, to];
    update({ pageLock: { ...pl, lockedPages: next } });
  };

  const registerPassword = async () => {
    if (!newPassword || newPassword.length < 4) {
      setError('A senha precisa de pelo menos 4 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('As senhas nao coincidem.');
      return;
    }
    const { salt, passwordHashCipher } = await window.electronAPI.setPageLockPassword({
      password: newPassword,
    });
    update({ pageLock: { ...pl, salt, passwordHashCipher } });
    setError(null);
    setNewPassword('');
    setConfirmPassword('');
    setPassword('');
    setAwaitingVerify(true);
  };

  const unlockAll = async () => {
    if (await verify()) {
      update({ pageLock: { ...pl, unlocked: true } });
      setPassword('');
      setAwaitingVerify(false);
    }
  };

  const lockAll = () => {
    update({ pageLock: { ...pl, unlocked: false } });
    setError(null);
    setPassword('');
    setAwaitingVerify(false);
  };

  const revealButtonVisible = awaitingVerify && !pl.unlocked && pl.lockedPages.length > 0;

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <div className="size-1.5 rounded-full bg-amber-400" />
        <h3 className="text-sm font-semibold text-foreground">Bloqueio de Paginas</h3>
      </div>
      <div className="rounded-xl border border-border bg-card p-5">
        <Toggle
          id="page-lock-enabled"
          label="Bloqueio de paginas"
          description="Paginas bloqueadas ficam ocultas ate serem reveladas com a senha."
          checked={pl.enabled}
          onChange={(e) => update({ pageLock: { ...pl, enabled: e.target.checked } })}
        />

        <div className="mt-5 space-y-4">
          <div>
            <p className="mb-2 text-sm font-medium text-foreground">
              Paginas bloqueadas:{' '}
              {pl.lockedPages.length > 0
                ? pl.lockedPages.map((r) => r.replace('/', '')).join(', ')
                : 'nenhuma'}
            </p>

            {!hasPassword && (
              <div className="space-y-2 rounded-lg border border-border p-4">
                <p className="text-sm text-muted-foreground">
                  Cadastre uma senha para poder adicionar/remover paginas e revela-las.
                </p>
                <PasswordField
                  placeholder="Nova senha"
                  value={newPassword}
                  onChange={setNewPassword}
                />
                <PasswordField
                  placeholder="Confirmar senha"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                />
                <button
                  type="button"
                  onClick={registerPassword}
                  className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  <KeyRound className="size-4" />
                  Cadastrar senha
                </button>
              </div>
            )}

            {hasPassword && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <PasswordField
                      placeholder="Digite sua senha para gerenciar/revelar"
                      value={password}
                      onChange={setPassword}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      if (await verify()) {
                        setAwaitingVerify(true);
                        setPassword('');
                      }
                    }}
                    className="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    Entrar
                  </button>
                </div>

                {awaitingVerify && (
                  <div className="space-y-3 rounded-lg border border-border p-4">
                    <p className="text-sm font-medium text-foreground">
                      Escolha quais paginas ficam bloqueadas:
                    </p>
                    <div className="flex flex-col gap-1.5">
                      {lockablePages.map((p) => (
                        <label key={p.to} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={pl.lockedPages.includes(p.to)}
                            onChange={() => togglePage(p.to)}
                          />
                          {p.label}
                        </label>
                      ))}
                    </div>
                    {revealButtonVisible && (
                      <div className="flex gap-3 pt-2">
                        <button
                          type="button"
                          onClick={unlockAll}
                          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                        >
                          <Unlock className="size-4" />
                          Revelar paginas bloqueadas
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {pl.unlocked ? (
                  <button
                    type="button"
                    onClick={lockAll}
                    className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
                  >
                    <Lock className="size-4" />
                    Bloquear novamente
                  </button>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Paginas bloqueadas estao ocultas. Use a senha para revela-las.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      </div>
    </div>
  );
}
