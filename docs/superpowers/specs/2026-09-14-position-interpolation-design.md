# Position Interpolation Design

## Goal

Allow an optional, user-controlled Catmull-Rom interpolation of tracked position data so velocity, acceleration, and energy can be derived from a denser position series. The default remains unmodified measured data.

## Data model

`state.positions` remains the immutable-for-analysis list of measured tracker samples. Each sample retains its original timestamp, pixel coordinates, physical coordinates, and confidence.

Analysis creates a separate position list:

- Interpolation off: analysis positions are the measured samples.
- Interpolation on: analysis positions contain every measured sample plus the configured number of interpolated samples between each adjacent measured pair.

No interpolation operation mutates, replaces, or hides the measured samples. Scale changes rescale measured samples first, then rebuild the analysis positions using the current interpolation controls.

## Interpolation

Use timestamp-aware Catmull-Rom interpolation expressed as cubic Hermite segments.

- The segment endpoints are the two measured samples that bound it.
- Interior tangents use the surrounding measured samples and their actual timestamps.
- Endpoint tangents use the nearest one-sided measured segment.
- Each inserted sample has a timestamp linearly located inside its original measured-frame interval.
- The first and last measured samples are preserved exactly.

This is intentionally a position-only transformation. Velocity, acceleration, and energy are recomputed from the resulting analysis positions; they are never interpolated independently.

## Graph UI

The Position article becomes a responsive two-column layout.

- Left: the existing Position chart.
- Right: an `Interpolation` controls card.
- On narrow screens: controls stack below the chart.

Controls:

- `Enable interpolation` checkbox, unchecked by default.
- `Points inserted per frame interval` range slider, default `1`, range `1` through `10`.
- A status line showing whether raw data is used or the resulting analysis-position count.

The slider is disabled while interpolation is off. Any control change immediately redraws Position, Velocity, Acceleration, and, when mass is valid, Energy.

## Position chart encoding

When interpolation is disabled, render measured x and y exactly as today.

When interpolation is enabled, render four distinct datasets:

- Measured x: dark blue, larger points, no connecting line.
- Interpolated x: light blue, small points and connecting line.
- Measured y: dark magenta, larger points, no connecting line.
- Interpolated y: light magenta, small points and connecting line.

The interpolated datasets are rendered before the measured datasets so measured points remain visually prominent.

## Lifecycle and failures

- New video, interval, ROI, or tracking run resets interpolation to off and restores the default slider value.
- Fewer than two measured positions keeps interpolation unavailable.
- Existing graph availability rules remain unchanged; derived graphs may be empty when the available number of analysis positions is insufficient for their finite-difference definitions.

## Verification

Tests must prove:

1. Catmull-Rom preserves all measured endpoints and passes through every measured point.
2. It inserts exactly the selected number of points per measured interval.
3. Interpolation off supplies measured positions to the motion calculation.
4. Interpolation on supplies interpolated positions to the motion calculation.
5. Position chart datasets distinguish measured from interpolated samples.
6. UI controls default to interpolation off and disable the slider while off.
