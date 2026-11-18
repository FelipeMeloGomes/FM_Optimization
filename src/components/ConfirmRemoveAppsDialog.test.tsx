// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AppxPackageInfo } from '../../electron/shared/ipc-types';
import { ConfirmRemoveAppsDialog } from './ConfirmRemoveAppsDialog';

function app(overrides: Partial<AppxPackageInfo> = {}): AppxPackageInfo {
  return {
    familyName: 'Microsoft.XboxGamingOverlay_8wekyb3d8bbwe',
    packageName: 'Microsoft.XboxGamingOverlay',
    displayName: 'Xbox Game Bar',
    version: '1.0.0.0',
    publisher: 'CN=Microsoft',
    isFramework: false,
    isProvisioned: false,
    removable: true,
    recommended: true,
    ...overrides,
  };
}

describe('ConfirmRemoveAppsDialog', () => {
  it('lista os apps selecionados e avisa que não é reversível', () => {
    render(
      <ConfirmRemoveAppsDialog
        open
        onOpenChange={() => {}}
        apps={[
          app(),
          app({
            familyName: 'Microsoft.SkypeApp_kzf8qxf38zg5c',
            packageName: 'Microsoft.SkypeApp',
            displayName: 'Skype',
          }),
        ]}
        onConfirm={() => {}}
      />
    );

    expect(screen.getByText('Remover apps selecionados')).not.toBeNull();
    expect(screen.getByText('2 apps selecionados')).not.toBeNull();
    expect(screen.getByText('Xbox Game Bar')).not.toBeNull();
    expect(screen.getByText('Skype')).not.toBeNull();
    expect(screen.getByText(/não pode ser desfeita/i)).not.toBeNull();
    expect(screen.getByText(/podem ser reinstalados/i)).not.toBeNull();

    const list = screen.getByRole('list');
    expect(list.className).toContain('overscroll-contain');
    const familyName = screen.getByText('Microsoft.XboxGamingOverlay_8wekyb3d8bbwe');
    expect(familyName.getAttribute('title')).toBe('Microsoft.XboxGamingOverlay_8wekyb3d8bbwe');
  });

  it('usa singular para um único app', () => {
    render(
      <ConfirmRemoveAppsDialog open onOpenChange={() => {}} apps={[app()]} onConfirm={() => {}} />
    );

    expect(screen.getByText('1 app selecionado')).not.toBeNull();
  });

  it('só remove ao confirmar', () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <ConfirmRemoveAppsDialog
        open
        onOpenChange={onOpenChange}
        apps={[app()]}
        onConfirm={onConfirm}
      />
    );

    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Remover apps/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
