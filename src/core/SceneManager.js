import * as THREE from 'three';

export class SceneManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true }); // Alpha true for AR overlay

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

        // Create a placeholder object (e.g., a red sphere for the nose)
        const geometry = new THREE.SphereGeometry(0.5, 32, 32);
        const material = new THREE.MeshStandardMaterial({ color: 0xff0000 });
        this.faceObject = new THREE.Mesh(geometry, material);
        this.scene.add(this.faceObject);

        // Position camera
        this.camera.position.z = 5;

        // Handle resize
        window.addEventListener('resize', () => this.onWindowResize());
    }

    updateFace(landmarks) {
        if (!landmarks || landmarks.length === 0) return;

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
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        this.renderer.render(this.scene, this.camera);
    }
    updateHands(results) {
        if (!this.handObjects) {
            this.handObjects = [];
            const geometry = new THREE.SphereGeometry(0.2, 16, 16);
            const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });

            // Create pool of objects for 2 hands * 21 landmarks
            for (let i = 0; i < 42; i++) {
                const mesh = new THREE.Mesh(geometry, material);
                mesh.visible = false;
                this.scene.add(mesh);
                this.handObjects.push(mesh);
            }
        }

        // Hide all first
        this.handObjects.forEach(obj => obj.visible = false);

        if (results.multiHandLandmarks) {
            const videoAspect = window.innerWidth / window.innerHeight;
            const fov = this.camera.fov * (Math.PI / 180);
            const heightAtZero = 2 * Math.tan(fov / 2) * 5;
            const widthAtZero = heightAtZero * this.camera.aspect;

            let objIndex = 0;
            for (const landmarks of results.multiHandLandmarks) {
                for (const landmark of landmarks) {
                    if (objIndex >= this.handObjects.length) break;

                    const mesh = this.handObjects[objIndex];
                    // Invert X to match mirrored video
                    const x = -(landmark.x - 0.5) * widthAtZero;
                    const y = -(landmark.y - 0.5) * heightAtZero;
                    // Simple Z approximation
                    const z = -landmark.z * widthAtZero;

                    mesh.position.set(x, y, z);
                    mesh.visible = true;
                    objIndex++;
                }
            }
        }
    }
}
