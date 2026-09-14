(() => {
function rescalePositions(samples, scale) {
  if (!samples.length) return [];
  const origin = samples[0];
  return samples.map((sample) => ({ ...sample, x: (sample.px - origin.px) * scale, y: -(sample.py - origin.py) * scale }));
}

function deriveMotion(positions) {
  const velocity = [];
  for (let i = 0; i < positions.length - 1; i += 1) {
    const a = positions[i], b = positions[i + 1], dt = b.t - a.t;
    if (!(dt > 0)) continue;
    const vx = (b.x - a.x) / dt, vy = (b.y - a.y) / dt;
    velocity.push({ t: (a.t + b.t) / 2, vx, vy, magnitude: Math.hypot(vx, vy), xMid: (a.x + b.x) / 2, yMid: (a.y + b.y) / 2 });
  }
  const acceleration = [];
  for (let i = 0; i < velocity.length - 1; i += 1) {
    const a = velocity[i], b = velocity[i + 1], dt = b.t - a.t;
    if (!(dt > 0)) continue;
    const ax = (b.vx - a.vx) / dt, ay = (b.vy - a.vy) / dt;
    acceleration.push({ t: (a.t + b.t) / 2, ax, ay, magnitude: Math.hypot(ax, ay) });
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
