import { FaceMesh } from '@mediapipe/face_mesh';


export class FaceTracker {
    constructor(videoElement) {
        this.videoElement = videoElement;
        this.faceMesh = null;

        this.onResultsCallback = null;
    }

    init(onResultsCallback) {
        console.log('FaceTracker: Initializing...');
        this.onResultsCallback = onResultsCallback;

        this.faceMesh = new FaceMesh({
            locateFile: (file) => {
                console.log(`FaceTracker: Loading file ${file}`);
                return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
            }
        });

        this.faceMesh.setOptions({
            maxNumFaces: 1,
            refineLandmarks: true,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });

        this.faceMesh.onResults((results) => {
            // console.log('FaceTracker: Got results'); // Uncomment if needed, but might be spammy
            if (this.onResultsCallback) {
                this.onResultsCallback(results);
            }
        });
        console.log('FaceTracker: Initialized');
    }

    async send(image) {
        if (this.faceMesh) {
            try {
                await this.faceMesh.send({ image: image });
            } catch (error) {
                console.error('FaceTracker: Error sending image', error);
            }
        }
    }
}
