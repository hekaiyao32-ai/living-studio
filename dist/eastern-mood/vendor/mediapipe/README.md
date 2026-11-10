MediaPipe Tasks Vision 0.10.21 (Apache-2.0)
https://www.npmjs.com/package/@mediapipe/tasks-vision/v/0.10.21

vision_bundle.mjs and wasm/* copied from the pinned official npm release:
https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/

Google MediaPipe Gesture Recognizer, float16, version 1:
https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task
https://ai.google.dev/edge/mediapipe/solutions/vision/gesture_recognizer

All inference assets are hosted with the artwork. No personal model URL or
training is required. Camera frames are processed locally in the browser.
Manual testing does not load the recognition runtime or request a camera.

Custom-model mode reuses landmark results from this same gesture-recognizer
asset and ignores its gesture classifications. Gesture actions use only the
visitor's trained Teachable Machine model. No duplicate hand model is required.
