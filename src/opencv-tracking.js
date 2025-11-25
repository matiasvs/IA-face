import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import objectTestUrl from './models3d/objectTest.glb?url';

export class OpenCVTracker {
    constructor(videoElement, videoCanvas, webglCanvas, referenceImagePath) {
        this.video = videoElement;
        this.videoCanvas = videoCanvas;
        this.webglCanvas = webglCanvas;
        this.videoCtx = videoCanvas.getContext('2d');
        this.referenceImagePath = referenceImagePath;

        // Three.js setup
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.model = null;

        // OpenCV matrices
        this.referenceImage = null;
        this.referenceKeypoints = null;
        this.referenceDescriptors = null;
        this.detector = null;
        this.matcher = null;

        // Tracking state
        this.isTracking = false;
        this.homography = null;

        // Smoothing
        this.smoothingFactor = 0.05;
        this.smoothedPosition = new THREE.Vector3();
        this.smoothedRotation = new THREE.Euler();
        this.smoothedScale = 1.0;

        // Performance
        this.lastFrameTime = 0;
        this.frameInterval = 1000 / 30; // 30 FPS max for tracking
    }

    async init() {
        console.log('🔧 Initializing OpenCV Tracker...');

        // Wait for OpenCV to be ready
        await this.waitForOpenCV();

        // Initialize Three.js
        this.initThreeJS();

        // Load reference image and extract features
        await this.loadReferenceImage();

        // Initialize detector and matcher
        this.initDetector();

        // Load 3D model
        await this.load3DModel();

        // Start video stream
        await this.startVideo();

        console.log('✅ OpenCV Tracker initialized');
    }

    async waitForOpenCV() {
        return new Promise((resolve) => {
            if (typeof cv !== 'undefined' && cv.Mat) {
                console.log('✅ OpenCV.js already loaded');
                resolve();
            } else {
                console.log('⏳ Waiting for OpenCV.js to load...');
                const checkInterval = setInterval(() => {
                    if (typeof cv !== 'undefined' && cv.Mat) {
                        clearInterval(checkInterval);
                        console.log('✅ OpenCV.js loaded');
                        resolve();
                    }
                }, 100);
            }
        });
    }

