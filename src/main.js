import { SceneManager } from './core/SceneManager.js';
import { FaceTracker } from './core/FaceTracker.js';
import { HandTracker } from './core/HandTracker.js';
import { Camera } from '@mediapipe/camera_utils';

document.addEventListener('DOMContentLoaded', async () => {
  const videoElement = document.getElementById('input-video');
  const canvasElement = document.getElementById('output-canvas');

  const sceneManager = new SceneManager(canvasElement);
  const faceTracker = new FaceTracker(videoElement);
  const handTracker = new HandTracker();

  faceTracker.init((results) => {
    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
      const landmarks = results.multiFaceLandmarks[0];
      sceneManager.updateFace(landmarks);
    }
  });

  handTracker.init((results) => {
    sceneManager.updateHands(results);
  });

  const camera = new Camera(videoElement, {
    onFrame: async () => {
      await faceTracker.send(videoElement);
      await handTracker.send(videoElement);
    },
    width: 1280,
    height: 720
  });

  // Start the Three.js loop
  sceneManager.animate();

  // Start the camera
  camera.start();
});
