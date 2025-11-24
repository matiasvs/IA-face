import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ParticleRain } from '../effects/ParticleRain.js';
import { FaceOccluder } from '../effects/FaceOccluder.js';
import objectTestUrl from '../models3d/objectTest.glb?url';

export class SceneManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true }); // Alpha true for AR overlay

        // Calibration parameters for hand tracking
        this.handCalibration = {
            offsetY: -0.6,
            scale: 1.0,
            depthScale: 0.5
        };

        // Calibration parameters for face mask
        this.faceCalibration = {
            offsetX: -0.1  // Horizontal offset for face mask
        };

        this.init();
    }

    init() {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);

        // Lighting
        const light = new THREE.DirectionalLight(0xffffff, 1);
        light.position.set(0, 0, 1);
        this.scene.add(light);
        this.scene.add(new THREE.AmbientLight(0xffffff, 0.5));

        // Initialize particle rain system
        this.particleRain = new ParticleRain(this.scene);

        // Initialize face occluder for depth-based occlusion
        this.faceOccluder = new FaceOccluder(this.scene);

        // Load controllable 3D model (positioned on right side, middle)
        const loader = new GLTFLoader();
        loader.load(
            objectTestUrl,
            (gltf) => {
                this.controllableCube = gltf.scene;
                this.controllableCube.position.set(2, 0, 0); // Right side, middle height
                this.controllableCube.scale.set(0.5, 0.5, 0.5); // 50% smaller
                this.controllableCube.renderOrder = 1; // Render after occluder

                // Enable depth testing for all meshes in the model
                this.controllableCube.traverse((child) => {
                    if (child.isMesh) {
                        child.material.depthTest = true;
                        child.material.depthWrite = true;
                    }
                });

                this.scene.add(this.controllableCube);
                console.log('✅ objectTest.glb loaded successfully');
            },
            (progress) => {
                console.log(`Loading model: ${(progress.loaded / progress.total * 100).toFixed(2)}%`);
            },
            (error) => {
                console.error('❌ Error loading objectTest.glb:', error);
                // Fallback to cube if model fails to load
                const cubeGeometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
                const cubeMaterial = new THREE.MeshStandardMaterial({
                    color: 0xff0000,
                    depthTest: true,
                    depthWrite: true
                });
                this.controllableCube = new THREE.Mesh(cubeGeometry, cubeMaterial);
                this.controllableCube.position.set(2, 0, 0);
                this.controllableCube.renderOrder = 1;
                this.scene.add(this.controllableCube);
            }
        );

        // Movement configuration
        this.cubeMovement = {
            step: 0.2  // Movement step size
        };

        // Position camera
        this.camera.position.z = 5;

        // Handle resize
        window.addEventListener('resize', () => this.onWindowResize());
    }

    updateFace(landmarks) {
        if (!landmarks || landmarks.length === 0) return;

        // Update face occluder for particle occlusion
        if (this.faceOccluder) {
            this.faceOccluder.updateFace(landmarks, this.camera, this.faceCalibration.offsetX);
        }

        // Landmarks
        const nose = landmarks[1];
        const leftEye = landmarks[33];
        const rightEye = landmarks[263];
        const chin = landmarks[152];

        // Position
        // Map normalized coordinates to world coordinates
        // We assume the camera is at z=5 and looking at z=0.
        // We need to calibrate the scale.
        // For a simple effect, we can just map the center.

        const videoAspect = window.innerWidth / window.innerHeight; // Assuming video covers screen
        const fov = this.camera.fov * (Math.PI / 180);
        const heightAtZero = 2 * Math.tan(fov / 2) * 5; // Distance 5
        const widthAtZero = heightAtZero * this.camera.aspect;

        // COMMENTED OUT - faceObject updates (sphere is commented out)
        /*
        // Invert X to match mirrored video
        const x = -(nose.x - 0.5) * widthAtZero;
        const y = -(nose.y - 0.5) * heightAtZero;

        this.faceObject.position.set(x, y, 0);

        // Rotation
        // Create vectors for eyes and face up/down
        // Invert X for mirrored video
        const p1 = new THREE.Vector3(-(leftEye.x - 0.5) * widthAtZero, -(leftEye.y - 0.5) * heightAtZero, 0);
        const p2 = new THREE.Vector3(-(rightEye.x - 0.5) * widthAtZero, -(rightEye.y - 0.5) * heightAtZero, 0);

        // Vector from left eye to right eye (local X axis)
        const xAxis = new THREE.Vector3().subVectors(p2, p1).normalize();

        // Vector from chin to nose (local Y axis approx)
        // Note: Z depth is missing, so rotation is 2D-ish unless we use Z from landmarks.
        // MediaPipe Z is normalized by image width.
        // Let's use the Z for better rotation.

        const zScale = widthAtZero; // Approximate scale for Z
        p1.z = -leftEye.z * zScale; // MediaPipe Z is negative into screen? No, it's relative.
        p2.z = -rightEye.z * zScale;

        // Re-calculate xAxis with Z
        xAxis.subVectors(p2, p1).normalize();

        // Temporary Y axis (Up)
        const yAxis = new THREE.Vector3(0, 1, 0);

        // Z axis (Forward) = X cross Y
        const zAxis = new THREE.Vector3().crossVectors(xAxis, yAxis).normalize();

        // Correct Y axis = Z cross X
        yAxis.crossVectors(zAxis, xAxis).normalize();

        // Create rotation matrix
        const matrix = new THREE.Matrix4();
        matrix.makeBasis(xAxis, yAxis, zAxis);

        this.faceObject.setRotationFromMatrix(matrix);
        */
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        // Update particle rain
        if (this.particleRain) {
            this.particleRain.update();
        }

        this.renderer.render(this.scene, this.camera);
    }
    updateHands(results) {
        if (!this.handObjects) {
            this.handObjects = [];
            const geometry = new THREE.SphereGeometry(0.15, 16, 16); // Slightly smaller spheres
            const material = new THREE.MeshStandardMaterial({
                color: 0x00ff00,
                depthTest: true,  // Ensure depth testing is enabled
                depthWrite: true  // Write to depth buffer
            });

            // Create pool of objects for 2 hands * 21 landmarks
            for (let i = 0; i < 42; i++) {
                const mesh = new THREE.Mesh(geometry, material);
                mesh.visible = false;
                mesh.renderOrder = 1; // Render after face occluder (which has renderOrder = 0)
                this.scene.add(mesh);
                this.handObjects.push(mesh);
            }
        }

        // Hide all first
        this.handObjects.forEach(obj => obj.visible = false);

        if (results.multiHandLandmarks) {
            const fov = this.camera.fov * (Math.PI / 180);
            const cameraDistance = 5; // Camera is at z=5

            // Calculate visible area at z=0 plane
            const heightAtZero = 2 * Math.tan(fov / 2) * cameraDistance;
            const widthAtZero = heightAtZero * this.camera.aspect;

            let objIndex = 0;
            for (const landmarks of results.multiHandLandmarks) {
                for (const landmark of landmarks) {
                    if (objIndex >= this.handObjects.length) break;

                    const mesh = this.handObjects[objIndex];

                    // MediaPipe coordinates:
                    // x, y: normalized [0, 1] relative to image
                    // z: depth relative to wrist (negative = closer to camera)

                    // Invert X to match mirrored video
                    const x = -(landmark.x - 0.5) * widthAtZero * this.handCalibration.scale;
                    const y = -(landmark.y - 0.5) * heightAtZero * this.handCalibration.scale + this.handCalibration.offsetY;

                    // Z depth: MediaPipe's z is relative depth, scale it appropriately
                    // Negative z in MediaPipe means closer to camera
                    const z = landmark.z * widthAtZero * this.handCalibration.depthScale;

                    mesh.position.set(x, y, z);
                    mesh.visible = true;
                    objIndex++;
                }
            }
        }
    }

    // Cube movement methods
    moveCubeUp() {
        if (this.controllableCube) {
            this.controllableCube.position.y += this.cubeMovement.step;
        }
    }

    moveCubeDown() {
        if (this.controllableCube) {
            this.controllableCube.position.y -= this.cubeMovement.step;
        }
    }

    moveCubeLeft() {
        if (this.controllableCube) {
            this.controllableCube.position.x -= this.cubeMovement.step;
        }
    }

    moveCubeRight() {
        if (this.controllableCube) {
            this.controllableCube.position.x += this.cubeMovement.step;
        }
    }

    // Method to update calibration values
    setHandCalibration(offsetY, scale, depthScale) {
        this.handCalibration.offsetY = offsetY;
        this.handCalibration.scale = scale;
        this.handCalibration.depthScale = depthScale;
    }

    // Method to update face mask calibration
    setFaceCalibration(offsetX) {
        this.faceCalibration.offsetX = offsetX;
    }
}
