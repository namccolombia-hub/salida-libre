# Generates the release "upload keystore" for Salida Libre.
# Run this yourself from PowerShell, in the project root (e:\Wrong Exit):
#   .\scripts\generate-keystore.ps1
#
# The keystore file and its passwords never leave your machine - this
# script doesn't call out to anything. It writes:
#   - android/app/salida-libre-upload.keystore   (the key itself, gitignored)
#   - android/keystore.properties                (passwords, gitignored)
#
# IMPORTANT: back up both files somewhere safe (a password manager entry
# with the keystore file attached, or an encrypted cloud folder) as soon as
# this finishes. If you lose them, you can no longer publish updates to the
# same Play Store listing without going through Google's account-recovery
# process for app signing.

$ErrorActionPreference = "Stop"

$keytool = "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe"
if (-not (Test-Path $keytool)) {
    Write-Error "keytool.exe not found at $keytool - edit this script if Android Studio is installed elsewhere."
    exit 1
}

$keystorePath = Join-Path $PSScriptRoot "..\android\app\salida-libre-upload.keystore"
$propsPath = Join-Path $PSScriptRoot "..\android\keystore.properties"

if (Test-Path $keystorePath) {
    Write-Error "A keystore already exists at $keystorePath - delete it first if you really want to regenerate (this would invalidate the old one)."
    exit 1
}

function New-RandomPassword {
    $bytes = New-Object byte[] 24
    [System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
    return [Convert]::ToBase64String($bytes) -replace '[+/=]', '' | ForEach-Object { $_.Substring(0, 24) }
}

$storePassword = New-RandomPassword
$keyPassword = New-RandomPassword
$alias = "salida-libre-upload"

& $keytool -genkeypair -v `
    -keystore $keystorePath `
    -alias $alias `
    -keyalg RSA -keysize 2048 -validity 10000 `
    -storepass $storePassword `
    -keypass $keyPassword `
    -dname "CN=Sebastian Serrano, OU=Namc Colombia, O=Namc Colombia, L=Colombia, ST=Colombia, C=CO"

if ($LASTEXITCODE -ne 0) {
    Write-Error "keytool failed - see output above."
    exit 1
}

@"
storeFile=salida-libre-upload.keystore
storePassword=$storePassword
keyAlias=$alias
keyPassword=$keyPassword
"@ | Set-Content -Path $propsPath -Encoding utf8

Write-Host ""
Write-Host "Keystore created: $keystorePath" -ForegroundColor Green
Write-Host "Passwords saved to: $propsPath" -ForegroundColor Green
Write-Host ""
Write-Host "NEXT STEP: back up BOTH files right now (password manager + a" -ForegroundColor Yellow
Write-Host "second location like encrypted cloud storage). Neither is in git." -ForegroundColor Yellow
Write-Host "Losing them means you can't publish updates to this app anymore" -ForegroundColor Yellow
Write-Host "without Google's account-recovery process." -ForegroundColor Yellow
