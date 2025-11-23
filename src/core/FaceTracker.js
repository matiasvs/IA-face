import { FaceMesh } from '@mediapipe/face_mesh';


export class FaceTracker {
    constructor(videoElement) {
        this.videoElement = videoElement;
        this.faceMesh = null;

        this.onResultsCallback = null;
    }

    init(onResultsCallback) {
        this.onResultsCallback = onResultsCallback;

        this.faceMesh = new FaceMesh({
            locateFile: (file) => {
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
            if (this.onResultsCallback) {
                this.onResultsCallback(results);
            }
        });

    }

    async send(image) {
        if (this.faceMesh) {
            await this.faceMesh.send({ image: image });
        }
    }
}
