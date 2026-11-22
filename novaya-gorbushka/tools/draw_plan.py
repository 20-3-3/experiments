"""Draw floor 1 and the reconstructed floor 2 side by side for checking.
Usage: python3 -I draw_plan.py model.json out.png"""
import sys, json, math
from PIL import Image, ImageDraw

M = json.load(open(sys.argv[1]))
COL = {'A': (153, 153, 204), 'B': (0, 177, 227), 'C': (0, 152, 70), 'D': (220, 213, 39), 'E': (141, 89, 159),
       'F': (243, 193, 45), 'G': (243, 147, 20), 'H': (225, 30, 36), 'tech': (178, 178, 178)}
S = 6.0
X0, Z0, X1, Z1 = -100, -85, 90, 155
W, H = int((X1 - X0) * S), int((Z1 - Z0) * S)
im = Image.new('RGB', (W * 2 + 40, H + 60), 'white')
d = ImageDraw.Draw(im)


def T(p, ox):
    return (ox + (p[0] - X0) * S, 40 + (p[1] - Z0) * S)


for k, (title, rooms) in enumerate([('1 этаж (схема)', M['rooms']), ('2 этаж (реконструкция)', M['floor2']['rooms'])]):
    ox = k * (W + 40)
    d.text((ox + 10, 10), title, fill='black')
    d.polygon([T(p, ox) for p in M['footprint']], outline=(90, 90, 90), fill=(250, 250, 250))
    if k == 1:
        for s in M['floor2']['slab']:
            d.polygon([T(p, ox) for p in s['poly']], fill=(236, 233, 226), outline=(120, 120, 120))
            for h in s['holes']:
                d.polygon([T(p, ox) for p in h], fill=(255, 255, 255), outline=(200, 0, 0))
    for r in rooms:
        c = COL.get(r['sector'], (150, 150, 150)) if r['kind'] != 'tech' else COL['tech']
        d.polygon([T(p, ox) for p in r['poly']], fill=c, outline=(255, 255, 255))
        if r.get('name') and k == 1:
            cx = sum(p[0] for p in r['poly']) / len(r['poly']); cz = sum(p[1] for p in r['poly']) / len(r['poly'])
            d.text(T((cx - 2, cz), ox), r['name'][:10], fill='black')
    if k == 1:
        for x0, z0, x1, z1 in M['floor2']['rails']:
            d.line([T((x0, z0), ox), T((x1, z1), ox)], fill=(255, 0, 255), width=2)
    for L in M['links']:
        a, b = T(L['a'], ox), T(L['b'], ox)
        d.line([a, b], fill=(0, 0, 0), width=max(2, int(L['w'] * S)))
        d.ellipse([b[0] - 5, b[1] - 5, b[0] + 5, b[1] + 5], fill=(255, 0, 0))
        d.text((a[0] + 4, a[1]), str(L['src']), fill=(0, 0, 0))
im.save(sys.argv[2])
print(im.size)
