"""Find the shop-front edges of every room (edges that face a corridor) on both floors,
drop vertical links that run inside stores, and attach photo-based brand info.
Usage: python3 -I fronts.py model2.json out-model.json"""
import sys, json, math
from shapely.geometry import Polygon, Point, box
from shapely.ops import unary_union
from shapely.prepared import prep

src, out = sys.argv[1:3]
M = json.load(open(src))
fp = prep(Polygon(M['footprint']).buffer(0))
walls = unary_union([Polygon(w['poly']).buffer(0) for w in M['walls']])


slab = unary_union([Polygon(s['poly'], s['holes']).buffer(0) for s in M['floor2']['slab']])
slab_p = prep(slab)

# brand styles seen on photos (2024-2026) or written on the official scheme
BRANDS = {
    # floor 1
    'B1-061': ('SAMSUNG', '#1428a0', '#ffffff'), 'H1-013': ('SAMSUNG', '#1428a0', '#ffffff'), 'H1-008': ('SAMSUNG', '#1428a0', '#ffffff'),
    'C1-023': ('SAMSUNG', '#1428a0', '#ffffff'),
    'B1-001': ('ТЕХНОПАРК', '#2b2f36', '#ffffff'), 'B1-021': ('ТЕХНОПАРК', '#2b2f36', '#ffffff'), 'G1-008': ('ТЕХНОПАРК', '#2b2f36', '#ffffff'),
    'D1-018': ('ТЕХНОПАРК', '#2b2f36', '#ffffff'), 'D1-008': ('ТЕХНОПАРК', '#2b2f36', '#ffffff'),
    'B1-040': ('YAMAGUCHI', '#c8102e', '#ffffff'), 'C1-046': ('PARK BT', '#1d1f23', '#ffffff'), 'G1-006': ('PARK BT', '#1d1f23', '#ffffff'),
    'F1-003': ('PARK BT', '#1d1f23', '#ffffff'),
    'H1-030': ('ПЕРЕКРЁСТОК', '#0f8a3c', '#ffffff'), 'H1-010': ('МТС', '#e30611', '#ffffff'), 'H1-001': ('СВЯЗНОЙ', '#3a2a6b', '#ffffff'),
    'H1-003A': ('АЛЬФА-БАНК', '#ef3124', '#ffffff'), 'H1-003': ('MIELE', '#8c0014', '#ffffff'),
    'E1-007': ('ГАЛЕРЕЯ ЗВУКА', '#1d1f23', '#e8c46a'), 'E1-005': ('РЕЗОНАНС', '#2b2f36', '#ffffff'), 'E1-003': ('AV-SOLO', '#1d1f23', '#ffffff'),
    'E1-008': ('MARANTZ', '#111111', '#d8c38a'), 'C1-016': ('SHARP', '#e4002b', '#ffffff'), 'C1-014': ('SONY', '#111111', '#ffffff'),
    'C1-005': ('BORK', '#111111', '#ffffff'), 'C1-026': ('MAXVIDEO', '#00539b', '#ffffff'), 'B1-074': ('MAXVIDEO', '#00539b', '#ffffff'),
    'B1-053': ('KÄRCHER', '#ffed00', '#1d1d1b'), 'B1-043': ('PIONEER', '#111111', '#ffffff'), 'B1-041': ('ЕВРОСЕТЬ', '#ffd400', '#1d1d1b'),
    'D1-025': ('TELESTUDIA', '#2b2f36', '#ffffff'), 'D1-060': ('МЯГКАЯ МЕБЕЛЬ', '#6b3e26', '#ffffff'), 'G1-003': ('ZIGMUND & SHTAIN', '#111111', '#ffffff'),
    'G1-001': ('PHILIPS', '#0b5ed7', '#ffffff'), 'F1-011': ('HANSA', '#0057a8', '#ffffff'), 'B1-059': ('СВЯЗНОЙ', '#3a2a6b', '#ffffff'),
    'C1-029': ('PLAY OFF', '#111111', '#ffffff'), 'C1-017': ('ОНЛАЙН ФОТО', '#0f6fb5', '#ffffff'),
    # floor 2 (photos 2024-2026)
    'B2-182': ('DNS', '#f26f21', '#ffffff'), 'B2-110': ('GARMIN', '#111111', '#ffffff'), 'B2-109': ('МУЗЫКА · КЛАССИКА', '#c8102e', '#ffffff'),
    'B2-108': ('ЧАСЫ', '#c8102e', '#ffd400'), 'B2-104': ('МЕЛОМАН', '#f2f4f7', '#1c5fa8'),
}
NAMED = {'C1-060': ('ЕВРОДОМ', '#0b6b3a', '#ffffff')}


