#!/bin/bash

# Script per preparare il frontend per deploy senza build

echo "🔧 Preparazione frontend per deploy..."

cd frontend

# Installa dipendenze
echo "📦 Installazione dipendenze..."
npm install

# Build del frontend
echo "🏗️ Build del frontend..."
npm run build

echo "✅ Frontend pronto in ./frontend/dist"
echo "📁 Puoi ora usare docker-compose.nobuild.yml"

cd ..

echo "🚀 Per deployare:"
echo "   1. Carica tutti i file su Portainer"
echo "   2. Usa docker-compose.nobuild.yml come stack file"
echo "   3. Non servono variabili di environment!"