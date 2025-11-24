import { MindARThree } from 'mind-ar/dist/mindar-image-three.prod.js';
import * as THREE from 'three';
import targetsUrl from './particleImage/targets.mind?url';

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

    // Add a 3D object to the anchor
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
    const cube = new THREE.Mesh(geometry, material);

    // Position cube slightly above the image
    cube.position.z = 0.5;

    anchor.group.add(cube);

    // Start the AR engine
    try {
        await mindarThree.start();

        // Animation loop
        renderer.setAnimationLoop(() => {
            // Rotate cube for visual effect
            cube.rotation.x += 0.01;
            cube.rotation.y += 0.01;

            renderer.render(scene, camera);
        });
    } catch (error) {
        console.error('Failed to start MindAR:', error);
    }
});
