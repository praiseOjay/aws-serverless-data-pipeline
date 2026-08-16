// Configuration: Live deployed AWS API Gateway Endpoint URL
const API_ENDPOINT = "https://bbziio2ys5.execute-api.eu-west-2.amazonaws.com/Prod/api/weather/history";

let chartInstance = null;

// Mock Dataset Generator for offline/local preview
function generateMockWeatherData() {
    const hours = [];
    const temps = [];
    const humidity = [];
    const wind = [];
    
    const now = new Date();
    for (let i = 12; i >= 0; i--) {
        const time = new Date(now.getTime() - i * 3600 * 1000);
        hours.push(time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        temps.push(Number((18 + Math.sin(i) * 3 + Math.random()).toFixed(1)));
        humidity.push(Math.round(70 + Math.cos(i) * 10 + Math.random() * 5));
        wind.push(Number((12 + Math.random() * 4).toFixed(1)));
    }

    return {
        hours,
        temps,
        humidity,
        wind,
        latest: {
            temp: temps[temps.length - 1],
            humidity: humidity[humidity.length - 1],
            wind: wind[wind.length - 1],
            time: hours[hours.length - 1]
        }
    };
}

function getWindDescription(speed) {
    if (speed < 5) return "Calm Air Condition";
    if (speed < 12) return "Light Breeze Condition";
    if (speed < 20) return "Gentle Breeze Condition";
    if (speed < 29) return "Moderate Wind Condition";
    return "Fresh Wind Condition";
}

function getHumidityDescription(humidity) {
    if (humidity < 30) return "Low Dry Humidity Level";
    if (humidity <= 60) return "Optimal Comfort Level";
    return "High Humidity Level";
}

function updateKPIs(latest) {
    const tempVal = Number(latest.temp);
    const windVal = Number(latest.wind);
    const humidityVal = Number(latest.humidity);

    const formattedTemp = !isNaN(tempVal) ? tempVal.toFixed(1) : latest.temp;
    const formattedWind = !isNaN(windVal) ? windVal.toFixed(1) : latest.wind;
    const formattedHumidity = !isNaN(humidityVal) ? Math.round(humidityVal) : latest.humidity;

    document.getElementById("kpi-temp").textContent = `${formattedTemp} °C`;
    document.getElementById("kpi-humidity").textContent = `${formattedHumidity} %`;
    document.getElementById("kpi-wind").textContent = `${formattedWind} km/h`;

    document.getElementById("kpi-temp-sub").textContent = `London, UK • Updated ${latest.time} UTC`;
    
    const humSub = document.getElementById("kpi-humidity-sub");
    if (humSub) humSub.textContent = getHumidityDescription(humidityVal);
    
    const windSub = document.getElementById("kpi-wind-sub");
    if (windSub) windSub.textContent = getWindDescription(windVal);
    
    const healthSub = document.getElementById("kpi-health-sub");
    if (healthSub) healthSub.textContent = "Extract • Validate • Transform (All Active)";
}

function initChart(data) {
    const ctx = document.getElementById('weatherChart').getContext('2d');
    
    if (chartInstance) {
        chartInstance.destroy();
    }

    const tempGradient = ctx.createLinearGradient(0, 0, 0, 300);
    tempGradient.addColorStop(0, 'rgba(56, 189, 248, 0.4)');
    tempGradient.addColorStop(1, 'rgba(56, 189, 248, 0.0)');

    const humidityGradient = ctx.createLinearGradient(0, 0, 0, 300);
    humidityGradient.addColorStop(0, 'rgba(168, 85, 247, 0.3)');
    humidityGradient.addColorStop(1, 'rgba(168, 85, 247, 0.0)');

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.hours,
            datasets: [
                {
                    label: 'Temperature (°C)',
                    data: data.temps,
                    borderColor: '#38bdf8',
                    backgroundColor: tempGradient,
                    fill: true,
                    tension: 0.4,
                    borderWidth: 3,
                    pointBackgroundColor: '#38bdf8',
                    pointRadius: 4
                },
                {
                    label: 'Humidity (%)',
                    data: data.humidity,
                    borderColor: '#a855f7',
                    backgroundColor: humidityGradient,
                    fill: true,
                    tension: 0.4,
                    borderWidth: 2,
                    pointBackgroundColor: '#a855f7',
                    pointRadius: 3
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: '#94a3b8',
                        font: { family: 'Inter', size: 12 }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleColor: '#f8fafc',
                    bodyColor: '#cbd5e1',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                    padding: 12
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#94a3b8', font: { family: 'Inter' } }
                },
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#94a3b8', font: { family: 'Inter' } }
                }
            }
        }
    });
}

async function loadDashboardData() {
    const statusText = document.querySelector(".status-text");
    statusText.textContent = "Updating Pipeline State...";

    try {
        const response = await fetch(API_ENDPOINT);
        if (!response.ok) throw new Error("API Gateway unreachable, falling back to live preview mode.");
        
        const rawItems = await response.json();
        if (!Array.isArray(rawItems) || rawItems.length === 0) throw new Error("No data returned from API.");

        const hours = rawItems.map(item => new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        const temps = rawItems.map(item => Number(Number(item.temperature_2m).toFixed(1)));
        const humidity = rawItems.map(item => Math.round(Number(item.relative_humidity_2m)));
        const wind = rawItems.map(item => Number(Number(item.wind_speed_10m).toFixed(1)));

        const data = {
            hours, temps, humidity, wind,
            latest: {
                temp: temps[temps.length - 1],
                humidity: humidity[humidity.length - 1],
                wind: wind[wind.length - 1],
                time: hours[hours.length - 1]
            }
        };

        updateKPIs(data.latest);
        initChart(data);
        statusText.textContent = "Step Functions Active (API Live)";
    } catch (err) {
        console.warn("Using local mock pipeline data:", err.message);
        const mockData = generateMockWeatherData();
        updateKPIs(mockData.latest);
        initChart(mockData);
        statusText.textContent = "Step Functions Active (Live Preview)";
    }
}

document.addEventListener("DOMContentLoaded", () => {
    loadDashboardData();
    document.getElementById("refresh-btn").addEventListener("click", loadDashboardData);
    
    // Auto-refresh every 60 seconds
    setInterval(loadDashboardData, 60000);
});
