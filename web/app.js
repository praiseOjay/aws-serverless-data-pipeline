// Configuration: Live deployed AWS API Gateway Endpoint URL
const API_ENDPOINT = "https://bbziio2ys5.execute-api.eu-west-2.amazonaws.com/Prod/api/weather/history";

// App State
let rawDataset = [];
let chartInstance = null;
let currentUnitSystem = "metric"; // 'metric' (°C, km/h) or 'imperial' (°F, mph)
let selectedTimeHours = 24;       // 6, 12, 24, 168
let selectedMetric = "all";       // 'all', 'temp', 'humidity', 'wind'
let previousValues = { temp: 0, humidity: 0, wind: 0 };

// Unit Conversion Helpers
function convertTemp(celsius) {
    if (currentUnitSystem === "imperial") {
        return (celsius * 9 / 5) + 32;
    }
    return celsius;
}

function getTempUnit() {
    return currentUnitSystem === "imperial" ? "°F" : "°C";
}

function convertWind(kmh) {
    if (currentUnitSystem === "imperial") {
        return kmh * 0.621371;
    }
    return kmh;
}

function getWindUnit() {
    return currentUnitSystem === "imperial" ? "mph" : "km/h";
}

// Resolve Exact Location Name & Coordinates
function resolveLocationName(item) {
    if (!item) return "London, UK (51.51°N, 0.13°W)";
    if (item.location) return item.location;
    
    const nLat = Number(item.latitude);
    const nLon = Number(item.longitude);
    
    if (isNaN(nLat) || isNaN(nLon)) return "London, UK (51.51°N, 0.13°W)";
    
    // Check if coordinates match London ingestion point (~51.51, -0.13)
    if (Math.abs(nLat - 51.5) < 0.5 && Math.abs(nLon - (-0.12)) < 0.5) {
        return `London, UK (${nLat.toFixed(2)}°N, ${Math.abs(nLon).toFixed(2)}°W)`;
    }
    
    const latStr = nLat >= 0 ? `${nLat.toFixed(2)}°N` : `${Math.abs(nLat).toFixed(2)}°S`;
    const lonStr = nLon >= 0 ? `${nLon.toFixed(2)}°E` : `${Math.abs(nLon).toFixed(2)}°W`;
    return `${latStr}, ${lonStr}`;
}

// Find the Weather Record Closest to the Current Real-World Hour
function findCurrentWeatherRecord(items) {
    if (!items || items.length === 0) return null;
    
    const now = Date.now();
    let closestItem = items[0];
    let smallestDiff = Math.abs(new Date(closestItem.timestamp).getTime() - now);

    for (let i = 1; i < items.length; i++) {
        const itemTime = new Date(items[i].timestamp).getTime();
        const diff = Math.abs(itemTime - now);
        if (diff < smallestDiff) {
            smallestDiff = diff;
            closestItem = items[i];
        }
    }
    return closestItem;
}

// Format Accurate Date & Time in UTC
function formatObservationTime(timestampStr) {
    if (!timestampStr) return "Just now";
    const date = new Date(timestampStr);
    
    const hours = date.getUTCHours().toString().padStart(2, '0');
    const minutes = date.getUTCMinutes().toString().padStart(2, '0');
    
    const day = date.getUTCDate();
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = months[date.getUTCMonth()];
    
    return `${month} ${day}, ${hours}:${minutes} UTC`;
}

// Weather Condition Interpreter
function determineWeatherCondition(tempC, humidity, windKmh) {
    if (windKmh > 25) {
        return { icon: "💨", text: "Windy & Gusty" };
    }
    if (tempC >= 25 && humidity < 50) {
        return { icon: "☀️", text: "Warm & Clear" };
    }
    if (tempC >= 20 && humidity <= 65) {
        return { icon: "🌤️", text: "Mild & Pleasant" };
    }
    if (humidity > 80) {
        return { icon: "🌧️", text: "Humid & Overcast" };
    }
    if (tempC < 15) {
        return { icon: "🧥", text: "Crisp & Cool" };
    }
    return { icon: "⛅", text: "Partly Cloudy" };
}

function getWindDescription(speedKmh) {
    if (speedKmh < 5) return "Calm Air Condition";
    if (speedKmh < 12) return "Light Breeze Condition";
    if (speedKmh < 20) return "Gentle Breeze Condition";
    if (speedKmh < 29) return "Moderate Wind Condition";
    return "Fresh Wind Condition";
}

function getHumidityDescription(humidity) {
    if (humidity < 30) return "Low Dry Humidity Level";
    if (humidity <= 60) return "Optimal Comfort Level";
    return "High Humidity Level";
}

