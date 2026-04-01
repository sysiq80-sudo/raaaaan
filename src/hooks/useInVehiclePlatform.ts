import { useEffect, useMemo, useState } from "react";
import {
  createInVehicleAdapter,
  getConfiguredInVehiclePlatform,
} from "@/services/inVehicle";
import type { InVehicleAdapter, InVehiclePlatform, InVehicleSessionContext } from "@/types/inVehicle";

export function useInVehiclePlatform(context: InVehicleSessionContext | null) {
  const [isReady, setIsReady] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);

  const platform: InVehiclePlatform = useMemo(() => getConfiguredInVehiclePlatform(), []);
  const adapter: InVehicleAdapter = useMemo(() => createInVehicleAdapter(platform), [platform]);

  useEffect(() => {
    let disposed = false;

    const start = async () => {
      if (!context) return;
      await adapter.init(context);
      if (disposed) return;
      setIsAvailable(adapter.isAvailable());
      setIsReady(true);
    };

    void start();

    return () => {
      disposed = true;
      void adapter.dispose();
      setIsReady(false);
      setIsAvailable(false);
    };
  }, [adapter, context]);

  return {
    platform,
    adapter,
    isReady,
    isAvailable,
  };
}
