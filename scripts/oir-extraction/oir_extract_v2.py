#!/usr/bin/env python3
"""
Deterministic OIR extractor (v2) — NO LLM in the correctness path.

Source PDF: 20-OIR-Test-Practice-Sets-SSBCrack (20 sets x 50 questions).
The PDF text layer is the source of truth: question text, the answer key, and the
REAL human-written explanations all extract deterministically. Figures are mapped
to questions by vertical position and rebuilt by compositing the CLEAN embedded
images onto a white canvas (the page-render watermark is never baked in).

Pipeline:
  text layer -> questions (text + options)              [Stage 1]
  text layer -> answers + REAL explanations             [Stage 2]
  geometry   -> one whole-figure crop per question      [Stage 3] (watermark-free)
  deterministic answer mapping                          [Stage 4]
  emit batch JSON + human-review HTML preview           [Stage 6]

Figure model: crop the whole diagram region (stem + the numbered 1-5 choices baked
in) as ONE image; options are plain text "1".."5" / Yes/No.

Usage:
  python3 oir_extract_v2.py --set 1          # one set
  python3 oir_extract_v2.py --all            # all 20 sets
  python3 oir_extract_v2.py --set 3 --pdf /path/to/the.pdf

Outputs (per set) under ./out/ :
  batch_pdf_{NNN}.json, batch_pdf_{NNN}_preview.html, images/set{N}_q{MM}.png
The questionImageUrl placeholder gs://BUCKET/... is rewritten by upload-oir-batch.js.
"""

import os, re, json, html, argparse
import fitz  # PyMuPDF
from PIL import Image

# ---------------------------------------------------------------- static config
HERE         = os.path.dirname(os.path.abspath(__file__))
DEFAULT_PDF  = "/Users/sunil/Desktop/OIR Tests/20-OIR-Test-Practice-Sets-SSBCrack (2).pdf"
OUT_ROOT     = os.path.join(HERE, "out")
IMG_DIR      = os.path.join(OUT_ROOT, "images")
STORAGE_BASE = "gs://BUCKET/oir/pdf_questions"   # rewritten at upload time
ZOOM         = 3.0
OPT_IDS      = ["opt_a", "opt_b", "opt_c", "opt_d", "opt_e", "opt_f"]

# Per-set page ranges (1-indexed). (q_start, a_start, a_end):
#   QUESTION_PAGES = q_start .. a_start  (incl. first answer page; trailing Qs sit
#                    atop it, before the 'ANSWERS AND EXPLANATIONS' marker)
#   ANSWER_PAGES   = a_start .. a_end
SET_TABLE = {
    1:  (9, 18, 22),    2:  (23, 32, 36),   3:  (37, 45, 49),   4:  (50, 58, 62),
    5:  (63, 71, 75),   6:  (76, 84, 88),   7:  (89, 96, 100),  8:  (101, 109, 112),
    9:  (113, 120, 124),10: (125, 133, 137),11: (138, 147, 151),12: (152, 160, 164),
    13: (165, 173, 177),14: (178, 186, 190),15: (191, 199, 203),16: (204, 212, 216),
    17: (217, 225, 228),18: (229, 238, 241),19: (242, 250, 254),20: (255, 263, 266),
}

# ---------------------------------------------------------------- per-run config (set by configure)
PDF_PATH = DEFAULT_PDF
QUESTION_PAGES = []
ANSWER_PAGES = []
BATCH_ID = ""
IMG_PREFIX = ""
SET_NUM = 0
EXPECTED_Q = 50


def configure(set_num, pdf_path):
    global PDF_PATH, QUESTION_PAGES, ANSWER_PAGES, BATCH_ID, IMG_PREFIX, SET_NUM
    q_start, a_start, a_end = SET_TABLE[set_num]
    PDF_PATH = pdf_path
    QUESTION_PAGES = list(range(q_start, a_start + 1))
    ANSWER_PAGES = list(range(a_start, a_end + 1))
    BATCH_ID = f"batch_pdf_{set_num:03d}"
    IMG_PREFIX = f"set{set_num}"
    SET_NUM = set_num

# ---------------------------------------------------------------- helpers
HEADER_FOOTER = re.compile(
    r"(OIR TEST\s*-\s*PRACTICE|shop\.ssbcrack\.com|^\s*\d+\s*\|\s*P\s*a\s*g\s*e|OIR - SET)",
    re.IGNORECASE,
)
MARKER_RE   = re.compile(r"^\s*(\d{1,2})[.)]\s*(.*)$")
ANSWERS_HDR = "ANSWERS AND EXPLANATIONS"


