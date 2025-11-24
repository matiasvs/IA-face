import * as THREE from 'three';

export class FaceOccluder {
    constructor(scene) {
        this.scene = scene;
        this.occluderMesh = null;
        this.faceGeometry = null;
        this.bodyOccluderMesh = null; // Rectangular mesh for body area

        this.init();
    }

    init() {
        // Create initial geometry (will be updated with face landmarks)
        this.faceGeometry = new THREE.BufferGeometry();

        // Material that writes to depth buffer but doesn't render color
        // This creates an invisible mesh that blocks objects behind it
        const material = new THREE.MeshBasicMaterial({
            color: 0xff0000,       // Red for debugging
            colorWrite: true,      // Write to color buffer (visible)
            transparent: true,     // Enable transparency
            opacity: 0.5,          // Semi-transparent
            depthWrite: true,      // Write to depth buffer (blocks objects)
            depthTest: true,       // Test depth
            depthFunc: THREE.LessEqualDepth,  // Standard depth function
            side: THREE.DoubleSide // Render both sides for better coverage
        });

        this.occluderMesh = new THREE.Mesh(this.faceGeometry, material);

        // Don't use renderOrder, let depth testing handle it naturally
        this.occluderMesh.renderOrder = 0;

        this.scene.add(this.occluderMesh);

        // Create body occluder (rectangular plane for neck, shoulders, chest)
        const bodyGeometry = new THREE.PlaneGeometry(10, 10); // Large plane
        this.bodyOccluderMesh = new THREE.Mesh(bodyGeometry, material);
        this.bodyOccluderMesh.renderOrder = 0;
        // Position will be updated in updateFace based on chin position
        this.scene.add(this.bodyOccluderMesh);
    }

    updateFace(landmarks, camera, xOffset = -0.1) {
        if (!landmarks || landmarks.length === 0) return;

        // Calculate world space dimensions
        const fov = camera.fov * (Math.PI / 180);
        const cameraDistance = 5;
        const heightAtZero = 2 * Math.tan(fov / 2) * cameraDistance;
        const widthAtZero = heightAtZero * camera.aspect;

        // Create face mesh from MediaPipe landmarks
        // We'll use key landmarks to create a simplified face mesh
        const vertices = [];
        const indices = [];

        // MediaPipe Face Mesh has 468 landmarks
        // We'll create a mesh using a subset for performance
        // Face oval indices (jawline and face contour)
        const faceOvalIndices = [
            10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
            397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
            172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109
        ];

        // Forehead area (to cover more of the face)
        const foreheadIndices = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288];

        // Nose bridge - COMMENTED OUT for performance optimization
        // The nose area is already covered by faceOvalIndices
        // const noseIndices = [6, 197, 195, 5, 4];

        // Chin indices for extension (strictly lower face)
        // CONFIGURATION: These indices work well for coverage from chin to forehead
        // Chin offset: -0.5 (see line ~105)
        // Scale: 1.1 (see line ~98)
        const chinIndices = [
            152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, // Left side from chin
            377, 400, 378, 379, 365, 397, 288, 361, 323, 454     // Right side from chin
        ];

        // Combine all important face regions
        const importantIndices = [
            ...faceOvalIndices,
            ...foreheadIndices,
            // ...noseIndices,  // Commented out for performance
            // Eye regions
            // 33, 133, 160, 159, 158, 157, 173, 246, 161, 160, 159, 158,
            // 362, 263, 387, 386, 385, 384, 398, 466, 388, 387, 386, 385,
            // Mouth region
            // 61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291,
            // Cheeks
            234, 93, 132, 58, 172, 136, 150, 149, 176, 148, 152,
            454, 323, 361, 288, 397, 365, 379, 378, 400, 377
        ];

        // Remove duplicates
        const uniqueIndices = [...new Set(importantIndices)];

        // Convert landmarks to vertices
        const landmarkToVertex = new Map();
        uniqueIndices.forEach((idx, i) => {
            if (idx < landmarks.length) {
                const landmark = landmarks[idx];
                // Apply uniform scale to expand the mask slightly
                const scale = 1.1;
                let x = -(landmark.x - 0.5) * widthAtZero * scale;
                let y = -(landmark.y - 0.5) * heightAtZero * scale;

                // Horizontal offset to shift mask to the left/right
                // CONFIGURATION: This value is now controlled by calibration slider
                x += xOffset;

                // Manual extensions removed to reset shape
                // if (foreheadTopIndices.includes(idx)) { ... }

                if (chinIndices.includes(idx)) {
                    // Extend downwards to cover chin/neck
                    // Reduced from 1.5 to 0.5 to prevent "too low" look
                    y -= 0.5;
                }

                // Position face mesh at a constant Z depth closer to camera
                // Particles are at z = -2.5
                // We set occluder at z = 0.0 to be safe from near clipping
                const z = 0.0;

                vertices.push(x, y, z);
                landmarkToVertex.set(idx, i);
            }
        });

        // Create triangles by connecting consecutive vertices
        // This creates a simple polygon without a center point to avoid stretching
        const count = vertices.length / 3;

        // Create a simple convex hull by connecting vertices in order
        for (let i = 1; i < count - 1; i++) {
            indices.push(0, i, i + 1);
        }

        // Update geometry
        this.faceGeometry.setAttribute(
            'position',
            new THREE.Float32BufferAttribute(vertices, 3)
        );

        this.faceGeometry.setIndex(indices);
        this.faceGeometry.computeVertexNormals();
        this.faceGeometry.attributes.position.needsUpdate = true;

        // Update body occluder position based on chin landmark
        // Find the chin point (landmark 152 is the bottom of the chin)
        if (landmarks.length > 152) {
            const chinLandmark = landmarks[152];
            const chinX = -(chinLandmark.x - 0.5) * widthAtZero * 1.1 + 0.1; // Same transforms as face
            const chinY = -(chinLandmark.y - 0.5) * heightAtZero * 1.1;

            // Position the body occluder below the chin
            // CONFIGURATION: Adjust these values to control body occluder coverage
            const bodyOffsetY = -5.5; // How far below chin (negative = down)
            const bodyZ = 0.0; // Same Z as face occluder

            this.bodyOccluderMesh.position.set(chinX, chinY + bodyOffsetY, bodyZ);
        }
    }

    dispose() {
        if (this.occluderMesh) {
            this.scene.remove(this.occluderMesh);
            this.faceGeometry.dispose();
            this.occluderMesh.material.dispose();
        }
        if (this.bodyOccluderMesh) {
            this.scene.remove(this.bodyOccluderMesh);
            this.bodyOccluderMesh.geometry.dispose();
        }
    }
}
