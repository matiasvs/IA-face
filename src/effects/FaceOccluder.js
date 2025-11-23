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
            color: 0x00ff00,       // Green for debugging
            colorWrite: true,      // Make it visible
            transparent: true,
            opacity: 0.5,
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

        // Combine all important face regions
        const importantIndices = [
            ...faceOvalIndices,
            ...foreheadIndices,
            ...noseIndices,
            // Eye regions
            33, 133, 160, 159, 158, 157, 173, 246, 161, 160, 159, 158,
            362, 263, 387, 386, 385, 384, 398, 466, 388, 387, 386, 385,
            // Mouth region
            61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291,
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
                const x = -(landmark.x - 0.5) * widthAtZero;
                let y = -(landmark.y - 0.5) * heightAtZero;

                // Extend forehead upwards to cover hair
                // Forehead indices: 10 (top center), and surrounding upper arc
                const foreheadTopIndices = [10, 338, 297, 332, 284, 251, 389, 356, 454];

                if (foreheadTopIndices.includes(idx)) {
                    // Extend upwards more (increased from 0.8 to 1.2)
                    y += 1.2;
                }

                // Extend chin downwards to cover neck and shoulders
                // Chin/Jawline indices
                const chinIndices = [
                    152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
                    365, 379, 378, 400, 377, 454, 323, 361, 288, 397
                ];

                if (chinIndices.includes(idx)) {
                    // Extend downwards significantly to cover neck and body
                    y -= 6.0; // Large value to go off-screen

                    // Widen the "shoulders"
                    // If it's a side point (near ears), push it out
                    // 234 is right ear area, 454 is left ear area
                    const rightSideIndices = [234, 127, 162, 21, 54, 103, 67, 109];
                    const leftSideIndices = [454, 323, 361, 288, 397, 365, 379, 378, 400, 377];

                    if (rightSideIndices.includes(idx)) {
                        x += 1.5; // Push right shoulder out
                    } else if (leftSideIndices.includes(idx)) {
                        x -= 1.5; // Push left shoulder out
                    }
                }

                // Position face mesh at a constant Z depth closer to camera
                // Particles are at z = -2.5
                // We set occluder at z = 0.0 to be safe from near clipping
                const z = 0.0;

                vertices.push(x, y, z);
                landmarkToVertex.set(idx, i);
            }
        });

        // Debug log (once per 100 frames to avoid spam)
        if (Math.random() < 0.01) {
            console.log(`FaceOccluder: Generated ${vertices.length / 3} vertices`);
        }

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
