import * as THREE from 'three';
import particleImageUrl from '../particleImage/particle-a.png';

export class ParticleRain {
    constructor(scene, particleCount = 20) {
        this.scene = scene;
        this.particleCount = particleCount;
        this.particles = null;
        this.velocities = [];
        this.textureLoader = new THREE.TextureLoader();

        // Configuration
        this.config = {
            particleSize: 0.8,  // Size of the sprite (reduced to 0.8)
            fallSpeed: 0.100,  // 1.7x faster fall speed
            spawnAreaWidth: 7,   // Increased from 4 to 7 to expand to sides
            spawnAreaHeight: 8,
            // Adjusted depth to match hand tracking range (around z=0)
            // Face occluder is at z≈0.0, so particles should be strictly behind
            spawnDepth: -5.0,  // Pushed back even further to -5.0
            depthRange: 1.0,   // Range of depth variation
            resetHeight: 5     // Top of spawn area
        };

        this.dummy = new THREE.Object3D();
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
        for (let i = 0; i < this.particleCount; i++) {
            // Random position in spawn area
            const x = (Math.random() - 0.5) * this.config.spawnAreaWidth;
            const y = Math.random() * this.config.spawnAreaHeight - this.config.spawnAreaHeight / 2;
            // Depth range: spawnDepth ± depthRange/2
            const z = this.config.spawnDepth + (Math.random() - 0.5) * this.config.depthRange;

            this.dummy.position.set(x, y, z);

            // No rotation - particles fall straight

            this.dummy.updateMatrix();
            this.particles.setMatrixAt(i, this.dummy.matrix);

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
        for (let i = 0; i < this.particleCount; i++) {
            // Get current matrix
            this.particles.getMatrixAt(i, this.dummy.matrix);
            this.dummy.matrix.decompose(this.dummy.position, this.dummy.quaternion, this.dummy.scale);

            // Update position (fall down)
            this.dummy.position.y += this.velocities[i].y;

            // Reset particle if it falls below the screen
            if (this.dummy.position.y < -this.config.spawnAreaHeight / 2 - 1) {
                this.dummy.position.y = this.config.resetHeight;
                this.dummy.position.x = (Math.random() - 0.5) * this.config.spawnAreaWidth;
                // Reset with new random depth
                this.dummy.position.z = this.config.spawnDepth + (Math.random() - 0.5) * this.config.depthRange;
            }

            // Update matrix
            this.dummy.updateMatrix();
            this.particles.setMatrixAt(i, this.dummy.matrix);
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
