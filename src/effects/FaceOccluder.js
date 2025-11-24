import * as THREE from 'three';

export class FaceOccluder {
    constructor(scene) {
        this.scene = scene;
        this.occluderMesh = null;
        this.faceGeometry = null;

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
    }

    updateFace(landmarks, camera) {
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

        // Nose bridge
        const noseIndices = [6, 197, 195, 5, 4];

        // Chin indices for extension (strictly lower face)
        const chinIndices = [
            152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, // Left side from chin
            377, 400, 378, 379, 365, 397, 288, 361, 323, 454     // Right side from chin
        ];

        // Combine all important face regions
        const importantIndices = [
            ...faceOvalIndices,
            ...foreheadIndices,
            ...noseIndices,
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
                const x = -(landmark.x - 0.5) * widthAtZero * scale;
                let y = -(landmark.y - 0.5) * heightAtZero * scale;

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



        // Create triangles using Delaunay-like approach
        // For simplicity, we'll create a convex hull-like mesh
        // Using a simple fan triangulation from center point

        // Calculate center point
        let centerX = 0, centerY = 0, centerZ = 0;
        for (let i = 0; i < vertices.length; i += 3) {
            centerX += vertices[i];
            centerY += vertices[i + 1];
            centerZ += vertices[i + 2];
        }
        const count = vertices.length / 3;
        centerX /= count;
        centerY /= count;
        centerZ /= count;

        // Add center vertex
        vertices.push(centerX, centerY, centerZ);
        const centerIndex = count;

        // Create triangles from center to each edge
        for (let i = 0; i < count; i++) {
            const next = (i + 1) % count;
            indices.push(centerIndex, i, next);
        }

        // Update geometry
        this.faceGeometry.setAttribute(
            'position',
            new THREE.Float32BufferAttribute(vertices, 3)
        );

        this.faceGeometry.setIndex(indices);
        this.faceGeometry.computeVertexNormals();
        this.faceGeometry.attributes.position.needsUpdate = true;
    }

    dispose() {
        if (this.occluderMesh) {
            this.scene.remove(this.occluderMesh);
            this.faceGeometry.dispose();
            this.occluderMesh.material.dispose();
        }
    }
}
