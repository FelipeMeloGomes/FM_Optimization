import type { ReactNode } from 'react';

interface SettingsPreviewLayoutProps {
  preview: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}

/** Organiza o card de ajustes com a prévia à esquerda e os controles à direita. */
export function SettingsPreviewLayout({ preview, children, footer }: SettingsPreviewLayoutProps) {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-5 md:grid-cols-[minmax(0,38%)_minmax(0,1fr)]">
        <div className="min-w-0">{preview}</div>
        <div className="min-w-0">{children}</div>
      </div>
      {footer ? <div className="border-t border-border pt-4">{footer}</div> : null}
    </div>
  );
}
