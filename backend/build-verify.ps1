# Build Script Completo per Portainer
# Verifica che tutto sia configurato correttamente

Write-Host "🚀 Palafeltre App - Build Verification Script" -ForegroundColor Cyan
Write-Host "=" * 50

# Verifica struttura file
Write-Host "📁 Verifica struttura file..." -ForegroundColor Yellow

$requiredFiles = @(
    "requirements.optimized.txt",
    "Dockerfile.optimized", 
    "app\main.py",
    "app\core\config.py",
    "app\api\v1\router.py"
)

$allFilesExist = $true
foreach ($file in $requiredFiles) {
    if (Test-Path $file) {
        Write-Host "✅ $file" -ForegroundColor Green
    } else {
        Write-Host "❌ $file MANCANTE" -ForegroundColor Red
        $allFilesExist = $false
    }
}

# Verifica requirements.optimized.txt
Write-Host "`n📦 Verifica dipendenze ottimizzate..." -ForegroundColor Yellow

if (Test-Path "requirements.optimized.txt") {
    $requirements = Get-Content "requirements.optimized.txt"
    $criticalDeps = @("fastapi", "uvicorn", "sqlalchemy", "psycopg2-binary", "PyJWT")
    
    foreach ($dep in $criticalDeps) {
        $found = $requirements | Where-Object { $_ -like "*$dep*" }
        if ($found) {
            Write-Host "✅ $dep trovato" -ForegroundColor Green
        } else {
            Write-Host "❌ $dep MANCANTE" -ForegroundColor Red
            $allFilesExist = $false
        }
    }
} else {
    Write-Host "❌ requirements.optimized.txt non trovato!" -ForegroundColor Red
    $allFilesExist = $false
}

# Mostra summary
Write-Host "`n" + "=" * 50
if ($allFilesExist) {
    Write-Host "🎉 READY FOR PORTAINER DEPLOY!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📋 Prossimi passi:" -ForegroundColor Cyan
    Write-Host "1. Commit e push su GitHub" -ForegroundColor White
    Write-Host "2. In Portainer, usa Repository method" -ForegroundColor White
    Write-Host "3. Compose path: docker-compose.portainer.yml" -ForegroundColor White  
    Write-Host "4. Deploy the stack" -ForegroundColor White
    Write-Host ""
    Write-Host "🔗 Accesso dopo deploy:" -ForegroundColor Cyan
    Write-Host "   Frontend: http://YOUR_SERVER:8080" -ForegroundColor White
    Write-Host "   Backend:  http://YOUR_SERVER:8001" -ForegroundColor White
    Write-Host "   Login:    admin / adminadmin" -ForegroundColor White
} else {
    Write-Host "❌ PROBLEMI TROVATI" -ForegroundColor Red
    Write-Host "Risolvi i file mancanti prima del deploy" -ForegroundColor Red
}

Write-Host "`n🏗️ Build ottimizzazioni implementate:" -ForegroundColor Cyan
Write-Host "   • Dockerfile.optimized con system deps corretti" -ForegroundColor White
Write-Host "   • requirements.optimized.txt con versioni stabili" -ForegroundColor White 
Write-Host "   • PyJWT invece di python-jose (più leggero)" -ForegroundColor White
Write-Host "   • Build multi-stage per dipendenze pesanti" -ForegroundColor White