    initThreeJS() {
        // Create scene
        this.scene = new THREE.Scene();

        // Create camera
        this.camera = new THREE.PerspectiveCamera(
            60,
            this.webglCanvas.width / this.webglCanvas.height,
            0.1,
            1000
        );
        this.camera.position.z = 5;

        // Create renderer
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.webglCanvas,
            alpha: true,
            antialias: true
        });
        this.renderer.setSize(this.webglCanvas.width, this.webglCanvas.height);
        this.renderer.setClearColor(0x000000, 0);

        // Add lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(1, 1, 1);
        this.scene.add(directionalLight);

        console.log('✅ Three.js initialized');
    }

    async loadReferenceImage() {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';

            img.onload = () => {
                console.log('📸 Reference image loaded');

                // Convert image to OpenCV Mat
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);

                this.referenceImage = cv.imread(canvas);

                // Convert to grayscale
                const gray = new cv.Mat();
                cv.cvtColor(this.referenceImage, gray, cv.COLOR_RGBA2GRAY);

                // Detect keypoints and compute descriptors
                this.referenceKeypoints = new cv.KeyPointVector();
                this.referenceDescriptors = new cv.Mat();

                // Use ORB detector
                const orb = new cv.ORB(500); // 500 features
                orb.detectAndCompute(gray, new cv.Mat(), this.referenceKeypoints, this.referenceDescriptors);

                console.log(`✅ Detected ${this.referenceKeypoints.size()} keypoints in reference image`);

                gray.delete();
                resolve();
            };

            img.onerror = () => {
                const errorMsg = `Failed to load reference image from ${this.referenceImagePath}`;
                console.error('❌ ' + errorMsg);
                reject(new Error(errorMsg));
            };

            img.src = this.referenceImagePath;
        });
    }

    initDetector() {
        // Create ORB detector for frame processing
        this.detector = new cv.ORB(500);

        // Create BFMatcher (Brute Force Matcher)
        this.matcher = new cv.BFMatcher(cv.NORM_HAMMING, true);

        console.log('✅ Detector and matcher initialized');
    }

    async load3DModel() {
        return new Promise((resolve, reject) => {
            const loader = new GLTFLoader();
            loader.load(
                objectTestUrl,
                (gltf) => {
                    this.model = gltf.scene;
                    this.model.scale.set(0.5, 0.5, 0.5);
                    this.model.position.z = 0;
                    this.scene.add(this.model);
                    console.log('✅ 3D model loaded');
                    resolve();
                },
                undefined,
                (error) => {
                    console.error('❌ Error loading 3D model:', error);
                    // Create fallback cube
                    const geometry = new THREE.BoxGeometry(1, 1, 1);
                    const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
                    this.model = new THREE.Mesh(geometry, material);
                    this.scene.add(this.model);
                    console.log('⚠️ Using fallback cube due to model load error');
                    resolve();
                }
            );
        });
    }

    async startVideo() {
        try {
            let stream;

            // Try rear camera first (for mobile)
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'environment' }
                });
                console.log('📹 Using rear camera');
            } catch (error) {
                // Fallback to front camera (for desktop)
                console.log('⚠️ Rear camera not available, trying front camera...');
                stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'user' }
                });
                console.log('📹 Using front camera');
            }

            this.video.srcObject = stream;
            await this.video.play();

            // Attempt to lock focus (disable autofocus hunting)
            const track = stream.getVideoTracks()[0];
            if (track) {
                const capabilities = track.getCapabilities ? track.getCapabilities() : {};
                console.log('📷 Camera capabilities:', capabilities);

                if (capabilities.focusMode && capabilities.focusMode.includes('manual')) {
                    try {
                        // First let it focus for a moment (optional, but 'manual' usually locks current)
                        // Applying 'manual' mode to lock focus
                        await track.applyConstraints({
                            advanced: [{ focusMode: 'manual' }]
                        });
                        console.log('✅ Focus locked to manual mode');
                    } catch (e) {
                        console.warn('⚠️ Could not lock focus:', e);
                    }
                }
            }

            // Wait for video metadata to load
            await new Promise(resolve => {
                if (this.video.videoWidth && this.video.videoHeight) {
                    resolve();
                } else {
                    this.video.addEventListener('loadedmetadata', resolve, { once: true });
                }
            });

            // Set internal canvas resolution to match video
            this.videoCanvas.width = this.video.videoWidth;
            this.videoCanvas.height = this.video.videoHeight;
            this.webglCanvas.width = this.video.videoWidth;
            this.webglCanvas.height = this.video.videoHeight;

            this.renderer.setSize(this.video.videoWidth, this.video.videoHeight);
            this.camera.aspect = this.video.videoWidth / this.video.videoHeight;
            this.camera.updateProjectionMatrix();

            // Handle window resize
            window.addEventListener('resize', () => this.updateCanvasLayout());
            this.updateCanvasLayout();

            console.log('✅ Video stream started');
        } catch (error) {
            console.error('❌ Error accessing camera:', error);
            throw error;
        }
    }

    updateCanvasLayout() {
        // Simulate "object-fit: cover" for canvas
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        const videoRatio = this.video.videoWidth / this.video.videoHeight;
        const windowRatio = windowWidth / windowHeight;

        let renderWidth, renderHeight;

        if (windowRatio > videoRatio) {
            // Window is wider than video
            renderWidth = windowWidth;
            renderHeight = windowWidth / videoRatio;
        } else {
            // Window is taller than video
            renderWidth = windowHeight * videoRatio;
            renderHeight = windowHeight;
        }

        // Center the canvas
        const left = (windowWidth - renderWidth) / 2;
        const top = (windowHeight - renderHeight) / 2;

        const style = `position: absolute; width: ${renderWidth}px; height: ${renderHeight}px; left: ${left}px; top: ${top}px;`;
        this.videoCanvas.style.cssText = style + ' z-index: 1;';
        this.webglCanvas.style.cssText = style + ' z-index: 2;';
    }

    processFrame() {
        const currentTime = Date.now();

        // Throttle processing to improve performance
        if (currentTime - this.lastFrameTime < this.frameInterval) {
            return;
        }
        this.lastFrameTime = currentTime;

        if (!this.video.videoWidth || !this.video.videoHeight) {
            return;
        }

        try {
            // Capture current frame
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = this.video.videoWidth;
            tempCanvas.height = this.video.videoHeight;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.drawImage(this.video, 0, 0);

            const frame = cv.imread(tempCanvas);
            const gray = new cv.Mat();
            cv.cvtColor(frame, gray, cv.COLOR_RGBA2GRAY);

            // Detect keypoints in current frame
            const frameKeypoints = new cv.KeyPointVector();
            const frameDescriptors = new cv.Mat();
            this.detector.detectAndCompute(gray, new cv.Mat(), frameKeypoints, frameDescriptors);

            // Match descriptors
            if (frameDescriptors.rows > 0 && this.referenceDescriptors.rows > 0) {
                const matches = new cv.DMatchVector();
                this.matcher.match(this.referenceDescriptors, frameDescriptors, matches);

                // Filter good matches (distance < threshold)
                const goodMatches = [];
                const threshold = 40; // Stricter threshold

                for (let i = 0; i < matches.size(); i++) {
                    const match = matches.get(i);
                    if (match.distance < threshold) {
                        goodMatches.push(match);
                    }
                }

                // Need at least 8 matches for stable homography
                if (goodMatches.length >= 8) {
                    this.isTracking = true;

                    // Extract matched points
                    const srcPoints = [];
                    const dstPoints = [];

                    for (const match of goodMatches) {
                        const refKp = this.referenceKeypoints.get(match.queryIdx);
                        const frameKp = frameKeypoints.get(match.trainIdx);
                        srcPoints.push(refKp.pt.x, refKp.pt.y);
                        dstPoints.push(frameKp.pt.x, frameKp.pt.y);
                    }

                    // Calculate homography
                    const srcMat = cv.matFromArray(goodMatches.length, 1, cv.CV_32FC2, srcPoints);
                    const dstMat = cv.matFromArray(goodMatches.length, 1, cv.CV_32FC2, dstPoints);

                    this.homography = cv.findHomography(srcMat, dstMat, cv.RANSAC, 5.0);

                    // Update 3D object position based on homography
                    if (!this.homography.empty()) {
                        this.update3DObject();
                    }

                    srcMat.delete();
                    dstMat.delete();
                } else {
                    this.isTracking = false;
                }

                matches.delete();
            }

            // Cleanup
            frame.delete();
            gray.delete();
            frameKeypoints.delete();
            frameDescriptors.delete();

        } catch (error) {
            console.error('Error processing frame:', error);
        }
    }

    update3DObject() {
        if (!this.homography || !this.model) return;

        try {
            // 1. Calculate Center Position using Perspective Transform
            // We transform the center point of the reference image to the video frame
            const centerX = this.referenceImage.cols / 2;
            const centerY = this.referenceImage.rows / 2;

            const srcPoints = cv.matFromArray(1, 1, cv.CV_32FC2, [centerX, centerY]);
            const dstPoints = new cv.Mat();

            cv.perspectiveTransform(srcPoints, dstPoints, this.homography);

            const x = dstPoints.data32F[0];
            const y = dstPoints.data32F[1];

            srcPoints.delete();
            dstPoints.delete();

            // Sanity check: Is the point within reasonable bounds?
            // Allow some margin outside the screen
            if (x < -this.videoCanvas.width || x > this.videoCanvas.width * 2 ||
                y < -this.videoCanvas.height || y > this.videoCanvas.height * 2) {
                return; // Ignore outliers
            }

            // 2. Calculate Scale
            // Transform (0,0) and (width,0) to get width in frame
            const h = this.homography;
            const scaleX = Math.sqrt(h.doubleAt(0, 0) ** 2 + h.doubleAt(1, 0) ** 2);
            const scaleY = Math.sqrt(h.doubleAt(0, 1) ** 2 + h.doubleAt(1, 1) ** 2);
            const scale = (scaleX + scaleY) / 2;

            // Sanity check: Scale
            if (scale < 0.1 || scale > 5.0) return;

            // 3. Calculate Rotation
            const rotation = Math.atan2(h.doubleAt(1, 0), h.doubleAt(0, 0));

            // 4. Map to Three.js Coordinates (Normalized Device Coordinates)
            // X: -1 (left) to 1 (right)
            // Y: 1 (top) to -1 (bottom)
            const normalizedX = (x / this.videoCanvas.width) * 2 - 1;
            const normalizedY = -((y / this.videoCanvas.height) * 2 - 1);

            // Z depth is arbitrary in this 2D-overlay approach, we keep it fixed or scale-dependent
            // For true AR, we'd need PnP. Here we just overlay.
            const targetPosition = new THREE.Vector3(normalizedX * (this.camera.aspect * 5), normalizedY * 5, 0);
            // Note: The multiplier 5 depends on camera Z position (which is 5) and FOV.
            // At Z=0, with Camera Z=5, the view height is 2 * 5 * tan(30deg) ~= 5.77

            // Refined mapping for PerspectiveCamera at Z=5, FOV=60
            const visibleHeightAtZ0 = 2 * Math.tan((this.camera.fov * Math.PI / 180) / 2) * this.camera.position.z;
            const visibleWidthAtZ0 = visibleHeightAtZ0 * this.camera.aspect;

            targetPosition.x = normalizedX * (visibleWidthAtZ0 / 2);
            targetPosition.y = normalizedY * (visibleHeightAtZ0 / 2);

            const targetRotation = new THREE.Euler(0, 0, -rotation); // Negative rotation for Three.js
            const targetScale = scale * 0.5; // Adjust base scale

            // Apply smoothing
            this.smoothedPosition.lerp(targetPosition, this.smoothingFactor);

            // Smooth rotation (handle wraparound)
            // Simplified lerp for rotation z
            this.smoothedRotation.z += (targetRotation.z - this.smoothedRotation.z) * this.smoothingFactor;

            this.smoothedScale += (targetScale - this.smoothedScale) * this.smoothingFactor;

            // Apply to model
            this.model.position.copy(this.smoothedPosition);
            this.model.rotation.copy(this.smoothedRotation);
            this.model.scale.setScalar(this.smoothedScale);
            this.model.visible = true;

        } catch (error) {
            console.error('Error updating 3D object:', error);
        }
    }

    render() {
        // Draw video frame on 2D canvas
        this.videoCtx.drawImage(this.video, 0, 0, this.videoCanvas.width, this.videoCanvas.height);

        // Process frame for tracking
        this.processFrame();

        // Hide model if not tracking
        if (this.model && !this.isTracking) {
            this.model.visible = false;
        }

        // Render Three.js scene on WebGL canvas
        this.renderer.render(this.scene, this.camera);
    }

    start() {
        const animate = () => {
            requestAnimationFrame(animate);
            this.render();
        };
        animate();
        console.log('🎬 Tracking started');
    }

    stop() {
        if (this.video.srcObject) {
            this.video.srcObject.getTracks().forEach(track => track.stop());
        }
        console.log('⏹️ Tracking stopped');
    }

    cleanup() {
        this.stop();

        // Cleanup OpenCV resources
        if (this.referenceImage) this.referenceImage.delete();
        if (this.referenceDescriptors) this.referenceDescriptors.delete();
        if (this.referenceKeypoints) this.referenceKeypoints.delete();
        if (this.homography) this.homography.delete();

        console.log('🧹 Cleanup complete');
    }
}
