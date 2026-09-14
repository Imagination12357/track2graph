(() => {
function clamp(value, low, high) { return Math.max(low, Math.min(value, high)); }

async function getOpenCv() {
  const deadline = Date.now() + 15000;
  console.info('[T2G:OpenCV] wait start', { href: location.href, cvType: typeof window.cv, cvPresent: Boolean(window.cv) });
  while (!window.cv && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 50));
  if (!window.cv) {
    console.error('[T2G:OpenCV] global cv absent after timeout', { waitedMs: 15000, href: location.href });
    throw new Error('OpenCV.js could not load. Check your network connection and reload.');
  }
  const rawCv = window.cv;
  console.info('[T2G:OpenCV] global cv found', { cvType: typeof rawCv, thenable: Boolean(rawCv?.then), hasMat: Boolean(rawCv?.Mat) });
  if (rawCv.Mat) {
    console.info('[T2G:OpenCV] ready object accepted without awaiting thenable', { hasMat: true });
    return { cv: rawCv };
  }
  const cv = await rawCv;
  console.info('[T2G:OpenCV] cv promise/value resolved', { hasMat: Boolean(cv?.Mat), keys: cv ? Object.keys(cv).slice(0, 12) : [] });
  if (cv.Mat) return { cv };
  await new Promise((resolve, reject) => {
    const remainingMs = Math.max(1, deadline - Date.now());
    console.info('[T2G:OpenCV] waiting for onRuntimeInitialized', { remainingMs, existingCallback: typeof cv.onRuntimeInitialized });
    const timeout = setTimeout(() => {
      console.error('[T2G:OpenCV] runtime initialization timeout', { hasMat: Boolean(cv.Mat), keys: Object.keys(cv).slice(0, 12) });
      reject(new Error('OpenCV.js took too long to initialize. Reload and try again.'));
    }, remainingMs);
    const previous = cv.onRuntimeInitialized;
    cv.onRuntimeInitialized = () => { console.info('[T2G:OpenCV] onRuntimeInitialized fired', { hasMat: Boolean(cv.Mat) }); previous?.(); clearTimeout(timeout); resolve(); };
  });
  console.info('[T2G:OpenCV] ready after runtime callback', { hasMat: Boolean(cv.Mat) });
  return { cv };
}

async function trackTemplate({ video, frameCanvas, roi, startTime, endTime, onSample, onProgress, cancelled }) {
  console.info('[T2G:Tracker] start requested', { startTime, endTime, duration: video.duration, roi });
  const { cv } = await getOpenCv();
  console.info('[T2G:Tracker] OpenCV acquired', { hasMat: Boolean(cv.Mat), videoWidth: video.videoWidth, videoHeight: video.videoHeight });
  const { frameToCanvas, waitForSeek } = window.T2G;
  if (!(endTime > startTime && endTime <= video.duration)) throw new Error('Choose a valid analysis interval.');
  video.pause();
  if (Math.abs(video.currentTime - startTime) > .0001) { video.currentTime = startTime; await waitForSeek(video); }
  frameToCanvas(video, frameCanvas);
  const initial = cv.imread(frameCanvas);
  const initialX = clamp(Math.round(roi.x), 0, initial.cols - 1);
  const initialY = clamp(Math.round(roi.y), 0, initial.rows - 1);
  const initialWidth = clamp(Math.round(roi.width), 1, initial.cols - initialX);
  const initialHeight = clamp(Math.round(roi.height), 1, initial.rows - initialY);
  const initialRect = new cv.Rect(initialX, initialY, initialWidth, initialHeight);
  const template = initial.roi(initialRect).clone();
  const initialResult = new cv.Mat();
  cv.matchTemplate(initial, template, initialResult, cv.TM_CCOEFF_NORMED);
  const initialMatch = cv.minMaxLoc(initialResult);
  let center = { x: initialMatch.maxLoc.x + template.cols / 2, y: initialMatch.maxLoc.y + template.rows / 2 };
  initialResult.delete();
  initial.delete();
  let lastMediaTime = startTime;
  try {
    onSample({ t: 0, px: center.x, py: center.y, confidence: initialMatch.maxVal });
    onProgress(0);
    if (!video.requestVideoFrameCallback) throw new Error('This browser does not provide decoded video frame callbacks.');
    await new Promise((resolve, reject) => {
      const resumeVideo = () => {
        Promise.resolve(video.play()).catch((error) => {
          video.pause();
          reject(error);
        });
      };
      const processFrame = (_now, metadata) => {
        const mediaTime = metadata.mediaTime;
        video.pause();
        if (cancelled() || mediaTime > endTime) { video.pause(); resolve(); return; }
        if (mediaTime <= lastMediaTime) {
          video.requestVideoFrameCallback(processFrame);
          resumeVideo();
          return;
        }
        try {
          lastMediaTime = mediaTime;
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
          onSample({ t: mediaTime - startTime, px: center.x, py: center.y, confidence: match.maxVal });
          result.delete(); search.delete(); frame.delete();
          onProgress((mediaTime - startTime) / (endTime - startTime));
          video.requestVideoFrameCallback(processFrame);
          resumeVideo();
        } catch (error) { video.pause(); reject(error); }
      };
      video.requestVideoFrameCallback(processFrame);
      resumeVideo();
    });
  } finally { template.delete(); }
}

window.T2G = { ...(window.T2G ?? {}), trackTemplate };
})();
