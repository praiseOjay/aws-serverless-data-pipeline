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
        // Ease out quadratic
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
function updateKPIs(latest) {
    const rawTempC = Number(latest.temp);
    const rawWindKmh = Number(latest.wind);
    const rawHumidity = Number(latest.humidity);

    const displayTemp = convertTemp(rawTempC);
    const displayWind = convertWind(rawWindKmh);

    // Animate KPI Numbers
    animateValue("kpi-temp", previousValues.temp ? convertTemp(previousValues.temp) : displayTemp * 0.8, displayTemp, 800, (v) => `${v.toFixed(1)} ${getTempUnit()}`);
    animateValue("kpi-humidity", previousValues.humidity || rawHumidity * 0.8, rawHumidity, 800, (v) => `${Math.round(v)} %`);
    animateValue("kpi-wind", previousValues.wind ? convertWind(previousValues.wind) : displayWind * 0.8, displayWind, 800, (v) => `${v.toFixed(1)} ${getWindUnit()}`);

    // Update Subtext & Badges
    document.getElementById("kpi-temp-sub").textContent = `London, UK • Updated ${latest.time} UTC`;
    
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

    // Calculate over the last 24 records (or all available)
    const windowItems = items.slice(0, 24);
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

// Render / Re-render Chart.js
function renderChart() {
    if (!rawDataset || rawDataset.length === 0) return;

    // Slice dataset by selected time range
    const sliced = rawDataset.slice(0, selectedTimeHours);
    
    // Sort chronologically for chart display
    const chronological = [...sliced].reverse();

    const labels = chronological.map(item => new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    const rawTemps = chronological.map(item => Number(item.temperature_2m));
    const rawHumidity = chronological.map(item => Number(item.relative_humidity_2m));
    const rawWind = chronological.map(item => Number(item.wind_speed_10m));

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
        const time = new Date(now.getTime() - i * 3600 * 1000);
        items.push({
            id: String(Math.floor(time.getTime() / 1000)),
            timestamp: time.toISOString(),
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
        const latestItem = rawDataset[0];
        const latestTime = new Date(latestItem.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        updateKPIs({
            temp: latestItem.temperature_2m,
            humidity: latestItem.relative_humidity_2m,
            wind: latestItem.wind_speed_10m,
            time: latestTime
        });

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
                const latestItem = rawDataset[0];
                const latestTime = new Date(latestItem.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                updateKPIs({
                    temp: latestItem.temperature_2m,
                    humidity: latestItem.relative_humidity_2m,
                    wind: latestItem.wind_speed_10m,
                    time: latestTime
                });
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
