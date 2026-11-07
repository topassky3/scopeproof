$ErrorActionPreference = 'Stop'
Write-Host '=== Scopeproof local verification ===' -ForegroundColor Cyan
node --version
npm --version
npm install
if ($LASTEXITCODE -ne 0) { throw 'npm install failed' }
npm test
if ($LASTEXITCODE -ne 0) { throw 'Unit tests failed' }
npm run build
if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed' }
Write-Host 'Scopeproof local verification PASSED' -ForegroundColor Green
