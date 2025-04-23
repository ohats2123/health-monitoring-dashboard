// Configuration
const BLYNK_AUTH_TOKEN = "pPXiGs0km6L8evbBrsdcO__OwabZGFbD"; // Your Blynk auth token
const BLYNK_SERVER = "blynk-cloud.com";
const BLYNK_URL = `https://${BLYNK_SERVER}/${BLYNK_AUTH_TOKEN}/get/`;

// Data mapping
const dataConfig = {
    heartRate: {
        pin: "V1",
        color: "#e53935",
        label: "Heart Rate (BPM)",
        min: 40,
        max: 180,
        element: "bpm"
    },
    spo2: {
        pin: "V2",
        color: "#1976d2",
        label: "SpO2 (%)",
        min: 80,
        max: 100,
        element: "spo2"
    },
    temperature: {
        pin: "V3",
        color: "#ff9800",
        label: "Temperature (°C)",
        min: 35,
        max: 42,
        element: "temperature"
    }
};

// Historical data storage
const historicalData = {
    heartRate: [],
    spo2: [],
    temperature: []
};

// Max data points to store
const MAX_DATA_POINTS = 20;

// Initialize chart
let healthChart;
let currentMetric = "heart-rate";

// Initialize chart when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
    initChart();
    setupTabButtons();
    fetchData();

    // Fetch data every 5 seconds
    setInterval(fetchData, 5000);
});

// Initialize the chart
function initChart() {
    const ctx = document.getElementById("health-chart").getContext("2d");
    
    healthChart = new Chart(ctx, {
        type: "line",
        data: {
            labels: [],
            datasets: [{
                label: dataConfig.heartRate.label,
                data: [],
                borderColor: dataConfig.heartRate.color,
                backgroundColor: `${dataConfig.heartRate.color}33`, // Add transparency
                borderWidth: 2,
                tension: 0.3,
                fill: true,
                pointRadius: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true, // Change to true to maintain aspect ratio
            aspectRatio: 2.5, // Set a fixed aspect ratio
            scales: {
                y: {
                    min: dataConfig.heartRate.min,
                    max: dataConfig.heartRate.max,
                    ticks: {
                        stepSize: 20
                    }
                },
                x: {
                    ticks: {
                        maxTicksLimit: 10
                    }
                }
            },
            animation: {
                duration: 500
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
}

// Set up tab button event listeners
function setupTabButtons() {
    const tabButtons = document.querySelectorAll(".tab-button");
    
    tabButtons.forEach(button => {
        button.addEventListener("click", () => {
            // Remove active class from all buttons
            tabButtons.forEach(btn => btn.classList.remove("active"));
            
            // Add active class to clicked button
            button.classList.add("active");
            
            // Update chart based on selected metric
            currentMetric = button.dataset.metric;
            updateChart();
        });
    });
}

// Fetch data from Blynk API
async function fetchData() {
    try {
        // Fetch heart rate data
        const heartRateData = await fetchBlynkData(dataConfig.heartRate.pin);
        updateValue(dataConfig.heartRate.element, heartRateData);
        addDataPoint("heartRate", heartRateData);
        
        // Fetch SpO2 data
        const spo2Data = await fetchBlynkData(dataConfig.spo2.pin);
        updateValue(dataConfig.spo2.element, spo2Data);
        addDataPoint("spo2", spo2Data);
        
        // Fetch temperature data
        const tempData = await fetchBlynkData(dataConfig.temperature.pin);
        updateValue(dataConfig.temperature.element, tempData);
        addDataPoint("temperature", tempData);
        
        // Update chart
        updateChart();
        
        // Update last update time
        document.getElementById("last-update-time").textContent = new Date().toLocaleTimeString();
    } catch (error) {
        console.error("Error fetching data:", error);
    }
}

// Fetch data from Blynk for a specific pin
async function fetchBlynkData(pin) {
    try {
        const response = await fetch(BLYNK_URL + pin);
        
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        const data = await response.json();
        return data[0];
    } catch (error) {
        console.error(`Error fetching data from pin ${pin}:`, error);
        return null;
    }
}

// Update displayed value
function updateValue(elementId, value) {
    if (value !== null) {
        document.getElementById(elementId).textContent = value;
    }
}

// Add data point to historical data
function addDataPoint(metric, value) {
    if (value === null) return;
    
    const timestamp = new Date().toLocaleTimeString();
    
    // Add new data point
    historicalData[metric].push({
        time: timestamp,
        value: value
    });
    
    // Remove oldest data point if we exceed the maximum
    if (historicalData[metric].length > MAX_DATA_POINTS) {
        historicalData[metric].shift();
    }
}

// Update chart with the latest data
function updateChart() {
    let metricKey;
    
    // Map tab metric to data config key
    switch (currentMetric) {
        case "heart-rate":
            metricKey = "heartRate";
            break;
        case "spo2":
            metricKey = "spo2";
            break;
        case "temperature":
            metricKey = "temperature";
            break;
        default:
            metricKey = "heartRate";
    }
    
    // Get the configuration for the selected metric
    const config = dataConfig[metricKey];
    
    // Update chart data
    healthChart.data.labels = historicalData[metricKey].map(item => item.time);
    healthChart.data.datasets[0].data = historicalData[metricKey].map(item => item.value);
    healthChart.data.datasets[0].label = config.label;
    healthChart.data.datasets[0].borderColor = config.color;
    healthChart.data.datasets[0].backgroundColor = `${config.color}33`;
    
    // Update y-axis scale
    healthChart.options.scales.y.min = config.min;
    healthChart.options.scales.y.max = config.max;
    
    // Update the chart
    healthChart.update();
} 