def is_noise(text: str) -> bool:
    return HEADER_FOOTER.search(text) is not None


def line_text(line) -> str:
    return "".join(s["text"] for s in line["spans"]).strip()


def page_lines(page):
    """Return [(y_top, text)] in reading order, header/footer stripped."""
    out = []
    for b in page.get_text("dict")["blocks"]:
        if "lines" not in b:
            continue
        for ln in b["lines"]:
            t = line_text(ln)
            if t and not is_noise(t):
                out.append((ln["bbox"][1], t))
    out.sort(key=lambda r: r[0])
    return out


def page_images(page):
    """Return [(center_y, fitz.Rect, xref)] for embedded raster images on the page.
    Images with no placement rect (e.g. the watermark logo) are skipped."""
    out = []
    seen = set()
    for img in page.get_images(full=True):
        xref = img[0]
        for r in page.get_image_rects(xref):
            key = (round(r.y0), round(r.y1), round(r.x0))
            if key in seen:
                continue
            seen.add(key)
            out.append(((r.y0 + r.y1) / 2, r, xref))
    out.sort(key=lambda r: r[0])
    return out


def extract_clean(doc, xref):
    """Return a watermark-free RGB PIL image for an embedded image xref."""
    pix = fitz.Pixmap(doc, xref)
    if pix.alpha or pix.n > 3:
        pix = fitz.Pixmap(fitz.csRGB, pix)
    return Image.frombytes("RGB", [pix.width, pix.height], pix.samples)


# ---------------------------------------------------------------- Stage 1: questions
def collect_markers(doc):
    """Walk QUESTION_PAGES in reading order, emit one record per question marker.
    Sequential validation (expected = last+1) rejects false positives such as the
    digit-sequence line in Q28. Stops at 'ANSWERS AND EXPLANATIONS'."""
    markers = []
    expected = 1
    for pno in QUESTION_PAGES:
        pidx = pno - 1
        for y, t in page_lines(doc[pidx]):
            if t.startswith(ANSWERS_HDR):
                return markers
            m = MARKER_RE.match(t)
            if m and int(m.group(1)) == expected:
                markers.append({"q": expected, "page_idx": pidx, "y": y,
                                "head": m.group(2).strip(), "body_lines": []})
                expected += 1
    return markers


def gpos(page_idx, y):
    return (page_idx, y)


def attach_body_lines(doc, markers):
    """Assign every non-marker line to the question it falls under (global order)."""
    mpos = [(gpos(mk["page_idx"], mk["y"]), idx) for idx, mk in enumerate(markers)]
    for pno in QUESTION_PAGES:
        pidx = pno - 1
        stop = False
        for y, t in page_lines(doc[pidx]):
            if t.startswith(ANSWERS_HDR):
                stop = True
                break
            mm = MARKER_RE.match(t)
            if mm and any(mk["q"] == int(mm.group(1)) and mk["page_idx"] == pidx
                          and abs(mk["y"] - y) < 1 for mk in markers):
                continue  # this is a real marker line; head already captured
            owner = _owner(mpos, gpos(pidx, y))
            if owner is not None:
                markers[owner]["body_lines"].append((y, t))
        if stop:
            break


def _owner(mpos, p):
    owner = None
    for pos, idx in mpos:
        if pos <= p:
            owner = idx
        else:
            break
    return owner


YESNO_RE = re.compile(r"[‘'\"]?\s*Yes\s*[’'\"]?\s*or\s*[‘'\"]?\s*No", re.IGNORECASE)
OPT_TOKEN_RE = re.compile(r"\((\d)\)\s*")


def parse_options(full_text):
    """Returns (question_text, options[{"text"}]). Handles inline '(1) a (2) b ...'
    and Yes/No. Returns [] options for free-answer / pure-figure questions."""
    nums = [int(n) for n in OPT_TOKEN_RE.findall(full_text)]
    if nums and nums == list(range(1, len(nums) + 1)) and len(nums) >= 2:
        parts = OPT_TOKEN_RE.split(full_text)  # [pre, '1', seg1, '2', seg2, ...]
        qtext = parts[0].strip()
        opts = []
        for i in range(1, len(parts), 2):
            seg = parts[i + 1] if i + 1 < len(parts) else ""
            opts.append({"text": seg.strip().strip(".").strip()})
        return _clean(qtext), opts
    if YESNO_RE.search(full_text):
        return _clean(full_text), [{"text": "Yes"}, {"text": "No"}]
    return _clean(full_text), []


