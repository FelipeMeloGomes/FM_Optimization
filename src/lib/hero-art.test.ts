import { describe, expect, it } from 'vitest';
import { ROUTES } from '../routes/config';
import { HERO_ART, heroArt } from './hero-art';

describe('hero-art', () => {
  it('oferece arte para as páginas já ilustradas', () => {
    for (const path of ['/mouse', '/teclado', '/monitor', '/meu-pc', '/armazenamento']) {
      expect(HERO_ART[path]?.image, path).toMatch(/(^data:image\/svg\+xml,|\.svg($|\?))/);
    }
    expect(HERO_ART['/mouse'].imageAlt).toBe('Ilustração de mouse gamer com iluminação RGB');
    expect(HERO_ART['/teclado'].imageAlt).toBe('Ilustração de teclado gamer com iluminação RGB');
    expect(HERO_ART['/monitor'].imageAlt).toBe('Ilustração de monitor gamer com iluminação RGB');
    expect(HERO_ART['/armazenamento'].imageAlt).toBe(
      'Ilustração de SSD NVMe M.2 com chips e contatos dourados'
    );
    expect(heroArt('/inesperado')).toBeUndefined();
  });

  it('oferece arte para a página de Otimização do Sistema', () => {
    expect(HERO_ART['/cpu']?.imageAlt).toBe('Ilustração de processador em soquete com dissipador');
    expect(HERO_ART['/cpu']?.image).toMatch(/(^data:image\/svg\+xml,|\.svg($|\?))/);
  });

  it.each([
    ['/input-lag', 'Ilustração de gamepad gamer com fio e botões'],
    ['/rede', 'Ilustração de roteador Wi-Fi com antenas e LEDs'],
    ['/personalizacao', 'Ilustração de hub RGB com botões e cabos'],
    ['/privacidade-seguranca', 'Ilustração de cofre com fechadura digital'],
    ['/reparo-do-sistema', 'Ilustração de ferro de solda e placa em bancada'],
    ['/utilities', 'Ilustração de multitool com chaves e pontas'],
  ])('oferece arte para %s', (path, alt) => {
    expect(HERO_ART[path]?.imageAlt, path).toBe(alt);
    expect(HERO_ART[path]?.image, path).toMatch(/(^data:image\/svg\+xml,|\.svg($|\?))/);
  });

  it.each([
    ['/', 'Ilustração de painel de instrumentos com mostradores e LEDs'],
    ['/otimizar-pc', 'Ilustração de cooler de processador com ventoinha RGB'],
    ['/cleaner', 'Ilustração de lata de ar comprimido com bico e jato'],
    ['/debloat', 'Ilustração de HD externo com cabo e etiquetas'],
    ['/essenciais', 'Ilustração de kit de ferramentas sobre placa-mãe'],
    ['/inicializacao', 'Ilustração de fonte de alimentação com chave e cabos'],
  ])('oferece arte para %s', (path, alt) => {
    expect(HERO_ART[path]?.imageAlt, path).toBe(alt);
    expect(HERO_ART[path]?.image, path).toMatch(/(^data:image\/svg\+xml,|\.svg($|\?))/);
  });

  it.each([
    ['/dns', 'Ilustração de servidor rack com portas e LEDs'],
    ['/velocidade', 'Ilustração de cabo Ethernet com conector RJ45'],
    ['/comparar-placa', 'Ilustração de duas placas de vídeo lado a lado'],
    ['/overlay-jogo', 'Ilustração de headset gamer com microfone'],
  ])('oferece arte para %s', (path, alt) => {
    expect(HERO_ART[path]?.imageAlt, path).toBe(alt);
    expect(HERO_ART[path]?.image, path).toMatch(/(^data:image\/svg\+xml,|\.svg($|\?))/);
  });

  it.each([
    ['/emuladores', 'Ilustração de console retrô com dois controles'],
    ['/history', 'Ilustração de arquivo de gavetas com pastas'],
    ['/restore-points', 'Ilustração de HD externo de backup com etiqueta'],
    ['/settings', 'Ilustração de console de ajustes com botões e LEDs'],
  ])('oferece arte para %s', (path, alt) => {
    expect(HERO_ART[path]?.imageAlt, path).toBe(alt);
    expect(HERO_ART[path]?.image, path).toMatch(/(^data:image\/svg\+xml,|\.svg($|\?))/);
  });

  it('tem ilustração para todas as rotas do app', () => {
    const semArte = ROUTES.map((r) => r.path).filter((path) => !HERO_ART[path]);
    expect(semArte).toEqual([]);
  });

  it('usa alt descritivo em português em toda a arte', () => {
    for (const [path, art] of Object.entries(HERO_ART)) {
      expect(art.imageAlt, path).toMatch(/^Ilustração de /);
      expect(art.image, path).toMatch(/(^data:image\/svg\+xml,|\.svg($|\?))/);
    }
  });
});
