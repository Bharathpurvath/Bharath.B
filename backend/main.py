from contextlib import asynccontextmanager
from datetime import datetime
from statistics import mean

from fastapi import Depends, FastAPI
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlmodel import Session, select

from backend.database import create_db_and_tables, get_session
from backend.models import SensorReadingRecord


LOW_SOIL_MOISTURE_LIMIT = 30
LOW_WATER_LEVEL_LIMIT = 10


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    yield


app = FastAPI(title="Smart Farming API", lifespan=lifespan)


class SensorReading(BaseModel):
    timestamp: datetime
    soil_moisture_percent: float
    temperature_celsius: float
    humidity_percent: float
    light_lux: float
    water_level_percent: float


@app.get("/")
def read_root():
    return {"message": "Smart Farming API is running"}


@app.get("/health")
def health_check():
    return {"status": "healthy"}


@app.post("/sensors/readings")
def receive_sensor_reading(
    reading: SensorReading,
    session: Session = Depends(get_session),
):
    database_reading = SensorReadingRecord(**reading.model_dump())
    session.add(database_reading)
    session.commit()
    session.refresh(database_reading)

    return {
        "message": "Sensor reading saved",
        "id": database_reading.id,
        "reading": database_reading,
    }


@app.get("/sensors/readings")
def get_sensor_readings(
    session: Session = Depends(get_session),
):
    statement = select(SensorReadingRecord).order_by(
        SensorReadingRecord.id.desc()
    )
    return session.exec(statement).all()


@app.get("/irrigation/status")
def get_irrigation_status(
    session: Session = Depends(get_session),
):
    statement = (
        select(SensorReadingRecord)
        .order_by(SensorReadingRecord.id.desc())
        .limit(1)
    )
    latest = session.exec(statement).first()

    if latest is None:
        return {
            "pump_on": False,
            "mode": "simulated",
            "message": "No sensor readings are available yet.",
        }

    pump_on = (
        latest.soil_moisture_percent <= LOW_SOIL_MOISTURE_LIMIT
        and latest.water_level_percent > LOW_WATER_LEVEL_LIMIT
    )

    if latest.water_level_percent <= LOW_WATER_LEVEL_LIMIT:
        message = "Water level is too low; the simulated pump stays off."
    elif pump_on:
        message = "Soil is dry; the simulated pump is on."
    else:
        message = "Soil moisture is sufficient; the simulated pump is off."

    return {
        "pump_on": pump_on,
        "mode": "simulated",
        "message": message,
    }


@app.get("/analytics/summary")
def get_analytics_summary(
    session: Session = Depends(get_session),
):
    readings = session.exec(select(SensorReadingRecord)).all()

    if not readings:
        return {
            "readings_count": 0,
            "average_soil_moisture_percent": None,
            "average_temperature_celsius": None,
            "average_humidity_percent": None,
            "average_water_level_percent": None,
        }

    return {
        "readings_count": len(readings),
        "average_soil_moisture_percent": round(
            mean(reading.soil_moisture_percent for reading in readings), 1
        ),
        "average_temperature_celsius": round(
            mean(reading.temperature_celsius for reading in readings), 1
        ),
        "average_humidity_percent": round(
            mean(reading.humidity_percent for reading in readings), 1
        ),
        "average_water_level_percent": round(
            mean(reading.water_level_percent for reading in readings), 1
        ),
    }


app.mount(
    "/dashboard",
    StaticFiles(directory="frontend", html=True),
    name="dashboard",
)