def _clean(s):
    return re.sub(r"\s+", " ", s).strip()


def build_question(mk):
    body = " ".join(t for _, t in mk["body_lines"])
    full = (mk["head"] + " " + body).strip()
    return parse_options(full)


# ---------------------------------------------------------------- Stage 3: figure crops
def assign_images(doc, markers):
    """Return {marker_index: [(page_idx, rect, xref), ...]} via global reading order."""
    mpos = [(gpos(mk["page_idx"], mk["y"]), idx) for idx, mk in enumerate(markers)]
    assigned = {i: [] for i in range(len(markers))}
    for pno in QUESTION_PAGES:
        pidx = pno - 1
        ans_y = None
        for y, t in page_lines(doc[pidx]):
            if t.startswith(ANSWERS_HDR):
                ans_y = y
                break
        for cy, rect, xref in page_images(doc[pidx]):
            if ans_y is not None and cy > ans_y:
                continue
            owner = _owner(mpos, gpos(pidx, cy))
            if owner is None:
                owner = 0  # image above the very first marker = stem of Q1
            assigned[owner].append((pidx, rect, xref))
    return assigned


def composite_figure(doc, rects):
    """Composite the clean extracted images onto a white canvas at their relative
    positions (watermark-free) and return the PIL image (or None for no rects).
    vstacks page-canvases if the figure spans two pages. Pure: callers own naming
    and saving — shared by the v2 and Part-3 pipelines (DRY)."""
    if not rects:
        return None
    by_page = {}
    for pidx, r, xref in rects:
        by_page.setdefault(pidx, []).append((r, xref))
    page_imgs = []
    pad = 4
    for pidx in sorted(by_page):
        items = by_page[pidx]
        x0 = min(r.x0 for r, _ in items) - pad
        y0 = min(r.y0 for r, _ in items) - pad
        x1 = max(r.x1 for r, _ in items) + pad
        y1 = max(r.y1 for r, _ in items) + pad
        cw = int(round((x1 - x0) * ZOOM))
        ch = int(round((y1 - y0) * ZOOM))
        canvas = Image.new("RGB", (max(1, cw), max(1, ch)), "white")
        for r, xref in items:
            im = extract_clean(doc, xref)
            w = max(1, int(round((r.x1 - r.x0) * ZOOM)))
            h = max(1, int(round((r.y1 - r.y0) * ZOOM)))
            im = im.resize((w, h), Image.LANCZOS)
            canvas.paste(im, (int(round((r.x0 - x0) * ZOOM)), int(round((r.y0 - y0) * ZOOM))))
        page_imgs.append(canvas)
    if len(page_imgs) == 1:
        return page_imgs[0]
    w = max(im.width for im in page_imgs)
    h = sum(im.height for im in page_imgs) + 8 * (len(page_imgs) - 1)
    final = Image.new("RGB", (w, h), "white")
    y = 0
    for im in page_imgs:
        final.paste(im, (0, y))
        y += im.height + 8
    return final


def crop_question_figure(doc, q_num, rects):
    """Composite the clean extracted images and save under IMG_PREFIX naming."""
    final = composite_figure(doc, rects)
    if final is None:
        return None
    fname = f"{IMG_PREFIX}_q{q_num:02d}.png"
    final.save(os.path.join(IMG_DIR, fname))
    return fname


# ---------------------------------------------------------------- Stage 2: answers + explanations
def parse_answers(doc):
    """Return {q_num: {'raw': str, 'explanation': str}} parsed from the text layer.
    We do NOT gate on the 'ANSWERS AND EXPLANATIONS' header (it falls on an earlier
    page for some sets). The '<n>. Answer:' regex is specific enough — trailing
    question text on the first answer page (e.g. '49. Which group...') never matches,
    and leading text before the first entry is ignored by the finditer scan."""
    lines = []
    for pno in ANSWER_PAGES:
        pidx = pno - 1
        for y, t in page_lines(doc[pidx]):
            lines.append(t)
    text = "\n".join(lines)
    # [ \t] (not \s) so a blank 'Answer:' does not swallow the next line's answer
    entry_re = re.compile(r"(?m)^(\d{1,2})\.[ \t]*Answer:[ \t]*(.*)$")
    matches = list(entry_re.finditer(text))
    out = {}
    for i, m in enumerate(matches):
        qn = int(m.group(1))
        raw = m.group(2).strip()
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        out[qn] = {"raw": raw, "explanation": _clean(text[start:end])}
    return out