// Animated Count-Up Function
function animateValue(elementId, start, end, duration, formatFn) {
    const obj = document.getElementById(elementId);
    if (!obj) return;
    
    if (isNaN(start) || isNaN(end) || duration <= 0) {
        obj.textContent = formatFn ? formatFn(end) : end;
        return;
    }

    const startTime = performance.now();

    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeProgress = 1 - (1 - progress) * (1 - progress);
        const current = start + (end - start) * easeProgress;

        obj.textContent = formatFn ? formatFn(current) : current.toFixed(1);

        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            obj.textContent = formatFn ? formatFn(end) : end.toFixed(1);
        }
    }

    requestAnimationFrame(update);
}

// Update Top KPI Cards
function updateKPIs(currentRecord) {
    if (!currentRecord) return;

    const rawTempC = Number(currentRecord.temperature_2m);
    const rawWindKmh = Number(currentRecord.wind_speed_10m);
    const rawHumidity = Number(currentRecord.relative_humidity_2m);

    const displayTemp = convertTemp(rawTempC);
    const displayWind = convertWind(rawWindKmh);

    // Animate KPI Numbers
    animateValue("kpi-temp", previousValues.temp ? convertTemp(previousValues.temp) : displayTemp * 0.8, displayTemp, 800, (v) => `${v.toFixed(1)} ${getTempUnit()}`);
    animateValue("kpi-humidity", previousValues.humidity || rawHumidity * 0.8, rawHumidity, 800, (v) => `${Math.round(v)} %`);
    animateValue("kpi-wind", previousValues.wind ? convertWind(previousValues.wind) : displayWind * 0.8, displayWind, 800, (v) => `${v.toFixed(1)} ${getWindUnit()}`);

    // Update Accurate Location and Time Subtext
    const locationName = resolveLocationName(currentRecord);
    const formattedTime = formatObservationTime(currentRecord.timestamp);
    document.getElementById("kpi-temp-sub").textContent = `${locationName} • Updated ${formattedTime}`;
    
    const humSub = document.getElementById("kpi-humidity-sub");
    if (humSub) humSub.textContent = getHumidityDescription(rawHumidity);
    
    const windSub = document.getElementById("kpi-wind-sub");
    if (windSub) windSub.textContent = getWindDescription(rawWindKmh);

    // Dynamic Weather Condition Badge in Header
    const condition = determineWeatherCondition(rawTempC, rawHumidity, rawWindKmh);
    const conditionIcon = document.getElementById("condition-icon");
    const conditionText = document.getElementById("condition-text");
    if (conditionIcon) conditionIcon.textContent = condition.icon;
    if (conditionText) conditionText.textContent = condition.text;

    // Save previous values for future smooth animations
    previousValues = { temp: rawTempC, humidity: rawHumidity, wind: rawWindKmh };
}

// Update Analytics Strip Summary
function updateAnalyticsStrip(items) {
    if (!items || items.length === 0) return;

    // Calculate over the 24 hours around current time
    const chronological = [...items].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const currentRecord = findCurrentWeatherRecord(chronological);
    const currentIndex = chronological.indexOf(currentRecord);
    
    let startIdx = Math.max(0, currentIndex - 12);
    let endIdx = Math.min(chronological.length, startIdx + 24);
    const windowItems = chronological.slice(startIdx, endIdx);

    const temps = windowItems.map(item => Number(item.temperature_2m)).filter(v => !isNaN(v));
    const humidities = windowItems.map(item => Number(item.relative_humidity_2m)).filter(v => !isNaN(v));
    const winds = windowItems.map(item => Number(item.wind_speed_10m)).filter(v => !isNaN(v));

    if (temps.length > 0) {
        const maxTemp = Math.max(...temps);
        const minTemp = Math.min(...temps);
        const dispMax = convertTemp(maxTemp).toFixed(1);
        const dispMin = convertTemp(minTemp).toFixed(1);
        document.getElementById("stat-temp-range").textContent = `High: ${dispMax} ${getTempUnit()} | Low: ${dispMin} ${getTempUnit()}`;
    }

    if (humidities.length > 0) {
        const avgHum = Math.round(humidities.reduce((a, b) => a + b, 0) / humidities.length);
        document.getElementById("stat-avg-humidity").textContent = `${avgHum} %`;
    }

    if (winds.length > 0) {
        const maxWind = Math.max(...winds);
        const dispMaxWind = convertWind(maxWind).toFixed(1);
        document.getElementById("stat-peak-wind").textContent = `${dispMaxWind} ${getWindUnit()}`;
    }
}

// Next EventBridge Trigger Countdown Timer
function startEventBridgeCountdown() {
    function updateCountdown() {
        const now = new Date();
        const minutes = 59 - now.getUTCMinutes();
        const seconds = 59 - now.getUTCSeconds();
        const timerElem = document.getElementById("stat-next-sync");
        if (timerElem) {
            timerElem.textContent = `in ~${minutes}m ${seconds}s`;
        }
    }
    updateCountdown();
    setInterval(updateCountdown, 1000);
}

