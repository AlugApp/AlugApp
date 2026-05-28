export function haversineKm(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function geocodeAddress(
  query: string
): Promise<{ latitude: number; longitude: number } | null> {
  try {
    const params = new URLSearchParams({ q: query, format: 'json', limit: '1', countrycodes: 'br' });
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: {
        'Accept-Language': 'pt-BR,pt;q=0.9',
        'User-Agent': 'AlugApp/1.0 (projeto-integrador)',
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || data.length === 0) return null;
    return { latitude: parseFloat(data[0].lat), longitude: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
}

export function buildAddressQuery(profile: {
  rua?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
}): string | null {
  if (!profile.cidade) return null;
  const parts: string[] = [];
  if (profile.rua) parts.push(profile.rua);
  if (profile.numero) parts.push(profile.numero);
  if (profile.bairro) parts.push(profile.bairro);
  parts.push(profile.cidade);
  if (profile.estado) parts.push(profile.estado);
  parts.push('Brasil');
  return parts.join(', ');
}