# ---------------------------------------------------------------- Stage 4: answer mapping
WORD2NUM = {"a": 0, "b": 1, "c": 2, "d": 3, "e": 4, "f": 5}


def map_answer(raw, options):
    """Returns (correct_answer_id, note, needs_review). note is prepended to the
    explanation for free/multi answers that cannot map to a single option."""
    raw_s = raw.strip()
    if raw_s == "":
        return "", "", True
    m = re.match(r"\((\d)\)", raw_s)  # leading paren option, e.g. '(5) River'
    if m:
        idx = int(m.group(1)) - 1
        if 0 <= idx < len(options):
            return OPT_IDS[idx], "", False
    m = re.fullmatch(r"\(?(\d)\)?", raw_s)
    if m:
        idx = int(m.group(1)) - 1
        if 0 <= idx < len(options):
            return OPT_IDS[idx], "", False
        return "", f"Answer: {raw_s}", True
    if re.fullmatch(r"[A-Fa-f]", raw_s):  # may be option letter OR free letter (Q9='D')
        idx = WORD2NUM[raw_s.lower()]
        if options and idx < len(options) and not _looks_freeletter(options):
            return OPT_IDS[idx], "", False
        return "", f"Answer: {raw_s}", True
    if raw_s.lower() in ("yes", "no"):
        for i, o in enumerate(options):
            if o["text"].strip().lower() == raw_s.lower():
                return OPT_IDS[i], "", False
        return "", f"Answer: {raw_s}", True
    # multi / free (e.g. '2 and 3', '1 and 4', 'JHG, FDC', '3 4 8 5', '2, 1, 2')
    return "", f"Answer: {raw_s}", True


def _looks_freeletter(options):
    txts = [o["text"].strip().lower() for o in options]
    return txts == ["yes", "no"] or all(re.fullmatch(r"\d+", t) for t in txts if t)


# ---------------------------------------------------------------- type heuristic
def guess_type(qtext, has_figure, options):
    t = qtext.lower()
    if has_figure or "figure" in t or "cube" in t or "class a" in t or ("series" in t and "letter" not in t):
        if "letter" in t or "word" in t or "sentence" in t:
            return "VERBAL_REASONING"
        return "NON_VERBAL_REASONING"
    if any(k in t for k in ["dictionary", "letter", "word", "sentence", "is to", "class as", "rearrang"]):
        return "VERBAL_REASONING"
    if any(k in t for k in ["add", "subtract", "minutes", "number", "series", "sum", "how many"]):
        return "NUMERICAL_ABILITY"
    return "VERBAL_REASONING"


