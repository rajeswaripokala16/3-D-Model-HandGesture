// --- 1. Global Setup and Constants ---
const canvas = document.getElementById('outputCanvas');
const videoElement = document.getElementById('webcamFeed');
const NUM_PARTICLES = 10000;

// --- 2. Three.js Initialization ---
let scene, camera, renderer;
let particleGeometry, particleMaterial, particleSystem;

function initThreeJS() {
    console.log("Initializing Three.js...");
    // Scene setup
    scene = new THREE.Scene();
    
    // Camera setup
    const aspectRatio = window.innerWidth / window.innerHeight;
    camera = new THREE.PerspectiveCamera(75, aspectRatio, 0.1, 1000);
    camera.position.z = 5;

    // Renderer setup
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}

function initParticles() {
    console.log("Initializing particles...");
    particleGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(NUM_PARTICLES * 3);
    const colors = new Float32Array(NUM_PARTICLES * 3);
    
    for (let i = 0; i < NUM_PARTICLES; i++) {
        const i3 = i * 3;
        // Random spherical distribution
        const r = Math.random() * 2;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(Math.random() * 2 - 1);

        positions[i3 + 0] = r * Math.sin(phi) * Math.cos(theta); // x
        positions[i3 + 1] = r * Math.sin(phi) * Math.sin(theta); // y
        positions[i3 + 2] = r * Math.cos(phi);                  // z
        
        colors[i3 + 0] = 1.0;
        colors[i3 + 1] = 1.0;
        colors[i3 + 2] = 1.0;
    }

    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    particleMaterial = new THREE.PointsMaterial({
        size: 0.05,
        vertexColors: true,
        transparent: true,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
    });
    
    particleSystem = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particleSystem);
}

// --- 3. Hand Tracking Integration (MediaPipe) ---

// THIS IS LINE 72 - The line that is throwing the error!
const hands = new Hands({ 
    locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4/${file}`;
    }
});

hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});

hands.onResults(onResults);

function onResults(results) {
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const handLandmarks = results.multiHandLandmarks[0];
        updateParticles(handLandmarks);
    }
}

// Setup the camera stream
const cameraFeed = new Camera(videoElement, {
    onFrame: async () => {
        await hands.send({ image: videoElement });
    },
    width: 640,
    height: 480
});

// Start everything when the camera is ready
cameraFeed.start()
    .then(() => {
        console.log("Camera stream started. Starting rendering loop.");
        initThreeJS();
        initParticles();
        animate();
    })
    .catch(err => {
        console.error("CRITICAL: Camera access failed or MediaPipe start error:", err);
        // This log will help us if the error changes from 'Hands is not defined'
    });


// --- 4. Control Logic: Map Hand Gesture to Particle Behavior ---

function updateParticles(handLandmarks) {
    // Check for the pinch gesture distance
    const thumbTip = handLandmarks[4];
    const indexTip = handLandmarks[8];

    const dx = thumbTip.x - indexTip.x;
    const dy = thumbTip.y - indexTip.y;
    const dz = thumbTip.z - indexTip.z;
    
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    // Control Particle Expansion (Size)
    const newSize = THREE.MathUtils.lerp(0.01, 0.5, distance * 3);
    particleMaterial.size = newSize;

    // Control Color Change (Blue to Red)
    const ratio = Math.min(1.0, distance * 5); 

    const positions = particleGeometry.attributes.position.array;
    const colors = particleGeometry.attributes.color.array;

    for (let i = 0; i < NUM_PARTICLES; i++) {
        const i3 = i * 3;
        
        // Color Interpolation (Red) and (Blue) based on ratio
        colors[i3 + 0] = ratio;      
        colors[i3 + 1] = 0;
        colors[i3 + 2] = 1.0 - ratio; 
        
        // Simple particle movement for visual effect
        const time = Date.now() * 0.0001;
        const radius = 2;
        positions[i3 + 0] = Math.cos(time + i * 0.1) * radius * (1 + ratio);
        positions[i3 + 2] = Math.sin(time + i * 0.1) * radius * (1 + ratio);
    }

    particleGeometry.attributes.color.needsUpdate = true;
    particleGeometry.attributes.position.needsUpdate = true;
}

// --- 5. Animation Loop ---

function animate() {
    requestAnimationFrame(animate);

    particleSystem.rotation.y += 0.001;
    
    renderer.render(scene, camera);
}