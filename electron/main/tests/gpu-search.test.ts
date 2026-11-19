import { describe, expect, it, vi } from 'vitest';
import { buildGpuSlug, searchGpu } from '../services/gpu-search';

const html = `
  <h4>Passmark</h4>
  <div class="avarage">19477</div><div class="samples_text">Amostras: 29742</div>
  <tr><td>Arquitetura</td><td><em class="blue">Ada Lovelace (2022−2024)</em></td></tr>
  <tr><td>Nome do código</td><td><em class="blue">AD107</em></td></tr>
  <tr><td>Capacidade máxima de memória RAM</td><td><em class="blue">8 GB</em></td></tr>
  <tr><td>Tipo de memória</td><td><em class="blue">GDDR6</em></td></tr>
  <tr><td>Largura do barramento de memória</td><td><em class="blue">128 Bit</em></td></tr>
  <tr><td>Largura de banda de memória</td><td><em class="blue">272.0 GB/s</em></td></tr>
  <tr><td>Consumo de energia (TDP)</td><td><em class="blue">115 Watt</em></td></tr>
  <tr><td>Frequência em modo Boost</td><td><em class="blue">2460 MHz</em></td></tr>
  <tr><td>Quantidade de processadores de sombreamento</td><td><em class="blue">3072</em></td></tr>
  <tr><td>Processo tecnológico de fabricação</td><td><em class="blue">5 nm</em></td></tr>
  <tr><td>Data de lançamento</td><td><em class="blue">18 de Maio 2023</em></td></tr>
`;

function htmlResponse(body: string, ok = true): Response {
  return { ok, status: ok ? 200 : 404, text: async () => body } as Response;
}

describe('buildGpuSlug', () => {
  it('remove o fabricante e normaliza sufixos de VRAM', () => {
    expect(buildGpuSlug('NVIDIA GeForce RTX 4060 Ti 16GB')).toBe('GeForce-RTX-4060-Ti-16-GB');
    expect(buildGpuSlug('AMD Radeon RX 7600')).toBe('Radeon-RX-7600');
  });

  it('nunca deixa a entrada escapar do caminho da URL', () => {
    const slug = buildGpuSlug('../../admin?x=1');
    expect(slug).toMatch(/^[a-zA-Z0-9-]+$/);
    expect(slug).not.toContain('..');
    expect(buildGpuSlug('')).toBeNull();
    expect(buildGpuSlug('!!!')).toBeNull();
  });
});

describe('searchGpu', () => {
  it('busca a página do modelo e extrai specs e pontuação', async () => {
    const fetchFn = vi.fn(async () => htmlResponse(html));

    const gpu = await searchGpu('NVIDIA GeForce RTX 4060', { fetchFn });

    expect(fetchFn).toHaveBeenCalledWith(
      'https://technical.city/pt/gpu/GeForce-RTX-4060',
      expect.objectContaining({ headers: expect.any(Object) })
    );
    expect(gpu).toMatchObject({
      id: 'geforce-rtx-4060',
      name: 'GeForce RTX 4060',
      manufacturer: 'NVIDIA',
      architecture: 'Ada Lovelace',
      vramGb: 8,
      vramType: 'GDDR6',
      memoryBusBits: 128,
      memoryBandwidthGbps: 272,
      tdpWatts: 115,
      boostClockMhz: 2460,
      shaderCount: 3072,
      processNm: 5,
      releaseYear: 2023,
      performanceScore: 19477,
    });
  });

  it('devolve null quando a página não tem PassMark', async () => {
    const fetchFn = vi.fn(async () => htmlResponse('<h1>Modelo desconhecido</h1>'));

    await expect(searchGpu('Radeon RX 9990', { fetchFn })).resolves.toBeNull();
  });

  it('devolve null em erro de rede ou HTTP', async () => {
    const offline = vi.fn(async () => {
      throw new Error('offline');
    });
    const notFound = vi.fn(async () => htmlResponse('', false));

    await expect(searchGpu('Arc A770', { fetchFn: offline })).resolves.toBeNull();
    await expect(searchGpu('Arc A770', { fetchFn: notFound })).resolves.toBeNull();
  });
});
