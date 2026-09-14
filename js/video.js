function waitForSeek(video) { return new Promise((resolve) => video.addEventListener('seeked', resolve, { once: true })); }
function canvasPoint(event, canvas) { const r = canvas.getBoundingClientRect(); return { x: (event.clientX - r.left) * canvas.width / r.width, y: (event.clientY - r.top) * canvas.height / r.height }; }
function frameToCanvas(video, canvas) { const ctx = canvas.getContext('2d', { willReadFrequently: true }); ctx.drawImage(video, 0, 0, canvas.width, canvas.height); }

window.T2G = { ...(window.T2G ?? {}), waitForSeek, canvasPoint, frameToCanvas };
