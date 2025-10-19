#!/usr/bin/env python3
"""
Test completo di avvio dell'app per verificare che tutto funzioni
"""
import os
import sys
import tempfile
import subprocess

# Aggiungi il path dell'app per gli import
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

def test_app_import():
    """Testa che l'app si possa importare senza errori"""
    print("🧪 Test import dell'applicazione...")
    
    try:
        # Impostiamo variabili di ambiente minime
        os.environ.setdefault('DATABASE_URL', 'sqlite:///test.db')
        os.environ.setdefault('JWT_SECRET', 'test-secret')
        os.environ.setdefault('STORAGE_PATH', tempfile.gettempdir())
        
        # Tenta import dell'app principale
        from app.main import app
        print("✅ App importata correttamente")
        
        # Verifica che l'app sia un'istanza FastAPI
        from fastapi import FastAPI
        if isinstance(app, FastAPI):
            print("✅ App è istanza FastAPI valida")
        else:
            print("❌ App non è istanza FastAPI")
            return False
            
        # Verifica che ci siano routes
        if len(app.routes) > 0:
            print(f"✅ App ha {len(app.routes)} routes definite")
        else:
            print("⚠️  Nessuna route definita")
            
        return True
        
    except Exception as e:
        print(f"❌ Errore import app: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_core_modules():
    """Testa i moduli core dell'app"""
    print("\n🧪 Test moduli core...")
    
    modules_to_test = [
        'app.core.config',
        'app.core.auth',
        'app.core.security', 
        'app.db.session',
        'app.api.v1.router',
    ]
    
    success = 0
    for module in modules_to_test:
        try:
            __import__(module)
            print(f"✅ {module}")
            success += 1
        except Exception as e:
            print(f"❌ {module}: {e}")
    
    print(f"📊 {success}/{len(modules_to_test)} moduli core funzionanti")
    return success == len(modules_to_test)

def main():
    print("🚀 Test Completo Palafeltre App")
    print("=" * 50)
    
    # Test import dell'app
    app_ok = test_app_import()
    
    # Test moduli core
    core_ok = test_core_modules()
    
    print("\n" + "=" * 50)
    if app_ok and core_ok:
        print("🎉 Tutti i test passati! L'app dovrebbe funzionare.")
        return 0
    else:
        print("❌ Alcuni test falliti. Controlla gli errori sopra.")
        return 1

if __name__ == "__main__":
    sys.exit(main())