// Global variables
let videoStream = null;
let faceDescriptors = [];
let labeledFaceDescriptors = [];
let faceMatcher = null;

// DOM elements
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const startCameraBtn = document.getElementById('startCamera');
const stopCameraBtn = document.getElementById('stopCamera');
const captureFaceBtn = document.getElementById('captureFace');
const recognizerBtn = document.getElementById('recognize');
const faceDescriptorsDiv = document.getElementById('faceDescriptors');
const recognizedFacesDiv = document.getElementById('recognizedFaces');

// Event listeners
startCameraBtn.addEventListener('click', startCamera);
stopCameraBtn.addEventListener('click', stopCamera);
captureFaceBtn.addEventListener('click', captureFace);
recognizerBtn.addEventListener('click', recognizeFaces);

// Load face-api.js models
async function loadModels() {
    try {
        await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
        await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
        await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
        console.log('Models loaded successfully');
    } catch (error) {
        console.error('Error loading models:', error);
        alert('Error loading face detection models. Please check console for details.');
    }
}

// Start camera
async function startCamera() {
    try {
        videoStream = await navigator.mediaDevices.getUserMedia({ 
            video: true, 
            audio: false 
        });
        video.srcObject = videoStream;
        
        startCameraBtn.disabled = true;
        stopCameraBtn.disabled = false;
        captureFaceBtn.disabled = false;
        
        // Start face detection
        detectFaces();
    } catch (error) {
        console.error('Error accessing camera:', error);
        alert('Could not access the camera. Please ensure you have granted permissions.');
    }
}

// Stop camera
function stopCamera() {
    if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
        video.srcObject = null;
        videoStream = null;
        
        startCameraBtn.disabled = false;
        stopCameraBtn.disabled = true;
        captureFaceBtn.disabled = true;
        recognizerBtn.disabled = true;
        
        // Clear canvas
        const context = canvas.getContext('2d');
        context.clearRect(0, 0, canvas.width, canvas.height);
    }
}

// Detect faces in real-time
async function detectFaces() {
    if (!videoStream) return;
    
    const displaySize = { width: video.width, height: video.height };
    faceapi.matchDimensions(canvas, displaySize);
    
    async function detect() {
        if (!videoStream) return;
        
        const detections = await faceapi.detectAllFaces(
            video, 
            new faceapi.TinyFaceDetectorOptions()
        ).withFaceLandmarks().withFaceDescriptors();
        
        // Resize detections to match canvas
        const resizedDetections = faceapi.resizeResults(detections, displaySize);
        
        // Clear canvas
        const context = canvas.getContext('2d');
        context.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw detections
        faceapi.draw.drawDetections(canvas, resizedDetections);
        faceapi.draw.drawFaceLandmarks(canvas, resizedDetections);
        
        requestAnimationFrame(detect);
    }
    
    detect();
}

// Capture face and store descriptor
async function captureFace() {
    const faceName = prompt('Enter a name for this face:');
    if (!faceName) return;
    
    const detections = await faceapi.detectAllFaces(
        video, 
        new faceapi.TinyFaceDetectorOptions()
    ).withFaceLandmarks().withFaceDescriptors();
    
    if (detections.length === 0) {
        alert('No faces detected!');
        return;
    }
    
    // For simplicity, we'll take the first face
    const descriptor = detections[0].descriptor;
    faceDescriptors.push({
        name: faceName,
        descriptor: descriptor
    });
    
    updateFaceDescriptorsDisplay();
    recognizerBtn.disabled = faceDescriptors.length === 0;
}

// Update the display of stored face descriptors
function updateFaceDescriptorsDisplay() {
    faceDescriptorsDiv.innerHTML = '<h3>Stored Faces:</h3>';
    
    if (faceDescriptors.length === 0) {
        faceDescriptorsDiv.innerHTML += '<p>No faces stored yet.</p>';
        return;
    }
    
    faceDescriptors.forEach((face, index) => {
        const faceBox = document.createElement('div');
        faceBox.className = 'face-box';
        faceBox.innerHTML = `
            <div class="face-info">
                <strong>${face.name}</strong><br>
                <button onclick="deleteFace(${index})">Delete</button>
            </div>
        `;
        faceDescriptorsDiv.appendChild(faceBox);
    });
}

// Delete a stored face
window.deleteFace = function(index) {
    faceDescriptors.splice(index, 1);
    updateFaceDescriptorsDisplay();
    recognizerBtn.disabled = faceDescriptors.length === 0;
};

// Recognize faces in real-time
async function recognizeFaces() {
    if (faceDescriptors.length === 0) {
        alert('No faces stored for recognition!');
        return;
    }
    
    // Prepare labeled face descriptors for face matcher
    labeledFaceDescriptors = faceDescriptors.map(face => (
        new faceapi.LabeledFaceDescriptors(
            face.name, 
            [face.descriptor]
        )
    ));
    
    faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors, 0.6);
    
    // Start recognition
    const displaySize = { width: video.width, height: video.height };
    faceapi.matchDimensions(canvas, displaySize);
    
    async function recognize() {
        if (!videoStream) return;
        
        const detections = await faceapi.detectAllFaces(
            video, 
            new faceapi.TinyFaceDetectorOptions()
        ).withFaceLandmarks().withFaceDescriptors();
        
        const resizedDetections = faceapi.resizeResults(detections, displaySize);
        
        // Clear canvas
        const context = canvas.getContext('2d');
        context.clearRect(0, 0, canvas.width, canvas.height);
        
        // Match faces with stored descriptors
        const results = resizedDetections.map(d => faceMatcher.findBestMatch(d.descriptor));
        
        // Draw results
        results.forEach((result, i) => {
            const box = resizedDetections[i].detection.box;
            const drawBox = new faceapi.draw.DrawBox(box, { 
                label: result.toString(),
                lineWidth: 2
            });
            drawBox.draw(canvas);
        });
        
        recognizedFacesDiv.innerHTML = '<h3>Recognition Results:</h3>';
        if (results.length > 0) {
            results.forEach(result => {
                recognizedFacesDiv.innerHTML += `<p>${result.toString()}</p>`;
            });
        } else {
            recognizedFacesDiv.innerHTML += '<p>No faces detected.</p>';
        }
        
        requestAnimationFrame(recognize);
    }
    
    recognize();
}

// Initialize the app
async function init() {
    console.log('Initializing face recognition app...');
    await loadModels();
    console.log('App initialized');
}

// Start the app
init();