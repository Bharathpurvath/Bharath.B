import json
import random
import time
from datetime import datetime, timezone
from urllib.request import Request, urlopen


API_URL = "http://127.0.0.1:8000/sensors/readings"

while True:
    reading = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "soil_moisture_percent": round(random.uniform(20, 80), 1),
        "temperature_celsius": round(random.uniform(18, 35), 1),
        "humidity_percent": round(random.uniform(30, 90), 1),
        "light_lux": round(random.uniform(100, 1000), 1),
        "water_level_percent": round(random.uniform(10, 100), 1),
    }

    request = Request(
        API_URL,
        data=json.dumps(reading).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    with urlopen(request) as response:
        print(f"Sent reading. API response: {response.status}")

    time.sleep(3)