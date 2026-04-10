# build-apk.ps1 — Build a specific RAAN flavor APK
# Usage: powershell scripts/build-apk.ps1 rider|driver|car
param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("rider","driver","car")]
    [string]$App
)

$ErrorActionPreference = "Stop"

# Map app name to build config, capacitor config, web dir, Gradle flavor, and APK output
$config = @{
    rider = @{
        viteConfig  = "vite.rider.config.ts"
        capConfig   = "capacitor.rider.config.ts"
        webDir      = "dist-rider"
        htmlFile    = "rider.html"
        flavor      = "rider"
        apkName     = "raan-rider.apk"
    }
    driver = @{
        viteConfig  = "vite.driver.config.ts"
        capConfig   = "capacitor.driver.config.ts"
        webDir      = "dist-driver"
        htmlFile    = "driver.html"
        flavor      = "captain"
        apkName     = "raan-driver.apk"
    }
    car = @{
        viteConfig  = "vite.car.config.ts"
        capConfig   = "capacitor.car.config.ts"
        webDir      = "dist-car"
        htmlFile    = "car.html"
        flavor      = "car"
        apkName     = "raan-car.apk"
    }
}

$c = $config[$App]
$flavorCap = $c.flavor.Substring(0,1).ToUpper() + $c.flavor.Substring(1)

Write-Host "`n=== Building RAAN $App APK (flavor: $($c.flavor)) ===" -ForegroundColor Cyan

# Step 1: Build web
Write-Host "`n[1/5] Building web ($($c.viteConfig))..." -ForegroundColor Yellow
npx vite build --config $c.viteConfig
if ($LASTEXITCODE -ne 0) { throw "Vite build failed" }

# Step 2: Copy html -> index.html
Write-Host "[2/5] Preparing index.html..." -ForegroundColor Yellow
Copy-Item "$($c.webDir)\$($c.htmlFile)" "$($c.webDir)\index.html" -Force

# Step 3: Copy capacitor config
Write-Host "[3/5] Setting capacitor config..." -ForegroundColor Yellow
Copy-Item $c.capConfig "capacitor.config.ts" -Force

# Step 4: Capacitor sync
Write-Host "[4/5] Syncing Capacitor..." -ForegroundColor Yellow
npx cap sync android
if ($LASTEXITCODE -ne 0) { throw "Capacitor sync failed" }

# Step 5: Gradle build with flavor
Write-Host "[5/5] Building APK (assemble${flavorCap}Debug)..." -ForegroundColor Yellow
Push-Location android
.\gradlew.bat "assemble${flavorCap}Debug"
if ($LASTEXITCODE -ne 0) { Pop-Location; throw "Gradle build failed" }
Pop-Location

# Copy APK to builds/
$apkSource = "android\app\build\outputs\apk\$($c.flavor)\debug\app-$($c.flavor)-debug.apk"
if (-not (Test-Path "builds")) { New-Item -ItemType Directory -Path "builds" | Out-Null }
Copy-Item $apkSource "builds\$($c.apkName)" -Force

Write-Host "`n✅ APK ready: builds\$($c.apkName)" -ForegroundColor Green
Write-Host "   ApplicationId: $(if($App -eq 'driver'){'com.raan.captain'}elseif($App -eq 'rider'){'com.raan.rider'}else{'com.raan.car'})"
Write-Host "   Flavor: $($c.flavor)`n"
