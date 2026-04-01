# In-Vehicle Implementation Start

## Goal

Start practical implementation for in-vehicle experiences (Android Auto and CarPlay)
without breaking the current driver app flow.

## Implemented In This Step

1. Added shared in-vehicle types in `src/types/inVehicle.ts`.
2. Added extensible adapter base and platform stubs in `src/services/inVehicle/`.
3. Added adapter factory with env-based platform selection using `VITE_IN_VEHICLE_PLATFORM`.
4. Added integration hook `src/hooks/useInVehiclePlatform.ts`.

## Environment Variable

Set in local development:

```bash
VITE_IN_VEHICLE_PLATFORM=none
```

Allowed values:

- `none`
- `android_auto`
- `carplay`

## Next Implementation Step

1. Integrate `useInVehiclePlatform` into the primary driver screen.
2. Publish key ride events via `publishEvent` (offer received, accepted, rejected, nav start/stop).
3. Connect adapters to real native bridges for each platform.
4. Enable minimal and safe in-vehicle driver interaction flow.

## Notes

- Current implementation is safe by default because platform is `none`.
- No database schema changes were introduced in this step.
