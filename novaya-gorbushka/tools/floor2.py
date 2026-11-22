"""Reconstruct the 2nd floor of Gorbushkin Dvor and connect the floors.

No official 2nd floor plan is available, so floor 2 is rebuilt from evidence:
- the legend of the official 1st floor poster: "ВСЕ ДИСКИ / 2 этаж сектор B2 C2 G2",
  "СЕРВИСНАЯ ЗОНА / 2 этаж сектор D2", "КОМПЬЮТЕРЫ / 2 этаж сектор E2 F2 H2" (no A2);
- confirmed 2nd floor pavilions: DNS B2-182, Garmin B2-110 (photo), Master Mobile C2-012A,
  phone repair C2-008A, GadgetClick E2-022, DJI pickup H2-010G;
- 2024-2026 photos: floor 2 sits under the steel roof trusses; in sector B a light well over the
  corridor in front of Technopark B1-001 with a stair and an escalator from Samsung B1-061 up to DNS;
  galleries with shops overlook it; the media hall is double height.
The column grid is shared by both floors, so floor 2 reuses the 1st floor pavilion grid; big
1st floor stores are split into rows of pavilions above them.

Usage: python3 -I floor2.py floor1-model.json out-model.json"""
import sys, json, math
from shapely.geometry import Polygon, box, LineString, MultiPolygon
from shapely.ops import unary_union

src, out = sys.argv[1:3]
M = json.load(open(src))
H1 = 5.2  # floor-to-floor height (top of floor 2 slab)

fp = Polygon(M['footprint']).buffer(0)
MAIN_BOX = box(-120, -100, 100, 80.4)   # the main hall ends just south of its wall (z = 79)
AWING_BOX = box(-120, 80.4, -55, 160)  # the A wing block starts outside the hall wall
main = fp.intersection(MAIN_BOX)
awing = fp.intersection(AWING_BOX)
if isinstance(main, MultiPolygon):
    main = max(main.geoms, key=lambda g: g.area)
if isinstance(awing, MultiPolygon):
    awing = max(awing.geoms, key=lambda g: g.area)


def P(r):
    return Polygon(r['poly']).buffer(0)


rooms1 = M['rooms']
in_main = [r for r in rooms1 if P(r).centroid.within(main) and P(r).centroid.y < 80]
obst1 = unary_union([P(r) for r in rooms1])

# ---------------- vertical links (stairs / escalators) ----------------
NOT_LINKS = set()
links = []
for i, f in enumerate(M['flights']):
    x0, z0 = f['min']; x1, z1 = f['max']
    cx, cz = (x0 + x1) / 2, (z0 + z1) / 2
    if not Polygon([(x0, z0), (x1, z0), (x1, z1), (x0, z1)]).centroid.within(main) or cz > 79:
        continue  # A wing stairs lead to the offices above, not to the mall
    along_x = f['axis'] == 'x'
    ln = (x1 - x0) if along_x else (z1 - z0)
    wd = (z1 - z0) if along_x else (x1 - x0)
    if ln < 4.0 and wd < 4.0 and abs(cz + 26.6) < 3 and abs(cx - 4.8) < 3:
        continue  # steps of the media hall stage
    need = 9.5 if f['kind'] == 'escalator' else 8.6
    wd = max(wd, 1.6 if f['kind'] == 'escalator' else 2.0)
    best = None
    for shift in (0.0, 1.0, -1.0, 0.5, -0.5):   # extend forward, backward or both ways
        if along_x:
            a0 = x0 - (need - ln) * (0.5 - shift / 2) if shift != 1.0 else x0
            a0 = x0 - (need - ln) if shift == -1.0 else a0
            seg = (a0, a0 + need)
            rect = box(seg[0], cz - wd / 2, seg[1], cz + wd / 2)
        else:
            a0 = z0 - (need - ln) * (0.5 - shift / 2) if shift != 1.0 else z0
            a0 = z0 - (need - ln) if shift == -1.0 else a0
            seg = (a0, a0 + need)
            rect = box(cx - wd / 2, seg[0], cx + wd / 2, seg[1])
        if not rect.within(main.buffer(-0.3)):
            continue
        hit = rect.intersection(obst1).area
        # landings beyond both ends must be free on the 1st floor
        if along_x:
            l0 = box(seg[0] - 2.0, cz - wd / 2, seg[0], cz + wd / 2); l1 = box(seg[1], cz - wd / 2, seg[1] + 2.0, cz + wd / 2)
        else:
            l0 = box(cx - wd / 2, seg[0] - 2.0, cx + wd / 2, seg[0]); l1 = box(cx - wd / 2, seg[1], cx + wd / 2, seg[1] + 2.0)
        lhit = l0.intersection(obst1).area + l1.intersection(obst1).area
        score = hit * 3 + lhit
        if best is None or score < best[0]:
            best = (score, seg, rect, l0, l1)
    if best is None:
        continue
    score, seg, rect, l0, l1 = best
    # bottom = the end you can walk up to on floor 1; the landing at the top is cleared on floor 2 below
    free0 = l0.intersection(obst1).area; free1 = l1.intersection(obst1).area
    up_positive = free0 <= free1
    if along_x:
        a = [seg[0], cz] if up_positive else [seg[1], cz]
        b = [seg[1], cz] if up_positive else [seg[0], cz]
    else:
        a = [cx, seg[0]] if up_positive else [cx, seg[1]]
        b = [cx, seg[1]] if up_positive else [cx, seg[0]]
    links.append({'kind': f['kind'], 'a': [round(v, 2) for v in a], 'b': [round(v, 2) for v in b], 'w': round(wd, 2),
                  'blocked1': round(score, 1), 'src': i})

