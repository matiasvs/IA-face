import { Hands } from '@mediapipe/hands';

export class HandTracker {
    constructor() {
        this.hands = null;
        this.onResultsCallback = null;
    }

    init(onResultsCallback) {
        this.onResultsCallback = onResultsCallback;

        this.hands = new Hands({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
            }
        });

        this.hands.setOptions({
            maxNumHands: 2,
            modelComplexity: 1,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });

        this.hands.onResults((results) => {
            if (this.onResultsCallback) {
                this.onResultsCallback(results);
            }
        });
    }

    async send(image) {
        if (this.hands) {
            await this.hands.send({ image: image });
        }
    }
}
