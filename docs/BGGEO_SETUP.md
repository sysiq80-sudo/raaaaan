# Transistorsoft BGGeo Setup

RAAN keeps `@transistorsoft/capacitor-background-geolocation` for the native driver app because the driver must continue location tracking while the app is backgrounded.

## What Is Required

- Android production applicationId: `com.raan.captain`
- Generate an Android license key in the Transistorsoft Customer Dashboard for `com.raan.captain`.
- The license key is a native Android value, not a Vite client variable.

## Local Android Builds

Add the license to `android/local.properties`:

```properties
transistorBgGeoLicense=YOUR_LICENSE_KEY_JWT
```

Debug builds can run without a license, but release builds need the real key.

## Production / CI Builds

Set this environment variable before building the captain release:

```bash
TRANSISTOR_BG_GEO_LICENSE=YOUR_LICENSE_KEY_JWT
```

The Gradle build injects it into `AndroidManifest.xml` as:

```xml
<meta-data
    android:name="com.transistorsoft.locationmanager.license"
    android:value="${transistorBgGeoLicense}" />
```

## About `VITE_TRANSISTOR_BG_GEO_TOKEN`

`VITE_TRANSISTOR_BG_GEO_TOKEN` is only for the plugin's Transistor authorization/demo tracking service if you use it. It does not fix `LICENSE VALIDATION FAILURE`.

Keep it empty unless you intentionally use Transistorsoft's hosted tracker:

```env
VITE_TRANSISTOR_BG_GEO_TOKEN=
```
