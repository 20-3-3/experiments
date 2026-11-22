"""Find the shop-front edges of every room (edges that face a corridor) on both floors,
drop vertical links that run inside stores, and attach photo-based brand info.
Usage: python3 -I fronts.py model2.json out-model.json"""
import sys, json, math, bisect
from shapely.geometry import Polygon, Point, box
from shapely.ops import unary_union
from shapely.prepared import prep

src, out = sys.argv[1:3]
M = json.load(open(src))


def ring_of(g):
    return [[round(x, 2), round(z, 2)] for x, z in list(g.exterior.coords)[:-1]]


# The south end of the A wing block: on the official scheme its wall runs straight under A1-102 with three
# street doors; the traced outline bulged into the street below it. Square it off just inside that wall line
# (the facade skin goes 1.3 m further out, onto the wall's outer face at z 142.9).
SOUTH_CUT = 141.8
_aw = Polygon(M['volumes']['awing']).buffer(0)
_x0, _, _x1, _ = _aw.intersection(box(-1e3, 133.9, 1e3, 134.1)).bounds
for key, poly in (('footprint', Polygon(M['footprint']).buffer(0)), ('awing', _aw)):
    g = poly.difference(box(_x0 - 5, 134.0, _x1 + 5, 1e3)).union(box(_x0, 133.9, _x1, SOUTH_CUT)).buffer(0)
    if key == 'footprint':
        M['footprint'] = ring_of(g)
    else:
        M['volumes']['awing'] = ring_of(g)
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
    if r.get('mine'):   # the owner's pavilion: dark band with yellow letters until we know its real sign
        r['brand'] = (r['codes'][0], '#1d1f22', '#ffd400')
    if isinstance(r.get('brand'), str):
        r['brand'] = BRANDS.get('B2-182') if r['brand'] == 'dns' else None
        if r['brand'] is None:
            del r['brand']

main_v = Polygon(M['volumes']['main']).buffer(0)
awing_v = Polygon(M['volumes']['awing']).buffer(0)


def largest(g):
    if isinstance(g, Polygon):
        return g
    return max([x for x in getattr(g, 'geoms', []) if isinstance(x, Polygon)], key=lambda x: x.area)


for key in ('main_shell', 'awing_shell'):
    M['volumes'].pop(key, None)
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

# ---------------- facade skins ----------------
# the wall strokes of the scheme are 0.4-1 m thick and ragged on the outside, so the visible facade is one
# clean skin per volume just outside all of them; doors become real openings in it
from shapely.geometry import LineString
glyphs = []
for w in M['walls']:
    g = Polygon(w['poly'], w['holes']).buffer(0)
    x0, y0, x1, y1 = g.bounds
    if g.area < 6 and max(x1 - x0, y1 - y0) < 3 and any(g.intersects(LineString([d['pos'], (d['pos'][0] - d['dir'][0] * 4.5, d['pos'][1] - d['dir'][1] * 4.5)]))
                          for d in M['doors']):
        glyphs.append(w)
M['walls'] = [w for w in M['walls'] if w not in glyphs]
print('door arrow glyphs taken out of the walls', len(glyphs), [[round(v, 1) for v in Polygon(w['poly']).bounds] for w in glyphs])
walls_u = unary_union([Polygon(w['poly'], w['holes']).buffer(0) for w in M['walls']])
fp_poly = Polygon(M['footprint']).buffer(0)
outside = walls_u.difference(fp_poly)
pts_out = [p for g in ([outside] if outside.geom_type == 'Polygon' else list(getattr(outside, 'geoms', [])))
           if g.geom_type == 'Polygon' for p in g.exterior.coords]
off = 0.6
if pts_out:
    dists = sorted(fp_poly.exterior.distance(Point(x, y)) for x, y in pts_out)
    off = round(min(1.3, dists[int(len(dists) * 0.98)] + 0.15), 2)   # ignore the odd stray stroke
main_skin = largest(main_v.buffer(off, join_style=2).difference(awing_v.buffer(0.01, join_style=2))).simplify(0.05)
awing_skin = largest(awing_v.buffer(off, join_style=2).difference(main_skin.buffer(0.01, join_style=2))).simplify(0.05)


