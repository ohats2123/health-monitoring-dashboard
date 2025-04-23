// Configuration
const BLYNK_AUTH_TOKEN = "pPXiGs0km6L8evbBrsdcO__OwabZGFbD"; // Your Blynk auth token
const BLYNK_SERVER = "blynk-cloud.com";
const BLYNK_URL = `https://${BLYNK_SERVER}/${BLYNK_AUTH_TOKEN}/get/`;

// Data mapping
const dataConfig = {
    heartRate: {
        pin: "V1",
        color: "#ff416c",
        label: "Heart Rate (BPM)",
        min: 40,
        max: 180,
        element: "bpm",
        alertElement: "bpm-alert",
        warningLow: 50,
        warningHigh: 100,
        dangerLow: 40,
        dangerHigh: 130,
        unit: "BPM",
        alertMessage: {
            high: "Heart rate is too high! Check patient status.",
            low: "Heart rate is too low! Check patient status."
        }
    },
    spo2: {
        pin: "V2",
        color: "#1e88e5",
        label: "SpO2 (%)",
        min: 80,
        max: 100,
        element: "spo2",
        alertElement: "spo2-alert",
        warningLow: 92,
        warningHigh: 100,
        dangerLow: 88,
        dangerHigh: 101, // Just for validation, not realistic
        unit: "%",
        alertMessage: {
            high: "Abnormal SpO2 reading!",
            low: "DANGER: Low oxygen levels! Immediate attention required."
        }
    },
    temperature: {
        pin: "V3",
        color: "#ff9d00",
        label: "Temperature (°C)",
        min: 35,
        max: 42,
        element: "temperature",
        alertElement: "temp-alert",
        warningLow: 36,
        warningHigh: 37.8,
        dangerLow: 35,
        dangerHigh: 39,
        unit: "°C",
        alertMessage: {
            high: "High fever detected! Medical attention recommended.",
            low: "Body temperature too low! Check patient status."
        }
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

// For sound alerts
let alertSound;

// Initialize chart when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
    initChart();
    setupTabButtons();
    fetchData();
    setupAlertSound();

    // Fetch data every 5 seconds
    setInterval(fetchData, 5000);
    
    // Add light animation to the page
    animateBackground();
});

// Setup alert sound
function setupAlertSound() {
    alertSound = new Audio("https://assets.mixkit.co/sfx/preview/mixkit-alarm-digital-clock-beep-989.mp3");
    alertSound.volume = 0.5;
}

