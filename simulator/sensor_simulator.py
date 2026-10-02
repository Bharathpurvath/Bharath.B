import json
import os
import random
import time
from datetime import datetime, timezone
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


API_URL = os.getenv(
    "SMART_FARM_API_URL",
    "http://127.0.0.1:8000/sensors/readings",
)
SENSOR_INTERVAL_SECONDS = float(os.getenv("SENSOR_INTERVAL_SECONDS", "3"))
REQUEST_TIMEOUT_SECONDS = 5

if SENSOR_INTERVAL_SECONDS <= 0:
    raise ValueError("SENSOR_INTERVAL_SECONDS must be greater than zero")


def create_sensor_reading():
    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "soil_moisture_percent": round(random.uniform(20, 80), 1),
        "temperature_celsius": round(random.uniform(18, 35), 1),
        "humidity_percent": round(random.uniform(30, 90), 1),
        "light_lux": round(random.uniform(100, 1000), 1),
        "water_level_percent": round(random.uniform(10, 100), 1),
    }


def send_reading(reading):
    request = Request(
        API_URL,
        data=json.dumps(reading).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
            print(f"Sent reading. API response: {response.status}", flush=True)
    except HTTPError as error:
        print(
            f"API rejected the reading: HTTP {error.code} {error.reason}",
            flush=True,
        )
    except URLError as error:
        print(f"API unavailable; will retry: {error.reason}", flush=True)


print(f"Sending simulated readings to {API_URL}", flush=True)
print(f"Update interval: {SENSOR_INTERVAL_SECONDS:g} seconds", flush=True)

while True:
    send_reading(create_sensor_reading())
    time.sleep(SENSOR_INTERVAL_SECONDS)