def ring_with_flags(g, other):
    cs = [[round(x, 2), round(z, 2)] for x, z in list(g.exterior.coords)[:-1]]
    flags = []
    for i in range(len(cs)):
        (x0, z0), (x1, z1) = cs[i], cs[(i + 1) % len(cs)]
        flags.append(other.distance(Point((x0 + x1) / 2, (z0 + z1) / 2)) < 0.06)   # shared with the other volume
    return cs, flags


M['volumes']['skin_offset'] = off
M['volumes']['main_skin'], M['volumes']['main_skin_shared'] = ring_with_flags(main_skin, awing_skin)
M['volumes']['awing_skin'], M['volumes']['awing_skin_shared'] = ring_with_flags(awing_skin, main_skin)

# width of every door's gap in the wall strokes, on both sides of the door position
for d in M['doors']:
    (px, pz), (dx, dz) = d['pos'], d['dir']
    ax_, az_ = -dz, dx                     # along the wall
    gap = []
    for sgn in (-1, 1):
        t = 0.3
        while t < 4.0:
            cx_, cz_ = px + ax_ * sgn * t, pz + az_ * sgn * t
            probe = LineString([(cx_ - dx * 1.6, cz_ - dz * 1.6), (cx_ + dx * 1.6, cz_ + dz * 1.6)])
            if probe.intersects(walls_u):
                break
            t += 0.1
        gap.append(round(t, 2))
    d['gap'] = gap

# where every outside door cuts the skin: cast a ray from 3 m inside the door outwards and take the first skin
# edge it leaves through; the opening is a stretch of the ring's arc length (it may run round a corner)
RINGS = {'main': (M['volumes']['main_skin'], M['volumes']['main_skin_shared']),
         'awing': (M['volumes']['awing_skin'], M['volumes']['awing_skin_shared'])}


def vol_at(x, z):
    p = Point(x, z)
    return 'main' if main_v.contains(p) else 'awing' if awing_v.contains(p) else None


def ring_edges(cs):
    ccw = Polygon(cs).exterior.is_ccw
    E, s = [], 0.0
    for i in range(len(cs)):
        (x0, z0), (x1, z1) = cs[i], cs[(i + 1) % len(cs)]
        L = math.hypot(x1 - x0, z1 - z0) or 1e-6
        nx, nz = (z1 - z0) / L, -(x1 - x0) / L
        if not ccw:
            nx, nz = -nx, -nz
        E.append(dict(a=(x0, z0), b=(x1, z1), L=L, s=s, nx=nx, nz=nz, ux=(x1 - x0) / L, uz=(z1 - z0) / L))
        s += L
    return E, s


