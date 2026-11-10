Teachable Machine Image 0.8.5 and TensorFlow.js 1.3.1

Official Image library and its pinned peer dependency, Apache-2.0:
https://www.npmjs.com/package/@teachablemachine/image/v/0.8.5
https://www.npmjs.com/package/@tensorflow/tfjs/v/1.3.1

Copied from the respective pinned npm releases on jsDelivr.
These libraries load only when the visitor starts custom-model recognition.
The visitor supplies an HTTPS TensorFlow.js image-model directory URL;
metadata labels are checked against the configured gesture classes.
Settings stay in localStorage; camera frames are processed in the browser.
The original MediaPipe mode remains separately available.
