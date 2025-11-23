import * as THREE from 'three';

export class ParticleRain {
    constructor(scene, particleCount = 200) {
        this.scene = scene;
        this.particleCount = particleCount;
        this.particles = null;
        this.velocities = [];
        this.textureLoader = new THREE.TextureLoader();

        // Configuration
        this.config = {
            particleSize: 0.3,  // Size of the sprite
            fallSpeed: 0.02,
            spawnAreaWidth: 10,
            spawnAreaHeight: 8,
            // Adjusted depth to match hand tracking range (around z=0)
            // Face occluder is at z≈0.5, so particles should be at z≈-0.5 to -2
            spawnDepth: -1.0,  // Behind the face but not too far
            depthRange: 1.0,   // Range of depth variation
            resetHeight: 5     // Top of spawn area
        };

        this.init();
    }

    init() {
        // Load particle texture
        const texture = this.textureLoader.load('/src/particleImage/particle-a.png');

        // Create plane geometry for sprite particles
        const geometry = new THREE.PlaneGeometry(
            this.config.particleSize,
            this.config.particleSize
        );

        // Material with texture and transparency
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            alphaTest: 0.1,    // Discard fully transparent pixels
            depthTest: true,   // Enable depth testing
            depthWrite: true,  // Write to depth buffer
            side: THREE.DoubleSide  // Render both sides
        });

        // Use InstancedMesh for better performance
        this.particles = new THREE.InstancedMesh(
            geometry,
            material,
            this.particleCount
        );

        // Initialize particle positions and velocities
        const dummy = new THREE.Object3D();

        for (let i = 0; i < this.particleCount; i++) {
            // Random position in spawn area
            const x = (Math.random() - 0.5) * this.config.spawnAreaWidth;
            const y = Math.random() * this.config.spawnAreaHeight - this.config.spawnAreaHeight / 2;
            // Depth range: spawnDepth ± depthRange/2
            const z = this.config.spawnDepth + (Math.random() - 0.5) * this.config.depthRange;

            dummy.position.set(x, y, z);

            // Random rotation on Z axis only (spinning effect)
            dummy.rotation.set(
                0,
                0,
                Math.random() * Math.PI * 2
            );

            dummy.updateMatrix();
            this.particles.setMatrixAt(i, dummy.matrix);

            // Random fall speed variation
            this.velocities.push({
                y: -(this.config.fallSpeed + Math.random() * 0.01),
                rotationZ: (Math.random() - 0.5) * 0.05  // Spinning speed
            });
        }

        this.particles.instanceMatrix.needsUpdate = true;

        // Render after face occluder (which has renderOrder = 0)
        // This ensures the occluder writes to depth buffer first
        this.particles.renderOrder = 1;

        this.scene.add(this.particles);
    }

    update() {
        const dummy = new THREE.Object3D();

        for (let i = 0; i < this.particleCount; i++) {
            // Get current matrix
            this.particles.getMatrixAt(i, dummy.matrix);
            dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);

            // Update position (fall down)
            dummy.position.y += this.velocities[i].y;

            // Update rotation for visual effect (spinning)
            dummy.rotation.z += this.velocities[i].rotationZ;

            // Reset particle if it falls below the screen
            if (dummy.position.y < -this.config.spawnAreaHeight / 2 - 1) {
                dummy.position.y = this.config.resetHeight;
                dummy.position.x = (Math.random() - 0.5) * this.config.spawnAreaWidth;
                // Reset with new random depth
                dummy.position.z = this.config.spawnDepth + (Math.random() - 0.5) * this.config.depthRange;
            }

            // Update matrix
            dummy.updateMatrix();
            this.particles.setMatrixAt(i, dummy.matrix);
        }

        this.particles.instanceMatrix.needsUpdate = true;
    }

    dispose() {
        if (this.particles) {
            this.scene.remove(this.particles);
            this.particles.geometry.dispose();
            this.particles.material.dispose();
        }
    }
}
