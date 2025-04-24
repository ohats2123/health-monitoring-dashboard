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
        label: "Nhịp Tim (BPM)",
        min: 40,
        max: 180,
        element: "bpm",
        alertElement: "bpm-alert",
        warningLow: 50,
        warningHigh: 130,
        dangerLow: 50,
        dangerHigh: 130,
        unit: "BPM",
        alertMessage: {
            high: "Nhịp tim quá cao! Hãy kiểm tra tình trạng bệnh nhân.",
            low: "Nhịp tim quá thấp! Hãy kiểm tra tình trạng bệnh nhân.",
            unused: "Cảm biến nhịp tim không phát hiện người dùng. Vui lòng kiểm tra vị trí thiết bị.",
            noData: "Không nhận được dữ liệu từ cảm biến nhịp tim. Hãy kiểm tra kết nối."
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
        warningLow: 90,
        warningHigh: 100,
        dangerLow: 90,
        dangerHigh: 101, // Just for validation, not realistic
        unit: "%",
        alertMessage: {
            high: "Chỉ số SpO2 bất thường!",
            low: "NGUY HIỂM: Nồng độ oxy thấp! Cần được chăm sóc ngay lập tức.",
            unused: "Cảm biến SpO2 không phát hiện người dùng. Vui lòng kiểm tra vị trí thiết bị.",
            noData: "Không nhận được dữ liệu từ cảm biến SpO2. Hãy kiểm tra kết nối."
        }
    },
    temperature: {
        pin: "V3",
        color: "#ff9d00",
        label: "Nhiệt Độ (°C)",
        min: 33,
        max: 42,
        element: "temperature",
        alertElement: "temp-alert",
        warningLow: 33.5,
        warningHigh: 38.0,
        dangerLow: 33.5,
        dangerHigh: 38.0,
        unit: "°C",
        alertMessage: {
            high: "Phát hiện sốt cao! Khuyến nghị chăm sóc y tế.",
            low: "Nhiệt độ cơ thể quá thấp! Hãy kiểm tra tình trạng bệnh nhân.",
            unused: "Cảm biến nhiệt độ không phát hiện người dùng. Vui lòng kiểm tra vị trí thiết bị.",
            noData: "Không nhận được dữ liệu từ cảm biến nhiệt độ. Hãy kiểm tra kết nối."
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
    
    // Initialize FAQ system
    initFAQ();
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
        
        // When one sensor shows zero for too long, set all sensors to inactive and show message
        setAllDevicesInactive();
    }
}

// Function to set all devices to inactive when one device shows zeros for too long
function setAllDevicesInactive() {
    // Set all devices to inactive
    Object.keys(zeroValueTracking).forEach(key => {
        zeroValueTracking[key].isActive = false;
        
        const config = dataConfig[key];
        const cardElement = document.querySelector(`.${key === "heartRate" ? "heart-rate" : key === "spo2" ? "oxygen" : "temperature"}`);
        const alertElement = document.getElementById(config.alertElement);
        
        // Add inactive class and show message
        cardElement.classList.add('inactive');
        
        // Show message to check device
        alertElement.textContent = "Vui lòng kiểm tra tất cả thiết bị. Kết nối có thể bị mất.";
        
        // Clear other alert classes
        cardElement.classList.remove('danger', 'warning');
        
        // Set displayed value to 0
        document.getElementById(config.element).textContent = "0";
    });
    
    // Play alert sound for device issue
    playAlertSound();
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
}, { once: true });

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
    
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
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

// Initialize FAQ system
function initFAQ() {
    // Get the FAQ elements
    const questions = document.querySelectorAll('.faq-question');
    const answerContent = document.querySelector('.faq-answer-content');
    const answerIcon = document.querySelector('.faq-answer-icon i');

    // Add click event to each question
    questions.forEach(question => {
        question.addEventListener('click', () => {
            // Get the question ID
            const id = question.getAttribute('data-id');
            
            // Remove active class from all questions
            questions.forEach(q => q.classList.remove('active'));
            
            // Add active class to clicked question
            question.classList.add('active');
            
            // Generate dynamic answer based on current health data
            const answer = generateDynamicAnswer(id);
            
            // Update the answer content
            answerContent.textContent = answer;
            
            // Change the icon based on the question
            answerIcon.className = question.querySelector('i').className;
            
            // Add animation
            answerContent.style.animation = 'none';
            setTimeout(() => {
                answerContent.style.animation = 'fadeIn 0.3s ease-in-out';
            }, 10);
        });
    });

    // Set the first question as active by default
    if (questions.length > 0) {
        questions[0].click();
    }
}

