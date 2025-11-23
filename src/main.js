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

  // Setup calibration controls
  const offsetYSlider = document.getElementById('offset-y');
  const offsetYValue = document.getElementById('offset-y-value');
  const scaleSlider = document.getElementById('scale');
  const scaleValue = document.getElementById('scale-value');
  const depthSlider = document.getElementById('depth');
  const depthValue = document.getElementById('depth-value');
  const resetButton = document.getElementById('reset-calibration');

  // Update calibration on slider change
  const updateCalibration = () => {
    const offsetY = parseFloat(offsetYSlider.value);
    const scale = parseFloat(scaleSlider.value);
    const depth = parseFloat(depthSlider.value);

    sceneManager.setHandCalibration(offsetY, scale, depth);

    offsetYValue.textContent = offsetY.toFixed(1);
    scaleValue.textContent = scale.toFixed(2);
    depthValue.textContent = depth.toFixed(1);
  };

  offsetYSlider.addEventListener('input', updateCalibration);
  scaleSlider.addEventListener('input', updateCalibration);
  depthSlider.addEventListener('input', updateCalibration);

  // Reset calibration
  resetButton.addEventListener('click', () => {
    offsetYSlider.value = 0;
    scaleSlider.value = 1.0;
    depthSlider.value = 0.5;
    updateCalibration();
  });
});
