import {
  AlertTriangle,
  Check,
  Download,
  ExternalLink,
  RefreshCw,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type {
  DownloadProgress,
  UpdateInfo,
  UpdateStatus,
} from '../../../electron/shared/ipc-types';
import { Button, Progress } from '../ui';

const DOWNLOAD_PAGE_URL = 'https://fmoptimize.vercel.app';

interface UpdatesSectionProps {
  appVersion: string;
  packaged: boolean;
}

export function UpdatesSection({ appVersion, packaged }: UpdatesSectionProps) {
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const unsubStatus = window.electronAPI.onUpdateStatus((s) => {
      setStatus(s);
      if (s === 'error') setErrorMsg('Falha ao verificar atualizacoes.');
    });
    const unsubInfo = window.electronAPI.onUpdateInfo((info) => {
      setUpdateInfo(info);
    });
    const unsubProgress = window.electronAPI.onDownloadProgress((p) => {
      setProgress(p);
      setStatus('downloading');
    });
    return () => {
      unsubStatus();
      unsubInfo();
      unsubProgress();
    };
  }, []);

  function handleCheck() {
    setStatus('checking');
    setUpdateInfo(null);
    setProgress(null);
    setErrorMsg('');
    window.electronAPI.checkForUpdate().catch(() => {
      setStatus(packaged ? 'error' : 'not-available');
      if (packaged) setErrorMsg('Falha ao verificar atualizacoes.');
    });
  }

  function handleDownload() {
    window.electronAPI.downloadUpdate().catch(() => {
      setStatus('error');
      setErrorMsg('Falha ao baixar atualizacao.');
    });
  }

  function handleInstall() {
    window.electronAPI.installUpdate();
  }

  function handleOpenDownloadPage() {
    window.open(DOWNLOAD_PAGE_URL, '_blank');
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <div className="size-1.5 rounded-full bg-emerald-400" />
        <h3 className="text-sm font-semibold text-foreground">Atualizacoes</h3>
      </div>
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
            <Sparkles className="size-4 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Versao atual</p>
            <p className="text-sm font-semibold text-foreground">{appVersion || '...'}</p>
          </div>
        </div>

        {status === 'checking' && (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center gap-3 rounded-lg bg-muted/50 p-3"
          >
            <RefreshCw className="size-4 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Verificando atualizacoes...</p>
          </div>
        )}

        {status === 'not-available' && (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3"
          >
            <Check className="size-4 text-emerald-400" />
            <p className="text-sm text-emerald-400">Voce ja esta na versao mais recente.</p>
          </div>
        )}

        {status === 'available' && updateInfo && (
          <div
            role="status"
            aria-live="polite"
            className="rounded-lg border border-primary/20 bg-primary/5 p-4"
          >
            <div className="mb-2 flex items-center gap-2">
              <Download className="size-4 text-primary" />
              <p className="text-sm font-medium text-foreground">
                Nova versao <span className="text-primary">v{updateInfo.version}</span> disponivel!
              </p>
            </div>
            <Button onClick={handleDownload} size="sm" className="gap-1.5">
              <Download className="size-3.5" />
              Baixar atualizacao
            </Button>
          </div>
        )}

        {status === 'downloading' && progress && (
          <div
            role="status"
            aria-live="polite"
            className="rounded-lg border border-primary/20 bg-primary/5 p-4"
          >
            <div className="mb-3 flex items-center gap-2">
              <RefreshCw className="size-4 animate-spin text-primary" />
              <p className="text-sm font-medium text-foreground">Baixando atualizacao...</p>
            </div>
            <Progress value={Math.round(progress.percent)} className="mb-2 h-2" />
            <p className="text-xs text-muted-foreground">
              {Math.round(progress.percent)}% ({(progress.transferred / 1024 / 1024).toFixed(1)}/
              {(progress.total / 1024 / 1024).toFixed(1)} MB)
            </p>
          </div>
        )}

        {status === 'ready' && (
          <div
            role="status"
            aria-live="polite"
            className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4"
          >
            <div className="mb-3 flex items-center gap-2">
              <Check className="size-4 text-emerald-400" />
              <p className="text-sm font-medium text-emerald-400">
                Atualizacao baixada com sucesso!
              </p>
            </div>
            <Button onClick={handleInstall} size="sm" className="gap-1.5">
              <RotateCcw className="size-3.5" />
              Reiniciar e instalar
            </Button>
          </div>
        )}

        {status === 'error' && (
          <div
            role="alert"
            className="rounded-lg border border-destructive/20 bg-destructive/10 p-4"
          >
            <div className="mb-3 flex items-center gap-2">
              <AlertTriangle className="size-4 text-destructive" />
              <p className="text-sm font-medium text-destructive">{errorMsg}</p>
            </div>
            <Button onClick={handleCheck} variant="secondary" size="sm" className="gap-1.5">
              <RefreshCw className="size-3.5" />
              Tentar novamente
            </Button>
          </div>
        )}

        {status === null && (
          <div className="flex gap-2">
            <Button onClick={handleCheck} size="sm" className="gap-1.5">
              <RefreshCw className="size-3.5" />
              Verificar atualizacoes
            </Button>
            {!packaged && (
              <Button
                onClick={handleOpenDownloadPage}
                variant="outline"
                size="sm"
                className="gap-1.5"
              >
                <ExternalLink className="size-3.5" />
                Pagina de download
              </Button>
            )}
          </div>
        )}

        {(status === 'not-available' || status === 'error') && (
          <div className="mt-3 flex gap-2">
            <Button onClick={handleCheck} variant="outline" size="sm" className="gap-1.5">
              <RefreshCw className="size-3.5" />
              Verificar novamente
            </Button>
            {!packaged && (
              <Button
                onClick={handleOpenDownloadPage}
                variant="ghost"
                size="sm"
                className="gap-1.5"
              >
                <ExternalLink className="size-3.5" />
                Pagina de download
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