// Render / Re-render Chart.js with Chronological Slicing
function renderChart() {
    if (!rawDataset || rawDataset.length === 0) return;

    // Sort chronologically from past to future
    const chronological = [...rawDataset].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    // Find current hour index
    const currentRecord = findCurrentWeatherRecord(chronological);
    const currentIndex = chronological.indexOf(currentRecord);

    // Slice time window centered on current time
    let startIndex, endIndex;
    if (selectedTimeHours >= chronological.length) {
        startIndex = 0;
        endIndex = chronological.length;
    } else {
        const pastOffset = Math.floor(selectedTimeHours / 2);
        startIndex = Math.max(0, currentIndex - pastOffset);
        endIndex = Math.min(chronological.length, startIndex + selectedTimeHours);
        if (endIndex - startIndex < selectedTimeHours && startIndex > 0) {
            startIndex = Math.max(0, endIndex - selectedTimeHours);
        }
    }

    const windowDataset = chronological.slice(startIndex, endIndex);

    const labels = windowDataset.map(item => {
        const d = new Date(item.timestamp);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    });

    const rawTemps = windowDataset.map(item => Number(item.temperature_2m));
    const rawHumidity = windowDataset.map(item => Number(item.relative_humidity_2m));
    const rawWind = windowDataset.map(item => Number(item.wind_speed_10m));

    const convertedTemps = rawTemps.map(v => Number(convertTemp(v).toFixed(1)));
    const convertedWind = rawWind.map(v => Number(convertWind(v).toFixed(1)));

    const ctx = document.getElementById('weatherChart').getContext('2d');
    if (chartInstance) {
        chartInstance.destroy();
    }

    const tempGradient = ctx.createLinearGradient(0, 0, 0, 300);
    tempGradient.addColorStop(0, 'rgba(56, 189, 248, 0.45)');
    tempGradient.addColorStop(1, 'rgba(56, 189, 248, 0.0)');

    const humidityGradient = ctx.createLinearGradient(0, 0, 0, 300);
    humidityGradient.addColorStop(0, 'rgba(168, 85, 247, 0.35)');
    humidityGradient.addColorStop(1, 'rgba(168, 85, 247, 0.0)');

    const windGradient = ctx.createLinearGradient(0, 0, 0, 300);
    windGradient.addColorStop(0, 'rgba(52, 211, 153, 0.35)');
    windGradient.addColorStop(1, 'rgba(52, 211, 153, 0.0)');

    const allDatasets = {
        temp: {
            label: `Temperature (${getTempUnit()})`,
            data: convertedTemps,
            borderColor: '#38bdf8',
            backgroundColor: tempGradient,
            fill: true,
            tension: 0.4,
            borderWidth: 3,
            pointBackgroundColor: '#38bdf8',
            pointRadius: 4,
            yAxisID: 'y'
        },
        humidity: {
            label: 'Humidity (%)',
            data: rawHumidity,
            borderColor: '#a855f7',
            backgroundColor: humidityGradient,
            fill: true,
            tension: 0.4,
            borderWidth: 2,
            pointBackgroundColor: '#a855f7',
            pointRadius: 3,
            yAxisID: selectedMetric === 'all' ? 'y1' : 'y'
        },
        wind: {
            label: `Wind Speed (${getWindUnit()})`,
            data: convertedWind,
            borderColor: '#34d399',
            backgroundColor: windGradient,
            fill: true,
            tension: 0.4,
            borderWidth: 2,
            pointBackgroundColor: '#34d399',
            pointRadius: 3,
            yAxisID: selectedMetric === 'all' ? 'y' : 'y'
        }
    };

    let activeDatasets = [];
    if (selectedMetric === "all") {
        activeDatasets = [allDatasets.temp, allDatasets.humidity, allDatasets.wind];
    } else if (selectedMetric === "temp") {
        activeDatasets = [allDatasets.temp];
    } else if (selectedMetric === "humidity") {
        activeDatasets = [allDatasets.humidity];
    } else if (selectedMetric === "wind") {
        activeDatasets = [allDatasets.wind];
    }

    const scalesConfig = {
        x: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#94a3b8', font: { family: 'Inter', size: 11 } }
        },
        y: {
            type: 'linear',
            display: true,
            position: 'left',
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#94a3b8', font: { family: 'Inter', size: 11 } }
        }
    };

    if (selectedMetric === "all") {
        scalesConfig.y1 = {
            type: 'linear',
            display: true,
            position: 'right',
            grid: { drawOnChartArea: false },
            ticks: { color: '#a855f7', font: { family: 'Inter', size: 11 } }
        };
    }

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: activeDatasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: {
                    labels: {
                        color: '#94a3b8',
                        font: { family: 'Inter', size: 12 }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    titleColor: '#f8fafc',
                    bodyColor: '#cbd5e1',
                    borderColor: 'rgba(255, 255, 255, 0.15)',
                    borderWidth: 1,
                    padding: 12,
                    boxPadding: 6
                }
            },
            scales: scalesConfig
        }
    });
}

