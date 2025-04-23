// Configuration
const BLYNK_AUTH_TOKEN = "pPXiGs0km6L8evbBrsdcO__OwabZGFbD"; // Your Blynk auth token
const BLYNK_SERVER = "blynk.cloud";
const BLYNK_URL = `https://${BLYNK_SERVER}/external/api/get?token=${BLYNK_AUTH_TOKEN}&pin=`;

// Mobile detection
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// Connection status tracking
let connectionEstablished = false;

// Zero value tracking to detect unused devices
const zeroValueTracking = {
    heartRate: {
        count: 0,
        threshold: 5, // Number of consecutive zeros to consider device unused
        isActive: true,
        hasReceivedData: false
    },
    spo2: {
        count: 0,
        threshold: 5,
        isActive: true,
        hasReceivedData: false
    },
    temperature: {
        count: 0,
        threshold: 5,
        isActive: true,
        hasReceivedData: false
    }
};

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
            low: "Heart rate is too low! Check patient status.",
            unused: "Heart rate sensor not detecting a user. Please check device placement.",
            noData: "No data received from heart rate sensor. Check connection."
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
            low: "DANGER: Low oxygen levels! Immediate attention required.",
            unused: "SpO2 sensor not detecting a user. Please check device placement.",
            noData: "No data received from SpO2 sensor. Check connection."
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
            low: "Body temperature too low! Check patient status.",
            unused: "Temperature sensor not detecting a user. Please check device placement.",
            noData: "No data received from temperature sensor. Check connection."
        }
    }
};

// Historical data storage
const historicalData = {
    heartRate: [],
    spo2: [],
    temperature: []
};

// Max data points to store - fewer on mobile for performance
const MAX_DATA_POINTS = isMobile ? 10 : 20;

// Initialize chart
let healthChart;
let currentMetric = "heart-rate";

// For sound alerts
let alertSound;
let lastTapTime = 0;

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
    // Setup mobile-specific optimizations
    if (isMobile) {
        setupMobileOptimizations();
    }
    
    initChart();
    setupTabButtons();
    setupCardInteractions();
    setupAlertSound();
    
    // Initial setup state
    showNoDataState();
    
    // First data fetch attempt
    fetchData();

    // Fetch data every 5 seconds (slightly longer on mobile)
    setInterval(fetchData, isMobile ? 6000 : 5000);
    
    // Add light animation to the page - reduce on mobile
    if (!isMobile) {
        animateBackground();
    }
});

// Mobile optimizations
function setupMobileOptimizations() {
    // Prevent zoom on double tap
    document.addEventListener('touchend', (e) => {
        const currentTime = new Date().getTime();
        const tapLength = currentTime - lastTapTime;
        
        if (tapLength < 500 && tapLength > 0) {
            e.preventDefault();
        }
        
        lastTapTime = currentTime;
    });
    
    // Handle orientation change
    window.addEventListener('orientationchange', () => {
        setTimeout(() => {
            if (healthChart) {
                healthChart.resize();
                updateChart();
            }
        }, 200);
    });
}

// Setup card touch interactions
function setupCardInteractions() {
    const cards = document.querySelectorAll('.card');
    
    cards.forEach(card => {
        card.addEventListener('click', () => {
            // Show a subtle feedback effect
            card.style.transform = 'scale(0.98)';
            setTimeout(() => {
                card.style.transform = '';
            }, 150);
        });
    });
}

// Setup alert sound
function setupAlertSound() {
    // Only setup if not on iOS (iOS requires user interaction for audio)
    if (!(/iPhone|iPad|iPod/i.test(navigator.userAgent))) {
        alertSound = new Audio("https://assets.mixkit.co/sfx/preview/mixkit-alarm-digital-clock-beep-989.mp3");
        alertSound.volume = 0.5;
        
        // Preload audio on mobile
        if (isMobile) {
            alertSound.load();
        }
    }
}

// Random number between min and max
function getRandomValue(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Animate background - reduced on mobile
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
                borderWidth: isMobile ? 2 : 3,
                tension: 0.4,
                fill: true,
                pointRadius: isMobile ? 3 : 4,
                pointBackgroundColor: "#fff",
                pointBorderColor: dataConfig.heartRate.color,
                pointHoverRadius: isMobile ? 4 : 6,
                pointHoverBackgroundColor: "#fff",
                pointHoverBorderColor: dataConfig.heartRate.color,
                pointHoverBorderWidth: isMobile ? 2 : 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: isMobile ? 1.8 : 2.5,
            scales: {
                y: {
                    min: dataConfig.heartRate.min,
                    max: dataConfig.heartRate.max,
                    ticks: {
                        stepSize: 20,
                        color: "rgba(255, 255, 255, 0.7)",
                        font: {
                            size: isMobile ? 10 : 12
                        }
                    },
                    grid: {
                        color: "rgba(255, 255, 255, 0.1)"
                    }
                },
                x: {
                    ticks: {
                        maxTicksLimit: isMobile ? 6 : 10,
                        color: "rgba(255, 255, 255, 0.7)",
                        font: {
                            size: isMobile ? 10 : 12
                        }
                    },
                    grid: {
                        color: "rgba(255, 255, 255, 0.1)",
                        display: !isMobile
                    }
                }
            },
            animation: {
                duration: isMobile ? 500 : 800,
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
                        size: isMobile ? 12 : 14,
                        weight: "bold"
                    },
                    bodyFont: {
                        size: isMobile ? 11 : 13
                    },
                    padding: isMobile ? 8 : 12,
                    displayColors: false
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            }
        }
    });
}

