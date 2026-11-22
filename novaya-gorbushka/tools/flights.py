"""Find hatched stair / escalator flights and pair them with the nearest stairs/escalator icon.
Usage: python3 -I flights.py scheme.png regions.json icons.json out.json overlay.png"""
import sys, json, math
import numpy as np
import cv2
from scipy import ndimage as ndi

src, reg_json, icons_json, out_json, out_png = sys.argv[1:6]
img = cv2.imread(src, cv2.IMREAD_COLOR)[:, :, ::-1].astype(np.int16)
R = json.load(open(reg_json))
icons = json.load(open(icons_json))
PX0, PY0, PX1, PY1 = R['plan']
LG = R['legend']
dark = np.abs(img - 51).sum(axis=2) < 90
dark[LG[1]:LG[3], LG[0]:LG[2]] = False
dark[:PY0] = False; dark[PY1:] = False; dark[:, :PX0] = False; dark[:, PX1:] = False
# icons are not hatches
for ic in icons:
    s = ic['size'] // 2 + 3
    dark[ic['y'] - s:ic['y'] + s, ic['x'] - s:ic['x'] + s] = False
lab, n = ndi.label(dark, structure=np.ones((3, 3)))
flights = []
for i, sl in enumerate(ndi.find_objects(lab), start=1):
    if sl is None:
        continue
    h = sl[0].stop - sl[0].start; w = sl[1].stop - sl[1].start
    if not (24 <= max(h, w) <= 200 and min(h, w) >= 16):
        continue
    comp = lab[sl] == i
    fill = comp.mean()
    if not 0.12 <= fill <= 0.65:
        continue
    # hatch: many parallel strokes -> many transitions along one axis
    inner = comp[2:-2, 2:-2] if min(h, w) > 8 else comp
    tx = np.abs(np.diff(inner.astype(np.int8), axis=1)).sum(axis=1).mean()  # transitions along x per row
    ty = np.abs(np.diff(inner.astype(np.int8), axis=0)).sum(axis=0).mean()  # along y per column
    stripes = max(tx, ty) / 2
    if stripes < 3.5:
        continue
    # stripes counted along x means the strokes are vertical -> you walk along x
    axis = 'x' if tx > ty else 'y'
    x0, y0 = sl[1].start, sl[0].start
    flights.append({'box': [int(x0), int(y0), int(x0 + w), int(y0 + h)], 'axis': axis, 'stripes': round(float(stripes), 1)})

# pair with icons
for f in flights:
    cx = (f['box'][0] + f['box'][2]) / 2; cy = (f['box'][1] + f['box'][3]) / 2
    best = None
    for ic in icons:
        if ic['type'] not in ('stairs', 'escalator'):
            continue
        # distance from icon centre to the box
        dx = max(f['box'][0] - ic['x'], 0, ic['x'] - f['box'][2])
        dy = max(f['box'][1] - ic['y'], 0, ic['y'] - f['box'][3])
        d = math.hypot(dx, dy)
        if best is None or d < best[0]:
            best = (d, ic)
    f['kind'] = best[1]['type'] if best and best[0] < 90 else 'stairs'
    f['icon'] = [best[1]['x'], best[1]['y']] if best and best[0] < 90 else None
json.dump(flights, open(out_json, 'w'))
ov = (img[:, :, ::-1] * 0.55 + 115).astype(np.uint8).copy()
for f in flights:
    x0, y0, x1, y1 = f['box']
    c = (255, 0, 0) if f['kind'] == 'escalator' else (0, 0, 0)
    cv2.rectangle(ov, (x0, y0), (x1, y1), c[::-1], 4)
    cv2.putText(ov, f"{f['kind'][:3]} {f['axis']}", (x0, y0 - 6), cv2.FONT_HERSHEY_SIMPLEX, 0.9, c[::-1], 2)
cv2.imwrite(out_png, ov)
from collections import Counter
print('flights', len(flights), Counter(f['kind'] for f in flights))
