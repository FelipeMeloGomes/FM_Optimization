import { Terminal } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useScriptContext } from '../contexts/ScriptContext';
import { useSystemContext } from '../contexts/SystemContext';
import { getScriptRoute } from '../lib/category-routes';
import { getRamScriptId } from '../lib/ram-script';
import { cn } from '../lib/utils';
import { plural } from '../utils/format';
import { ScriptBadge } from './ScriptBadge';
import { SearchInput } from './ui/SearchInput';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { state, filteredScripts } = useScriptContext();
  const { state: systemState } = useSystemContext();

  const userRamGb = useMemo<number | null>(() => {
    if (systemState.status !== 'success') return null;
    const match = systemState.data.memory.total.match(/(\d+(?:\.\d+)?)/);
    return match ? parseFloat(match[1]) : null;
  }, [systemState]);

  const recommendedRamScriptId = useMemo<string | null>(() => {
    if (!userRamGb) return null;
    return getRamScriptId(userRamGb);
  }, [userRamGb]);

  const scripts = useMemo(() => {
    if (state.status !== 'success') return [];

    return filteredScripts.filter((script) => {
      // --- Filtro RAM (subcategory RAM) ---
      if (script.subcategory === 'RAM') {
        // Script de reset (cpu-37) sempre visível
        if (script.id === 'cpu-37') return true;

        // Só mostrar script da tier exata do usuário
        if (recommendedRamScriptId && script.id !== recommendedRamScriptId) {
          return false;
        }

        // Se não conseguiu detectar RAM, esconder scripts RAM-specific (exceto reset)
        if (!userRamGb) return false;
      }

      return true;
    });
  }, [state.status, filteredScripts, userRamGb, recommendedRamScriptId]);

  const filtered = useMemo(() => {
    if (!query.trim()) return scripts;
    const q = query.toLowerCase();
    return scripts.filter(
      (s) => s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q)
    );
  }, [scripts, query]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' && filtered[selectedIndex]) {
        navigate(getScriptRoute(filtered[selectedIndex]));
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filtered, selectedIndex, navigate, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      <button
        type="button"
        aria-label="Fechar busca"
        onClick={onClose}
        className="fixed inset-0 bg-overlay/50"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Busca rápida"
        className="relative z-10 w-full max-w-lg rounded-xl border border-border bg-card shadow-2xl"
      >
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <SearchInput
            ariaLabel="Buscar tweaks"
            bare
            type="text"
            inputRef={inputRef}
            wrapperClassName="flex-1"
            role="combobox"
            aria-expanded="true"
            aria-controls="command-palette-results"
            aria-activedescendant={
              filtered.length > 0 ? `command-palette-option-${selectedIndex}` : undefined
            }
            placeholder="Buscar tweaks…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          />
          <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
            ESC
          </kbd>
        </div>
        <p aria-live="polite" className="sr-only">
          {plural(filtered.length, 'resultado', 'resultados')}
        </p>
        <div
          id="command-palette-results"
          role="listbox"
          aria-label="Resultados da busca"
          className="max-h-[60vh] overflow-y-auto overscroll-contain p-2"
        >
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground" role="status">
              Nenhum resultado encontrado
            </div>
          ) : (
            filtered.map((script, index) => (
              <button
                type="button"
                role="option"
                id={`command-palette-option-${index}`}
                aria-selected={index === selectedIndex}
                key={script.id}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                  index === selectedIndex
                    ? 'bg-primary/10 text-foreground'
                    : 'text-foreground hover:bg-muted'
                )}
                onClick={() => {
                  navigate(getScriptRoute(script));
                  onClose();
                }}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <Terminal className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <div title={script.name} className="truncate font-medium">
                    {script.name}
                  </div>
                  <div title={script.category} className="truncate text-xs text-muted-foreground">
                    {script.category}
                  </div>
                </div>
                <ScriptBadge script={script} />
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
