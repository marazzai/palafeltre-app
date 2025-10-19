from fastapi import HTTPException, status
from functools import wraps
from typing import List, Optional, Callable, Any
from sqlalchemy.orm import Session
from ..models.rbac import User, Permission
from ..db.session import get_db
import jwt
from ..core.config import settings


class PermissionChecker:
    """Utility class for checking user permissions"""
    
    @staticmethod
    def user_has_permission(user: User, permission_code: str) -> bool:
        """Check if user has a specific permission"""
        if not user or not user.is_active:
            return False
            
        for role in user.roles:
            for permission in role.permissions:
                if permission.code == permission_code:
                    return True
        return False
    
    @staticmethod
    def user_has_any_permission(user: User, permission_codes: List[str]) -> bool:
        """Check if user has any of the specified permissions"""
        return any(
            PermissionChecker.user_has_permission(user, code) 
            for code in permission_codes
        )
    
    @staticmethod
    def user_has_all_permissions(user: User, permission_codes: List[str]) -> bool:
        """Check if user has all of the specified permissions"""
        return all(
            PermissionChecker.user_has_permission(user, code) 
            for code in permission_codes
        )


def require_permissions(
    permissions: List[str], 
    require_all: bool = False,
    allow_admin_override: bool = True
):
    """
    Decorator to require specific permissions for an endpoint
    
    Args:
        permissions: List of permission codes required
        require_all: If True, user must have ALL permissions. If False, user needs ANY permission
        allow_admin_override: If True, users with 'admin.full_access' bypass permission checks
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Extract current_user from kwargs (should be injected by dependency)
            current_user = kwargs.get('current_user')
            if not current_user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authentication required"
                )
            
            # Check for admin override
            if allow_admin_override and PermissionChecker.user_has_permission(
                current_user, 'admin.full_access'
            ):
                return await func(*args, **kwargs)
            
            # Check permissions
            if require_all:
                has_permission = PermissionChecker.user_has_all_permissions(
                    current_user, permissions
                )
            else:
                has_permission = PermissionChecker.user_has_any_permission(
                    current_user, permissions
                )
            
            if not has_permission:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Insufficient permissions. Required: {', '.join(permissions)}"
                )
            
            return await func(*args, **kwargs)
        return wrapper
    return decorator


def require_permission(permission: str, allow_admin_override: bool = True):
    """Decorator to require a single permission"""
    return require_permissions([permission], require_all=True, allow_admin_override=allow_admin_override)


# Predefined permission groups for common use cases
class Permissions:
    """Constants for permission codes"""
    
    # Admin permissions
    ADMIN_FULL_ACCESS = "admin.full_access"
    ADMIN_USER_MANAGEMENT = "admin.users"
    ADMIN_SYSTEM_CONFIG = "admin.config"
    
    # Game control permissions
    GAME_CONTROL = "game.control"
    GAME_VIEW = "game.view"
    GAME_SCOREBOARD = "game.scoreboard"
    
    # OBS control permissions
    OBS_CONTROL = "obs.control"
    OBS_VIEW = "obs.view"
    
    # User management permissions
    USER_VIEW_OWN = "user.view_own"
    USER_EDIT_OWN = "user.edit_own"
    USER_VIEW_ALL = "user.view_all"
    USER_EDIT_ALL = "user.edit_all"
    
    # System permissions
    SYSTEM_LOGS = "system.logs"
    SYSTEM_MAINTENANCE = "system.maintenance"


# Common permission groups
class PermissionGroups:
    GAME_OPERATOR = [Permissions.GAME_CONTROL, Permissions.GAME_VIEW]
    OBS_OPERATOR = [Permissions.OBS_CONTROL, Permissions.OBS_VIEW]
    BASIC_USER = [Permissions.USER_VIEW_OWN, Permissions.USER_EDIT_OWN]
    ADMIN = [Permissions.ADMIN_FULL_ACCESS]


def check_user_permissions(user: User, required_permissions: List[str]) -> bool:
    """
    Utility function to check if a user has required permissions
    Can be used in non-decorator contexts
    """
    if not user or not user.is_active:
        return False
    
    # Admin override
    if PermissionChecker.user_has_permission(user, Permissions.ADMIN_FULL_ACCESS):
        return True
    
    return PermissionChecker.user_has_any_permission(user, required_permissions)