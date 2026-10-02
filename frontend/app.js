const API_URL = "http://127.0.0.1:8000/sensors/readings";
const IRRIGATION_URL = "http://127.0.0.1:8000/irrigation/status";
const ANALYTICS_URL = "http://127.0.0.1:8000/analytics/summary";
const LOW_SOIL_MOISTURE_LIMIT = 30;

async function updateDashboard() {
  const status = document.getElementById("connection-status");

  try {
    const response = await fetch(API_URL);

    if (!response.ok) {
      throw new Error("The sensor API returned an error");
    }

    const readings = await response.json();

    if (readings.length === 0) {
      status.textContent = "Connected; waiting for sensor readings";
      return;
    }

    const latest = readings[0];

    document.getElementById("soil-moisture").textContent =
      `${latest.soil_moisture_percent}%`;
    document.getElementById("temperature").textContent =
      `${latest.temperature_celsius}°C`;
    document.getElementById("humidity").textContent =
      `${latest.humidity_percent}%`;
    document.getElementById("light").textContent =
      `${latest.light_lux} lux`;
    document.getElementById("water-level").textContent =
      `${latest.water_level_percent}%`;

    const soilAlert = document.getElementById("soil-alert");

    if (latest.soil_moisture_percent <= LOW_SOIL_MOISTURE_LIMIT) {
      soilAlert.textContent =
        "Low soil moisture detected. Irrigation may be needed.";
    } else {
      soilAlert.textContent = "";
    }

    const irrigationResponse = await fetch(IRRIGATION_URL);

    if (!irrigationResponse.ok) {
      throw new Error("The irrigation API returned an error");
    }

    const irrigation = await irrigationResponse.json();
    const pumpStatus = document.getElementById("pump-status");

    pumpStatus.textContent = irrigation.pump_on
      ? "Simulated pump: ON"
      : "Simulated pump: OFF";
    pumpStatus.className = irrigation.pump_on ? "pump-on" : "pump-off";

    document.getElementById("pump-message").textContent =
      irrigation.message;

    const analyticsResponse = await fetch(ANALYTICS_URL);

    if (!analyticsResponse.ok) {
      throw new Error("The analytics API returned an error");
    }

    const analytics = await analyticsResponse.json();

    document.getElementById("reading-count").textContent =
      `Based on ${analytics.readings_count} saved readings`;
    document.getElementById("average-soil").textContent =
      `${analytics.average_soil_moisture_percent}%`;
    document.getElementById("average-temperature").textContent =
      `${analytics.average_temperature_celsius}°C`;
    document.getElementById("average-humidity").textContent =
      `${analytics.average_humidity_percent}%`;
    document.getElementById("average-water").textContent =
      `${analytics.average_water_level_percent}%`;

    const historyRows = document.getElementById("history-rows");
    historyRows.replaceChildren();

    readings.slice(0, 10).forEach((reading) => {
      const row = document.createElement("tr");
      const values = [
        new Date(reading.timestamp).toLocaleTimeString(),
        `${reading.soil_moisture_percent}%`,
        `${reading.temperature_celsius}°C`,
        `${reading.humidity_percent}%`,
        `${reading.light_lux} lux`,
        `${reading.water_level_percent}%`,
      ];

      values.forEach((value) => {
        const cell = document.createElement("td");
        cell.textContent = value;
        row.appendChild(cell);
      });

      historyRows.appendChild(row);
    });

    status.textContent = "Connected to sensor data";
    document.getElementById("last-updated").textContent =
      `Last reading: ${new Date(latest.timestamp).toLocaleString()}`;
  } catch (error) {
    status.textContent = "Could not connect to the API";
  }
}

updateDashboard();
setInterval(updateDashboard, 3000);