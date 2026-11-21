// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SettingsPreviewLayout } from './SettingsPreviewLayout';

describe('SettingsPreviewLayout', () => {
  it('mostra a prévia antes dos controles e o rodapé depois', () => {
    render(
      <SettingsPreviewLayout
        preview={<div>PRÉVIA</div>}
        footer={<button type="button">RODAPÉ</button>}
      >
        <div>CONTROLE</div>
      </SettingsPreviewLayout>
    );

    const preview = screen.getByText('PRÉVIA');
    const control = screen.getByText('CONTROLE');
    const footer = screen.getByRole('button', { name: 'RODAPÉ' });

    expect(
      preview.compareDocumentPosition(control) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(control.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('empilha a prévia sobre os controles em telas estreitas e usa duas colunas a partir de md', () => {
    const { container } = render(
      <SettingsPreviewLayout preview={<div>PRÉVIA</div>}>
        <div>CONTROLE</div>
      </SettingsPreviewLayout>
    );

    expect(container.firstElementChild?.className).toContain('flex-col');
    expect(container.firstElementChild?.firstElementChild?.className).toContain('grid');
    expect(container.firstElementChild?.firstElementChild?.className).toContain('md:grid-cols-');
  });
});
