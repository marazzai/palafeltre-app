#!/usr/bin/env python3
"""
Test script per verificare che tutti gli import funzionino correttamente
"""
import sys
import traceback

def test_import(module_name, description=""):
    """Testa un import specifico"""
    try:
        __import__(module_name)
        print(f"✅ {module_name} - {description}")
        return True
    except ImportError as e:
        print(f"❌ {module_name} - {description}: {e}")
        return False
    except Exception as e:
        print(f"⚠️  {module_name} - {description}: {e}")
        return False

def main():
    print("🔍 Verifica dipendenze Palafeltre App Backend")
    print("=" * 50)
    
    success = 0
    total = 0
    
    # Core dependencies
    tests = [
        ("fastapi", "Web framework"),
        ("uvicorn", "ASGI server"),
        ("sqlalchemy", "Database ORM"),
        ("psycopg2", "PostgreSQL driver"),
        ("pydantic", "Data validation"),
        ("jwt", "JWT tokens (PyJWT)"),
        ("passlib", "Password hashing"),
        ("bcrypt", "Bcrypt hashing"),
        ("slowapi", "Rate limiting"),
        ("httpx", "HTTP client"),
        ("pytest", "Testing framework"),
        
        # Optional but important
        ("obswebsocket", "OBS WebSocket control"),
        ("reportlab", "PDF generation"),
        ("email_validator", "Email validation"),
    ]
    
    for module, desc in tests:
        total += 1
        if test_import(module, desc):
            success += 1
    
    print("=" * 50)
    print(f"📊 Risultato: {success}/{total} dipendenze funzionanti")
    
    if success == total:
        print("🎉 Tutte le dipendenze sono disponibili!")
        return 0
    else:
        print(f"⚠️  {total - success} dipendenze mancanti")
        return 1

if __name__ == "__main__":
    sys.exit(main())