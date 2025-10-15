from __future__ import annotations

from typing import Dict, List, Optional
from ..core.config import settings


class DALIService:
    """
    Abstraction over a DALI gateway (LOYTEC L-DALI via BACnet/IP).
    For now, this is an in-memory fallback implementation. Replace methods to
    integrate a BACnet client (e.g., bacpypes) that talks to the gateway.
    """

    def __init__(self) -> None:
        # Example configured groups and scenes
        self._groups: Dict[int, Dict[str, object]] = {
            1: {"name": "Luci Pista", "level": 0},
            2: {"name": "Luci Spalti", "level": 0},
            3: {"name": "Luci Hall", "level": 0},
        }
        self._scenes: Dict[int, str] = {
            1: "Illuminazione Gara",
            2: "Manutenzione",
            3: "Tutto Spento",
        }
        self._active_scene: Optional[int] = None

        # Store gateway config if provided
        self.gateway_ip: Optional[str] = settings.dali_gateway_ip
        self.gateway_device_id: Optional[int] = settings.dali_gateway_device_id

    # ---- BACnet placeholders ----
    # In a real implementation, map group_id -> BACnet object (device/object id)
    # and perform ReadProperty/WriteProperty calls.

    def read_group_level(self, group_id: int) -> int:
        g = self._groups.get(group_id)
        if not g:
            raise ValueError("Gruppo non trovato")
        val = g.get("level", 0)
        if isinstance(val, int):
            return val
        if isinstance(val, (str, float)):
            try:
                return int(val)
            except Exception:
                return 0
        return 0

    def set_group_level(self, group_id: int, level: int) -> None:
        if level < 0 or level > 100:
            raise ValueError("Livello fuori range (0-100)")
        g = self._groups.get(group_id)
        if not g:
            raise ValueError("Gruppo non trovato")
        g["level"] = level

    def recall_scene(self, scene_id: int) -> None:
        if scene_id not in self._scenes:
            raise ValueError("Scena non trovata")
        self._active_scene = scene_id
        # Mock: apply scene presets
        if scene_id == 1:  # Gara
            self._groups[1]["level"] = 100
            self._groups[2]["level"] = 70
            self._groups[3]["level"] = 40
        elif scene_id == 2:  # Manutenzione
            self._groups[1]["level"] = 60
            self._groups[2]["level"] = 60
            self._groups[3]["level"] = 60
        elif scene_id == 3:  # Tutto Spento
            for g in self._groups.values():
                g["level"] = 0

    def list_groups(self) -> List[Dict[str, object]]:
        result: List[Dict[str, object]] = []
        for gid, g in self._groups.items():
            result.append({
                "id": gid,
                "name": g["name"],
                "level": g["level"],
            })
        return result

    def list_scenes(self) -> List[Dict[str, object]]:
        return [{"id": sid, "name": name} for sid, name in self._scenes.items()]

    def active_scene(self) -> Optional[int]:
        return self._active_scene


service = DALIService()
