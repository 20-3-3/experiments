"""Find entrance arrows on the scheme by template matching (4 orientations).
Usage: python3 -I arrows.py scheme.png regions.json x0 y0 x1 y1 out.json overlay.png
(x0..y1 = bounding box of one left-pointing arrow used as the template)"""
import sys, json
import numpy as np
import cv2

src, reg_json = sys.argv[1:3]
x0, y0, x1, y1 = map(int, sys.argv[3:7])
out_json, out_png = sys.argv[7:9]
img = cv2.imread(src, cv2.IMREAD_COLOR)[:, :, ::-1].astype(np.int16)
R = json.load(open(reg_json))
PX0, PY0, PX1, PY1 = R['plan']
dark = (np.abs(img - 51).sum(axis=2) < 90).astype(np.float32)
LG = R['legend']; dark[LG[1]:LG[3], LG[0]:LG[2]] = 0
tpl = dark[y0 - 2:y1 + 2, x0 - 2:x1 + 2].copy()
found = []
# template points left; rotations give the 4 directions (dx, dy of the arrow head)
for k, d in [(0, (-1, 0)), (1, (0, 1)), (2, (1, 0)), (3, (0, -1))]:
    t = np.rot90(tpl, k).copy()
    res = cv2.matchTemplate(dark[PY0:PY1, PX0:PX1], t, cv2.TM_CCOEFF_NORMED)
    ys, xs = np.nonzero(res > 0.72)
    for y, x in zip(ys, xs):
        cx = x + PX0 + t.shape[1] / 2; cy = y + PY0 + t.shape[0] / 2
        found.append((float(res[y, x]), cx, cy, d))
found.sort(reverse=True)
arrows = []
for sc, cx, cy, d in found:
    if all((cx - a['x']) ** 2 + (cy - a['y']) ** 2 > 22 ** 2 for a in arrows):
        arrows.append({'x': round(cx), 'y': round(cy), 'dir': d, 'score': round(sc, 3)})
json.dump(arrows, open(out_json, 'w'))
ov = (img[:, :, ::-1] * 0.5 + 127).astype(np.uint8).copy()
for a in arrows:
    cx, cy = a['x'], a['y']; dx, dy = a['dir']
    cv2.arrowedLine(ov, (int(cx - dx * 25), int(cy - dy * 25)), (int(cx + dx * 25), int(cy + dy * 25)), (0, 0, 255), 6, tipLength=0.5)
cv2.imwrite(out_png, ov)
print('arrows', len(arrows))
