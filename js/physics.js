(() => {
function rescalePositions(samples, scale) {
  if (!samples.length) return [];
  const origin = samples[0];
  return samples.map((sample) => ({ ...sample, x: (sample.px - origin.px) * scale, y: -(sample.py - origin.py) * scale }));
}

function interpolatePositions(samples, insertions) {
  if (!Number.isInteger(insertions) || insertions < 1 || samples.length < 2) return samples;
  const slope = (left, right, key) => {
    const dt = right.t - left.t;
    return dt > 0 ? (right[key] - left[key]) / dt : 0;
  };
  const tangent = (index, key) => {
    if (index === 0) return slope(samples[0], samples[1], key);
    if (index === samples.length - 1) return slope(samples[index - 1], samples[index], key);
    return slope(samples[index - 1], samples[index + 1], key);
  };
  const output = [{ ...samples[0], interpolated: false }];
  for (let index = 0; index < samples.length - 1; index += 1) {
    const left = samples[index], right = samples[index + 1], dt = right.t - left.t;
    if (dt > 0) {
      const leftTx = tangent(index, 'x'), leftTy = tangent(index, 'y');
      const rightTx = tangent(index + 1, 'x'), rightTy = tangent(index + 1, 'y');
      for (let step = 1; step <= insertions; step += 1) {
        const u = step / (insertions + 1), u2 = u * u, u3 = u2 * u;
        const h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
        output.push({ t: left.t + dt * u, x: h00 * left.x + h10 * dt * leftTx + h01 * right.x + h11 * dt * rightTx, y: h00 * left.y + h10 * dt * leftTy + h01 * right.y + h11 * dt * rightTy, interpolated: true });
      }
    }
    output.push({ ...right, interpolated: false });
  }
  return output;
}

function selectAnalysisPositions(measured, enabled, insertions) {
  return enabled ? interpolatePositions(measured, insertions) : measured;
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

window.T2G = { ...(window.T2G ?? {}), rescalePositions, interpolatePositions, selectAnalysisPositions, deriveMotion, deriveEnergy };
})();
