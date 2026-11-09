import { buildAddressQuery, geocodeAddress, haversineKm } from '../geocoding';

// RF018 — geocodificação via Nominatim / RF020 — filtro por raio de proximidade
describe('Geolocalização e proximidade (RF018, RF020)', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  test('[AUT-015] haversineKm calcula distâncias conhecidas', () => {
    // Esplanada (Brasília) -> Praça Cívica (Goiânia): ~173 km em linha reta
    const d = haversineKm(-15.7975, -47.8919, -16.6799, -49.255);
    expect(d).toBeGreaterThan(165);
    expect(d).toBeLessThan(185);
    expect(haversineKm(-15.8, -47.9, -15.8, -47.9)).toBe(0);
    // 0,01° de latitude ≈ 1,11 km — limite usado no filtro de 1 km
    expect(haversineKm(-15.8, -47.9, -15.81, -47.9)).toBeCloseTo(1.11, 1);
  });

  test('[AUT-016] buildAddressQuery monta a consulta e exige cidade', () => {
    expect(
      buildAddressQuery({ rua: 'SEPN 707/907', bairro: 'Asa Norte', cidade: 'Brasília', estado: 'DF' })
    ).toBe('SEPN 707/907, Asa Norte, Brasília, DF, Brasil');
    expect(buildAddressQuery({ cidade: 'Brasília' })).toBe('Brasília, Brasil');
    expect(buildAddressQuery({ rua: 'Rua A', estado: 'DF' })).toBeNull();
  });

  test('[AUT-017] geocodeAddress consulta o Nominatim restrito ao Brasil e converte as coordenadas', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ lat: '-15.7652', lon: '-47.8714' }],
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const r = await geocodeAddress('Asa Norte, Brasília, DF, Brasil');

    expect(r).toEqual({ latitude: -15.7652, longitude: -47.8714 });
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain('nominatim.openstreetmap.org/search');
    expect(url).toContain('countrycodes=br');
    expect(url).toContain('format=json');
  });

  test('[AUT-018] geocodeAddress retorna null em erro HTTP, resultado vazio ou falha de rede', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, json: async () => [] }) as unknown as typeof fetch;
    expect(await geocodeAddress('x')).toBeNull();

    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => [] }) as unknown as typeof fetch;
    expect(await geocodeAddress('x')).toBeNull();

    global.fetch = jest.fn().mockRejectedValue(new Error('offline')) as unknown as typeof fetch;
    expect(await geocodeAddress('x')).toBeNull();
  });
});
