const API_URL = "/sensors/readings";
const IRRIGATION_URL = "/irrigation/status";
const ANALYTICS_URL = "/analytics/summary";
const LOW_SOIL_MOISTURE_LIMIT = 30;
const TREND_READING_COUNT = 24;
const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

const TREND_METRICS = {
  soil_moisture_percent: {
    label: "Soil moisture",
    unit: "%",
    color: "#28784a",
    decimals: 1,
    deltaUnit: "percentage points",
  },
  temperature_celsius: {
    label: "Temperature",
    unit: "°C",
    color: "#c05a36",
    decimals: 1,
    deltaUnit: "°C",
  },
  humidity_percent: {
    label: "Humidity",
    unit: "%",
    color: "#3478a5",
    decimals: 1,
    deltaUnit: "percentage points",
  },
  light_lux: {
    label: "Light intensity",
    unit: "lux",
    color: "#a57a16",
    decimals: 0,
    deltaUnit: "lux",
  },
  water_level_percent: {
    label: "Water level",
    unit: "%",
    color: "#7656a6",
    decimals: 1,
    deltaUnit: "percentage points",
  },
};

let latestReadings = [];

function setConnectionStatus(message, state) {
  const status = document.getElementById("connection-status");
  status.textContent = message;
  status.className = `connection-status is-${state}`;
}

function showEmptyDashboard() {
  ["soil-moisture", "temperature", "humidity", "light", "water-level"]
    .forEach((id) => {
      document.getElementById(id).textContent = "--";
    });

  document.getElementById("soil-alert").textContent = "";
  document.getElementById("pump-status").textContent = "No sensor data";
  document.getElementById("pump-status").className = "pump-off";
  document.getElementById("pump-message").textContent =
    "Start the sensor simulator or connect a sensor node to see irrigation status.";
  document.getElementById("reading-count").textContent = "No saved readings yet";
  ["average-soil", "average-temperature", "average-humidity", "average-water"]
    .forEach((id) => {
      document.getElementById(id).textContent = "--";
    });
  const emptyRow = document.createElement("tr");
  const emptyCell = document.createElement("td");
  emptyCell.colSpan = 6;
  emptyCell.textContent = "No sensor readings have been saved yet.";
  emptyRow.appendChild(emptyCell);
  document.getElementById("history-rows").replaceChildren(emptyRow);
  document.getElementById("last-updated").textContent =
    "Waiting for the first sensor reading...";
  document.getElementById("download-csv").disabled = true;
}