// Generate dynamic answers based on current health data
function generateDynamicAnswer(questionId) {
    // Get current health data values
    const heartRate = document.getElementById("bpm").textContent;
    const spo2 = document.getElementById("spo2").textContent;
    const temperature = document.getElementById("temperature").textContent;
    const lastUpdate = document.getElementById("last-update-time").textContent;
    
    // Parse values for comparison
    const heartRateValue = parseFloat(heartRate);
    const spo2Value = parseFloat(spo2);
    const tempValue = parseFloat(temperature);
    
    // Check for data availability
    const noData = heartRate === "--" || spo2 === "--" || temperature === "--";
    
    if (noData) {
        return "Đang chờ dữ liệu từ cảm biến. Vui lòng đảm bảo thiết bị của bạn được kết nối và hoạt động đúng cách.";
    }
    
    // Generate answers based on the question ID
    switch(questionId) {
        case "1": // Heart rate question
            let heartStatus = "";
            if (heartRateValue < 60) {
                heartStatus = "Nhịp tim của bạn dưới mức bình thường (60-100 BPM). Nhịp tim thấp (nhịp chậm) có thể bình thường đối với vận động viên hoặc trong khi ngủ, nhưng có thể chỉ ra vấn đề sức khỏe nếu bạn cảm thấy chóng mặt hoặc mệt mỏi.";
            } else if (heartRateValue <= 100) {
                heartStatus = "Nhịp tim của bạn nằm trong phạm vi bình thường (60-100 BPM), điều này khỏe mạnh đối với hầu hết người trưởng thành. Nhịp tim hiện tại cho thấy hệ tim mạch của bạn đang hoạt động tốt.";
            } else if (heartRateValue <= 120) {
                heartStatus = "Nhịp tim của bạn cao hơn bình thường. Điều này có thể bình thường nếu bạn vừa hoạt động, căng thẳng hoặc vừa tiêu thụ caffeine. Nếu bạn đang nghỉ ngơi, hãy thử thư giãn một chút.";
            } else {
                heartStatus = "Nhịp tim của bạn cao đáng kể (nhịp nhanh). Điều này có thể chỉ ra căng thẳng, gắng sức, sốt, mất nước hoặc các vấn đề sức khỏe khác. Nếu tình trạng này kéo dài khi nghỉ ngơi, hãy cân nhắc việc tư vấn y tế.";
            }
            return `Nhịp tim hiện tại của bạn là ${heartRateValue} BPM. ${heartStatus} Đo lần cuối lúc ${lastUpdate}.`;
            
        case "2": // Oxygen level question
            let oxygenStatus = "";
            if (spo2Value >= 95) {
                oxygenStatus = "Đây là trong phạm vi bình thường (95-100%), cho thấy độ bão hòa oxy trong máu tốt. Phổi và hệ tuần hoàn của bạn dường như đang hoạt động bình thường.";
            } else if (spo2Value >= 90) {
                oxygenStatus = "Đây là hơi dưới phạm vi bình thường. Mặc dù không nghiêm trọng, nhưng có thể chỉ ra các vấn đề hô hấp nhỏ. Hãy thử hít thở sâu hoặc di chuyển đến khu vực thông thoáng.";
            } else {
                oxygenStatus = "Đây là dưới phạm vi bình thường và có thể cần được chăm sóc y tế. Nồng độ oxy thấp có thể chỉ ra các vấn đề về hô hấp. Nếu bạn đang gặp khó thở hoặc các triệu chứng khác, vui lòng tìm kiếm tư vấn y tế.";
            }
            return `Mức SpO2 hiện tại của bạn là ${spo2Value}%. ${oxygenStatus} Đo lần cuối lúc ${lastUpdate}.`;
            
        case "3": // Temperature question
            let tempStatus = "";
            if (tempValue < 36) {
                tempStatus = "Đây là dưới nhiệt độ cơ thể bình thường. Hạ thân nhiệt nhẹ có thể xảy ra nếu bạn ở trong môi trường lạnh. Hãy cân nhắc giữ ấm và theo dõi nhiệt độ của bạn.";
            } else if (tempValue <= 37.5) {
                tempStatus = "Đây là trong phạm vi nhiệt độ cơ thể bình thường. Cơ thể bạn đang điều hòa nhiệt độ một cách thích hợp.";
            } else if (tempValue <= 38) {
                tempStatus = "Đây chỉ ra sốt nhẹ. Sốt nhẹ thường là phản ứng tự nhiên của cơ thể để chống lại nhiễm trùng. Hãy nghỉ ngơi và uống đủ nước.";
            } else if (tempValue <= 39) {
                tempStatus = "Đây chỉ ra sốt vừa phải. Cơ thể bạn có thể đang chống lại nhiễm trùng. Hãy nghỉ ngơi, uống đủ nước và cân nhắc dùng thuốc phù hợp. Nếu sốt kéo dài, hãy tham khảo ý kiến bác sĩ.";
            } else {
                tempStatus = "Đây chỉ ra sốt cao có thể cần chăm sóc y tế, đặc biệt nếu kèm theo các triệu chứng khác. Vui lòng tham khảo ý kiến bác sĩ.";
            }
            return `Nhiệt độ cơ thể hiện tại của bạn là ${tempValue}°C. ${tempStatus} Đo lần cuối lúc ${lastUpdate}.`;
            
        case "4": // Vitals trend question
            // Get historical data
            const heartRateHistory = historicalData.heartRate;
            const spo2History = historicalData.spo2;
            const tempHistory = historicalData.temperature;
            
            // Need at least 2 data points for trend analysis
            if (heartRateHistory.length < 2 || spo2History.length < 2 || tempHistory.length < 2) {
                return "Chưa đủ dữ liệu lịch sử để phân tích xu hướng. Tiếp tục theo dõi để xem các dấu hiệu sinh tồn của bạn thay đổi như thế nào theo thời gian.";
            }
            
            const firstHeartRate = heartRateHistory[0].value;
            const latestHeartRate = heartRateHistory[heartRateHistory.length - 1].value;
            const heartRateChange = latestHeartRate - firstHeartRate;
            
            const firstSpo2 = spo2History[0].value;
            const latestSpo2 = spo2History[spo2History.length - 1].value;
            const spo2Change = latestSpo2 - firstSpo2;
            
            const firstTemp = tempHistory[0].value;
            const latestTemp = tempHistory[tempHistory.length - 1].value;
            const tempChange = latestTemp - firstTemp;
            
            let trendSummary = "Dưới đây là cách các chỉ số sinh tồn của bạn đã thay đổi:\n\n";
            
            // Heart rate trend
            trendSummary += `Nhịp Tim: Thay đổi từ ${firstHeartRate} thành ${latestHeartRate} BPM `;
            if (Math.abs(heartRateChange) < 5) {
                trendSummary += "(tương đối ổn định).\n\n";
            } else if (heartRateChange > 0) {
                trendSummary += `(tăng ${heartRateChange.toFixed(1)} BPM).\n\n`;
            } else {
                trendSummary += `(giảm ${Math.abs(heartRateChange).toFixed(1)} BPM).\n\n`;
            }
            
            // SpO2 trend
            trendSummary += `Nồng Độ Oxy: Thay đổi từ ${firstSpo2}% thành ${latestSpo2}% `;
            if (Math.abs(spo2Change) < 2) {
                trendSummary += "(tương đối ổn định).\n\n";
            } else if (spo2Change > 0) {
                trendSummary += `(cải thiện ${spo2Change.toFixed(1)}%).\n\n`;
            } else {
                trendSummary += `(giảm ${Math.abs(spo2Change).toFixed(1)}%).\n\n`;
            }
            
            // Temperature trend
            trendSummary += `Nhiệt Độ: Thay đổi từ ${firstTemp}°C thành ${latestTemp}°C `;
            if (Math.abs(tempChange) < 0.3) {
                trendSummary += "(tương đối ổn định).\n\n";
            } else if (tempChange > 0) {
                trendSummary += `(tăng ${tempChange.toFixed(1)}°C).\n\n`;
            } else {
                trendSummary += `(giảm ${Math.abs(tempChange).toFixed(1)}°C).\n\n`;
            }
            
            return trendSummary;
            
        case "5": // Concerning values question
            let concerns = [];
            
            // Check heart rate
            if (heartRateValue < 50) {
                concerns.push("Nhịp tim của bạn thấp hơn đáng kể so với phạm vi bình thường (60-100 BPM). Điều này có thể chỉ ra nhịp tim chậm (nhịp chậm).");
            } else if (heartRateValue > 120) {
                concerns.push("Nhịp tim của bạn cao hơn đáng kể so với phạm vi bình thường (60-100 BPM). Điều này có thể chỉ ra nhịp tim nhanh (nhịp nhanh).");
            }
            
            // Check SpO2
            if (spo2Value < 92) {
                concerns.push("Độ bão hòa oxy của bạn dưới mức khuyến nghị (95-100%). SpO2 thấp có thể chỉ ra các vấn đề về hô hấp.");
            }
            
            // Check temperature
            if (tempValue > 38) {
                concerns.push("Bạn hiện đang bị sốt. Nhiệt độ cơ thể trên 38°C cho thấy cơ thể bạn có thể đang chống lại nhiễm trùng.");
            } else if (tempValue < 35.5) {
                concerns.push("Nhiệt độ cơ thể của bạn dưới phạm vi bình thường. Điều này có thể chỉ ra hạ thân nhiệt hoặc vấn đề với cảm biến.");
            }
            
            if (concerns.length === 0) {
                return "Tin tốt! Tất cả các dấu hiệu sinh tồn của bạn dường như trong hoặc gần với phạm vi bình thường. Tiếp tục theo dõi để phát hiện bất kỳ thay đổi nào.";
            } else {
                return "Các chỉ số sau đây có thể cần được chú ý:\n\n" + concerns.join("\n\n") + "\n\nHãy nhớ rằng đây không phải là lời khuyên y tế. Nếu bạn lo lắng về sức khỏe của mình, vui lòng tham khảo ý kiến chuyên gia y tế.";
            }
            
        default:
            return "Chọn một câu hỏi để xem thông tin về dữ liệu sức khỏe hiện tại của bạn.";
    }
} 