# the atrium pair in sector B: escalator + stair from Technopark (south) up to DNS (north), photo 2024-2026
for L in links:
    src_f = M['flights'][L['src']]
    cx = (src_f['min'][0] + src_f['max'][0]) / 2
    if -73 < cx < -64 and 60 < src_f['min'][1] < 64:
        L['a'] = [round(cx, 2), 70.3]; L['b'] = [round(cx, 2), 61.9]; L['atrium'] = True   # a kiosk stands at z 70.5


def link_rect(L, pad=0.0):
    (ax, az), (bx, bz) = L['a'], L['b']
    w = L['w'] / 2 + pad
    if abs(ax - bx) > abs(az - bz):
        return box(min(ax, bx), az - w, max(ax, bx), az + w)
    return box(ax - w, min(az, bz), ax + w, max(az, bz))


def top_landing(L, depth=2.4):
    (ax, az), (bx, bz) = L['a'], L['b']
    w = L['w'] / 2 + 0.4
    dx, dz = bx - ax, bz - az
    n = math.hypot(dx, dz); dx /= n; dz /= n
    ex, ez = bx + dx * depth, bz + dz * depth
    return LineString([(bx, bz), (ex, ez)]).buffer(w, cap_style=2)


def bottom_approach(L, depth=2.0):
    (ax, az), (bx, bz) = L['a'], L['b']
    n = math.hypot(bx - ax, bz - az); dx, dz = (bx - ax) / n, (bz - az) / n
    return LineString([(ax - dx * depth, az - dz * depth), (ax, az)]).buffer(L['w'] / 2 + 0.1, cap_style=2)


# a flight that would cut through a big store is that store's internal stair: drop it
links = [L for L in links if L['blocked1'] <= 15]

# every remaining flight must be reachable on floor 1: trim the pavilion corners that stand on the
# flight or in the 2 m approach in front of its bottom step (a game-level fix, noted in the README)
cut = unary_union([link_rect(L) for L in links] + [bottom_approach(L) for L in links]).buffer(0.05)
trimmed, dropped = [], []
kept_rooms = []
for r in M['rooms']:
    p = P(r)
    if r['kind'] == 'stage' or not p.intersects(cut) or p.intersection(cut).area < 0.03:
        kept_rooms.append(r); continue
    g = p.difference(cut)
    parts = [x for x in ([g] if isinstance(g, Polygon) else list(getattr(g, 'geoms', []))) if isinstance(x, Polygon)]
    if not parts or max(x.area for x in parts) < 1.5:
        dropped.append(r['codes'] or r['kind']); continue
    q = max(parts, key=lambda x: x.area).simplify(0.03)
    r['poly'] = [[round(x, 2), round(z, 2)] for x, z in list(q.exterior.coords)[:-1]]
    r['area'] = round(q.area, 1); r['trimmed'] = True
    trimmed.append(r['codes'] or r['kind'])
    kept_rooms.append(r)
