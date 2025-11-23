# Walkthrough - Three.js Face Tracking

This project implements a real-time face tracking application using **Three.js** for rendering and **MediaPipe Face Mesh** for face detection.

## Project Structure

- **`src/main.js`**: Entry point. Initializes the `SceneManager` and `FaceTracker`.
- **`src/core/SceneManager.js`**: Handles the Three.js scene, camera, renderer, and the 3D object that tracks the face.
- **`src/core/FaceTracker.js`**: Handles the camera input and MediaPipe Face Mesh detection.
- **`index.html`**: Contains the video (hidden/background) and canvas (overlay) elements.
- **`style.css`**: Handles the layout to ensure the canvas overlays the video correctly.

## How to Run

1.  **Install Dependencies** (if not already done):
    ```bash
    npm install
    ```
2.  **Start Development Server**:
    ```bash
    npm run dev
    ```
3.  **Open Browser**:
    Navigate to the URL shown in the terminal (usually `http://localhost:5173`).
4.  **Allow Camera**:
    Allow the browser to access your camera.

## Features

- **Face Detection**: Uses MediaPipe to detect face landmarks.
- **Position Tracking**: Maps the nose tip position to the 3D object's position.
- **Rotation Tracking**: Calculates face orientation (yaw, pitch, roll) using eye and chin landmarks and applies it to the 3D object.
- **Visual Effect**: Currently displays a red sphere on the nose. You can replace this with any 3D model in `SceneManager.js`.

## Customization

To change the visual effect, modify `src/core/SceneManager.js`:

```javascript
// In init() method:
const geometry = new THREE.BoxGeometry(1, 1, 1); // Change geometry
const material = new THREE.MeshNormalMaterial(); // Change material
this.faceObject = new THREE.Mesh(geometry, material);
```

To use a 3D model (GLTF), use `GLTFLoader`:

```javascript
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ...
const loader = new GLTFLoader();
loader.load('path/to/model.glb', (gltf) => {
    this.faceObject = gltf.scene;
    this.scene.add(this.faceObject);
});
```
