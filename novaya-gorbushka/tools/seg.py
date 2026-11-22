"""Segment the Gorbushkin Dvor floor scheme into coloured regions (pavilions, technical rooms).
Usage: python3 -I seg.py scheme.png out.json overlay.png"""
import sys, json
import numpy as np
import cv2
from scipy import ndimage as ndi

src, out_json, out_png = sys.argv[1:4]
img = cv2.imread(src, cv2.IMREAD_COLOR)[:, :, ::-1].astype(np.int16)  # RGB
H, W, _ = img.shape
# plan panel (excludes the poster header and the legend at the bottom)
PX0, PY0, PX1, PY1 = 80, 610, 2712, 3530
LEGEND = (1500, 3300, 2712, 3700)   # x0, y0, x1, y1 of the legend block, ignored

PALETTE = {
    'H': (225, 30, 36), 'G': (243, 147, 20), 'F': (243, 193, 45), 'E': (141, 89, 159),
    'B': (0, 177, 227), 'C': (0, 152, 70), 'D': (220, 213, 39), 'A': (153, 153, 204),
    'tech': (177, 178, 178), 'park': (203, 204, 203),
}
TOL = {'tech': 14, 'park': 10}

regions = []
img_l = img.copy()
img_l[LEGEND[1]:LEGEND[3], LEGEND[0]:LEGEND[2]] = 255
plan = img_l[PY0:PY1, PX0:PX1]
keys = list(PALETTE)
cols = np.array([PALETTE[k] for k in keys])
dist = np.abs(plan[:, :, None, :] - cols[None, None, :, :]).sum(axis=3)
nearest = dist.argmin(axis=2)
mind = dist.min(axis=2)
for ki, key in enumerate(keys):
    mask = (nearest == ki) & (mind < TOL.get(key, 60))
    # 4-connected components; white separators split pavilions
    lab, n = ndi.label(mask, structure=[[0, 1, 0], [1, 1, 1], [0, 1, 0]])
    objs = ndi.find_objects(lab)
    for i, sl in enumerate(objs, start=1):
        if sl is None:
            continue
        comp = lab[sl] == i
        area = int(comp.sum())
        hgt, wid = comp.shape
        if area < 250 or min(hgt, wid) < 9:
            continue
        filled = ndi.binary_fill_holes(comp)
        cs, _ = cv2.findContours(filled.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        c = max(cs, key=cv2.contourArea)
        approx = cv2.approxPolyDP(c, 2.2, True)[:, 0, :]
        oy, ox = sl[0].start + PY0, sl[1].start + PX0
        poly = [[int(x + ox), int(y + oy)] for x, y in approx]
        fill_ratio = area / max(1, int(filled.sum()))
        regions.append({
            'key': key, 'poly': poly, 'area': int(filled.sum()), 'ink': round(1 - fill_ratio, 3),
            'bbox': [int(sl[1].start + PX0), int(sl[0].start + PY0), int(sl[1].stop + PX0), int(sl[0].stop + PY0)],
        })

json.dump({'size': [W, H], 'plan': [PX0, PY0, PX1, PY1], 'legend': list(LEGEND), 'regions': regions}, open(out_json, 'w'))

# overlay for checking
ov = (img[:, :, ::-1] * 0.35 + 255 * 0.65).astype(np.uint8).copy()
rng = np.random.default_rng(3)
for r in regions:
    col = tuple(int(v) for v in rng.integers(30, 220, 3))
    pts = np.array(r['poly'], np.int32)
    cv2.polylines(ov, [pts], True, col, 3)
cv2.imwrite(out_png, ov)
from collections import Counter
print('regions', len(regions), Counter(r['key'] for r in regions))
