import * as THREE from 'three';

export class ParticleRain {
    constructor(scene, particleCount = 200) {
        this.scene = scene;
        this.particleCount = particleCount;
        this.particles = null;
        this.velocities = [];

        // Configuration
        this.config = {
            cubeSize: 0.08,
            fallSpeed: 0.02,
            spawnAreaWidth: 10,
            spawnAreaHeight: 8,
            spawnDepth: -3,  // Behind the face
            minDepth: -5,    // Furthest back
            resetHeight: 5   // Top of spawn area
        };

        this.init();
    }

    init() {
        // Create cube geometry for particles
        const geometry = new THREE.BoxGeometry(
            this.config.cubeSize,
            this.config.cubeSize,
            this.config.cubeSize
        );

        // Blue material for particles
        const material = new THREE.MeshStandardMaterial({
            color: 0x0066ff,
            metalness: 0.3,
            roughness: 0.4
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
            const z = this.config.spawnDepth + (Math.random() - 0.5) * 2;

            dummy.position.set(x, y, z);

            // Random rotation
            dummy.rotation.set(
                Math.random() * Math.PI,
                Math.random() * Math.PI,
                Math.random() * Math.PI
            );

            dummy.updateMatrix();
            this.particles.setMatrixAt(i, dummy.matrix);

            // Random fall speed variation
            this.velocities.push({
                y: -(this.config.fallSpeed + Math.random() * 0.01),
                rotationX: (Math.random() - 0.5) * 0.02,
                rotationY: (Math.random() - 0.5) * 0.02,
                rotationZ: (Math.random() - 0.5) * 0.02
            });
        }

        this.particles.instanceMatrix.needsUpdate = true;

        // Set render order to render particles first (before face occluder)
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

            // Update rotation for visual effect
            dummy.rotation.x += this.velocities[i].rotationX;
            dummy.rotation.y += this.velocities[i].rotationY;
            dummy.rotation.z += this.velocities[i].rotationZ;

            // Reset particle if it falls below the screen
            if (dummy.position.y < -this.config.spawnAreaHeight / 2 - 1) {
                dummy.position.y = this.config.resetHeight;
                dummy.position.x = (Math.random() - 0.5) * this.config.spawnAreaWidth;
                dummy.position.z = this.config.spawnDepth + (Math.random() - 0.5) * 2;
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