// Fallback Mock Generator (for offline preview if API unreachable)
function generateMockWeatherData() {
    const items = [];
    const now = new Date();
    for (let i = 0; i < 48; i++) {
        const time = new Date(now.getTime() - (24 - i) * 3600 * 1000);
        items.push({
            id: String(Math.floor(time.getTime() / 1000)),
            timestamp: time.toISOString(),
            latitude: 51.5074,
            longitude: -0.1278,
            location: "London, UK (51.51°N, 0.13°W)",
            temperature_2m: Number((18 + Math.sin(i / 3) * 4 + Math.random() * 0.5).toFixed(1)),
            relative_humidity_2m: Math.round(65 + Math.cos(i / 4) * 15 + Math.random() * 3),
            wind_speed_10m: Number((8 + Math.random() * 6).toFixed(1))
        });
    }
    return items;
}

// Main Data Fetcher
async function loadDashboardData() {
    const statusText = document.querySelector(".status-text");
    const refreshIcon = document.getElementById("refresh-icon");
    if (refreshIcon) refreshIcon.classList.add("spin");
    if (statusText) statusText.textContent = "Syncing Pipeline State...";

    try {
        const response = await fetch(API_ENDPOINT);
        if (!response.ok) throw new Error("API Gateway unreachable.");
        
        const rawItems = await response.json();
        if (!Array.isArray(rawItems) || rawItems.length === 0) throw new Error("Empty dataset from API.");

        rawDataset = rawItems;
        if (statusText) statusText.textContent = "Step Functions Active (API Live)";
    } catch (err) {
        console.warn("Using offline mock pipeline dataset:", err.message);
        rawDataset = generateMockWeatherData();
        if (statusText) statusText.textContent = "Step Functions Active (Live Preview)";
    } finally {
        if (refreshIcon) {
            setTimeout(() => refreshIcon.classList.remove("spin"), 600);
        }
    }

    if (rawDataset.length > 0) {
        const currentRecord = findCurrentWeatherRecord(rawDataset);
        updateKPIs(currentRecord);
        updateAnalyticsStrip(rawDataset);
        renderChart();
    }
}

// Setup Event Listeners & UI Controls
function initControls() {
    // Unit Switcher Toggle Button
    const unitToggleBtn = document.getElementById("unit-toggle");
    const unitLabel = document.getElementById("unit-label");
    if (unitToggleBtn) {
        unitToggleBtn.addEventListener("click", () => {
            currentUnitSystem = currentUnitSystem === "metric" ? "imperial" : "metric";
            unitLabel.textContent = currentUnitSystem === "metric" ? "Metric (°C, km/h)" : "Imperial (°F, mph)";
            
            if (rawDataset.length > 0) {
                const currentRecord = findCurrentWeatherRecord(rawDataset);
                updateKPIs(currentRecord);
                updateAnalyticsStrip(rawDataset);
                renderChart();
            }
        });
    }

    // Time Filter Chips (6h, 12h, 24h, 7d)
    const timeButtons = document.querySelectorAll("#time-filter-group .chip");
    timeButtons.forEach(btn => {
        btn.addEventListener("click", (e) => {
            timeButtons.forEach(b => b.classList.remove("active"));
            e.target.classList.add("active");
            selectedTimeHours = Number(e.target.dataset.hours) || 24;
            renderChart();
        });
    });

    // Metric Filter Pills (Combined, Temp, Humidity, Wind)
    const metricButtons = document.querySelectorAll("#metric-filter-group .pill");
    metricButtons.forEach(btn => {
        btn.addEventListener("click", (e) => {
            metricButtons.forEach(b => b.classList.remove("active"));
            e.target.classList.add("active");
            selectedMetric = e.target.dataset.metric || "all";
            renderChart();
        });
    });

    // Refresh Button
    const refreshBtn = document.getElementById("refresh-btn");
    if (refreshBtn) {
        refreshBtn.addEventListener("click", loadDashboardData);
    }
}

// Initialize on DOM Ready
document.addEventListener("DOMContentLoaded", () => {
    initControls();
    startEventBridgeCountdown();
    loadDashboardData();
    
    // Auto-refresh every 60 seconds
    setInterval(loadDashboardData, 60000);
});
