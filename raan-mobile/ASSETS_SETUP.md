# App Icons & Splash Screen Setup

## Required Assets

### App Icon (`assets/icon.png`)
- Size: 1024x1024 px
- Format: PNG (no transparency for App Store)
- Content: ران logo on dark (#0f172a) background with green (#00d9a5) accent

### Adaptive Icon (`assets/adaptive-icon.png`)
- Size: 1024x1024 px (foreground layer)
- Format: PNG with transparency
- Content: ران logo centered (icon sits in inner 66% safe zone)
- Background color: #0f172a (set in app.json)

### Splash Icon (`assets/splash-icon.png`)
- Size: 200x200 px (centered on splash)
- Format: PNG with transparency
- Content: ران logo
- Background color: #0f172a (set in app.json)

### Notification Icon (`assets/notification-icon.png`)
- Size: 96x96 px
- Format: PNG with transparency
- Content: White silhouette of ران logo (Android notification tray requires monochrome)

### Favicon (`assets/favicon.png`)
- Size: 48x48 px
- For web only

## Quick Copy from Capacitor
You can copy the existing Capacitor icons as a starting point:
```bash
# Copy the largest launcher icon
copy ..\android\app\src\main\res\mipmap-xxxhdpi\ic_launcher.png assets\icon.png
copy ..\android\app\src\main\res\mipmap-xxxhdpi\ic_launcher_foreground.png assets\adaptive-icon.png
```

## Generate with Expo CLI (after setting icon.png)
```bash
npx expo customize
# Select: splash screen, adaptive icon
```
