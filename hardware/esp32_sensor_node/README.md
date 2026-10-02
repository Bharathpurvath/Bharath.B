# ESP32 sensor node

This starter firmware reads an example set of sensors and posts the same JSON fields as the Python simulator to the FastAPI service. The current pump logic still runs as a simulation in the backend; this sketch does not control a physical pump or relay.

## Example parts and pin map

This example assumes a classic ESP32 DevKit board, a DHT22, a BH1750 light sensor, an analog capacitive soil-moisture probe, and an analog water-level sensor. Change the pins and calibration for your actual board and sensor modules.

| Sensor | ESP32 connection |
| --- | --- |
| DHT22 data | GPIO 4 |
| BH1750 SDA | GPIO 21 |
| BH1750 SCL | GPIO 22 |
| Soil-moisture analog output | GPIO 34 |
| Water-level analog output | GPIO 35 |
| Sensor grounds | ESP32 GND |

Power each module according to its datasheet. ESP32 analog inputs must not receive more than 3.3 V. Some bare DHT22 sensors need a pull-up resistor between data and 3.3 V; many breakout boards already include one.

## Arduino setup

1. Install the Arduino IDE and the [Espressif ESP32 board package](https://docs.espressif.com/projects/arduino-esp32/en/latest/).
2. In the library manager, install [DHT sensor library](https://github.com/adafruit/DHT-sensor-library) by Adafruit, **Adafruit Unified Sensor**, and [BH1750](https://github.com/claws/BH1750) by Christopher Laws.
3. Copy `secrets.example.h` to `secrets.h` in this same folder.
4. Edit `secrets.h` with your 2.4 GHz Wi-Fi name, password, and the computer's local IPv4 address in `API_URL`.
5. Open `esp32_sensor_node.ino`, select your ESP32 board and port, then upload it.
6. Open Serial Monitor at 115200 baud to see Wi-Fi and sensor messages.

The real `secrets.h` file is ignored by Git. Keep it local and do not paste Wi-Fi credentials into the committed example file.

## Compile from PowerShell

Install Arduino CLI and make sure `arduino-cli` is available in PowerShell's `PATH`. From the repository root, add Espressif's board index once, then install the ESP32 core and required libraries and compile for a classic ESP32 DevKit:

```powershell
arduino-cli config add board_manager.additional_urls https://espressif.github.io/arduino-esp32/package_esp32_index.json
arduino-cli core update-index
arduino-cli core install esp32:esp32@3.3.12
arduino-cli lib install "DHT sensor library@1.4.7" "Adafruit Unified Sensor@1.1.15" "BH1750@1.3.0"
arduino-cli compile --fqbn esp32:esp32:esp32 hardware/esp32_sensor_node/esp32_sensor_node.ino
```

This sketch compiled successfully on October 2, 2026 with Arduino CLI 1.5.1, ESP32 core 3.3.12, and those library versions. The reported build used 980,300 bytes (74%) of program storage and 50,280 bytes (15%) of global memory. A physical board is still needed to upload and check sensor wiring and calibration.

## Let the ESP32 reach the API

The API must listen on the computer's network interface. From the project root, start it with:

```powershell
.\.venv\Scripts\python.exe -m uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

Run `ipconfig` on the computer and use its private IPv4 address in `API_URL`, for example `http://192.168.1.100:8000/sensors/readings`. The ESP32 and computer must be on the same local network. If Windows Firewall asks, allow access on the private network. Do not expose this development API directly to the public internet.

## Calibrate the analog sensors

The starting raw ADC values in the sketch are examples only. Use Serial Monitor to observe the raw values in dry and wet conditions, then update `SOIL_DRY_RAW`, `SOIL_WET_RAW`, `WATER_EMPTY_RAW`, and `WATER_FULL_RAW` in the sketch. The percentages are estimates until calibrated for the exact probes, soil, and reservoir.

The firmware waits for network time before sending timestamps. It retries Wi-Fi on later samples if the network is temporarily unavailable, and skips invalid sensor readings instead of posting them.
