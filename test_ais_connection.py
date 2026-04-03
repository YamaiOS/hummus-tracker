import asyncio
import json
import os
import traceback
from dotenv import load_dotenv
import websockets

load_dotenv()

async def test_ais():
    api_key = os.getenv("AISSTREAM_API_KEY")
    if not api_key:
        print("No AISSTREAM_API_KEY found")
        return

    url = "wss://stream.aisstream.io/v0/stream"
    
    # Try a broader area or no filtering if possible just to see if it connects
    # But for now, let's use the HORMUZ_BBOX from backend/models.py
    # "lat_min": 24.5, "lat_max": 27.0, "lon_min": 55.5, "lon_max": 58.0
    subscribe_msg = {
        "APIKey": api_key,
        "BoundingBoxes": [[[24.0, 50.0], [30.0, 65.0]]], # Larger area
    }

    print(f"Connecting to {url} with key {api_key[:10]}...")
    try:
        async with websockets.connect(url) as ws:
            await ws.send(json.dumps(subscribe_msg))
            print("Subscribed. Waiting for messages (30s)...")
            
            while True:
                try:
                    msg = await asyncio.wait_for(ws.recv(), timeout=30)
                    data = json.loads(msg)
                    print(f"Received message type: {data.get('MessageType')} from MMSI: {data.get('MetaData', {}).get('MMSI')}")
                except asyncio.TimeoutError:
                    print("No messages received in 30 seconds.")
                    break
    except Exception as e:
        print(f"Error: {e}")
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_ais())
