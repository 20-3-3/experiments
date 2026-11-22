"""Detect pictogram icons (dark rounded squares) on the plan and classify them with the legend.
Usage: python3 -I icons.py scheme.png regions.json out.json overlay.png"""
import sys, json
import numpy as np
import cv2
from scipy import ndimage as ndi

src, reg_json, out_json, out_png = sys.argv[1:5]
img = cv2.imread(src, cv2.IMREAD_COLOR)[:, :, ::-1].astype(np.int16)
R = json.load(open(reg_json))
PX0, PY0, PX1, PY1 = R['plan']
LG = R['legend']
dark = np.abs(img - 51).sum(axis=2) < 70


def squares(mask, x0, y0, x1, y1, smin, smax):
    sub = mask[y0:y1, x0:x1]
    # fill glyph holes so an icon becomes one solid square
    lab, n = ndi.label(sub, structure=np.ones((3, 3)))
    out = []
    for i, sl in enumerate(ndi.find_objects(lab), start=1):
        if sl is None:
            continue
        h = sl[0].stop - sl[0].start; w = sl[1].stop - sl[1].start
        if not (smin <= h <= smax and smin <= w <= smax) or max(h, w) > 1.35 * min(h, w):
            continue
        comp = lab[sl] == i
        ring = np.ones_like(comp); ring[3:-3, 3:-3] = False
        ring_density = comp[ring].mean()
        ink = comp.mean()
        if ring_density < 0.62 or not 0.3 <= ink <= 0.93:
            continue
        out.append((sl[1].start + x0, sl[0].start + y0, w, h))
    return out


def norm(x, y, w, h):
    crop = img[y:y + h, x:x + w]
    glyph = (crop.sum(axis=2) > 450).astype(np.float32)  # white glyph on dark square
    g = cv2.resize(glyph, (32, 32), interpolation=cv2.INTER_AREA)
    g -= g.mean()
    n = np.linalg.norm(g)
    return g / n if n else g


# legend: three columns of icons with their names, top to bottom
NAMES = [['atm', 'buffet', 'info', 'medical'], ['cafe', 'credit', 'stairs', 'sale'], ['exchange', 'wc', 'escalator']]
COLX = [1587, 1994, 2413]
ROW0, ROWSTEP, SIZE = 3349, 89, 59
templates = []
for ci, names in enumerate(NAMES):
    for ri, name in enumerate(names):
        b = (COLX[ci], ROW0 + ri * ROWSTEP, SIZE, SIZE)
        if name == 'sale':
            continue   # round icon, not a square
        templates.append((name, norm(*b), b))
print('legend icons', [(t[0], t[2][:2]) for t in templates])

plan_mask = dark.copy()
plan_mask[LG[1]:LG[3], LG[0]:LG[2]] = False
found = squares(plan_mask, PX0, PY0, PX1, PY1, 17, 34)
icons = []
for b in found:
    v = norm(*b)
    scores = sorted(((float((v * t).sum()), name) for name, t, _ in templates), reverse=True)
    best, name = scores[0]
    if best < 0.45:
        continue
    x, y, w, h = b
    icons.append({'type': name, 'x': int(x + w / 2), 'y': int(y + h / 2), 'size': int(max(w, h)), 'score': round(best, 2),
                  'second': scores[1][1], 'margin': round(best - scores[1][0], 2)})
json.dump(icons, open(out_json, 'w'))
ov = (img[:, :, ::-1] * 0.55 + 115).astype(np.uint8).copy()
colors = {'atm': (0, 128, 0), 'buffet': (0, 90, 200), 'info': (200, 0, 200), 'medical': (0, 0, 255), 'cafe': (255, 100, 0),
          'credit': (120, 120, 0), 'stairs': (0, 0, 0), 'sale': (128, 0, 128), 'exchange': (0, 160, 160), 'wc': (255, 0, 0), 'escalator': (60, 60, 255)}
for ic in icons:
    c = colors.get(ic['type'], (0, 0, 0))
    cv2.circle(ov, (ic['x'], ic['y']), 20, c[::-1], 3)
    cv2.putText(ov, ic['type'], (ic['x'] + 20, ic['y'] + 8), cv2.FONT_HERSHEY_SIMPLEX, 0.9, c[::-1], 2)
cv2.imwrite(out_png, ov)
from collections import Counter
print('icons', len(icons), Counter(i['type'] for i in icons))
