from datetime import datetime

from sqlmodel import Field, SQLModel


class SensorReadingRecord(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    timestamp: datetime
    soil_moisture_percent: float
    temperature_celsius: float
    humidity_percent: float
    light_lux: float
    water_level_percent: float