M['rooms'] = rooms1 = kept_rooms
in_main = [r for r in rooms1 if P(r).centroid.within(main) and P(r).centroid.y < 80]
obst1 = unary_union([P(r) for r in rooms1])
print('trimmed for stair access:', trimmed, 'dropped:', dropped)


# ---------------- voids ----------------
V_ATRIUM = box(-72.6, 65.6, -33.2, 74.5).union(box(-72.6, 61.9, -65.0, 70.3))   # sector B light well + stair opening
stage = [r for r in rooms1 if r['kind'] == 'stage']
voids = [V_ATRIUM]
if stage:
    sx = P(stage[0]).bounds
    voids.append(box(sx[0] + 0.3, sx[1] + 0.3, sx[2] - 0.3, sx[3]))                 # media hall, double height
openings = [link_rect(L) for L in links if not L.get('atrium')]
holes = unary_union(voids + openings)

# ---------------- floor 2 rooms ----------------
DNS = box(-81.3, 40.4, -65.6, 57.4)
GALLERY_N = box(-81.3, 57.4, -65.0, 61.9)      # walkway in front of DNS at the top of the escalator
keepout = unary_union([holes.buffer(0.15), DNS, GALLERY_N] + [top_landing(L) for L in links])

pieces = []
for r in in_main:
    if r['kind'] == 'stage':
        continue
    poly = P(r)
    if r['kind'] == 'tech':
        g = poly.difference(keepout)
        if g.area > 4:
            pieces.append(('tech', r['sector'], g))
        continue
    if r['kind'] == 'store' or poly.area > 110:
        minx, minz, maxx, maxz = poly.bounds
        w, h = maxx - minx, maxz - minz
        cells = []
        if w >= h:
            rows = [(minz, maxz)] if h <= 15 else [(minz, (minz + maxz) / 2 - 1.6), ((minz + maxz) / 2 + 1.6, maxz)]
            n = max(1, round(w / 5.0))
            for k in range(n):
                for z0, z1 in rows:
                    cells.append(box(minx + k * w / n, z0, minx + (k + 1) * w / n, z1))
        else:
            cols = [(minx, maxx)] if w <= 15 else [(minx, (minx + maxx) / 2 - 1.6), ((minx + maxx) / 2 + 1.6, maxx)]
            n = max(1, round(h / 5.0))
            for k in range(n):
                for x0, x1 in cols:
                    cells.append(box(x0, minz + k * h / n, x1, minz + (k + 1) * h / n))
        for c in cells:
            g = c.intersection(poly).difference(keepout)
            if g.area > 7:
                pieces.append(('pavilion', r['sector'], g))
        continue
    g = poly.difference(keepout)
    if g.area > 2.5:
        pieces.append(('pavilion' if g.area >= 6 else 'kiosk', r['sector'], g))


def as_polys(g):
    if g.is_empty:
        return []
    if isinstance(g, Polygon):
        return [g]
    return [x for x in getattr(g, 'geoms', []) if isinstance(x, Polygon)]


rooms2 = []
for kind, sec, g in pieces:
    for p in as_polys(g.buffer(0)):
        if p.area < 2.5:
            continue
        p = p.simplify(0.05)
        rooms2.append({'sector': sec, 'kind': kind, 'poly': [[round(x, 2), round(z, 2)] for x, z in list(p.exterior.coords)[:-1]],
                       'area': round(p.area, 1), 'codes': [], 'name': ''})
rooms2.append({'sector': 'B', 'kind': 'store', 'poly': [[round(x, 2), round(z, 2)] for x, z in list(DNS.exterior.coords)[:-1]],
               'area': round(DNS.area, 1), 'codes': ['B2-182'], 'name': 'DNS', 'brand': 'dns'})

# ---------------- every stair top must open onto the corridors of floor 2 ----------------
# floor 2 pavilions copy the floor 1 grid, which can box a landing in; carve a passage from such a
# landing to the nearest corridor, trimming the floor 2 pavilions in the way
from shapely.ops import nearest_points
slab_g = main.difference(holes)


