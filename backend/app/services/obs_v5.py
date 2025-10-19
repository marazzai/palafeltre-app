import threading
import time
import logging
from typing import Optional, List

logger = logging.getLogger(__name__)

# Try to import obs-websocket client for v5 (obs-websocket-py provides obsws)
try:
    from obswebsocket import obsws, requests as obsreq, events as obsevents
    OBS_AVAILABLE = True
except Exception:
    OBS_AVAILABLE = False


class ObsManager:
    """Simple manager that keeps a connection to OBS (obs-websocket v5 via obs-websocket-py) alive and
    exposes methods to get scenes and set current scene. It reads settings (host, port, password) from
    the application via explicit calls (set_config) and will reconnect automatically on failure.
    """

    def __init__(self):
        self._host: Optional[str] = None
        self._port: Optional[int] = None
        self._pwd: Optional[str] = None
        self._ws = None
        self._lock = threading.Lock()
        self._thread: Optional[threading.Thread] = None
        self._stop = threading.Event()
        self._connected = threading.Event()

    def set_config(self, host: str, port: int, password: str):
        with self._lock:
            self._host = host
            self._port = port
            self._pwd = password
        # start background thread if not running
        if self._thread is None or not self._thread.is_alive():
            self._stop.clear()
            self._thread = threading.Thread(target=self._run, daemon=True)
            self._thread.start()

    def stop(self):
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=2)
        with self._lock:
            try:
                if self._ws:
                    try: self._ws.disconnect()
                    except Exception: pass
            except Exception:
                pass
            self._ws = None
        self._connected.clear()

    def _run(self):
        while not self._stop.is_set():
            host = None
            port = None
            pwd = None
            with self._lock:
                host, port, pwd = self._host, self._port, self._pwd
            if not host or not port:
                # nothing configured; sleep and wait
                self._connected.clear()
                time.sleep(2)
                continue
            if not OBS_AVAILABLE:
                logger.warning('OBS client library not available in this environment')
                self._connected.clear()
                time.sleep(5)
                continue
            try:
                # Connect using obsws(host, port, password)
                logger.info(f'Attempting OBS connection to {host}:{port}')
                ws = obsws(host, port, pwd)
                ws.connect()
                with self._lock:
                    self._ws = ws
                self._connected.set()
                logger.info('OBS connected')
                # keep listening for disconnections
                while not self._stop.is_set():
                    time.sleep(1)
                break
            except Exception as e:
                logger.warning(f'OBS connection failed: {e}')
                self._connected.clear()
                try:
                    if self._ws:
                        try: self._ws.disconnect()
                        except Exception: pass
                finally:
                    self._ws = None
                time.sleep(5)

    def is_connected(self) -> bool:
        return self._connected.is_set()

    def get_scenes(self) -> List[str]:
        if not OBS_AVAILABLE:
            raise RuntimeError('OBS client not available')
        if not self.is_connected() or self._ws is None:
            raise RuntimeError('Not connected to OBS')
        try:
            resp = self._ws.call(obsreq.GetSceneList())
            # resp.getScenes() may be present depending on library
            scenes = []
            try:
                scenes = [s['sceneName'] for s in resp.getScenes()]
            except Exception:
                # attempt attr access
                if hasattr(resp, 'getScenes'):
                    scenes = [s['sceneName'] for s in resp.getScenes()]
            return scenes
        except Exception as e:
            raise RuntimeError(f'Failed to get scenes: {e}')

    def set_scene(self, scene_name: str):
        if not OBS_AVAILABLE:
            raise RuntimeError('OBS client not available')
        if not self.is_connected() or self._ws is None:
            raise RuntimeError('Not connected to OBS')
        try:
            self._ws.call(obsreq.SetCurrentProgramScene(scene_name))
        except Exception as e:
            raise RuntimeError(f'Failed to set scene: {e}')


# single global manager
obs_manager = ObsManager()
*** End Patch
