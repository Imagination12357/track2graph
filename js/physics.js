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
    const ax = 2 * ((next.x - current.x) / afterDt - (current.x - previous.x) / beforeDt) / totalDt;
    const ay = 2 * ((next.y - current.y) / afterDt - (current.y - previous.y) / beforeDt) / totalDt;
    velocity.push({ t: current.t, vx, vy, magnitude: Math.hypot(vx, vy), xMid: current.x, yMid: current.y });
    acceleration.push({ t: current.t, ax, ay, magnitude: Math.hypot(ax, ay) });
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
