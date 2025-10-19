import threading
import time
import logging
from typing import Optional, List
import asyncio
import json

logger = logging.getLogger(__name__)

# Try to import OBS WebSocket client - use simpleobsws (più leggero di obs-websocket-py)
try:
    import simpleobsws
    OBS_AVAILABLE = True
    logger.info("OBS WebSocket support available (simpleobsws)")
except Exception as e:
    OBS_AVAILABLE = False
    logger.warning(f"OBS WebSocket not available: {e}")


class ObsManager:
    """Manager che mantiene connessione a OBS WebSocket v5 usando simpleobsws"""

    def __init__(self):
        self._host: Optional[str] = None
        self._port: Optional[int] = None
        self._pwd: Optional[str] = None
        self._ws = None
        self._lock = threading.Lock()
        self._thread: Optional[threading.Thread] = None
        self._stop = threading.Event()
        self._connected = threading.Event()
        self._loop = None

    def set_config(self, host: str, port: int, password: str = ""):
        """Configura connessione OBS"""
        with self._lock:
            self._host = host
            self._port = port
            self._pwd = password
            self._stop.set()
            if self._thread and self._thread.is_alive():
                self._thread.join(timeout=5)
            self._stop.clear()
            self._connected.clear()
            if OBS_AVAILABLE:
                self._thread = threading.Thread(target=self._connection_worker, daemon=True)
                self._thread.start()
            else:
                logger.warning("Cannot start OBS manager - simpleobsws not available")

    def _connection_worker(self):
        """Worker thread per mantenere connessione"""
        if not OBS_AVAILABLE:
            return
            
        # Crea event loop per questo thread
        self._loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self._loop)
        
        try:
            self._loop.run_until_complete(self._async_connection_worker())
        except Exception as e:
            logger.error(f"OBS connection worker error: {e}")
        finally:
            self._loop.close()

    async def _async_connection_worker(self):
        """Async worker per connessione WebSocket"""
        while not self._stop.is_set():
            try:
                # Crea connessione WebSocket
                self._ws = simpleobsws.WebSocketClient(
                    url=f"ws://{self._host}:{self._port}",
                    password=self._pwd
                )
                
                await self._ws.connect()
                self._connected.set()
                logger.info(f"Connected to OBS at {self._host}:{self._port}")
                
                # Mantieni connessione attiva
                while not self._stop.is_set() and self._ws:
                    try:
                        await asyncio.sleep(1)
                        # Ping periodico per verificare connessione
                        if hasattr(self._ws, 'call'):
                            await self._ws.call('GetVersion')
                    except Exception as e:
                        logger.warning(f"OBS connection lost: {e}")
                        break
                        
            except Exception as e:
                logger.error(f"Failed to connect to OBS: {e}")
                self._connected.clear()
                await asyncio.sleep(5)  # Retry dopo 5 secondi
            
            finally:
                if self._ws:
                    try:
                        await self._ws.disconnect()
                    except:
                        pass
                    self._ws = None
                self._connected.clear()

    def is_connected(self) -> bool:
        """Verifica se connesso a OBS"""
        return self._connected.is_set()

    async def get_scenes(self) -> List[str]:
        """Ottieni lista scene OBS"""
        if not self.is_connected() or not self._ws:
            return []
        
        try:
            response = await self._ws.call('GetSceneList')
            if response and 'scenes' in response:
                return [scene['sceneName'] for scene in response['scenes']]
        except Exception as e:
            logger.error(f"Error getting OBS scenes: {e}")
        
        return []

    async def set_current_scene(self, scene_name: str) -> bool:
        """Cambia scena corrente in OBS"""
        if not self.is_connected() or not self._ws:
            return False
        
        try:
            await self._ws.call('SetCurrentProgramScene', {'sceneName': scene_name})
            logger.info(f"Changed OBS scene to: {scene_name}")
            return True
        except Exception as e:
            logger.error(f"Error setting OBS scene: {e}")
            return False

    async def get_current_scene(self) -> Optional[str]:
        """Ottieni scena corrente"""
        if not self.is_connected() or not self._ws:
            return None
            
        try:
            response = await self._ws.call('GetCurrentProgramScene')
            if response and 'currentProgramSceneName' in response:
                return response['currentProgramSceneName']
        except Exception as e:
            logger.error(f"Error getting current OBS scene: {e}")
        
        return None

    def stop(self):
        """Ferma manager"""
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=5)


# Istanza globale
obs_manager = ObsManager()