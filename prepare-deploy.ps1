# Script PowerShell per preparare il frontend per deploy

Write-Host "🔧 Preparazione frontend per deploy..." -ForegroundColor Cyan

Set-Location frontend

# Installa dipendenze
Write-Host "📦 Installazione dipendenze..." -ForegroundColor Yellow
npm install

# Build del frontend
Write-Host "🏗️ Build del frontend..." -ForegroundColor Yellow
npm run build

Write-Host "✅ Frontend pronto in ./frontend/dist" -ForegroundColor Green
Write-Host "📁 Puoi ora usare docker-compose.nobuild.yml" -ForegroundColor Green

Set-Location ..

Write-Host "🚀 Per deployare:" -ForegroundColor Cyan
Write-Host "   1. Carica tutti i file su Portainer" -ForegroundColor White
Write-Host "   2. Usa docker-compose.nobuild.yml come stack file" -ForegroundColor White
Write-Host "   3. Non servono variabili di environment!" -ForegroundColor White