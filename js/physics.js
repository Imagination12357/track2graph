(() => {
function rescalePositions(samples, scale) {
  if (!samples.length) return [];
  const origin = samples[0];
  return samples.map((sample) => ({ ...sample, x: (sample.px - origin.px) * scale, y: -(sample.py - origin.py) * scale }));
}

function deriveMotion(positions) {
  const velocity = [];
  const acceleration = [];
  for (let i = 1; i < positions.length - 1; i += 1) {
    const previous = positions[i - 1], current = positions[i], next = positions[i + 1];
    const beforeDt = current.t - previous.t, afterDt = next.t - current.t, totalDt = next.t - previous.t;
    if (!(beforeDt > 0 && afterDt > 0 && totalDt > 0)) continue;
    const vx = (next.x - previous.x) / totalDt, vy = (next.y - previous.y) / totalDt;
    velocity.push({ t: current.t, vx, vy, magnitude: Math.hypot(vx, vy), xMid: current.x, yMid: current.y });
  }
  for (let i = 0; i < positions.length - 3; i += 1) {
    const leftStart = positions[i], leftEnd = positions[i + 1], rightStart = positions[i + 2], rightEnd = positions[i + 3];
    const leftDt = leftEnd.t - leftStart.t, rightDt = rightEnd.t - rightStart.t;
    const leftTime = (leftStart.t + leftEnd.t) / 2, rightTime = (rightStart.t + rightEnd.t) / 2, totalDt = rightTime - leftTime;
    if (!(leftDt > 0 && rightDt > 0 && totalDt > 0)) continue;
    const leftVx = (leftEnd.x - leftStart.x) / leftDt, leftVy = (leftEnd.y - leftStart.y) / leftDt;
    const rightVx = (rightEnd.x - rightStart.x) / rightDt, rightVy = (rightEnd.y - rightStart.y) / rightDt;
    const ax = (rightVx - leftVx) / totalDt, ay = (rightVy - leftVy) / totalDt;
    acceleration.push({ t: (leftTime + rightTime) / 2, ax, ay, magnitude: Math.hypot(ax, ay) });
  }
  return { velocity, acceleration };
}

function deriveEnergy(velocity, mass) {
  return velocity.map((v) => {
    const kinetic = .5 * mass * (v.vx ** 2 + v.vy ** 2);
    const potential = mass * 9.80665 * v.yMid;
    return { t: v.t, kinetic, potential, mechanical: kinetic + potential };
  });
}

window.T2G = { ...(window.T2G ?? {}), rescalePositions, deriveMotion, deriveEnergy };
})();