function csvCell(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function downloadReadingsCsv() {
  if (latestReadings.length === 0) {
    return;
  }

  const columns = [
    "id",
    "timestamp",
    "soil_moisture_percent",
    "temperature_celsius",
    "humidity_percent",
    "light_lux",
    "water_level_percent",
  ];
  const lines = [
    columns.map(csvCell).join(","),
    ...latestReadings.map((reading) =>
      columns.map((column) => csvCell(reading[column])).join(","),
    ),
  ];
  const file = new Blob(["\uFEFF", lines.join("\r\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  const timestamp = new Date().toISOString().slice(0, 19).replaceAll(":", "-");

  link.href = url;
  link.download = `smart-farming-readings-${timestamp}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function formatMetricValue(value, metric) {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: metric.decimals,
  }).format(value);
}

function createSvgElement(name, attributes = {}) {
  const element = document.createElementNS(SVG_NAMESPACE, name);

  Object.entries(attributes).forEach(([attribute, value]) => {
    element.setAttribute(attribute, value);
  });

  return element;
}

function renderTrendChart(readings) {
  const chart = document.getElementById("trend-chart");
  const summary = document.getElementById("trend-summary");
  const metricKey = document.getElementById("trend-metric").value;
  const metric = TREND_METRICS[metricKey];
  const points = readings
    .slice(0, TREND_READING_COUNT)
    .reverse()
    .map((reading) => ({
      timestamp: new Date(reading.timestamp),
      value: Number(reading[metricKey]),
    }))
    .filter((point) => Number.isFinite(point.value));

  chart.replaceChildren();
  chart.appendChild(createSvgElement("title", { id: "trend-chart-title" }));
  chart.appendChild(createSvgElement("desc", { id: "trend-chart-description" }));

  const title = chart.querySelector("title");
  const description = chart.querySelector("desc");
  title.textContent = `${metric.label} over the latest sensor readings`;

  if (points.length === 0) {
    summary.textContent = "No sensor readings are available yet.";
    description.textContent = "No readings are available to display.";

    const emptyText = createSvgElement("text", {
      x: "380",
      y: "164",
      class: "chart-empty",
      "text-anchor": "middle",
    });
    emptyText.textContent = "Waiting for sensor readings";
    chart.appendChild(emptyText);
    return;
  }

  const values = points.map((point) => point.value);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const rawRange = rawMax - rawMin;
  const padding = rawRange === 0
    ? Math.max(Math.abs(rawMax) * 0.08, 1)
    : rawRange * 0.12;
  const minValue = rawMin - padding;
  const maxValue = rawMax + padding;
  const plot = { left: 62, right: 744, top: 24, bottom: 264 };
  const width = plot.right - plot.left;
  const height = plot.bottom - plot.top;
  const valueToY = (value) =>
    plot.bottom - ((value - minValue) / (maxValue - minValue)) * height;
  const pointToX = (index) =>
    points.length === 1
      ? plot.left + width / 2
      : plot.left + (index / (points.length - 1)) * width;

  for (let index = 0; index <= 4; index += 1) {
    const fraction = index / 4;
    const y = plot.top + fraction * height;
    const value = maxValue - fraction * (maxValue - minValue);
    const gridLine = createSvgElement("line", {
      x1: plot.left,
      x2: plot.right,
      y1: y,
      y2: y,
      class: "chart-grid-line",
    });
    const yLabel = createSvgElement("text", {
      x: plot.left - 10,
      y: y + 4,
      class: "chart-axis-label",
      "text-anchor": "end",
    });
    yLabel.textContent = formatMetricValue(value, metric);
    chart.append(gridLine, yLabel);
  }

  const pathData = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${pointToX(index)} ${valueToY(point.value)}`)
    .join(" ");
  chart.appendChild(createSvgElement("path", {
    d: pathData,
    class: "chart-line",
    stroke: metric.color,
  }));

  points.forEach((point, index) => {
    const circle = createSvgElement("circle", {
      cx: pointToX(index),
      cy: valueToY(point.value),
      r: points.length > 18 ? 3 : 4,
      class: "chart-point",
      fill: metric.color,
    });
    const pointTitle = createSvgElement("title");
    pointTitle.textContent = `${point.timestamp.toLocaleString()}: ${formatMetricValue(point.value, metric)} ${metric.unit}`;
    circle.appendChild(pointTitle);
    chart.appendChild(circle);
  });

  chart.appendChild(createSvgElement("line", {
    x1: plot.left,
    x2: plot.right,
    y1: plot.bottom,
    y2: plot.bottom,
    class: "chart-axis-line",
  }));

  [0, Math.floor((points.length - 1) / 2), points.length - 1]
    .filter((index, position, indexes) => indexes.indexOf(index) === position)
    .forEach((index) => {
      const xLabel = createSvgElement("text", {
        x: pointToX(index),
        y: plot.bottom + 25,
        class: "chart-axis-label",
        "text-anchor": index === 0 ? "start" : index === points.length - 1 ? "end" : "middle",
      });
      xLabel.textContent = points[index].timestamp.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      });
      chart.appendChild(xLabel);
    });

  const firstValue = points[0].value;
  const latestValue = points[points.length - 1].value;
  const delta = latestValue - firstValue;
  const deltaPrefix = delta > 0 ? "+" : "";
  summary.textContent =
    `${points.length} readings · Latest ${metric.label.toLowerCase()}: ` +
    `${formatMetricValue(latestValue, metric)} ${metric.unit} · Change ` +
    `${deltaPrefix}${formatMetricValue(delta, metric)} ${metric.deltaUnit}`;
  description.textContent =
    `Line chart of ${metric.label.toLowerCase()} for the ${points.length} most recent readings, ` +
    `from ${formatMetricValue(firstValue, metric)} to ${formatMetricValue(latestValue, metric)} ${metric.unit}.`;
}

async function updateDashboard() {
  try {
    const response = await fetch(API_URL);

    if (!response.ok) {
      throw new Error("The sensor API returned an error");
    }

    const readings = await response.json();
    latestReadings = readings;
    renderTrendChart(readings);
    document.getElementById("download-csv").disabled = readings.length === 0;

    if (readings.length === 0) {
      showEmptyDashboard();
      setConnectionStatus("Connected · waiting for sensor readings", "waiting");
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

    setConnectionStatus("Connected to sensor data", "connected");
    document.getElementById("last-updated").textContent =
      `Last reading: ${new Date(latest.timestamp).toLocaleString()}`;
  } catch (error) {
    const message = latestReadings.length > 0
      ? "Dashboard update incomplete · displaying saved readings"
      : "Could not connect to the API";
    setConnectionStatus(message, "error");
  }
}

document.getElementById("trend-metric").addEventListener("change", () => {
  renderTrendChart(latestReadings);
});

document.getElementById("download-csv").addEventListener("click", downloadReadingsCsv);

updateDashboard();
setInterval(updateDashboard, 3000);