# balustrades around the light wells and stair openings (open only where you step off a flight)
rails = []
link_tops = unary_union([top_landing(L, 0.6) for L in links])
for g in as_polys(holes):
    ring = list(g.exterior.coords)
    for (x0, z0), (x1, z1) in zip(ring, ring[1:]):
        seg = LineString([(x0, z0), (x1, z1)])
        rest = seg.difference(link_tops.buffer(0.1))
        for part in ([rest] if isinstance(rest, LineString) else list(getattr(rest, 'geoms', []))):
            if part.length > 0.3:
                (a, b) = part.coords[0], part.coords[-1]
                rails.append([round(a[0], 2), round(a[1], 2), round(b[0], 2), round(b[1], 2)])
rail_geom = unary_union([LineString([(r[0], r[1]), (r[2], r[3])]) for r in rails]).buffer(0.12)


def walk_area():
    # where a player can walk comfortably on floor 2: passages at least 1 m wide (the player is 0.56 m wide)
    occ = unary_union([Polygon(r['poly']).buffer(0) for r in rooms2] + [rail_geom]).buffer(0.5)
    return slab_g.buffer(-0.8).difference(occ)


carved = []
for L in links:
    comps = as_polys(walk_area())
    if not comps:
        break
    big = max(comps, key=lambda g: g.area)
    land = top_landing(L, 1.6)
    if land.intersection(big).area > 0.5:
        continue
    p1, p2 = nearest_points(land, big)
    dx_, dz_ = p2.x - p1.x, p2.y - p1.y
    n_ = math.hypot(dx_, dz_) or 1.0
    end = (p2.x + dx_ / n_ * 1.5, p2.y + dz_ / n_ * 1.5)   # run 1.5 m into the corridor for a wide join
    corridor = LineString([(p1.x, p1.y), end]).buffer(1.25, cap_style=2).union(land.buffer(0.2))
    for r in list(rooms2):
        poly = Polygon(r['poly']).buffer(0)
        if not poly.intersects(corridor):
            continue
        parts = as_polys(poly.difference(corridor.buffer(0.05)))
        if not parts or max(p.area for p in parts) < 2.5:
            rooms2.remove(r); continue
        q = max(parts, key=lambda p: p.area).simplify(0.03)
        r['poly'] = [[round(x, 2), round(z, 2)] for x, z in list(q.exterior.coords)[:-1]]
        r['area'] = round(q.area, 1)
    carved.append((L['src'], round(n_, 1)))
print('passages carved from stair tops (flight, metres):', carved)

# placeholder numbering: B2 and G2 use 1xx (B2-110, B2-182 and G2-103 are real), the others start at 001;
# real numbers are kept free for the pavilions they belong to
REAL = {'B2-110', 'B2-182', 'G2-103', 'C2-012A', 'C2-008A', 'E2-022', 'H2-010G'}
by_sec = {}
for r in rooms2:
    if r['kind'] == 'tech' or r['codes']:
        continue
    by_sec.setdefault(r['sector'], []).append(r)
for sec, rs in by_sec.items():
    rs.sort(key=lambda r: (round(Polygon(r['poly']).centroid.y / 6), Polygon(r['poly']).centroid.x))
    n = 101 if sec in ('B', 'G') else 1
    for r in rs:
        while f'{sec}2-{n:03d}' in REAL:
            n += 1
        r['codes'] = [f'{sec}2-{n:03d}']; n += 1


def nearest(sec, x, z, pred=lambda r: True):
    best = None
    for r in rooms2:
        if r['sector'] != sec or r['kind'] == 'tech' or not pred(r):
            continue
        c = Polygon(r['poly']).centroid
        d = math.hypot(c.x - x, c.y - z)
        if best is None or d < best[0]:
            best = (d, r)
    return best[1] if best else None


def set_code(r, code, name='', brand=None):
    for o in rooms2:   # keep codes unique
        if o is not r and code in o['codes']:
            o['codes'] = [c + 'x' if c == code else c for c in o['codes']]
    r['codes'] = [code]; r['name'] = name
    if brand:
        r['brand'] = brand


