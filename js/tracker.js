function clamp(value, low, high) { return Math.max(low, Math.min(value, high)); }

async function getOpenCv() {
  const deadline = Date.now() + 15000;
  while (!window.cv && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 50));
  if (!window.cv) throw new Error('OpenCV.js could not load. Check your network connection and reload.');
  const cv = await window.cv;
  if (cv.Mat) return cv;
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('OpenCV.js took too long to initialize. Reload and try again.')), Math.max(1, deadline - Date.now()));
    const previous = cv.onRuntimeInitialized;
    cv.onRuntimeInitialized = () => { previous?.(); clearTimeout(timeout); resolve(); };
  });
  return cv;
}

async function trackTemplate({ video, frameCanvas, roi, startTime, endTime, onSample, onProgress, cancelled }) {
  const cv = await getOpenCv();
  const { frameToCanvas, waitForSeek } = window.T2G;
  if (!(endTime > startTime && endTime <= video.duration)) throw new Error('Choose a valid analysis interval.');
  video.pause();
  video.currentTime = startTime;
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
      const targetTime = startTime + (endTime - startTime) * i / sampleCount;
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
      onSample({ t: video.currentTime - startTime, px: center.x, py: center.y, confidence: match.maxVal });
      result.delete(); search.delete(); frame.delete();
      onProgress(i / sampleCount);
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  } finally { template.delete(); }
}

window.T2G = { ...(window.T2G ?? {}), trackTemplate };
