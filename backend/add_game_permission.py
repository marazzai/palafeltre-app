"""
Script per aggiungere il permesso 'game.control' al database
Eseguire con: python -m backend.add_game_permission
"""
from app.db.session import SessionLocal
from app.models.rbac import Permission, Role

def add_game_permission():
    db = SessionLocal()
    try:
        # Crea permesso se non esiste
        perm = db.query(Permission).filter(Permission.code == 'game.control').first()
        if not perm:
            perm = Permission(
                code='game.control',
                description='Controllo partita (scoreboard, timer, punteggi)'
            )
            db.add(perm)
            db.commit()
            db.refresh(perm)
            print(f"✅ Creato permesso: {perm.code}")
        else:
            print(f"ℹ️  Permesso già esistente: {perm.code}")
        
        # Assegna automaticamente al ruolo admin
        admin_role = db.query(Role).filter(Role.name == 'admin').first()
        if admin_role and perm not in admin_role.permissions:
            admin_role.permissions.append(perm)
            db.commit()
            print(f"✅ Permesso assegnato al ruolo 'admin'")
        else:
            print(f"ℹ️  Permesso già assegnato al ruolo 'admin'")
            
    finally:
        db.close()

if __name__ == '__main__':
    add_game_permission()
    print("\n✅ Operazione completata!")
    print("\n📝 Per assegnare questo permesso ad altri ruoli:")
    print("   1. Vai su /admin nel pannello web")
    print("   2. Gestisci Ruoli > Seleziona ruolo > Aggiungi permesso 'game.control'")
