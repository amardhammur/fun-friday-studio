# Third-party notices

The application source and cartoon demo artwork were created for this project. Runtime dependencies are installed through npm; exact versions are recorded in `package-lock.json`.

## Locally bundled fonts

- **Bricolage Grotesque** — SIL Open Font License 1.1; `public/licenses/Bricolage-Grotesque-OFL.txt`.
- **Atkinson Hyperlegible** — SIL Open Font License 1.1; `public/licenses/Atkinson-Hyperlegible-OFL.txt`.
- **Caveat** — SIL Open Font License 1.1; `public/licenses/Caveat-OFL.txt`.

Font binaries are supplied by the corresponding `@fontsource` npm packages and emitted into the production assets. Original copyright notices are retained in the license files.

## Face detection

**MediaPipe Tasks Vision**, Copyright The MediaPipe Authors, Apache License 2.0. The JavaScript runtime comes from `@mediapipe/tasks-vision`; its WASM and loader assets are copied to `public/mediapipe/` without source changes. License: `public/licenses/MediaPipe-Apache-2.0.txt`.

The **BlazeFace short-range float16 model, version 1** is downloaded from Google's official MediaPipe model distribution:

https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite

Model documentation: https://ai.google.dev/edge/mediapipe/solutions/vision/face_detector

The app runs inference entirely on the host laptop. Its worker restricts fetches to same-origin GET requests; no images or dependency telemetry can be posted externally through that worker.

## Other runtime dependencies

React and React DOM, Zod, idb, and fflate are MIT-licensed. Lucide icons use the ISC license. Their original license notices remain in the installed packages. Bundled development tooling is not required by the deployed static app.
