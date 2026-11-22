"""Extract wall strokes (thin dark lines) and door arrows from the scheme.
Usage: python3 -I walls.py scheme.png regions.json out.json overlay.png"""
import sys, json
import numpy as np
import cv2
from scipy import ndimage as ndi

src, reg_json, out_json, out_png = sys.argv[1:5]
img = cv2.imread(src, cv2.IMREAD_COLOR)[:, :, ::-1].astype(np.int16)
R = json.load(open(reg_json))
PX0, PY0, PX1, PY1 = R['plan']

dark = np.abs(img - 51).sum(axis=2) < 60
LG = R['legend']; dark[LG[1]:LG[3], LG[0]:LG[2]] = False
dark[:PY0] = False; dark[PY1:] = False; dark[:, :PX0] = False; dark[:, PX1:] = False
dt = ndi.distance_transform_edt(dark)
lab, n = ndi.label(dark, structure=np.ones((3, 3)))
objs = ndi.find_objects(lab)
walls, arrows, other = [], [], []
wall_mask = np.zeros(dark.shape, bool)
for i, sl in enumerate(objs, start=1):
    comp = lab[sl] == i
    h = sl[0].stop - sl[0].start; w = sl[1].stop - sl[1].start
    area = int(comp.sum())
    if area < 30:
        continue
    thick = float(dt[sl][comp].max())
    fill = area / (h * w)
    box = [int(sl[1].start), int(sl[0].start), int(sl[1].stop), int(sl[0].stop)]
    if thick <= 5.0 and max(h, w) >= 14:
        # thin stroke: wall line, wall tick, or hatch stripe / text
        walls.append({'box': box, 'len': max(h, w), 'area': area, 'fill': round(fill, 2)})
        wall_mask[sl] |= comp
    elif 6 <= thick <= 13 and 22 <= max(h, w) <= 60 and 0.25 <= fill <= 0.6:
        # arrow glyph: find the head by the thickest point and the tail by the farthest pixel from it
        ys, xs = np.nonzero(comp)
        d = dt[sl] * comp
        hy, hx = np.unravel_index(np.argmax(d), d.shape)
        far = np.argmax((xs - hx) ** 2 + (ys - hy) ** 2)
        tx, ty = xs[far], ys[far]
        arrows.append({'box': box, 'head': [int(hx + sl[1].start), int(hy + sl[0].start)],
                       'tail': [int(tx + sl[1].start), int(ty + sl[0].start)]})
    else:
        other.append({'box': box, 'thick': round(thick, 1), 'fill': round(fill, 2)})

json.dump({'walls': walls, 'arrows': arrows, 'other': other}, open(out_json, 'w'))
np.save(out_json.replace('.json', '_mask.npy'), wall_mask)
ov = np.full(img.shape, 255, np.uint8)
ov[wall_mask] = (0, 0, 0)
for a in arrows:
    cv2.arrowedLine(ov, tuple(a['tail']), tuple(a['head']), (0, 0, 255), 5, tipLength=0.4)
for o in other:
    x0, y0, x1, y1 = o['box']
    cv2.rectangle(ov, (x0, y0), (x1, y1), (255, 140, 0), 2)
cv2.imwrite(out_png, ov)
print('walls', len(walls), 'arrows', len(arrows), 'other', len(other))
