import { useState, useCallback } from 'react';

interface GeolocationState {
  latitude: number | null;
  longitude: number | null;
  error: string | null;
  loading: boolean;
}

export function useGeolocation() {
  const [state, setState] = useState<GeolocationState>({
    latitude: null,
    longitude: null,
    error: null,
    loading: false,
  });

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setState(s => ({ ...s, error: 'Geolocalização não suportada neste dispositivo.' }));
      return;
    }
    setState(s => ({ ...s, loading: true, error: null }));
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setState({
          latitude: coords.latitude,
          longitude: coords.longitude,
          error: null,
          loading: false,
        });
      },
      (err) => {
        let msg: string;
        switch (err.code) {
          case err.PERMISSION_DENIED:
            msg = 'Permissão negada pelo navegador. Clique no ícone de cadeado na barra de endereço e permita a localização.';
            break;
          case err.POSITION_UNAVAILABLE:
            msg = 'Localização indisponível. Verifique se os serviços de localização estão ativos em Configurações do Windows → Privacidade → Localização.';
            break;
          case err.TIMEOUT:
            msg = 'Tempo esgotado. Tente novamente.';
            break;
          default:
            msg = 'Erro ao obter localização.';
        }
        setState(s => ({ ...s, error: msg, loading: false }));
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  }, []);

  const clearLocation = useCallback(() => {
    setState({ latitude: null, longitude: null, error: null, loading: false });
  }, []);

  return { ...state, requestLocation, clearLocation };
}