def free_edges(rooms, region_ok, others_union):
    others = prep(others_union)
    for r in rooms:
        pts = r['poly']
        edges = []
        n = len(pts)
        poly = Polygon(pts)
        ccw = poly.exterior.is_ccw
        for i in range(n):
            x1, z1 = pts[i]; x2, z2 = pts[(i + 1) % n]
            L = math.hypot(x2 - x1, z2 - z1)
            if L < 0.9:
                continue
            # outward normal (shapely y = our z)
            nx, nz = (z2 - z1) / L, -(x2 - x1) / L
            if not ccw:
                nx, nz = -nx, -nz
            mx, mz = (x1 + x2) / 2, (z1 + z2) / 2
            ok = True
            for d in (0.6, 1.4):
                p = Point(mx + nx * d, mz + nz * d)
                if others.contains(p) or not region_ok(p) or walls.contains(p):
                    ok = False; break
            if ok:
                edges.append([round(x1, 2), round(z1, 2), round(x2, 2), round(z2, 2), round(nx, 3), round(nz, 3)])
        r['fronts'] = edges


rooms1 = M['rooms']; rooms2 = M['floor2']['rooms']
u1 = unary_union([Polygon(r['poly']).buffer(0) for r in rooms1])
u2 = unary_union([Polygon(r['poly']).buffer(0) for r in rooms2])
free_edges(rooms1, lambda p: fp.contains(p), u1)
free_edges(rooms2, lambda p: slab_p.contains(p), u2)

for r in rooms1 + rooms2:
    for c in r['codes']:
        if c in BRANDS:
            r['brand'] = BRANDS[c]; break
    for c in r['codes']:
        if c in NAMED and 'brand' not in r:
            r['brand'] = NAMED[c]
    if 'brand' not in r and r.get('name') == 'ЕВРОДОМ':
        r['brand'] = NAMED['C1-060']
    if 'brand' not in r and r.get('name') == 'ПЕРЕКРЕСТОК':
        r['brand'] = BRANDS['H1-030']
    if 'brand' not in r and r.get('kind') == 'cafe':
        r['brand'] = (r['name'].replace('КАФЕ ', ''), '#7a1f1f', '#ffe3a3')
    if isinstance(r.get('brand'), str):
        r['brand'] = BRANDS.get('B2-182') if r['brand'] == 'dns' else None
        if r['brand'] is None:
            del r['brand']

# facade shells: just outside the wall line so they never z-fight with the walls; where the hall meets
# the A wing block neither shell may reach into the other volume, or its outer face shows from inside
main_v = Polygon(M['volumes']['main']).buffer(0)
awing_v = Polygon(M['volumes']['awing']).buffer(0)


def largest(g):
    if isinstance(g, Polygon):
        return g
    return max([x for x in getattr(g, 'geoms', []) if isinstance(x, Polygon)], key=lambda x: x.area)


shells = {
    'main': largest(main_v.buffer(0.35, join_style=2).difference(awing_v.buffer(0.4, join_style=2))),
    'awing': largest(awing_v.buffer(0.35, join_style=2).difference(main_v.buffer(0.05, join_style=2))),
}
for key, g in shells.items():
    g = g.simplify(0.2)
    M['volumes'][key + '_shell'] = [[round(x, 2), round(z, 2)] for x, z in list(g.exterior.coords)[:-1]]
# the opening between the hall and the A wing gets a lintel over the passage
junction = main_v.boundary.intersection(awing_v.buffer(0.15))
segs = []
for part in ([junction] if junction.geom_type == 'LineString' else list(getattr(junction, 'geoms', []))):
    if part.geom_type != 'LineString':
        continue
    cs = list(part.coords)
    for (x0, z0), (x1, z1) in zip(cs, cs[1:]):
        if math.hypot(x1 - x0, z1 - z0) > 0.3:
            segs.append([round(x0, 2), round(z0, 2), round(x1, 2), round(z1, 2)])
M['volumes']['junction'] = segs
print('junction segments', len(segs), 'total m', round(sum(math.hypot(s[2] - s[0], s[3] - s[1]) for s in segs), 1))

json.dump(M, open(out, 'w'), ensure_ascii=False, separators=(',', ':'))
n1 = sum(1 for r in rooms1 if r['fronts']); n2 = sum(1 for r in rooms2 if r['fronts'])
print('links kept', len(M['links']), '| rooms with fronts f1', n1, '/', len(rooms1), 'f2', n2, '/', len(rooms2))
print('brands f1', sum(1 for r in rooms1 if r.get('brand')), 'f2', [(r['codes'], r['brand'][0]) for r in rooms2 if r.get('brand')])
print('size KB', round(len(json.dumps(M, ensure_ascii=False, separators=(',', ':'))) / 1024))
