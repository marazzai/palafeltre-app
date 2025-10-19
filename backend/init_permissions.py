"""
Script per inizializzare i permessi e ruoli di base dell'applicazione
"""
from sqlalchemy.orm import Session
from app.db.session import engine, SessionLocal
from app.models.rbac import User, Role, Permission, Base
from app.core.security import hash_password
from app.core.config import settings

def create_permissions(db: Session):
    """Crea i permessi di base"""
    permissions_data = [
        # Admin permissions
        ("admin.full_access", "Accesso completo al sistema"),
        ("admin.users", "Gestione utenti"),
        ("admin.config", "Configurazione sistema"),
        
        # Game control permissions
        ("game.control", "Controllo partita (punteggi, cronometro)"),
        ("game.view", "Visualizzazione stato partita"),
        ("game.scoreboard", "Accesso al tabellone"),
        
        # OBS control permissions
        ("obs.control", "Controllo OBS Studio"),
        ("obs.view", "Visualizzazione stato OBS"),
        
        # User management permissions
        ("user.view_own", "Visualizza il proprio profilo"),
        ("user.edit_own", "Modifica il proprio profilo"),
        ("user.view_all", "Visualizza tutti gli utenti"),
        ("user.edit_all", "Modifica tutti gli utenti"),
        
        # System permissions
        ("system.logs", "Accesso ai log di sistema"),
        ("system.maintenance", "Manutenzione sistema"),
    ]
    
    created_permissions = {}
    for code, description in permissions_data:
        permission = db.query(Permission).filter(Permission.code == code).first()
        if not permission:
            permission = Permission(code=code, description=description)
            db.add(permission)
            print(f"Created permission: {code}")
        created_permissions[code] = permission
    
    db.commit()
    return created_permissions

def create_roles(db: Session, permissions: dict):
    """Crea i ruoli di base"""
    roles_data = [
        ("admin", "Amministratore", [
            "admin.full_access", "admin.users", "admin.config",
            "game.control", "game.view", "game.scoreboard",
            "obs.control", "obs.view",
            "user.view_all", "user.edit_all",
            "system.logs", "system.maintenance"
        ]),
        ("game_operator", "Operatore Partita", [
            "game.control", "game.view", "game.scoreboard",
            "user.view_own", "user.edit_own"
        ]),
        ("obs_operator", "Operatore OBS", [
            "obs.control", "obs.view", "game.view",
            "user.view_own", "user.edit_own"
        ]),
        ("viewer", "Visualizzatore", [
            "game.view", "game.scoreboard", "obs.view",
            "user.view_own", "user.edit_own"
        ]),
        ("basic_user", "Utente Base", [
            "user.view_own", "user.edit_own"
        ])
    ]
    
    created_roles = {}
    for name, description, permission_codes in roles_data:
        role = db.query(Role).filter(Role.name == name).first()
        if not role:
            role = Role(name=name)
            db.add(role)
            print(f"Created role: {name}")
        
        # Clear existing permissions and add new ones
        role.permissions.clear()
        for perm_code in permission_codes:
            if perm_code in permissions:
                role.permissions.append(permissions[perm_code])
        
        created_roles[name] = role
    
    db.commit()
    return created_roles

def create_admin_user(db: Session, roles: dict):
    """Crea l'utente amministratore di default"""
    admin_user = db.query(User).filter(User.username == settings.admin_username).first()
    
    if not admin_user:
        admin_user = User(
            username=settings.admin_username,
            email=settings.admin_email,
            full_name="Administrator",
            hashed_password=hash_password(settings.admin_password),
            is_active=True
        )
        db.add(admin_user)
        print(f"Created admin user: {settings.admin_username}")
    else:
        print(f"Admin user already exists: {settings.admin_username}")
        # Force reset password if configured
        if settings.force_reset_admin_password:
            admin_user.hashed_password = hash_password(settings.admin_password)
            admin_user.must_change_password = False
            print("Reset admin password")
    
    # Ensure admin user has admin role
    if "admin" in roles:
        if roles["admin"] not in admin_user.roles:
            admin_user.roles.append(roles["admin"])
            print("Assigned admin role to admin user")
    
    db.commit()
    return admin_user

def init_database():
    """Inizializza il database con permessi, ruoli e utente admin"""
    print("Initializing database...")
    
    # Create all tables
    Base.metadata.create_all(bind=engine)
    print("Database tables created")
    
    db = SessionLocal()
    try:
        # Create permissions
        print("\nCreating permissions...")
        permissions = create_permissions(db)
        
        # Create roles
        print("\nCreating roles...")
        roles = create_roles(db, permissions)
        
        # Create admin user
        print("\nCreating admin user...")
        admin_user = create_admin_user(db, roles)
        
        print(f"\nDatabase initialization completed!")
        print(f"Admin user: {settings.admin_username}")
        print(f"Admin email: {settings.admin_email}")
        print(f"Admin password: {settings.admin_password}")
        print(f"\nTotal permissions: {len(permissions)}")
        print(f"Total roles: {len(roles)}")
        
    except Exception as e:
        print(f"Error during initialization: {e}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    init_database()