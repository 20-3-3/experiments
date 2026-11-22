"""Assemble the digitised 1st floor of Gorbushkin Dvor into one model file (metres).
Usage: python3 -I assemble.py <ng dir> out_model.json check_overlay.png"""
import sys, json, re, math
import numpy as np
import cv2
from scipy import ndimage as ndi

D, out_json, out_png = sys.argv[1:4]
img = cv2.imread(f'{D}/floor1.png', cv2.IMREAD_COLOR)[:, :, ::-1].astype(np.int16)
R = json.load(open(f'{D}/regions_ocr.json'))
W = json.load(open(f'{D}/walls.json'))
wall_mask = np.load(f'{D}/walls_mask.npy')
arrows = json.load(open(f'{D}/arrows.json'))
icons = json.load(open(f'{D}/icons.json'))
flights = json.load(open(f'{D}/flights.json'))

S = 0.085            # metres per scheme pixel
CX, CY = 1400, 1820  # scheme pixel that becomes the world origin


def w(p):
    return [round((p[0] - CX) * S, 2), round((p[1] - CY) * S, 2)]


outline = None  # computed from the cleaned wall mask further below


def inside_building(x, y):
    # main block + A wing; everything outside these boxes is street, parking or poster frame
    main = 380 <= x <= 2440 and 860 <= y <= 2770
    wing = 300 <= x <= 650 and 2700 <= y <= 3525
    tail = 640 <= x <= 1120 and 3380 <= y <= 3525   # small annex next to the A wing exit
    return main or wing or tail


def centroid(poly):
    a = np.array(poly, float)
    return a[:, 0].mean(), a[:, 1].mean()


# ---------- manual additions ----------
flights += [
    {'box': [426, 1095, 463, 1165], 'axis': 'x', 'kind': 'stairs', 'manual': True},
    {'box': [1433, 1488, 1479, 1526], 'axis': 'y', 'kind': 'stairs', 'manual': True},
    {'box': [1655, 2435, 1696, 2488], 'axis': 'y', 'kind': 'stairs', 'manual': True},
]
BADGES = {'H': (648, 1122), 'G': (672, 1804), 'F': (1290, 1783), 'E': (2191, 1806),
          'D': (2204, 2382), 'C': (1456, 2690), 'B': (595, 2671), 'A': (425, 3156)}
EXTRA_DOORS = [  # gray arrows under the A wing and the service entrance
    {'x': 469, 'y': 3478, 'dir': [0, -1], 'kind': 'entrance'},
    {'x': 575, 'y': 3478, 'dir': [0, -1], 'kind': 'entrance'},
    {'x': 1545, 'y': 1519, 'dir': [-1, 0], 'kind': 'service'},
]
SECTOR_COLORS = {'A': '#9999cc', 'B': '#00b1e3', 'C': '#009846', 'D': '#dcd527', 'E': '#8d599f',
                 'F': '#f3c12d', 'G': '#f39314', 'H': '#e11e24'}

# ---------- pavilions / rooms ----------
JUNK = re.compile(r'[^A-Za-zА-Яа-яЁё0-9 \-«»&.,]')


def name_from_text(t, codes):
    names = []
    for line in t.split(' | '):
        line = line.strip()
        if not line or re.search(r'[0-9]{3}', line):
            continue
        letters = re.findall(r'[A-Za-zА-Яа-яЁё]', line)
        if len(letters) < 3 or len(JUNK.findall(line)) > 1 or len(letters) < 0.7 * len(line.replace(' ', '')):
            continue
        names.append(line)
    return ' '.join(names)[:40]


import difflib
KNOWN_NAMES = ['ПЕРЕКРЕСТОК', 'SAMSUNG', 'SKYLINK', 'МТС', 'БЫТОВАЯ ТЕХНИКА', 'АЛЬФАБАНК', 'MIELE', 'СВЯЗНОЙ',
               'ТЕХНОПАРК', 'Park-BT', 'ZIGMUND & SHTAIN', 'PHILIPS', 'Yota', 'HANSA', 'ГАЛЕРЕЯ ЗВУКА', 'РЕЗОНАНС',
               'MARANTZ', 'AV-SOLO', 'РЕЗОНАНС-PRO', 'ГУД МУД БУФЕТ', 'ЕВРОСЕТЬ', 'MAXVIDEO', 'KARCHER', 'PIONEER',
               'YAMAGUCHI', 'МАССАЖНОЕ ОБОРУДОВАНИЕ', 'ЕВРОДОМ', 'ОНЛАЙН ФОТО', 'PLAY OFF', 'SHARP', 'SONY', 'BORK',
               'US MEDICA', 'TELESTUDIA', 'МЯГКАЯ МЕБЕЛЬ', 'БУФЕТ', 'MAX VIDEO', 'ТЕХНИЧЕСКОЕ ПОМЕЩЕНИЕ']
