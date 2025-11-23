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
  const calibrationPanel = document.getElementById('calibration-controls');
  const toggleButton = document.getElementById('toggle-calibration');
  const offsetYSlider = document.getElementById('offset-y');
  const offsetYValue = document.getElementById('offset-y-value');
  const scaleSlider = document.getElementById('scale');
  const scaleValue = document.getElementById('scale-value');
  const depthSlider = document.getElementById('depth');
  const depthValue = document.getElementById('depth-value');
  const resetButton = document.getElementById('reset-calibration');

  // Toggle panel visibility
  toggleButton.addEventListener('click', () => {
    calibrationPanel.classList.toggle('collapsed');
  });

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

  // Initialize with default values
  updateCalibration();

  offsetYSlider.addEventListener('input', updateCalibration);
  scaleSlider.addEventListener('input', updateCalibration);
  depthSlider.addEventListener('input', updateCalibration);

  // Reset calibration
  resetButton.addEventListener('click', () => {
    offsetYSlider.value = -0.6;
    scaleSlider.value = 1.0;
    depthSlider.value = 0.5;
    updateCalibration();
  });

  // Setup movement controls
  const movementPanel = document.getElementById('movement-controls');
  const toggleMovement = document.getElementById('toggle-movement');
  const btnUp = document.getElementById('btn-up');
  const btnDown = document.getElementById('btn-down');
  const btnLeft = document.getElementById('btn-left');
  const btnRight = document.getElementById('btn-right');

  // Toggle movement panel visibility
  toggleMovement.addEventListener('click', () => {
    movementPanel.classList.toggle('collapsed');
  });

  // Movement button event listeners
  btnUp.addEventListener('click', () => {
    sceneManager.moveCubeUp();
  });

  btnDown.addEventListener('click', () => {
    sceneManager.moveCubeDown();
  });

  btnLeft.addEventListener('click', () => {
    sceneManager.moveCubeLeft();
  });

  btnRight.addEventListener('click', () => {
    sceneManager.moveCubeRight();
  });
});
