#!/usr/bin/env python3
"""
Quick diagnostic for obs-websocket connectivity.

Usage (inside project or inside backend container):
  python tools/obs_test.py --host 127.0.0.1 --port 4455 --password ""

It will attempt to import the installed obs-websocket client, connect and call GetSceneList,
printing full response and exception traceback to help diagnose protocol/version mismatches.
"""
import argparse
import traceback

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--host', default='127.0.0.1')
    parser.add_argument('--port', type=int, default=4455)
    parser.add_argument('--password', default='')
    args = parser.parse_args()

    print('Using obs-websocket client from Python environment...')
    try:
        from obswebsocket import obsws, requests as obsreq
        print('Imported obswebsocket (legacy client)')
    except Exception as e:
        print('Failed to import obswebsocket:', repr(e))
        print('Traceback:')
        traceback.print_exc()
        return

    try:
        ws = obsws(args.host, args.port, args.password)
        print(f'Connecting to {args.host}:{args.port} ...')
        ws.connect()
        print('Connected OK')
        print('Calling GetSceneList...')
        resp = ws.call(obsreq.GetSceneList())
        print('Call returned. repr(resp)=')
        try:
            print(repr(resp))
        except Exception:
            print('<unprintable resp>')
        try:
            scenes = resp.getScenes()
            print('resp.getScenes() ->', repr(scenes))
        except Exception as e:
            print('Error while reading scenes:', repr(e))
            traceback.print_exc()
        ws.disconnect()
        print('Disconnected')
    except Exception as e:
        print('Exception during connect/call:', repr(e))
        traceback.print_exc()

if __name__ == '__main__':
    main()
