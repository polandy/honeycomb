# Calibrating the sharpness measure

The sharpness measure (`src/logic/sharpness.ts`, SERIES-006, ADR 0046) marks the sharpest photo
of a series. Whether it picks the photo a person would pick is checked on real series, not on
test vectors: `scripts/sharpness-calibration.sh` measures local copies with the same module.

## Collecting series

Copy series out of the Photos library, never into it or inside it: the library is only browsed
and copied from, never changed (owner decision 2026-11-20). Export or copy the JPEGs of each
series into its own subfolder of a working folder outside the library, for example:

```text
~/calibration/
  birds-in-flight/  IMG_1201.jpg IMG_1202.jpg IMG_1203.jpg
  portrait-window/  IMG_2210.jpg IMG_2211.jpg
```

Pick series where you know the sharpest photo, and some where none stands out.

## Running it

```sh
scripts/sharpness-calibration.sh ~/calibration
```

It needs Node and ImageMagick 7 (`magick`), and only reads the folder. Each photo is shrunk to
the loupe tier (4096 px on the longer side, never enlarged) as the preview is, and measured.
For each series it prints the photos sharpest first, with the value and the focus tile (0–63,
row by row on an 8 × 8 grid), and the sharpest by the cull's rule, at least 5 % above the second,
or `none`:

```text
birds-in-flight: 3 photos, sharpest IMG_1202.jpg
  1. IMG_1202.jpg  812.4  tile 27
  2. IMG_1201.jpg  640.0  tile 28
  3. IMG_1203.jpg  301.7  tile 20
```

A photo it cannot decode is listed last as `not measured` with the reason.

## Changing the measure

When the ranks disagree with your choice, change the measure in `src/logic/sharpness.ts` and
raise `SHARPNESS_METHOD`: a stored value of another method counts as missing, so every series is
measured again and no migration is needed (ADR 0046). Record the result in
`docs/dev/decisions.md`.