# gallery across the light well (south side, above Technopark): from the 2026 photo, west to east:
# MELOMAN ... CHASY, MUZYKA KLASSIKA, GARMIN B2-110
south = lambda r: Polygon(r['poly']).centroid.y > 74.4
gal = [r for r in rooms2 if r['sector'] in 'BC' and r['kind'] != 'tech' and south(r) and -66 < Polygon(r['poly']).centroid.x < -30]
gal.sort(key=lambda r: Polygon(r['poly']).centroid.x)
if gal:
    set_code(gal[-1], 'B2-110', 'GARMIN', 'garmin')
    if len(gal) > 1: set_code(gal[-2], 'B2-109', 'МУЗЫКА · КЛАССИКА', 'music')
    if len(gal) > 2: set_code(gal[-3], 'B2-108', 'ЧАСЫ', 'watches')
    if len(gal) > 3: set_code(gal[0], 'B2-104', 'МЕЛОМАН', 'meloman')
r = nearest('C', 10, 30)
if r: set_code(r, 'C2-012A', 'Master Mobile')
r = nearest('C', 4, 30, lambda x: 'C2-012A' not in x['codes'])
if r: set_code(r, 'C2-008A', 'Ремонт телефонов')
r = nearest('E', 50, 0)
if r: set_code(r, 'E2-022', 'ГаджетКлик')
r = nearest('H', -50, -45)
if r: set_code(r, 'H2-010G', 'DJI · GoPro · Insta360')

# the owner's pavilion G2-103 (number told by the owner; the place is a guess until they describe it):
# by the numbering it sits above G1-003, so take the cell over G1-003 that faces the main corridor of sector G
OWNER = 'G2-103'
g1_003 = next((P(r) for r in rooms1 if 'G1-003' in r['codes']), None)
cands = [r for r in rooms2 if r['sector'] == 'G' and r['kind'] != 'tech' and g1_003 is not None and Polygon(r['poly']).centroid.within(g1_003)]
if cands:
    r = max(cands, key=lambda r: Polygon(r['poly']).centroid.x)
    set_code(r, OWNER, 'Мой павильон')
    r['mine'] = True
    M['player'] = {'pavilion': OWNER}
    print('owner pavilion', OWNER, 'at', [round(v, 1) for v in Polygon(r['poly']).bounds], 'area', r['area'])

# themes from the poster legend
THEME = {'B': 'все диски', 'C': 'все диски', 'G': 'все диски', 'D': 'сервисная зона',
         'E': 'компьютеры', 'F': 'компьютеры', 'H': 'компьютеры'}   # word for word from the legend of the floor 1 poster
for r in rooms2:
    r['theme'] = THEME.get(r['sector'], '')

# ---------------- slab, balustrades ----------------
slab = main.difference(holes)
slab_polys = []
for p in as_polys(slab):
    slab_polys.append({'poly': [[round(x, 2), round(z, 2)] for x, z in list(p.exterior.coords)[:-1]],
                       'holes': [[[round(x, 2), round(z, 2)] for x, z in list(h.coords)[:-1]] for h in p.interiors]})
M['floor2'] = {
    'note': 'Реконструкция: официальной схемы 2 этажа нет в открытом доступе',
    'height': H1,
    'rooms': rooms2,
    'slab': slab_polys,
    'voids': [[[round(x, 2), round(z, 2)] for x, z in list(v.exterior.coords)[:-1]] for v in as_polys(unary_union(voids))],
    'rails': rails,
}
M['links'] = links
M['volumes'] = {
    'main': [[round(x, 2), round(z, 2)] for x, z in list(main.exterior.coords)[:-1]],
    'awing': [[round(x, 2), round(z, 2)] for x, z in list(awing.exterior.coords)[:-1]],
}
json.dump(M, open(out, 'w'), ensure_ascii=False, separators=(',', ':'))
from collections import Counter
print('links', len(links), Counter(l['kind'] for l in links), 'blocked', [l['blocked1'] for l in links])
print('floor2 rooms', len(rooms2), Counter(r['sector'] for r in rooms2), Counter(r['kind'] for r in rooms2))
print('slab parts', len(slab_polys), 'holes', sum(len(s['holes']) for s in slab_polys), 'rails', len(rails))
print('named', [(r['codes'], r['name']) for r in rooms2 if r['name']])
