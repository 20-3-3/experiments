"""Check that every stair/escalator has a free approach at the bottom (floor 1) and a landing at the top (floor 2).
Usage: python3 -I check_links.py model.json"""
import sys, json, math
from shapely.geometry import Polygon, LineString
from shapely.ops import unary_union

M = json.load(open(sys.argv[1]))
r1 = unary_union([Polygon(r['poly']).buffer(0) for r in M['rooms']] + [Polygon(w['poly']).buffer(0) for w in M['walls']])
r2 = unary_union([Polygon(r['poly']).buffer(0) for r in M['floor2']['rooms']])
slab = unary_union([Polygon(s['poly'], s['holes']).buffer(0) for s in M['floor2']['slab']])
bad = 0
for L in M['links']:
    (ax, az), (bx, bz) = L['a'], L['b']
    n = math.hypot(bx - ax, bz - az); dx, dz = (bx - ax) / n, (bz - az) / n
    w = L['w'] / 2 - 0.3
    rect = LineString([(ax, az), (bx, bz)]).buffer(w, cap_style=2)
    below = LineString([(ax - dx * 1.6, az - dz * 1.6), (ax, az)]).buffer(w, cap_style=2)
    above = LineString([(bx, bz), (bx + dx * 1.6, bz + dz * 1.6)]).buffer(w, cap_style=2)
    f_in = rect.intersection(r1).area
    f_below = below.intersection(r1).area
    f_above_rooms = above.intersection(r2).area
    f_above_slab = above.difference(slab).area
    ok = f_in < 0.2 and f_below < 0.2 and f_above_rooms < 0.2 and f_above_slab < 0.4
    bad += not ok
    print(('OK ' if ok else 'BAD'), L['kind'][:3], L['a'], '->', L['b'], 'in', round(f_in, 2), 'below', round(f_below, 2), 'top rooms', round(f_above_rooms, 2), 'top no slab', round(f_above_slab, 2))
print('bad', bad)
