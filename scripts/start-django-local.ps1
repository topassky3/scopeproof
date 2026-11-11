# Start Django local development with a stable, untracked session signing key.
$ErrorActionPreference = "Stop"
$repo = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$python = Join-Path $repo "backend\.venv\Scripts\python.exe"
$secretPath = Join-Path $repo "backend\.local-django-secret"
if (-not (Test-Path -LiteralPath $python)) {
    throw "Python venv missing. Run: py -3 -m venv backend\.venv; backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt"
}
if (-not (Test-Path -LiteralPath $secretPath)) {
    $bytes = New-Object byte[] 32
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
    [Convert]::ToBase64String($bytes) | Set-Content -LiteralPath $secretPath -NoNewline
}
$env:DJANGO_DEBUG = "1"
$env:DJANGO_SECRET_KEY = (Get-Content -LiteralPath $secretPath -Raw).Trim()
$env:DJANGO_ALLOWED_HOSTS = "127.0.0.1,localhost"
$env:SCOPEPROOF_ALLOW_SIGNUP = "1"
& $python (Join-Path $repo "backend\manage.py") migrate
if ($LASTEXITCODE -ne 0) { throw "DJANGO_MIGRATIONS_FAILED" }
& $python (Join-Path $repo "backend\manage.py") runserver "127.0.0.1:8000"