EDGES = {k: ring_edges(cs) for k, (cs, _) in RINGS.items()}
for d in M['doors']:
    (px, pz), (dx, dz) = d['pos'], d['dir']
    d.pop('opening', None); d.pop('internal', None)
    v_out, v_in = vol_at(px - dx, pz - dz), vol_at(px + dx * 2, pz + dz * 2)
    if v_out and v_in and v_out != v_in:          # a passage between the hall and the A wing block
        d['internal'] = True
        continue
    ray = LineString([(px + dx * 3, pz + dz * 3), (px - dx * 8, pz - dz * 8)])
    best = None
    for key, (E, total) in EDGES.items():
        flags = RINGS[key][1]
        for i, e in enumerate(E):
            if flags[i] or -(dx * e['nx'] + dz * e['nz']) < 0.3:
                continue
            hit = ray.intersection(LineString([e['a'], e['b']]))
            if hit.is_empty or hit.geom_type != 'Point':
                continue
            dist = (hit.x - px) * -dx + (hit.y - pz) * -dz          # how far outside the door point the skin is
            if best is None or dist < best[0]:
                best = (dist, key, i, e, hit)
    if best is None:                                  # inside the building: a service door to a back room
        d['internal'] = True
        continue
    dist, key, i, e, hit = best
    E, total = EDGES[key]
    flags = RINGS[key][1]
    cum = [q['s'] for q in E]
    s = e['s'] + math.hypot(hit.x - e['a'][0], hit.y - e['a'][1])
    ax, az = -dx, -dz                                  # the passage runs along the door, outwards
    lx, lz = dz, -dx                                   # across it: the side of gap[0]
    if dist <= off + 0.8:                              # door in the wall line: the opening spans the gap in the strokes
        want = [min(2.2, max(1.0, g)) for g in d['gap']]
    else:                                              # door deeper inside: a passage of standard width
        want = [1.6, 1.6]

    def at(t):                                         # edge index and point at arc length t
        t %= total
        k = max(0, bisect.bisect_right(cum, t) - 1)
        q = E[k]
        return k, (q['a'][0] + q['ux'] * (t - q['s']), q['a'][1] + q['uz'] * (t - q['s']))

    def reach(step):
        # walk along the skin from the hit until the cut is wide enough across the door, the skin turns away
        # from the door line (a corner), or the edge is shared with the other volume
        side = 1 if (e['ux'] * lx + e['uz'] * lz) * step > 0 else -1
        need = want[0] if side > 0 else want[1]
        t = 0.0
        while t < need + 3:
            k, (qx, qz) = at(s + step * (t + 0.05))
            across = ((qx - hit.x) * lx + (qz - hit.y) * lz) * side
            along = (qx - hit.x) * ax + (qz - hit.y) * az
            if flags[k] or abs(along) > 1.2 or across >= need:
                break
            t += 0.05
        return max(0.3, t)
    a, b = s - reach(-1), s + reach(1)
    if a < 0:
        spans = [[a + total, total], [0.0, b]]
    elif b > total:
        spans = [[a, total], [0.0, b - total]]
    else:
        spans = [[a, b]]
    d['opening'] = {'ring': key, 'spans': [[round(x, 3), round(y, 3)] for x, y in spans],
                    'depth': round(min(6.0, max(off + 1.2, dist + 1.2)), 2), 'axis': [ax, az],
                    'hit': [round(hit.x, 2), round(hit.y, 2)], 'n': [round(e['nx'], 4), round(e['nz'], 4)]}

# sidewalk: a 3 m band around the building (not under it), cut by the roads and parking lots of the scheme
blockers = unary_union([Polygon(r['poly']).buffer(0) for r in M['exterior']['roads']] +
                       [Polygon(p['poly']).buffer(0) for p in M['exterior']['parking']])
body = unary_union([main_skin, awing_skin]).buffer(0.02, join_style=2)
walk = body.buffer(3.0, join_style=2).difference(body).difference(blockers)
M['exterior']['sidewalk'] = [{'poly': [[round(x, 2), round(z, 2)] for x, z in list(p.exterior.coords)[:-1]],
                              'holes': [[[round(x, 2), round(z, 2)] for x, z in list(h.coords)[:-1]] for h in p.interiors]}
                             for p in ([walk] if walk.geom_type == 'Polygon' else list(walk.geoms)) if p.area > 20]
print('skin offset', off, 'm | skins', len(M['volumes']['main_skin']), len(M['volumes']['awing_skin']),
      '| shared edges', sum(M['volumes']['main_skin_shared']), sum(M['volumes']['awing_skin_shared']),
      '| sidewalk parts', len(M['exterior']['sidewalk']))
print('doors: outside', sum(1 for d in M['doors'] if d.get('opening')), '| between volumes or inside',
      [(d['kind'], d['pos']) for d in M['doors'] if d.get('internal')])

json.dump(M, open(out, 'w'), ensure_ascii=False, separators=(',', ':'))
n1 = sum(1 for r in rooms1 if r['fronts']); n2 = sum(1 for r in rooms2 if r['fronts'])
print('links kept', len(M['links']), '| rooms with fronts f1', n1, '/', len(rooms1), 'f2', n2, '/', len(rooms2))
print('brands f1', sum(1 for r in rooms1 if r.get('brand')), 'f2', [(r['codes'], r['brand'][0]) for r in rooms2 if r.get('brand')])
print('size KB', round(len(json.dumps(M, ensure_ascii=False, separators=(',', ':'))) / 1024))
