# Smart Farming IoT Dashboard

A smart farming prototype that collects sensor readings, stores them in SQLite, and displays live farm conditions in a web dashboard. The current version uses a Python simulator; the API and dashboard are structured for a later ESP32 connection.

## Features

- FastAPI service for receiving and listing sensor readings
- SQLite storage created automatically when the backend starts
- Sensor simulator that posts sample data every three seconds
- Dashboard that refreshes sensor cards, recent readings, and analytics every three seconds
- Low soil moisture alert at or below 30%
- Simulated irrigation pump that turns on when soil moisture is low and water level is above 10%
- Low-water safeguard that keeps the simulated pump off at or below 10%
- Interactive API documentation at `/docs`

## Project structure

```text
backend/
  database.py          SQLite connection and session setup
  main.py              FastAPI routes and irrigation logic
  models.py            Sensor reading database model
frontend/
  app.js               Dashboard data loading and refresh
  index.html           Dashboard page
  style.css            Dashboard styling
simulator/
  sensor_simulator.py  Generates and submits sample readings
requirements.txt       Python dependencies
```

## Requirements

- Python 3.10 or newer
- Windows PowerShell (the commands below use PowerShell syntax)

## Run the project

From the project root in PowerShell, create the virtual environment and install the dependencies:

```powershell
py -m venv .venv
```

```powershell
.\.venv\Scripts\python.exe -m pip install -r .\requirements.txt
```

Start the API and dashboard server:

```powershell
.\.venv\Scripts\python.exe -m uvicorn backend.main:app --reload
```

In a second PowerShell terminal opened in the same project folder, start simulated sensor readings:

```powershell
.\.venv\Scripts\python.exe .\simulator\sensor_simulator.py
```

Open the dashboard or API documentation in a browser:

- Dashboard: <http://127.0.0.1:8000/dashboard/>
- API documentation: <http://127.0.0.1:8000/docs>
- Health check: <http://127.0.0.1:8000/health>

Stop the simulator with `Ctrl+C` in its terminal. Stop the backend with `Ctrl+C` in its terminal.

## API endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/` | API welcome message |
| `GET` | `/health` | Backend health status |
| `POST` | `/sensors/readings` | Save one sensor reading |
| `GET` | `/sensors/readings` | List saved readings, newest first |
| `GET` | `/irrigation/status` | Read the simulated pump state and reason |
| `GET` | `/analytics/summary` | Get the reading count and average values |

Example reading body:

```json
{
  "timestamp": "2026-10-02T12:00:00Z",
  "soil_moisture_percent": 45.5,
  "temperature_celsius": 25.2,
  "humidity_percent": 60.0,
  "light_lux": 500.0,
  "water_level_percent": 75.0
}
```

Sensor percentages must be between 0 and 100. Temperature is accepted from -50 to 100 °C, and light intensity must be non-negative.

## Data storage

The backend creates `smart_farming.db` in the project folder. The database and Python virtual environment are excluded from Git by `.gitignore`.

## Hardware integration

The current irrigation output is simulated in software. No physical pump or relay is controlled. The next hardware stage can connect an ESP32 and calibrated sensors to the same `POST /sensors/readings` API, then add a properly isolated relay driver with hardware safety controls.
