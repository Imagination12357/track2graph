export function waitForSeek(video) { return new Promise((resolve) => video.addEventListener('seeked', resolve, { once: true })); }
export function canvasPoint(event, canvas) { const r = canvas.getBoundingClientRect(); return { x: (event.clientX - r.left) * canvas.width / r.width, y: (event.clientY - r.top) * canvas.height / r.height }; }
export function frameToCanvas(video, canvas) { const ctx = canvas.getContext('2d', { willReadFrequently: true }); ctx.drawImage(video, 0, 0, canvas.width, canvas.height); }