FIX_CODES = {'G1-401': 'G1-001', 'A1-413': 'A1-013', 'F1-605A': 'F1-005A', 'C1-880': 'C1-089', 'C1-989': None}


def clean_name(raw):
    out = []
    for part in re.split(r'\s{2,}|(?<=[a-zа-я])\s(?=[A-ZА-Я]{3,})', raw):
        part = part.strip()
        if not part:
            continue
        m = difflib.get_close_matches(part.upper(), [k.upper() for k in KNOWN_NAMES], n=1, cutoff=0.6)
        if m:
            nm = KNOWN_NAMES[[k.upper() for k in KNOWN_NAMES].index(m[0])]
            if nm not in out:
                out.append(nm)
    if not out:
        # try the whole string against combined names (e.g. 'YAMAGUCHI МАССАЖНОЕ ОБОРУДОВАНИЕ')
        for k in KNOWN_NAMES:
            if k.upper() in raw.upper() and k not in out:
                out.append(k)
    return ' · '.join(out)


MANUAL_NAMES = [  # (sector, x0, y0, x1, y1 of the region bbox centre area, name, kind)
    ('H', 1000, 1160, 1110, 1420, 'КАФЕ «ПО ЩУЧЬЕМУ ВЕЛЕНИЮ»', 'cafe'),
    ('C', 1140, 2280, 1230, 2500, 'КАФЕ «КОРМУШКА»', 'cafe'),
    ('H', 1030, 1130, 1500, 1420, 'МЕДИА ХОЛЛ', 'stage'),
]

rooms = []
for r in R['regions']:
    key = r['key']
    cx, cy = centroid(r['poly'])
    if key == 'park':
        continue
    if not inside_building(cx, cy):
        continue
    area_m2 = r['area'] * S * S
    o = r.get('ocr') or {}
    codes = []
    for c in (o.get('codes') or []):
        c2 = FIX_CODES.get(c, c)
        if c2 and c2 not in codes:
            codes.append(c2)
    name = clean_name(name_from_text(o.get('text', ''), codes))
    if key == 'tech':
        kind = 'tech'
    elif area_m2 > 110:
        kind = 'store'
    elif area_m2 < 6:
        kind = 'kiosk'
    else:
        kind = 'pavilion'
    x0, y0, x1, y1 = r['bbox']
    for sec, mx0, my0, mx1, my1, mname, mkind in MANUAL_NAMES:
        if key == sec and mx0 <= x0 and x1 <= mx1 and my0 <= y0 and y1 <= my1:
            if mkind == 'stage' and (x1 - x0) < 250:
                continue
            if mkind == 'cafe' and not 50 <= (x1 - x0) <= 120:
                continue
            name, kind = mname, mkind
            break
    if kind == 'tech':
        name = 'Техническое помещение'
    rooms.append({'sector': key, 'kind': kind, 'codes': codes, 'name': name,
                  'area': round(area_m2, 1), 'poly': [w(p) for p in r['poly']]})

# ---------- walls ----------
lab, n = ndi.label(wall_mask, structure=np.ones((3, 3)))
objs = ndi.find_objects(lab)
long_ids = set()
for i, sl in enumerate(objs, start=1):
    if sl is None:
        continue
    if max(sl[0].stop - sl[0].start, sl[1].stop - sl[1].start) > 120:
        long_ids.add(i)
long_mask = np.isin(lab, list(long_ids))
near_long = cv2.dilate(long_mask.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (81, 81))) > 0
blocked = np.zeros(wall_mask.shape, bool)
for f in flights:
    x0, y0, x1, y1 = f['box']; blocked[y0 - 4:y1 + 4, x0 - 4:x1 + 4] = True