# ---------------------------------------------------------------- assemble
def run_set(set_num, pdf_path):
    configure(set_num, pdf_path)
    os.makedirs(IMG_DIR, exist_ok=True)
    doc = fitz.open(PDF_PATH)

    markers = collect_markers(doc)
    attach_body_lines(doc, markers)
    images = assign_images(doc, markers)
    answers = parse_answers(doc)

    questions, review_flags = [], []
    for idx, mk in enumerate(markers):
        qn = mk["q"]
        qtext, options = build_question(mk)
        rects = images.get(idx, [])
        has_fig = len(rects) > 0
        ans = answers.get(qn, {"raw": "", "explanation": ""})

        if not options and has_fig:  # synth options for pure-figure questions
            if ans["raw"].strip().lower() in ("yes", "no") or ("yes" in qtext.lower() and "no" in qtext.lower()):
                options = [{"text": "Yes"}, {"text": "No"}]
            else:
                options = [{"text": str(i)} for i in range(1, 6)]

        fname = crop_question_figure(doc, qn, rects)
        correct, note, needs_review = map_answer(ans["raw"], options)

        explanation = ans["explanation"]
        if note:
            explanation = f"{note}. {explanation}".strip().strip(".") + "."
        if not qtext:
            qtext = "Study the figure and select the correct option."
            needs_review = True

        q = {
            "id": f"oir_pdf_s{set_num:02d}_q{qn:04d}",
            "questionNumber": qn,
            "type": guess_type(qtext, has_fig, options),
            "questionText": qtext,
            "options": [{"id": OPT_IDS[i], "text": o["text"]} for i, o in enumerate(options)],
            "correctAnswerId": correct,
            "explanation": explanation,
            "timeSeconds": 60,
        }
        if fname:
            q["questionImageUrl"] = f"{STORAGE_BASE}/{fname}"
        questions.append(q)
        if needs_review:
            review_flags.append(qn)

    batch = {
        "batchId": BATCH_ID,
        "version": "2.0",
        "source": "pdf_extracted_deterministic",
        "totalQuestions": len(questions),
        "createdAt": "2026-06-02T00:00:00Z",
        "questions": questions,
    }
    out_json = os.path.join(OUT_ROOT, f"{BATCH_ID}.json")
    with open(out_json, "w") as f:
        json.dump(batch, f, indent=2, ensure_ascii=False)
    write_preview(questions, set(review_flags))

    answered = sum(1 for q in questions if q["correctAnswerId"])
    in_expl = sum(1 for q in questions if q["explanation"].startswith("Answer:"))
    with_fig = sum(1 for q in questions if q.get("questionImageUrl"))
    missing = [q["questionImageUrl"].split("/")[-1] for q in questions
               if q.get("questionImageUrl") and not os.path.exists(
                   os.path.join(IMG_DIR, q["questionImageUrl"].split("/")[-1]))]
    print(f"[Set {set_num}] {BATCH_ID}: {len(questions)} Q (expected {EXPECTED_Q}) | "
          f"mapped={answered} inExpl={in_expl} unaccounted={len(questions)-answered-in_expl} | "
          f"figures={with_fig} missingFiles={len(missing)}")
    print(f"          review: {sorted(review_flags)}")
    if missing:
        print(f"          MISSING IMAGE FILES: {missing}")
    return {"set": set_num, "total": len(questions), "answered": answered,
            "inExpl": in_expl, "figures": with_fig, "missing": missing}


def write_preview(questions, review_set):
    rows = []
    for q in questions:
        qn = q["questionNumber"]
        badge = '<span style="background:#c00;color:#fff;padding:2px 6px;border-radius:4px">REVIEW</span>' if qn in review_set else ""
        img = ""
        if q.get("questionImageUrl"):
            fname = q["questionImageUrl"].split("/")[-1]
            img = f'<div><img src="images/{fname}" style="max-width:520px;border:1px solid #ccc"></div>'
        opts = ""
        for o in q["options"]:
            mark = " ✅" if o["id"] == q["correctAnswerId"] else ""
            opts += f'<li>{html.escape(o["text"])}{mark}</li>'
        rows.append(f"""
        <div style="border-bottom:1px solid #ddd;padding:12px 0">
          <h3>Q{qn} {badge} <small style="color:#888">[{q['type']}]</small></h3>
          <p><b>{html.escape(q['questionText'])}</b></p>
          {img}
          <ol type="1">{opts}</ol>
          <p style="color:#060"><b>Answer id:</b> {q['correctAnswerId'] or '(see explanation)'} </p>
          <p style="color:#444"><b>Explanation:</b> {html.escape(q['explanation'])}</p>
        </div>""")
    htmlout = (f"<html><head><meta charset='utf-8'><title>{BATCH_ID} preview</title></head>"
               f"<body style='font-family:sans-serif;max-width:760px;margin:auto'>"
               f"<h1>{BATCH_ID} — {len(questions)} questions</h1>{''.join(rows)}</body></html>")
    with open(os.path.join(OUT_ROOT, f"{BATCH_ID}_preview.html"), "w") as f:
        f.write(htmlout)


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Deterministic OIR extractor")
    ap.add_argument("--set", type=int, help="set number 1-20")
    ap.add_argument("--all", action="store_true", help="run all 20 sets")
    ap.add_argument("--pdf", default=DEFAULT_PDF, help="path to the source PDF")
    args = ap.parse_args()
    os.makedirs(IMG_DIR, exist_ok=True)
    if args.all:
        results = [run_set(n, args.pdf) for n in sorted(SET_TABLE)]
        print("\n=== SUMMARY ===")
        for r in results:
            flag = "OK" if not r["missing"] and r["total"] == EXPECTED_Q else "CHECK"
            print(f"  Set {r['set']:2d}: {r['total']} Q, {r['figures']} figs, "
                  f"missing={len(r['missing'])}  [{flag}]")
    elif args.set:
        run_set(args.set, args.pdf)
    else:
        ap.error("provide --set N or --all")
