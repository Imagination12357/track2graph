# T2G Agent Guide

## Product boundary

T2G is a static, client-side tool for analysing one tracked object in a
fixed-camera 2D physics video. Keep its flow explicit:

`Video → Scale → Track → Graph`.

Do not add a backend, uploads, AI object detection, regression/smoothing,
multi-object tracking, or perspective calibration unless the user asks.

## Implementation conventions

- Use browser-native ES modules and static assets that work on GitHub Pages.
- Keep all internal physics values in SI units.
- Use a single stage value to gate features, and invalidate downstream data
  whenever video, scale, ROI, or tracking changes.
- Treat video pixels as the canonical interaction/tracking coordinate space;
  convert pointer coordinates from rendered CSS size before use.
- Prefer timestamp-derived sampling intervals over assumed FPS.
- Keep modules focused: state, video, scale, tracking, physics, charts, UI,
  and application wiring.

## Verification

- Preserve the existing working tree; make only task-related changes.
- Test pure physics calculations independently when changing them.
- Validate the static page with a browser after meaningful UI changes.
- Do not change or contact Git remotes.