for a in arrows:
    blocked[a['y'] - 24:a['y'] + 24, a['x'] - 24:a['x'] + 24] = True
for ic in icons:
    s = ic['size'] // 2 + 3; blocked[ic['y'] - s:ic['y'] + s, ic['x'] - s:ic['x'] + s] = True
walls = []
keep_mask = np.zeros(wall_mask.shape, np.uint8)
for i, sl in enumerate(objs, start=1):
    if sl is None:
        continue
    comp = lab[sl] == i
    is_long = i in long_ids
    if not is_long:
        hh = sl[0].stop - sl[0].start; ww = sl[1].stop - sl[1].start
        if 60 <= hh <= 125 and 60 <= ww <= 125:
            continue   # sector badge ring, not a wall
        if not near_long[sl][comp].any() or blocked[sl][comp].mean() > 0.3:
            continue
        cy0 = sl[0].start; cx0 = sl[1].start
        if not inside_building(cx0, cy0) and max(comp.shape) < 30 and False:
            continue
    keep_mask[sl][comp] = 1
# footprint: close the door gaps of the cleaned walls, flood the street, keep what is enclosed
PX0, PY0, PX1, PY1 = R['plan']
closed = cv2.dilate(keep_mask, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (121, 121))) > 0
free = ~closed
free[:PY0] = False; free[PY1:] = False; free[:, :PX0] = False; free[:, PX1:] = False
labf, nf = ndi.label(free)
outside = labf == labf[PY0 + 5, PX0 + 5]
core = ~outside & ~closed
core[:PY0] = False; core[PY1:] = False; core[:, :PX0] = False; core[:, PX1:] = False
labc, nc = ndi.label(core)
sizes = ndi.sum(core, labc, range(1, nc + 1))
core = np.isin(labc, [i + 1 for i, sz in enumerate(sizes) if sz > 100000])
inside_mask = cv2.dilate(core.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (121, 121)))
fcs, _ = cv2.findContours(inside_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
fc = max(fcs, key=cv2.contourArea)
outline = cv2.approxPolyDP(fc, 4, True)[:, 0, :]
print('footprint area m2', round(cv2.contourArea(fc) * S * S), 'pts', len(outline))

cs, hier = cv2.findContours(keep_mask, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
if hier is not None:
    hier = hier[0]
    for ci, c in enumerate(cs):
        if hier[ci][3] != -1:
            continue  # holes are attached to their parent below
        if cv2.contourArea(c) < 40:
            continue
        outer = cv2.approxPolyDP(c, 1.3, True)[:, 0, :]
        holes = []
        ch = hier[ci][2]
        while ch != -1:
            if cv2.contourArea(cs[ch]) > 30:
                holes.append([w(p) for p in cv2.approxPolyDP(cs[ch], 1.3, True)[:, 0, :]])
            ch = hier[ch][0]
        walls.append({'poly': [w(p) for p in outer], 'holes': holes})

# ---------- doors, icons, flights, badges ----------
doors = [{'pos': w((a['x'], a['y'])), 'dir': a['dir'], 'kind': 'entrance'} for a in arrows]
doors += [{'pos': w((d['x'], d['y'])), 'dir': d['dir'], 'kind': d['kind']} for d in EXTRA_DOORS]
icons_w = [{'type': ic['type'], 'pos': w((ic['x'], ic['y']))} for ic in icons]
flights_w = [{'kind': f['kind'], 'axis': f['axis'], 'min': w(f['box'][:2]), 'max': w(f['box'][2:])} for f in flights]
badges = [{'sector': k, 'pos': w(p), 'color': SECTOR_COLORS[k]} for k, p in BADGES.items()]

# ---------- exterior ----------
park_lots, cars = [], []
for r in R['regions']:
    if r['key'] != 'park':
        continue
    if r['area'] > 50000:
        park_lots.append([w(p) for p in r['poly']])
    elif 1000 < r['area'] < 3500:
        cx, cy = centroid(r['poly'])
        # orientation of the car icon: principal axis of its polygon
        a = np.array(r['poly'], float); a -= a.mean(0)
        cov = a.T @ a
        ev, evec = np.linalg.eigh(cov)
        ang = math.atan2(evec[1, 1], evec[0, 1])
        cars.append({'pos': w((cx, cy)), 'angle': round(ang, 2)})


def mask_poly(col, tol, box, min_area):
    m = (np.abs(img - np.array(col)).sum(axis=2) < tol)
    sub = np.zeros_like(m); x0, y0, x1, y1 = box; sub[y0:y1, x0:x1] = m[y0:y1, x0:x1]
    sub = ndi.binary_closing(sub, iterations=3)
    cs, _ = cv2.findContours(sub.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    return [[w(p) for p in cv2.approxPolyDP(c, 6, True)[:, 0, :]] for c in cs if cv2.contourArea(c) > min_area]


roads = []
roads += [{'name': 'Багратионовский проезд', 'poly': p} for p in mask_poly((235, 236, 236), 8, (100, 640, 230, 3530), 20000)]
roads += [{'name': 'проезд к паркингу', 'poly': p} for p in mask_poly((235, 236, 236), 8, (1680, 640, 2712, 3300), 20000)]
roads.append({'name': 'улица Барклая', 'poly': [w(p) for p in [(914, 3341), (2423, 2933), (2423, 3060), (914, 3468)]]})
exterior = {
    'parking': [{'name': 'Паркинг 2' if i == 0 else 'Паркинг', 'poly': p} for i, p in enumerate(park_lots)],
    'cars': cars, 'roads': roads,
    'veranda': [w(p) for p in [(780, 2818), (1182, 2818), (1182, 3096), (780, 3096)]],
    'metro': w((159, 3538)),
    'parking_lift': [w((2023, 727)), w((2104, 833))],
    'labels': [
        {'text': 'ПАРКИНГ 2', 'pos': w((1275, 745))},
        {'text': 'ПАРКИНГ 1', 'pos': w((2603, 1830))},
        {'text': 'ЛЕТНЯЯ ВЕРАНДА', 'pos': w((981, 2957))},
        {'text': 'БАГРАТИОНОВСКИЙ ПРОЕЗД', 'pos': w((165, 2100))},
        {'text': 'УЛИЦА БАРКЛАЯ', 'pos': w((1300, 3330))},
        {'text': 'МЕДИА ХОЛЛ', 'pos': w((1320, 1245))},
    ],
}

model = {
    'name': 'Горбушкин Двор, 1 этаж', 'source': 'Официальная схема 1 этажа (gorbushkin.ru), оцифровка',
    'scale_m_per_px': S, 'origin_px': [CX, CY],
    'footprint': [w(p) for p in outline],
    'rooms': rooms, 'walls': walls, 'doors': doors, 'icons': icons_w, 'flights': flights_w,
    'badges': badges, 'exterior': exterior,
}
json.dump(model, open(out_json, 'w'), ensure_ascii=False, separators=(',', ':'))

# ---------- check overlay: codes drawn on the scheme ----------
ov = (img[:, :, ::-1] * 0.45 + 140).astype(np.uint8).copy()
cv2.drawContours(ov, [np.array(c) for c in []], -1, (0, 0, 0), 1)
ov[keep_mask > 0] = (0, 0, 0)
font = cv2.FONT_HERSHEY_SIMPLEX
for r in R['regions']:
    if r['key'] == 'park':
        continue
    cx, cy = centroid(r['poly'])
    if not inside_building(cx, cy):
        continue
    cv2.polylines(ov, [np.array(r['poly'], np.int32)], True, (90, 90, 90), 2)
    o = r.get('ocr') or {}
    t = ','.join(c.split('-')[1] for c in (o.get('codes') or []))
    if t:
        cv2.putText(ov, t, (int(cx) - 22, int(cy) + 8), font, 0.7, (0, 0, 200), 2)
cv2.imwrite(out_png, ov)
from collections import Counter
print('rooms', len(rooms), Counter(r['kind'] for r in rooms), 'walls', len(walls), 'doors', len(doors),
      'icons', len(icons_w), 'flights', len(flights_w), 'cars', len(cars), 'roads', len(roads), 'lots', len(park_lots))
print('rooms with codes', sum(1 for r in rooms if r['codes']), 'named', sum(1 for r in rooms if r['name']))
