import { frameToCanvas, waitForSeek } from './video.js';

function clamp(value, low, high) { return Math.max(low, Math.min(value, high)); }

export async function trackTemplate({ video, frameCanvas, roi, onSample, onProgress, cancelled }) {
  const { cv } = window;
  if (!cv?.Mat) throw new Error('OpenCV.js is still loading. Please try again shortly.');
  const duration = video.duration;
  if (!(duration > 0)) throw new Error('The video duration is unavailable.');
  video.pause();
  video.currentTime = 0;
  await waitForSeek(video);
  frameToCanvas(video, frameCanvas);
  const initial = cv.imread(frameCanvas);
  const initialX = clamp(Math.round(roi.x), 0, initial.cols - 1);
  const initialY = clamp(Math.round(roi.y), 0, initial.rows - 1);
  const initialWidth = clamp(Math.round(roi.width), 1, initial.cols - initialX);
  const initialHeight = clamp(Math.round(roi.height), 1, initial.rows - initialY);
  const initialRect = new cv.Rect(initialX, initialY, initialWidth, initialHeight);
  const template = initial.roi(initialRect).clone();
  initial.delete();
  let center = { x: roi.x + roi.width / 2, y: roi.y + roi.height / 2 };
  // These are evenly spaced analysis targets, not an assumed source FPS.
  const sampleCount = 240;
  try {
    for (let i = 0; i <= sampleCount; i += 1) {
      if (cancelled()) break;
      const targetTime = duration * i / sampleCount;
      if (Math.abs(video.currentTime - targetTime) > .0001) { video.currentTime = targetTime; await waitForSeek(video); }
      frameToCanvas(video, frameCanvas);
      const frame = cv.imread(frameCanvas);
      const margin = Math.max(60, Math.max(roi.width, roi.height) * 2);
      const sx = clamp(Math.round(center.x - roi.width / 2 - margin), 0, Math.max(0, frame.cols - template.cols));
      const sy = clamp(Math.round(center.y - roi.height / 2 - margin), 0, Math.max(0, frame.rows - template.rows));
      const sw = Math.min(frame.cols - sx, Math.round(template.cols + margin * 2));
      const sh = Math.min(frame.rows - sy, Math.round(template.rows + margin * 2));
      const search = frame.roi(new cv.Rect(sx, sy, sw, sh));
      const result = new cv.Mat();
      cv.matchTemplate(search, template, result, cv.TM_CCOEFF_NORMED);
      const match = cv.minMaxLoc(result);
      center = { x: sx + match.maxLoc.x + template.cols / 2, y: sy + match.maxLoc.y + template.rows / 2 };
      onSample({ t: video.currentTime, px: center.x, py: center.y, confidence: match.maxVal });
      result.delete(); search.delete(); frame.delete();
      onProgress(i / sampleCount);
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  } finally { template.delete(); }
}
