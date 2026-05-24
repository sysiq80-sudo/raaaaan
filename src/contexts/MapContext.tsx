import React, { createContext, useContext } from "react";
import { useMapProvider, type MapProvider } from "@/hooks/useMapProvider";
import { useGoogleMapsApiKey } from "@/hooks/useGoogleMapsApiKey";

type MapContextValue = {
  provider: MapProvider;
  isGoogleConfigured: boolean;
  googleMapsApiKey: string;
  isLoading: boolean;
  isReady: boolean;
};

const MapContext = createContext<MapContextValue | null>(null);

export const MapProviderContext: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { provider, isGoogleConfigured, loading: providerLoading } = useMapProvider();
  const { apiKey, isLoading: keyLoading } = useGoogleMapsApiKey();

  const isLoading = providerLoading || keyLoading;
  const isReady = provider === "google" && isGoogleConfigured && !!apiKey;

  return (
    <MapContext.Provider
      value={{
        provider,
        isGoogleConfigured,
        googleMapsApiKey: apiKey,
        isLoading,
        isReady,
      }}
    >
      {children}
    </MapContext.Provider>
  );
};

export const useMapContext = () => {
  const context = useContext(MapContext);
  if (!context) {
    throw new Error("useMapContext must be used within MapProviderContext");
  }
  return context;
};
