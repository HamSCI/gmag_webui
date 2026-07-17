#!/usr/bin/env python3
"""mag-usb WebSocket -> MQTT bridge.

Reads readings from mag-usb's WebSocket feed and republishes each message
verbatim to an MQTT topic, so MQTT clients (e.g. the gmag_webui dashboard's
MQTT source) can consume the same JSON the WebSocket emits.

Why Python + `websockets` and not Deno: mag-usb's minimal WebSocket server does
*case-sensitive* HTTP header matching on the handshake. Deno (native and via its
node-compat layer) lowercases outgoing header names, which the server rejects
with 400. The standards-compliant `websockets` client sends properly-cased
headers and handshakes cleanly.

Configuration is read from the environment (see bridge.env):
  WS_URL         mag-usb WebSocket URL      (default ws://127.0.0.1:8765)
  MQTT_HOST      broker host                (default 127.0.0.1)
  MQTT_PORT      broker port                (default 1883)
  MQTT_USER      broker username            (optional)
  MQTT_PASSWORD  broker password            (optional)
  MQTT_TOPIC     topic to publish to        (default magnetometer/data)
"""
import asyncio
import os

import paho.mqtt.client as mqtt
import websockets

WS_URL = os.environ.get("WS_URL", "ws://127.0.0.1:8765")
MQTT_HOST = os.environ.get("MQTT_HOST", "127.0.0.1")
MQTT_PORT = int(os.environ.get("MQTT_PORT", "1883"))
MQTT_USER = os.environ.get("MQTT_USER") or None
MQTT_PASSWORD = os.environ.get("MQTT_PASSWORD") or None
MQTT_TOPIC = os.environ.get("MQTT_TOPIC", "magnetometer/data")


def make_mqtt_client():
    """Persistent, auto-reconnecting MQTT client (background network loop)."""
    client = mqtt.Client(client_id="ws-mqtt-bridge")
    if MQTT_USER:
        client.username_pw_set(MQTT_USER, MQTT_PASSWORD)
    client.on_connect = lambda c, u, f, rc: print(
        "[mqtt] connect rc=%s (%s)" % (rc, mqtt.connack_string(rc)), flush=True)
    client.on_disconnect = lambda c, u, rc: print(
        "[mqtt] disconnected rc=%s" % rc, flush=True)
    client.reconnect_delay_set(min_delay=1, max_delay=30)
    client.connect_async(MQTT_HOST, MQTT_PORT, keepalive=60)
    client.loop_start()
    return client


async def pump(client):
    """Reconnect to the WebSocket forever; republish each reading unchanged.

    ping_interval=None: mag-usb's minimal WS server does not answer client
    pings, so the default keepalive ping would time out and drop the link. The
    steady ~1 Hz data stream keeps the connection live on its own.
    """
    while True:
        try:
            async with websockets.connect(WS_URL, ping_interval=None) as ws:
                print("[ws] connected %s" % WS_URL, flush=True)
                async for msg in ws:
                    payload = msg if isinstance(msg, (bytes, bytearray)) \
                        else msg.encode("utf-8")
                    client.publish(MQTT_TOPIC, payload, qos=0, retain=False)
        except Exception as e:
            print("[ws] %s: %s -- retrying in 2s" % (type(e).__name__, e),
                  flush=True)
            await asyncio.sleep(2)


def main():
    client = make_mqtt_client()
    print("[bridge] %s -> mqtt %s:%s topic '%s'"
          % (WS_URL, MQTT_HOST, MQTT_PORT, MQTT_TOPIC), flush=True)
    try:
        asyncio.run(pump(client))
    except KeyboardInterrupt:
        pass
    finally:
        client.loop_stop()
        client.disconnect()


if __name__ == "__main__":
    main()
