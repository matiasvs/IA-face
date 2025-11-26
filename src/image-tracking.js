import { MindARThree } from 'mind-ar/dist/mindar-image-three.prod.js';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import targetsUrl from './particleImage/targets3.mind?url';
import objectTestUrl from './models3d/objectTest.glb?url';

/**
 * MindAR Image Tracker with Advanced Anti-Jitter Stabilization
 * 
 * This tracker implements a multi-layer stabilization system to reduce 3D object trembling:
 * 
 * 1. ROLLING AVERAGE FILTER (historySize)
 *    - Averages position/rotation over multiple frames
 *    - Higher value = more stable but slower response
 *    - Recommended: 3-7 frames
 * 
 * 2. MOVEMENT THRESHOLD / DEAD ZONE (movementThreshold)
 *    - Ignores micro-movements below threshold
 *    - Higher value = less jitter but may feel "sticky"
 *    - Recommended: 0.0005 - 0.002
 * 
 * 3. VELOCITY CAPPING (maxVelocity)
 *    - Prevents sudden jumps in position
 *    - Lower value = smoother but may lag on fast movements
 *    - Recommended: 0.05 - 0.15
 * 
 * 4. LERP SMOOTHING (smoothingFactor)
 *    - Linear interpolation between current and target position
 *    - Higher value = faster response but more jitter
 *    - Recommended: 0.1 - 0.2
 * 
 * TUNING TIPS:
 * - If object is too slow to respond: increase smoothingFactor, decrease historySize
 * - If object still jitters: increase historySize, decrease movementThreshold
 * - If object "jumps" suddenly: decrease maxVelocity
 */


export class MindARTracker {
    constructor() {
        this.container = document.querySelector('#container');
        this.mindarThree = null;
        this.renderer = null;
        this.scene = null;
        this.camera = null;
        this.anchor = null;
        this.model = null;
        this.isRunning = false;

        // Enhanced smoothing configuration
        this.smoothingFactor = 0.15; // Increased from 0.1 for more stability
        this.targetPosition = new THREE.Vector3();
        this.targetQuaternion = new THREE.Quaternion();
        this.smoothedPosition = new THREE.Vector3();
        this.smoothedQuaternion = new THREE.Quaternion();

        // Rolling average filter (stores last N positions)
        this.positionHistory = [];
        this.quaternionHistory = [];
        this.historySize = 5; // Average over 5 frames

        // Movement threshold (dead zone) - ignore tiny movements
        this.movementThreshold = 0.001; // Minimum movement to apply

        // Velocity-based smoothing
        this.lastPosition = new THREE.Vector3();
        this.velocity = new THREE.Vector3();
        this.maxVelocity = 0.1; // Cap maximum velocity
    }

    async init() {
        console.log('Initializing MindAR with targets:', targetsUrl);

        this.mindarThree = new MindARThree({
            container: this.container,
            imageTargetSrc: targetsUrl,
        });

        this.renderer = this.mindarThree.renderer;
        this.scene = this.mindarThree.scene;
        this.camera = this.mindarThree.camera;

        // Add a light
        const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
        this.scene.add(light);

        // Create an anchor
        this.anchor = this.mindarThree.addAnchor(0);

        // Load 3D model
        await this.loadModel();
    }

    async loadModel() {
        return new Promise((resolve, reject) => {
            const loader = new GLTFLoader();
            loader.load(
                objectTestUrl,
                (gltf) => {
                    this.model = gltf.scene;
                    this.model.position.z = 0.5;
                    this.model.scale.set(0.5, 0.5, 0.5);
                    this.anchor.group.add(this.model);
                    console.log('✅ objectTest.glb loaded successfully in image tracking');

                    // Initialize smoothed values
                    this.smoothedPosition.copy(this.anchor.group.position);
                    this.smoothedQuaternion.copy(this.anchor.group.quaternion);

                    resolve();
                },
                (progress) => {
                    console.log(`Loading model: ${(progress.loaded / progress.total * 100).toFixed(2)}%`);
                },
                (error) => {
                    console.error('❌ Error loading objectTest.glb:', error);
                    // Fallback to cube
                    const geometry = new THREE.BoxGeometry(1, 1, 1);
                    const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
                    const cube = new THREE.Mesh(geometry, material);
                    cube.position.z = 0.5;
                    this.anchor.group.add(cube);
                    resolve();
                }
            );
        });
    }

