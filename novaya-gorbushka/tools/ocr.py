"""OCR the white labels inside every coloured region of the scheme.
Pass 1 (rus+eng) reads names; pass 2 (digits/letters whitelist) reads pavilion codes.
The sector letter of a code is taken from the region colour, OCR gives the number;
K1-/M1- prefixes (kiosks, mezzanine) are kept as read.
Usage: python3 -I ocr.py scheme.png regions.json out.json"""
import sys, json, re, subprocess, os, tempfile
import numpy as np
import cv2
from scipy import ndimage as ndi
from concurrent.futures import ThreadPoolExecutor

src, reg_json, out_json = sys.argv[1:4]
img = cv2.imread(src, cv2.IMREAD_COLOR)[:, :, ::-1].astype(np.int16)
R = json.load(open(reg_json))
tmpdir = tempfile.mkdtemp(prefix='ocr_', dir=os.path.dirname(os.path.abspath(out_json)))
ENV = dict(os.environ, OMP_THREAD_LIMIT='1')
SUFFIX = str.maketrans('АВСЕНКМОРТХ', 'ABCEHKMOPTX')


def tess(path, psm, lang, extra=()):
    try:
        out = subprocess.run(['tesseract', path, 'stdout', '-l', lang, '--psm', str(psm), *extra],
                             capture_output=True, text=True, timeout=40, env=ENV)
        return out.stdout
    except subprocess.TimeoutExpired:
        return ''


def glyph_mask(r):
    x0, y0, x1, y1 = r['bbox']
    pad = 2
    ox, oy = max(0, x0 - pad), max(0, y0 - pad)
    crop = img[oy:y1 + pad, ox:x1 + pad]
    poly = np.array(r['poly'], np.int32) - [ox, oy]
    inside = np.zeros(crop.shape[:2], np.uint8)
    cv2.fillPoly(inside, [poly], 1)
    inside = cv2.erode(inside, np.ones((3, 3), np.uint8))
    white = (crop.sum(axis=2) > 560) & (inside > 0)
    lab, n = ndi.label(white, structure=np.ones((3, 3)))
    keep = np.zeros_like(white)
    for j, sl in enumerate(ndi.find_objects(lab), start=1):
        if sl is None:
            continue
        hh = sl[0].stop - sl[0].start; ww = sl[1].stop - sl[1].start
        if max(hh, ww) <= 34 and min(hh, ww) >= 2:
            keep[sl] |= lab[sl] == j
    if keep.sum() < 25:
        return None, None
    ys, xs = np.nonzero(keep)
    ty0, tx0 = max(0, ys.min() - 4), max(0, xs.min() - 4)
    m = keep[ty0:ys.max() + 5, tx0:xs.max() + 5]
    return m, (int(ox + tx0), int(oy + ty0))


CODE_RX = re.compile(r'(?:([A-HKMАВСЕНКМ])\s?)?[1I]\s?[-–]?\s?([0-9]{3})(?![0-9])\s?([A-ZА-Я]?)(?![A-ZА-Я0-9])')


def parse_codes(t):
    """(prefix letter or '', number, suffix) for every code-looking token."""
    out = []
    txt = re.sub(r'-\s*\n\s*', '-', t.upper())
    for line in txt.splitlines():
        line = line.replace('O', '0').replace('О', '0')
        for pre, num, suf in CODE_RX.findall(line):
            out.append((pre.translate(SUFFIX), num, suf))
    return out


def ocr_region(idx):
    r = R['regions'][idx]
    if r['key'] == 'park':
        return idx, None
    m, origin = glyph_mask(r)
    if m is None:
        return idx, {'text': '', 'codes': []}
    bw = np.where(m, 0, 255).astype(np.uint8)
    bw = cv2.resize(bw, None, fx=4, fy=4, interpolation=cv2.INTER_CUBIC)
    bw = cv2.copyMakeBorder(bw, 30, 30, 30, 30, cv2.BORDER_CONSTANT, value=255)
    h, w = bw.shape
    rots = [0, 90, 270] if h > 1.4 * w else [0]
    best = None
    for rot in rots:
        im = bw if rot == 0 else np.ascontiguousarray(np.rot90(bw, 1 if rot == 90 else 3))
        p = os.path.join(tmpdir, f'r{idx}_{rot}.png')
        cv2.imwrite(p, im)
        t_code = tess(p, 6, 'eng', ['-c', 'tessedit_char_whitelist=ABCDEFGHKMY0123456789-,'])
        nums = parse_codes(t_code)
        t_full = tess(p, 6, 'rus+eng')
        nums_full = parse_codes(t_full)
        words = re.findall(r'[A-Za-zА-Яа-яЁё]{3,}', t_full)
        strong = sum(1 for pre, _, _ in nums + nums_full if pre)
        junk = len(re.findall(r'[^\w\s\-,.«»&]', t_full))
        score = strong * 30 + (len(nums) + len(nums_full)) * 10 + len(words) * 2 - junk
        if best is None or score > best[0]:
            best = (score, rot, t_full, t_code, nums, nums_full)
    _, rot, t_full, t_code, nums, nums_full = best
    lines = [re.sub(r'\s+', ' ', l).strip() for l in t_full.splitlines() if l.strip()]
    key = r['key']
    codes = []
    if key in 'ABCDEFGH':
        src_nums = nums if nums else nums_full
        sufs_full = {n: x for _, n, x in nums_full}
        pres_full = {n: p for p, n, _ in nums_full}
        for pre, num, suf in src_nums:
            pre = pre or pres_full.get(num, '')
            sx = (suf or sufs_full.get(num, '')).translate(SUFFIX)
            code = f'{pre}1-{num}{sx}' if pre in ('K', 'M') else f'{key}1-{num}{sx}'
            if code not in codes:
                codes.append(code)
    return idx, {'text': ' | '.join(lines), 'code_raw': ' | '.join(l.strip() for l in t_code.splitlines() if l.strip()),
                 'codes': codes, 'rot': rot, 'text_origin': origin, 'text_size': [int(m.shape[1]), int(m.shape[0])]}


with ThreadPoolExecutor(max_workers=6) as ex:
    res = dict(ex.map(ocr_region, range(len(R['regions']))))
for i, r in enumerate(R['regions']):
    r['ocr'] = res.get(i)
json.dump(R, open(out_json, 'w'), ensure_ascii=False)
n_codes = sum(1 for r in R['regions'] if r.get('ocr') and r['ocr']['codes'])
print('regions with codes', n_codes, 'of', len(R['regions']))
