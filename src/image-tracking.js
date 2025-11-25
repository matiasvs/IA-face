import { MindARThree } from 'mind-ar/dist/mindar-image-three.prod.js';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import targetsUrl from './particleImage/targets.mind?url';
import objectTestUrl from './models3d/objectTest.glb?url';

document.addEventListener('DOMContentLoaded', async () => {
    const container = document.querySelector('#container');

    console.log('Initializing MindAR with targets:', targetsUrl);

    const mindarThree = new MindARThree({
        container: container,
        imageTargetSrc: targetsUrl,
    });

    const { renderer, scene, camera } = mindarThree;

    // Add a light
    const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
    scene.add(light);

    // Create an anchor (index 0 because we have 1 image target)
    const anchor = mindarThree.addAnchor(0);

    // Smoothing configuration
    const smoothingFactor = 0.1; // Lower = smoother but slower response (0.1-0.3 recommended)
    let targetPosition = new THREE.Vector3();
    let targetQuaternion = new THREE.Quaternion();
    let smoothedPosition = new THREE.Vector3();
    let smoothedQuaternion = new THREE.Quaternion();

    // Load 3D model instead of cube
    const loader = new GLTFLoader();
    loader.load(
        objectTestUrl,
        (gltf) => {
            const model = gltf.scene;

            // Position model slightly above the image
            model.position.z = 0.5;
            model.scale.set(0.5, 0.5, 0.5); // Same scale as face tracking

            anchor.group.add(model);
            console.log('✅ objectTest.glb loaded successfully in image tracking');

            // Initialize smoothed values
            smoothedPosition.copy(anchor.group.position);
            smoothedQuaternion.copy(anchor.group.quaternion);

            // Start the AR engine
            mindarThree.start().then(() => {
                // Animation loop
                renderer.setAnimationLoop(() => {
                    // Apply smoothing to anchor position and rotation
                    if (anchor.group.visible) {
                        // Get target values from MindAR
                        targetPosition.copy(anchor.group.position);
                        targetQuaternion.copy(anchor.group.quaternion);

                        // Smoothly interpolate position (lerp)
                        smoothedPosition.lerp(targetPosition, smoothingFactor);

                        // Smoothly interpolate rotation (slerp)
                        smoothedQuaternion.slerp(targetQuaternion, smoothingFactor);

                        // Apply smoothed values
                        anchor.group.position.copy(smoothedPosition);
                        anchor.group.quaternion.copy(smoothedQuaternion);
                    }

                    renderer.render(scene, camera);
                });
            }).catch((error) => {
                console.error('Failed to start MindAR:', error);
            });
        },
        (progress) => {
            console.log(`Loading model: ${(progress.loaded / progress.total * 100).toFixed(2)}%`);
        },
        (error) => {
            console.error('❌ Error loading objectTest.glb:', error);
            // Fallback to cube if model fails to load
            const geometry = new THREE.BoxGeometry(1, 1, 1);
            const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
            const cube = new THREE.Mesh(geometry, material);
            cube.position.z = 0.5;
            anchor.group.add(cube);

            // Start the AR engine with fallback cube
            mindarThree.start().then(() => {
                renderer.setAnimationLoop(() => {
                    renderer.render(scene, camera);
                });
            }).catch((error) => {
                console.error('Failed to start MindAR:', error);
            });
        }
    );
});
