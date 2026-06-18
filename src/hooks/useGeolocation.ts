import { useState, useCallback } from 'react';

interface GeolocationState {
  latitude: number | null;
  longitude: number | null;
  error: string | null;
  loading: boolean;
}

export interface Coords {
  latitude: number;
  longitude: number;
}

function describeError(err: GeolocationPositionError): string {
  switch (err.code) {
    case err.PERMISSION_DENIED:
      return 'Permissão negada pelo navegador. Clique no ícone de cadeado na barra de endereço e permita a localização.';
    case err.POSITION_UNAVAILABLE:
      return 'Localização indisponível. Verifique se os serviços de localização estão ativos em Configurações do Windows → Privacidade → Localização.';
    case err.TIMEOUT:
      return 'Tempo esgotado ao obter a localização. Tente novamente.';
    default:
      return 'Erro ao obter localização.';
  }
}

export function useGeolocation() {
  const [state, setState] = useState<GeolocationState>({
    latitude: null,
    longitude: null,
    error: null,
    loading: false,
  });

  // Retorna uma Promise com as coordenadas (ou null em caso de falha).
  // Permite que o chamador *aguarde* o GPS resolver — essencial no submit de um anúncio.
  const getPosition = useCallback((): Promise<Coords | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        setState(s => ({ ...s, error: 'Geolocalização não suportada neste dispositivo.', loading: false }));
        resolve(null);
        return;
      }
      setState(s => ({ ...s, loading: true, error: null }));
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
          const c = { latitude: coords.latitude, longitude: coords.longitude };
          console.log('[geo] posição obtida:', c, 'precisão:', Math.round(coords.accuracy), 'm');
          setState({ ...c, error: null, loading: false });
          resolve(c);
        },
        (err) => {
          const msg = describeError(err);
          console.warn('[geo] falha:', err.code, msg);
          setState(s => ({ ...s, error: msg, loading: false }));
          resolve(null);
        },
        { enableHighAccuracy: false, timeout: 20000, maximumAge: 60000 }
      );
    });
  }, []);

  const requestLocation = useCallback(() => { void getPosition(); }, [getPosition]);

  const clearLocation = useCallback(() => {
    setState({ latitude: null, longitude: null, error: null, loading: false });
  }, []);

  return { ...state, getPosition, requestLocation, clearLocation };
}