// Set up tab button event listeners
function setupTabButtons() {
    const tabButtons = document.querySelectorAll(".tab-button");
    
    tabButtons.forEach(button => {
        // Use touchstart for faster response on mobile
        const eventType = isMobile ? 'touchstart' : 'click';
        
        button.addEventListener(eventType, (e) => {
            if (isMobile) {
                e.preventDefault(); // Prevent ghost clicks on mobile
            }
            
            // Remove active class from all buttons
            tabButtons.forEach(btn => btn.classList.remove("active"));
            
            // Add active class to clicked button
            button.classList.add("active");
            
            // Update chart based on selected metric
            currentMetric = button.dataset.metric;
            updateChart();
            
            // Provide feedback
            if (isMobile) {
                button.style.opacity = "0.5";
                setTimeout(() => {
                    button.style.opacity = "1";
                }, 150);
            }
        });
    });
}

// Set initial no-data state
function showNoDataState() {
    Object.keys(dataConfig).forEach(key => {
        const config = dataConfig[key];
        const cardElement = document.querySelector(`.${key === "heartRate" ? "heart-rate" : key === "spo2" ? "oxygen" : "temperature"}`);
        const alertElement = document.getElementById(config.alertElement);
        
        // Show no-data message
        cardElement.classList.add('no-data');
        alertElement.textContent = config.alertMessage.noData;
    });
}

// Fetch data from Blynk API with debounce for mobile
let isFetching = false;
let consecutiveFailures = 0;
async function fetchData() {
    if (isFetching) return;
    isFetching = true;
    
    try {
        // Try to fetch any data to verify connection
        const connectionTest = await fetch(BLYNK_URL + "V1")
            .then(response => response.ok)
            .catch(() => false);
            
        if (!connectionTest) {
            consecutiveFailures++;
            
            // After 3 failures, show no-data state
            if (consecutiveFailures >= 3) {
                connectionEstablished = false;
                showNoDataState();
            }
            
            throw new Error("Connection failed");
        }
        
        consecutiveFailures = 0;
        connectionEstablished = true;
        
        // Fetch heart rate data
        const heartRateData = await fetchBlynkData(dataConfig.heartRate.pin);
        updateValue(dataConfig.heartRate.element, heartRateData);
        addDataPoint("heartRate", heartRateData);
        checkDeviceUsage("heartRate", heartRateData);
        
        // Only check alerts if we've confirmed data reception
        if (zeroValueTracking.heartRate.hasReceivedData) {
            checkAlert("heartRate", heartRateData);
        }
        
        // Fetch SpO2 data
        const spo2Data = await fetchBlynkData(dataConfig.spo2.pin);
        updateValue(dataConfig.spo2.element, spo2Data);
        addDataPoint("spo2", spo2Data);
        checkDeviceUsage("spo2", spo2Data);
        
        // Only check alerts if we've confirmed data reception
        if (zeroValueTracking.spo2.hasReceivedData) {
            checkAlert("spo2", spo2Data);
        }
        
        // Fetch temperature data
        const tempData = await fetchBlynkData(dataConfig.temperature.pin);
        updateValue(dataConfig.temperature.element, tempData);
        addDataPoint("temperature", tempData);
        checkDeviceUsage("temperature", tempData);
        
        // Only check alerts if we've confirmed data reception
        if (zeroValueTracking.temperature.hasReceivedData) {
            checkAlert("temperature", tempData);
        }
        
        // Update chart
        updateChart();
        
        // Update last update time
        const now = new Date();
        document.getElementById("last-update-time").textContent = now.toLocaleTimeString();
    } catch (error) {
        console.error("Error fetching data:", error);
    } finally {
        isFetching = false;
    }
}

// Fetch data from Blynk for a specific pin with caching for mobile
const apiCache = {};
const CACHE_DURATION = 2000; // 2 seconds cache

