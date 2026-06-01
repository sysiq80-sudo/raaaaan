# ═══════════════════════════════════════════════════════════════════════════
# RAAN — Watchdog Verification Runner
# يجمع الـ keys تلقائياً من CLI ويطلب INTERNAL_EDGE_SECRET بشكل آمن
# ═══════════════════════════════════════════════════════════════════════════
#
# التشغيل:
#   cd D:\projects\taksi-iraqi\RAAN\raan
#   .\supabase\verification\run-watchdog-verify.ps1
#

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$PROJ_REF = "wgolkcztdrwdphwjvqxt"
$SUPABASE_URL = "https://$PROJ_REF.supabase.co"

Write-Host ""
Write-Host "══════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  RAAN — Financial Watchdog Verification" -ForegroundColor Cyan
Write-Host "══════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# ─── 1. service_role key من Supabase CLI ───
Write-Host "⏳ جاري جلب service_role key..." -ForegroundColor Yellow
try {
    $rawJson = supabase projects api-keys --project-ref $PROJ_REF --output json 2>$null
    $keys = $rawJson | ConvertFrom-Json
    $srKey = ($keys | Where-Object { $_.name -eq "service_role" }).api_key
    if (-not $srKey) { throw "service_role key غير موجود في الناتج" }
    Write-Host "✅ service_role key: تم الجلب (طول=$($srKey.Length))" -ForegroundColor Green
} catch {
    Write-Host "❌ فشل جلب service_role key: $_" -ForegroundColor Red
    Write-Host "   تأكد من تسجيل الدخول: supabase login" -ForegroundColor Yellow
    exit 1
}

# ─── 2. INTERNAL_EDGE_SECRET — من البيئة أو بإدخال آمن ───
if ($env:INTERNAL_EDGE_SECRET) {
    $internalSecret = $env:INTERNAL_EDGE_SECRET
    Write-Host "✅ INTERNAL_EDGE_SECRET: موجود في البيئة (طول=$($internalSecret.Length))" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "🔑 أدخل قيمة INTERNAL_EDGE_SECRET:" -ForegroundColor Yellow
    Write-Host "   (الإدخال مخفي — أو اضبطها مسبقاً: `$env:INTERNAL_EDGE_SECRET = '...')" -ForegroundColor Gray
    $secureSecret = Read-Host -AsSecureString
    $internalSecret = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
        [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureSecret)
    )
    if (-not $internalSecret) {
        Write-Host "❌ INTERNAL_EDGE_SECRET فارغ — خرج." -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ INTERNAL_EDGE_SECRET: مُستلم (طول=$($internalSecret.Length))" -ForegroundColor Green
}

# ─── 3. ضبط متغيرات البيئة في العملية الحالية فقط ───
$env:SUPABASE_URL = $SUPABASE_URL
$env:SUPABASE_SERVICE_ROLE_KEY = $srKey
$env:INTERNAL_EDGE_SECRET = $internalSecret
$env:RAAN_VERIFY_ALLOW_PRODUCTION = "yes"

Write-Host ""
Write-Host "🚀 تشغيل Watchdog Verification..." -ForegroundColor Cyan
Write-Host "══════════════════════════════════════════════" -ForegroundColor Cyan

# ─── 4. تشغيل السكربت ───
npx tsx supabase/verification/watchdog-verification.ts

$exitCode = $LASTEXITCODE

# ─── 5. تنظيف متغيرات البيئة من الذاكرة ───
Remove-Item Env:\SUPABASE_SERVICE_ROLE_KEY -ErrorAction SilentlyContinue
Remove-Item Env:\INTERNAL_EDGE_SECRET -ErrorAction SilentlyContinue
Remove-Item Env:\RAAN_VERIFY_ALLOW_PRODUCTION -ErrorAction SilentlyContinue
$srKey = $null
$internalSecret = $null

exit $exitCode
