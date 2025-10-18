import json
import logging
import time
from typing import List, Optional

import websocket

logger = logging.getLogger(__name__)


class ObsV5Error(Exception):
    pass


def _make_request(request_id: int, op: str, d: Optional[dict] = None) -> str:
    payload = {"op": 6, "d": {"requestType": op, "requestId": str(request_id)}}
    if d:
        payload['d']['requestData'] = d
    return json.dumps(payload)


def get_scene_list(host: str, port: int, password: str = '', timeout: float = 5.0) -> List[str]:
    """Connect to OBS WebSocket v5 and return list of scene names.

    This implements a minimal subset of the v5 JSON messages needed for GetSceneList.
    """
    url = f"ws://{host}:{port}"
    ws = None
    try:
        logger.debug("Connecting to OBS v5 websocket at %s", url)
        ws = websocket.create_connection(url, timeout=timeout)
        # Read the hello message
        hello_raw = ws.recv()
        hello = json.loads(hello_raw)
        logger.debug("OBS hello: %s", hello_raw)

        # If authentication is required, the hello message will contain 'd' with 'authentication'
        if hello.get('op') == 0 and isinstance(hello.get('d'), dict):
            auth = hello['d'].get('authentication', None)
            if auth and password is not None:
                # For OBS WebSocket v5, authentication uses challenge/secret hashing (HMAC-SHA256 + base64)
                # Implementing the full challenge-response is out-of-scope for a quick helper.
                # If password is provided and server requires authentication, raise explicit error.
                raise ObsV5Error('OBS WebSocket v5 requires authentication (challenge) — provide an authenticated client or configure a passwordless connection')

        # Send GetSceneList request (requestId 1)
        req = _make_request(1, 'GetSceneList')
        ws.send(req)
        start = time.time()
        while True:
            if time.time() - start > timeout:
                raise ObsV5Error('Timeout waiting for GetSceneList response')
            raw = ws.recv()
            if not raw:
                continue
            try:
                msg = json.loads(raw)
            except Exception:
                continue
            # Check for event with requestId
            d = msg.get('d') or {}
            if isinstance(d, dict) and d.get('requestId') == '1':
                # Expect 'responseData' with 'scenes'
                rd = d.get('responseData') or {}
                scenes = []
                if 'scenes' in rd and isinstance(rd['scenes'], list):
                    for s in rd['scenes']:
                        name = s.get('sceneName') or s.get('scene-name') or s.get('name')
                        if name:
                            scenes.append(name)
                return scenes
            # loop until we find the response
    except ObsV5Error:
        raise
    except Exception as e:
        logger.exception('Error connecting to OBS v5 websocket')
        raise ObsV5Error(str(e))
    finally:
        try:
            if ws:
                ws.close()
        except Exception:
            pass