async function fetchBlynkData(pin) {
    try {
        // Check cache on mobile
        if (isMobile && apiCache[pin] && Date.now() - apiCache[pin].timestamp < CACHE_DURATION) {
            return apiCache[pin].data;
        }
        
        const response = await fetch(BLYNK_URL + pin);
        
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        const data = await response.text();
        const parsed = parseFloat(data);
        
        // Cache the result on mobile
        if (isMobile) {
            apiCache[pin] = {
                data: isNaN(parsed) ? null : parsed,
                timestamp: Date.now()
            };
        }
        
        return isNaN(parsed) ? null : parsed;
    } catch (error) {
        console.error(`Error fetching data from pin ${pin}:`, error);
        return null;
    }
}

// Check if a device is being used by monitoring for consecutive zero values
function checkDeviceUsage(metricKey, value) {
    const tracking = zeroValueTracking[metricKey];
    const config = dataConfig[metricKey];
    const cardElement = document.querySelector(`.${metricKey === "heartRate" ? "heart-rate" : metricKey === "spo2" ? "oxygen" : "temperature"}`);
    const alertElement = document.getElementById(config.alertElement);
    
    // First, remove the no-data state if we have any value
    if (value !== null) {
        cardElement.classList.remove('no-data');
        
        // Mark that we've received data at least once
        tracking.hasReceivedData = true;
    }
    
    // If null (no data), skip the rest of the check
    if (value === null) return;
    
    // If value is zero, increment the counter
    if (value === 0) {
        tracking.count++;
    } else {
        // Reset counter if we get a non-zero value
        tracking.count = 0;
        
        // If previously marked as inactive, restore
        if (!tracking.isActive) {
            tracking.isActive = true;
            
            // Remove inactive appearance if no other alerts
            if (!cardElement.classList.contains('danger') && 
                !cardElement.classList.contains('warning')) {
                cardElement.classList.remove('inactive');
            }
        }
    }
    
    // Check if we've passed the threshold for unused device
    if (tracking.count >= tracking.threshold && tracking.isActive) {
        tracking.isActive = false;
        
        // Add inactive class and show message
        cardElement.classList.add('inactive');
        alertElement.textContent = config.alertMessage.unused;
        
        // Clear other alert classes if they exist
        cardElement.classList.remove('danger', 'warning');
        
        // Play alert for unused device
        playAlertSound();
    }
}

// Check if value triggers an alert
function checkAlert(metricKey, value) {
    if (value === null) return;
    
    const config = dataConfig[metricKey];
    const cardElement = document.querySelector(`.${metricKey === "heartRate" ? "heart-rate" : metricKey === "spo2" ? "oxygen" : "temperature"}`);
    const alertElement = document.getElementById(config.alertElement);
    
    // Skip alert check if device is marked as not in use
    if (!zeroValueTracking[metricKey].isActive) return;
    
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

// Play alert sound with user interaction check for mobile
function playAlertSound() {
    if (alertSound && document.hasFocus()) {
        try {
            alertSound.currentTime = 0;
            
            // On mobile, only play if user has interacted with the page
            if (isMobile) {
                if (document.body.classList.contains('user-interacted')) {
                    alertSound.play().catch(e => console.log("Audio playback prevented:", e));
                }
            } else {
                alertSound.play().catch(e => console.log("Audio playback prevented:", e));
            }
        } catch (e) {
            console.log("Audio playback error:", e);
        }
    }
}

// Mark that user has interacted for audio on mobile
document.addEventListener('touchstart', () => {
    document.body.classList.add('user-interacted');
}, {once: true});

// Update displayed value with optimized animations
function updateValue(elementId, value) {
    if (value !== null) {
        const element = document.getElementById(elementId);
        
        // Create a nice transition effect
        const currentValue = parseFloat(element.textContent) || 0;
        const newValue = parseFloat(value);
        const diff = newValue - currentValue;
        
        // If the diff is small enough, animate it (simpler animation on mobile)
        if (Math.abs(diff) < 20) {
            if (isMobile) {
                // Simpler animation for mobile
                element.textContent = newValue;
                element.style.transform = 'scale(1.1)';
                setTimeout(() => {
                    element.style.transform = 'scale(1)';
                }, 100);
            } else {
                animateValue(element, currentValue, newValue, 500);
            }
        } else {
            element.textContent = value;
        }
    }
}

// Animate value change (optimized)
function animateValue(element, start, end, duration) {
    // Skip animation if tab is not visible
    if (document.hidden) {
        element.textContent = end;
        return;
    }
    
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
    
    const timestamp = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    
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

// Update chart with the latest data - optimized for mobile
function updateChart() {
    // Skip update if tab is hidden
    if (document.hidden) return;
    
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
    
    // Update the chart with reduced animation on mobile
    healthChart.update(isMobile ? 'none' : undefined);
}

// Handle visibility changes to pause animations when tab is hidden
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && healthChart) {
        updateChart();
    }
}); 