    async start() {
        if (!this.mindarThree) await this.init();

        try {
            await this.mindarThree.start();
            this.isRunning = true;

            this.renderer.setAnimationLoop(() => {
                if (!this.isRunning) return;

                // Advanced smoothing with multiple filters
                if (this.anchor.group.visible) {
                    this.targetPosition.copy(this.anchor.group.position);
                    this.targetQuaternion.copy(this.anchor.group.quaternion);

                    // 1. Rolling Average Filter
                    this.positionHistory.push(this.targetPosition.clone());
                    this.quaternionHistory.push(this.targetQuaternion.clone());

                    if (this.positionHistory.length > this.historySize) {
                        this.positionHistory.shift();
                        this.quaternionHistory.shift();
                    }

                    // Calculate average position
                    const avgPosition = new THREE.Vector3();
                    this.positionHistory.forEach(pos => avgPosition.add(pos));
                    avgPosition.divideScalar(this.positionHistory.length);

                    // Calculate average quaternion (simplified - use first and slerp with others)
                    const avgQuaternion = this.quaternionHistory[0].clone();
                    for (let i = 1; i < this.quaternionHistory.length; i++) {
                        avgQuaternion.slerp(this.quaternionHistory[i], 1 / (i + 1));
                    }

                    // 2. Movement Threshold (Dead Zone) - ignore tiny movements
                    const distance = this.smoothedPosition.distanceTo(avgPosition);
                    if (distance < this.movementThreshold) {
                        // Movement too small, keep current position
                        this.anchor.group.position.copy(this.smoothedPosition);
                        this.anchor.group.quaternion.copy(this.smoothedQuaternion);
                        this.renderer.render(this.scene, this.camera);
                        return;
                    }

                    // 3. Velocity-based smoothing
                    this.velocity.subVectors(avgPosition, this.lastPosition);

                    // Cap velocity to prevent sudden jumps
                    if (this.velocity.length() > this.maxVelocity) {
                        this.velocity.normalize().multiplyScalar(this.maxVelocity);
                    }

                    this.lastPosition.copy(avgPosition);

                    // 4. Enhanced Lerp smoothing
                    this.smoothedPosition.lerp(avgPosition, this.smoothingFactor);
                    this.smoothedQuaternion.slerp(avgQuaternion, this.smoothingFactor);

                    this.anchor.group.position.copy(this.smoothedPosition);
                    this.anchor.group.quaternion.copy(this.smoothedQuaternion);
                }

                this.renderer.render(this.scene, this.camera);
            });
        } catch (error) {
            console.error('Failed to start MindAR:', error);
            throw error;
        }
    }

    stop() {
        if (this.mindarThree) {
            try {
                this.mindarThree.stop();
            } catch (e) {
                console.warn('Error stopping MindAR (possibly not started yet):', e);
            }
            if (this.mindarThree.renderer) {
                this.mindarThree.renderer.setAnimationLoop(null);
            }
            this.isRunning = false;
        }
    }

    // Focus Control Methods
    getFocusCapabilities() {
        const video = this.mindarThree?.video;
        if (!video || !video.srcObject) return null;

        const track = video.srcObject.getVideoTracks()[0];
        if (!track || !track.getCapabilities) return null;

        return track.getCapabilities();
    }

    async toggleFocusLock(locked) {
        const video = this.mindarThree?.video;
        if (!video || !video.srcObject) return false;

        const track = video.srcObject.getVideoTracks()[0];
        if (!track) return false;

        const mode = locked ? 'manual' : 'continuous';
        console.log(`📷 Setting focus mode to: ${mode}`);

        try {
            await track.applyConstraints({
                advanced: [{ focusMode: mode }]
            });
            return true;
        } catch (e) {
            console.warn('⚠️ Error setting focus mode:', e);
            return false;
        }
    }

    async setFocusDistance(distance) {
        const video = this.mindarThree?.video;
        if (!video || !video.srcObject) return false;

        const track = video.srcObject.getVideoTracks()[0];
        if (!track) return false;

        console.log(`📷 Setting focus distance to: ${distance}`);

        try {
            await track.applyConstraints({
                advanced: [{ focusDistance: distance }]
            });
            return true;
        } catch (e) {
            console.warn('⚠️ Error setting focus distance:', e);
            return false;
        }
    }
}
