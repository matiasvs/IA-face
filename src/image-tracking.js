import { MindARThree } from 'mind-ar/dist/mindar-image-three.prod.js';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import targetsUrl from './particleImage/targets2.mind?url';
import objectTestUrl from './models3d/objectTest.glb?url';

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

        // Smoothing configuration
        this.smoothingFactor = 0.1;
        this.targetPosition = new THREE.Vector3();
        this.targetQuaternion = new THREE.Quaternion();
        this.smoothedPosition = new THREE.Vector3();
        this.smoothedQuaternion = new THREE.Quaternion();
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

                // Apply smoothing
                if (this.anchor.group.visible) {
                    this.targetPosition.copy(this.anchor.group.position);
                    this.targetQuaternion.copy(this.anchor.group.quaternion);

                    this.smoothedPosition.lerp(this.targetPosition, this.smoothingFactor);
                    this.smoothedQuaternion.slerp(this.targetQuaternion, this.smoothingFactor);

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
}