// Random number between min and max
function getRandomValue(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Animate background
function animateBackground() {
    const cards = document.querySelectorAll('.card');
    
    // Add random subtle animations to cards
    cards.forEach(card => {
        const delay = getRandomValue(0, 5000);
        setTimeout(() => {
            card.style.transition = 'all 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
            card.style.transform = 'translateY(-5px)';
            
            setTimeout(() => {
                card.style.transform = '';
            }, 800);
        }, delay);
    });
    
    // Repeat animation every 10s
    setTimeout(animateBackground, 10000);
}

// Initialize the chart
function initChart() {
    const ctx = document.getElementById("health-chart").getContext("2d");
    
    // Chart gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, `${dataConfig.heartRate.color}80`);
    gradient.addColorStop(1, `${dataConfig.heartRate.color}00`);
    
    healthChart = new Chart(ctx, {
        type: "line",
        data: {
            labels: [],
            datasets: [{
                label: dataConfig.heartRate.label,
                data: [],
                borderColor: dataConfig.heartRate.color,
                backgroundColor: gradient,
                borderWidth: 3,
                tension: 0.4,
                fill: true,
                pointRadius: 4,
                pointBackgroundColor: "#fff",
                pointBorderColor: dataConfig.heartRate.color,
                pointHoverRadius: 6,
                pointHoverBackgroundColor: "#fff",
                pointHoverBorderColor: dataConfig.heartRate.color,
                pointHoverBorderWidth: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 2.5,
            scales: {
                y: {
                    min: dataConfig.heartRate.min,
                    max: dataConfig.heartRate.max,
                    ticks: {
                        stepSize: 20,
                        color: "rgba(255, 255, 255, 0.7)"
                    },
                    grid: {
                        color: "rgba(255, 255, 255, 0.1)"
                    }
                },
                x: {
                    ticks: {
                        maxTicksLimit: 10,
                        color: "rgba(255, 255, 255, 0.7)"
                    },
                    grid: {
                        color: "rgba(255, 255, 255, 0.1)"
                    }
                }
            },
            animation: {
                duration: 800,
                easing: "easeOutQuart"
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: "rgba(0, 0, 0, 0.7)",
                    titleColor: "#fff",
                    bodyColor: "#fff",
                    titleFont: {
                        size: 14,
                        weight: "bold"
                    },
                    bodyFont: {
                        size: 13
                    },
                    padding: 12,
                    borderWidth: 1,
                    borderColor: "rgba(255, 255, 255, 0.2)",
                    displayColors: false
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
        checkAlert("heartRate", heartRateData);
        
        // Fetch SpO2 data
        const spo2Data = await fetchBlynkData(dataConfig.spo2.pin);
        updateValue(dataConfig.spo2.element, spo2Data);
        addDataPoint("spo2", spo2Data);
        checkAlert("spo2", spo2Data);
        
        // Fetch temperature data
        const tempData = await fetchBlynkData(dataConfig.temperature.pin);
        updateValue(dataConfig.temperature.element, tempData);
        addDataPoint("temperature", tempData);
        checkAlert("temperature", tempData);
        
        // Update chart
        updateChart();
        
        // Update last update time
        const now = new Date();
        document.getElementById("last-update-time").textContent = now.toLocaleTimeString();
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

// Check if value triggers an alert
function checkAlert(metricKey, value) {
    if (value === null) return;
    
    const config = dataConfig[metricKey];
    const cardElement = document.querySelector(`.${metricKey === "heartRate" ? "heart-rate" : metricKey === "spo2" ? "oxygen" : "temperature"}`);
    const alertElement = document.getElementById(config.alertElement);
    
    // Remove previous classes
    cardElement.classList.remove("danger", "warning");
    
    // Check for danger range
    if (value <= config.dangerLow || value >= config.dangerHigh) {
        cardElement.classList.add("danger");
        alertElement.textContent = value <= config.dangerLow ? config.alertMessage.low : config.alertMessage.high;
        playAlertSound();
    }
    // Check for warning range
    else if (value <= config.warningLow || value >= config.warningHigh) {
        cardElement.classList.add("warning");
        alertElement.textContent = value <= config.warningLow ? config.alertMessage.low : config.alertMessage.high;
    }
}

// Play alert sound
function playAlertSound() {
    if (alertSound) {
        alertSound.currentTime = 0;
        alertSound.play().catch(e => {
            console.log("Audio playback prevented: ", e);
        });
    }
}

// Update displayed value
function updateValue(elementId, value) {
    if (value !== null) {
        const element = document.getElementById(elementId);
        
        // Create a nice transition effect
        const currentValue = parseFloat(element.textContent) || 0;
        const newValue = parseFloat(value);
        const diff = newValue - currentValue;
        
        // If the diff is small enough, animate it
        if (Math.abs(diff) < 20) {
            animateValue(element, currentValue, newValue, 500);
        } else {
            element.textContent = value;
        }
    }
}

// Animate value change
function animateValue(element, start, end, duration) {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const currentValue = Math.round((progress * (end - start) + start) * 10) / 10;
        element.textContent = currentValue;
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
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
    
    // Update chart gradient
    const ctx = document.getElementById("health-chart").getContext("2d");
    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, `${config.color}80`);
    gradient.addColorStop(1, `${config.color}00`);
    
    // Update chart data
    healthChart.data.labels = historicalData[metricKey].map(item => item.time);
    healthChart.data.datasets[0].data = historicalData[metricKey].map(item => item.value);
    healthChart.data.datasets[0].label = config.label;
    healthChart.data.datasets[0].borderColor = config.color;
    healthChart.data.datasets[0].backgroundColor = gradient;
    healthChart.data.datasets[0].pointBorderColor = config.color;
    healthChart.data.datasets[0].pointHoverBorderColor = config.color;
    
    // Update y-axis scale
    healthChart.options.scales.y.min = config.min;
    healthChart.options.scales.y.max = config.max;
    
    // Update the chart
    healthChart.update();
} 