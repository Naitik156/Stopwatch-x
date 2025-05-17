// DOM Elements
const display = document.getElementById('display');
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const resetBtn = document.getElementById('resetBtn');
const statusIndicator = document.getElementById('statusIndicator');
const statusDot = document.querySelector('.status-dot');
const statusText = document.querySelector('.status-text');
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const focusedTimeDisplay = document.getElementById('focusedTime');
const distractedTimeDisplay = document.getElementById('distractedTime');
const focusPercentageDisplay = document.getElementById('focusPercentage');
const yearElement = document.getElementById('year');

// Set current year in footer
yearElement.textContent = new Date().getFullYear();

// Stopwatch variables
let startTime;
let elapsedTime = 0;
let timerInterval;
let isRunning = false;
let isPaused = false;

// Focus tracking variables
let focusedTime = 0;
let distractedTime = 0;
let lastFocusCheckTime = 0;
let isFocused = false;
let faceDetectionActive = false;

// Initialize face-api.js models
async function loadModels() {
    try {
        statusText.textContent = "Loading face detection models...";
        await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
        await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
        statusText.textContent = "Models loaded. Please allow camera access.";
        
        // Start video stream
        startVideo();
    } catch (error) {
        console.error("Error loading models:", error);
        statusText.textContent = "Error loading face detection. Timer will work without focus detection.";
        statusIndicator.classList.add('status-distracted');
    }
}

// Start video stream
function startVideo() {
    navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => {
            video.srcObject = stream;
            video.onloadedmetadata = () => {
                detectFaces();
            };
        })
        .catch(err => {
            console.error("Error accessing camera:", err);
            statusText.textContent = "Camera access denied. Timer will work without focus detection.";
            statusIndicator.classList.add('status-distracted');
        });
}

// Detect faces and check focus
async function detectFaces() {
    if (!faceDetectionActive) return;
    
    try {
        const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks();
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw detections
        faceapi.draw.drawDetections(canvas, detections);
        faceapi.draw.drawFaceLandmarks(canvas, detections);
        
        // Check focus state
        checkFocusState(detections);
        
        // Continue detection
        requestAnimationFrame(detectFaces);
    } catch (error) {
        console.error("Face detection error:", error);
        setTimeout(detectFaces, 1000);
    }
}

// Check if user is focused
function checkFocusState(detections) {
    const now = Date.now();
    
    if (detections && detections.length > 0) {
        const landmarks = detections[0].landmarks;
        
        // Simple focus detection: check if head is tilted down (studying position)
        // This checks if the nose tip is below the eyes
        const noseTip = landmarks.getNose()[3]; // Tip of the nose
        const leftEye = landmarks.getLeftEye()[1]; // Bottom of left eye
        const rightEye = landmarks.getRightEye()[1]; // Bottom of right eye
        
        // Average eye position
        const eyeLevel = (leftEye.y + rightEye.y) / 2;
        
        // If nose tip is below eye level (head tilted down)
        if (noseTip.y > eyeLevel) {
            setFocusState(true, now);
        } else {
            setFocusState(false, now);
        }
    } else {
        // No face detected
        setFocusState(false, now);
    }
}

// Set focus state and update timer accordingly
function setFocusState(focused, timestamp) {
    if (isFocused === focused) return;
    
    // Update time counters
    if (lastFocusCheckTime > 0) {
        const timeDiff = (timestamp - lastFocusCheckTime) / 1000; // in seconds
        
        if (isFocused) {
            focusedTime += timeDiff;
        } else {
            distractedTime += timeDiff;
        }
    }
    
    // Update state
    isFocused = focused;
    lastFocusCheckTime = timestamp;
    
    // Update UI
    updateFocusUI();
    
    // Pause or resume timer based on focus state if auto-pause is enabled
    if (isRunning && !isPaused) {
        if (focused) {
            resumeTimer();
        } else {
            pauseTimer();
        }
    }
}

// Update focus-related UI elements
function updateFocusUI() {
    // Update status indicator
    statusIndicator.className = 'status-indicator';
    
    if (isFocused) {
        statusIndicator.classList.add('status-focus');
        statusText.textContent = "Focused";
    } else {
        statusIndicator.classList.add('status-distracted');
        statusText.textContent = "Distracted";
    }
    
    // Update stats displays
    focusedTimeDisplay.textContent = formatTime(focusedTime);
    distractedTimeDisplay.textContent = formatTime(distractedTime);
    
    const totalTime = focusedTime + distractedTime;
    const percentage = totalTime > 0 ? Math.round((focusedTime / totalTime) * 100) : 0;
    focusPercentageDisplay.textContent = `${percentage}%`;
}

// Format time for display (HH:MM:SS)
function formatTime(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// Stopwatch functions
function startTimer() {
    if (isRunning) return;
    
    isRunning = true;
    isPaused = false;
    startTime = Date.now() - elapsedTime;
    timerInterval = setInterval(updateDisplay, 1000);
    
    // Start face detection if not already running
    if (!faceDetectionActive) {
        faceDetectionActive = true;
        detectFaces();
    }
    
    // Update button states
    startBtn.disabled = true;
    pauseBtn.disabled = false;
    resetBtn.disabled = false;
}

function pauseTimer() {
    if (!isRunning || isPaused) return;
    
    isPaused = true;
    clearInterval(timerInterval);
    elapsedTime = Date.now() - startTime;
    
    pauseBtn.textContent = "Resume";
}

function resumeTimer() {
    if (!isRunning || !isPaused) return;
    
    isPaused = false;
    startTime = Date.now() - elapsedTime;
    timerInterval = setInterval(updateDisplay, 1000);
    
    pauseBtn.textContent = "Pause";
}

function resetTimer() {
    clearInterval(timerInterval);
    isRunning = false;
    isPaused = false;
    elapsedTime = 0;
    display.textContent = "00:00:00";
    
    // Reset focus stats
    focusedTime = 0;
    distractedTime = 0;
    isFocused = false;
    lastFocusCheckTime = 0;
    updateFocusUI();
    
    // Update button states
    startBtn.disabled = false;
    pauseBtn.disabled = true;
    resetBtn.disabled = true;
    pauseBtn.textContent = "Pause";
}

function updateDisplay() {
    const currentTime = Date.now();
    elapsedTime = currentTime - startTime;
    
    const totalSeconds = Math.floor(elapsedTime / 1000);
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    
    display.textContent = `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// Event Listeners
startBtn.addEventListener('click', startTimer);
pauseBtn.addEventListener('click', () => {
    if (isPaused) {
        resumeTimer();
    } else {
        pauseTimer();
    }
});
resetBtn.addEventListener('click', resetTimer);

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    loadModels();
    statusIndicator.classList.add('status-initializing');
});
