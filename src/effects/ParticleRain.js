import * as THREE from 'three';
import particleImageUrl from '../particleImage/particle-a.png';

export class ParticleRain {
    constructor(scene, particleCount = 30) {
        this.scene = scene;
        this.particleCount = particleCount;
        this.particles = null;
        this.velocities = [];
        this.textureLoader = new THREE.TextureLoader();

        // Configuration
        this.config = {
            particleSize: 0.70,  // Size of the sprite (1.6x larger)
            fallSpeed: 0.034,  // 1.7x faster fall speed
            spawnAreaWidth: 4,   // Reduced from 10 to 4 to center the rain
            spawnAreaHeight: 8,
            // Adjusted depth to match hand tracking range (around z=0)
            // Face occluder is at z≈0.0, so particles should be strictly behind
            spawnDepth: -5.0,  // Pushed back even further to -5.0
            depthRange: 1.0,   // Range of depth variation
            resetHeight: 5     // Top of spawn area
        };

        this.init();
    }

    init() {
        // Load particle texture using imported URL (Vite asset handling)
        const texture = this.textureLoader.load(
            particleImageUrl,
            // onLoad callback
            (loadedTexture) => {
                console.log('✅ Particle texture loaded successfully');
                console.log('Texture size:', loadedTexture.image.width, 'x', loadedTexture.image.height);
            },
            // onProgress callback
            undefined,
            // onError callback
            (error) => {
                console.error('❌ Error loading particle texture:', error);
            }
        );

        // Create plane geometry for sprite particles
        const geometry = new THREE.PlaneGeometry(
            this.config.particleSize,
            this.config.particleSize
        );

        // Material with texture
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            color: 0xffffff,   // White to show texture as-is
            transparent: true,
            opacity: 1.0,
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

            // No rotation - particles fall straight

            dummy.updateMatrix();
            this.particles.setMatrixAt(i, dummy.matrix);

            // Random fall speed variation
            this.velocities.push({
                y: -(this.config.fallSpeed + Math.random() * 0.01)
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
