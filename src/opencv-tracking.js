import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import objectTestUrl from './models3d/objectTest.glb?url';

export class OpenCVTracker {
    constructor(videoElement, canvasElement, referenceImagePath) {
        this.video = videoElement;
        this.canvas = canvasElement;
        this.ctx = canvasElement.getContext('2d');
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
        this.smoothingFactor = 0.1;
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
            this.canvas.width / this.canvas.height,
            0.1,
            1000
        );
        this.camera.position.z = 5;

        // Create renderer
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            alpha: true,
            antialias: true
        });
        this.renderer.setSize(this.canvas.width, this.canvas.height);
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

            img.onerror = (error) => {
                console.error('❌ Failed to load reference image:', error);
                reject(error);
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
                    resolve();
                }
            );
        });
    }

    async startVideo() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' }
            });
            this.video.srcObject = stream;
            await this.video.play();

            // Set canvas size to match video
            this.canvas.width = this.video.videoWidth;
            this.canvas.height = this.video.videoHeight;
            this.renderer.setSize(this.canvas.width, this.canvas.height);

            console.log('✅ Video stream started');
        } catch (error) {
            console.error('❌ Error accessing camera:', error);
        }
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
                const threshold = 50;

                for (let i = 0; i < matches.size(); i++) {
                    const match = matches.get(i);
                    if (match.distance < threshold) {
                        goodMatches.push(match);
                    }
                }

                // Need at least 4 matches for homography
                if (goodMatches.length >= 4) {
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

                    this.homography = cv.findHomography(srcMat, dstMat, cv.RANSAC);

                    // Update 3D object position based on homography
                    this.update3DObject();

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
            // Extract transformation from homography
            // This is a simplified approach - in production you'd want proper pose estimation
            const h = this.homography;

            // Get center point transformation
            const centerX = this.referenceImage.cols / 2;
            const centerY = this.referenceImage.rows / 2;

            // Calculate scale from homography
            const scaleX = Math.sqrt(h.doubleAt(0, 0) ** 2 + h.doubleAt(1, 0) ** 2);
            const scaleY = Math.sqrt(h.doubleAt(0, 1) ** 2 + h.doubleAt(1, 1) ** 2);
            const scale = (scaleX + scaleY) / 2;

            // Calculate rotation
            const rotation = Math.atan2(h.doubleAt(1, 0), h.doubleAt(0, 0));

            // Map to normalized coordinates (-1 to 1)
            const tx = h.doubleAt(0, 2);
            const ty = h.doubleAt(1, 2);

            const normalizedX = (tx / this.canvas.width) * 2 - 1;
            const normalizedY = -((ty / this.canvas.height) * 2 - 1);

            // Target values
            const targetPosition = new THREE.Vector3(normalizedX * 3, normalizedY * 3, 0);
            const targetRotation = new THREE.Euler(0, 0, rotation);
            const targetScale = Math.max(0.1, Math.min(2, scale * 0.5));

            // Apply smoothing
            this.smoothedPosition.lerp(targetPosition, this.smoothingFactor);
            this.smoothedRotation.x += (targetRotation.x - this.smoothedRotation.x) * this.smoothingFactor;
            this.smoothedRotation.y += (targetRotation.y - this.smoothedRotation.y) * this.smoothingFactor;
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
        // Draw video frame
        this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);

        // Process frame for tracking
        this.processFrame();

        // Hide model if not tracking
        if (this.model && !this.isTracking) {
            this.model.visible = false;
        }

        // Render Three.js scene on top
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
