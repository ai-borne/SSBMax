#!/usr/bin/env python3
"""
Deterministic OIR extractor — Part 3 ("OIR PART 3 (1).pdf"). NO LLM in the
correctness path (same principle as oir_extract_v2.py).

The Part-3 PDF is laid out as topic SECTIONS rather than 50-question sets:

    Test Name
    <Section Name>
    Total Questions
    <N>
    <optional intro lines>
    1. <stem>
    a. <opt>  b. <opt>  c. <opt>  [d. <opt>]
    [Solution. <human-written working>]
    Answer. <letter>
    2. ...
    [Test Answer        <- redundant summary key, used only for cross-validation]
    1. (a)
    2. (d)
    ...

The text layer is the source of truth (stem, options, the inline `Answer.`
letter, and the real `Solution.` explanation all parse deterministically).
Figures are mapped to questions by vertical position and rebuilt by compositing
the CLEAN embedded images (watermark-free) — both reused from oir_extract_v2.

Sections that contain NO `a.` option markers are fill-in-the-blank (Rearrange
Words / Last Alphabet / Last Digit) and are SKIPPED — they are not multiple
choice and would be dropped by the runtime validator anyway.

Topic-family batches (255 MCQ total):
    021 Proverbs            (40)   VERBAL
    022 Series Completion   (50)   per-question (number-series -> NUMERICAL else VERBAL)
    023 Coding              (40)   VERBAL
    024 Word Order          (25)   VERBAL
    025 Cubes               (45)   NON_VERBAL
    026 Absurd Statements   (20)   VERBAL
    027 Numerical Ability   (15)   NUMERICAL
    028 OIR Exam-3          (20)   mixed (per-question heuristic)

IDs: oir_pdf_p3_q{NNNN} (distinct prefix from oir_pdf_sNN_* so a Room REPLACE
can never clobber existing Part-1/2 questions). Images: out/images/p3_q{NNNN}.png.

Usage:
  python3 oir_extract_part3.py --all
  python3 oir_extract_part3.py --batch 021
  python3 oir_extract_part3.py --all --pdf "/path/to/OIR PART 3 (1).pdf"
"""

import os, re, json, html, argparse

# DRY: reuse the v2 helpers instead of re-implementing them.
from oir_extract_v2 import (
    page_images, composite_figure, OPT_IDS, STORAGE_BASE, OUT_ROOT, IMG_DIR,
)

DEFAULT_PDF = "/Users/sunil/Desktop/OIR Tests/OIR PART 3 (1).pdf"

import fitz  # PyMuPDF (already a v2 dependency)

# ---------------------------------------------------------------- section -> batch mapping
# (name keyword -> batch id, type rule). Order matters only for keyword matching.
#   type rule: a TestType string, or "PER_Q" (decide per question), or "MIXED".
BATCH_FOR = [
    ("proverb",            "batch_pdf_021", "VERBAL_REASONING"),
    ("series completion",  "batch_pdf_022", "PER_Q"),
    ("coding",             "batch_pdf_023", "VERBAL_REASONING"),
    ("word order",         "batch_pdf_024", "VERBAL_REASONING"),
    ("cube",               "batch_pdf_025", "NON_VERBAL_REASONING"),
    ("absurd",             "batch_pdf_026", "VERBAL_REASONING"),
    ("numerical ability",  "batch_pdf_027", "NUMERICAL_ABILITY"),
    ("oir exam",           "batch_pdf_028", "MIXED"),
]

# ---------------------------------------------------------------- text helpers
def _norm(s: str) -> str:
    """Normalise the PDF's non-breaking spaces / soft hyphens, fix mojibake."""
    s = s.replace("\xa0", " ").replace("\xad", "-").replace("\x00", "")
    if any(m in s for m in ("Â", "Ã", "â€")):
        try:
            s = s.encode("cp1252").decode("utf-8")
        except (UnicodeEncodeError, UnicodeDecodeError):
            pass
    return s


def _clean(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip()


HEADER_FOOTER = re.compile(r"(OIR TEST\s*\|\s*shop\.ssbcrack\.com|shop\.ssbcrack\.com)", re.IGNORECASE)
MARKER_RE     = re.compile(r"^(\d{1,2})[.)]\s*(.*)$")
OPT_RE        = re.compile(r"^([a-fA-F])\.\s+(.*)$")
ANSWER_RE     = re.compile(r"^Answer\.\s*([a-fA-F])\b")
SOLUTION_RE   = re.compile(r"^Solution\.\s*(.*)$")
SUMMARY_RE    = re.compile(r"^(\d{1,2})\.\s*\(([a-fA-F])\)\s*$")
SECTION_INTRO = ("Test Name", "Total Questions", "Test Question", "Language")


def is_noise(text: str) -> bool:
    return bool(HEADER_FOOTER.search(text))


def line_text(line) -> str:
    return "".join(s["text"] for s in line["spans"])


def page_lines(page):
    """[(y_top, text)] in reading order, header/footer stripped, normalised."""
    out = []
    for b in page.get_text("dict")["blocks"]:
        if "lines" not in b:
            continue
        for ln in b["lines"]:
            t = _norm(line_text(ln)).rstrip()
            if t.strip() and not is_noise(t):
                out.append((ln["bbox"][1], t.strip()))
    out.sort(key=lambda r: r[0])
    return out


# ---------------------------------------------------------------- Stage 1: discover sections
def discover_sections(doc):
    """Walk the doc, return [{name, start_page, end_page(excl)}] from 'Test Name'."""
    secs = []
    for i in range(doc.page_count):
        lines = [t for _, t in page_lines(doc[i])]
        for j, l in enumerate(lines):
            if l == "Test Name" and j + 1 < len(lines):
                secs.append({"name": lines[j + 1], "start": i})
    for idx, s in enumerate(secs):
        s["end"] = secs[idx + 1]["start"] if idx + 1 < len(secs) else doc.page_count
    return secs


def classify(name):
    """Return (batch_id, type_rule) or (None, None) if the section is not a target."""
    low = name.lower()
    for kw, batch, rule in BATCH_FOR:
        if kw in low:
            return batch, rule
    return None, None


# ---------------------------------------------------------------- Stage 2: collect markers + lines
def section_stream(doc, sec):
    """Flatten the section's pages into [(page_idx, y, text)] in reading order,
    stopping at the 'Test Answer' summary; also return the parsed summary key."""
    stream, summary, in_summary = [], {}, False
    for pidx in range(sec["start"], sec["end"]):
        for y, t in page_lines(doc[pidx]):
            if t == "Test Answer":
                in_summary = True
                continue
            if in_summary:
                m = SUMMARY_RE.match(t)
                if m:
                    summary[int(m.group(1))] = m.group(2).lower()
                continue
            stream.append((pidx, y, t))
    return stream, summary


HEADER_TOKENS = ("Test Name", "Total Questions", "Test Question")


def split_questions(stream, section_name):
    """Group the stream into questions by sequential numeric markers (1,2,3,...).
    Returns (intro_text, [{"q","page_idx","y","lines"}]). Lines before the first
    marker (minus the section header block) form the section instruction text,
    used as the stem for figure-only questions."""
    qs, expected, intro = [], 1, []
    current_instruction = ""   # persists across questions until a new sub-instruction appears
    trailing, seen_answer = [], False
    for pidx, y, t in stream:
        m = MARKER_RE.match(t)
        if m and int(m.group(1)) == expected:
            if trailing:  # sub-instruction printed between the previous answer and here
                current_instruction = _clean(" ".join(trailing))
            qs.append({"q": expected, "page_idx": pidx, "y": y, "lines": [t],
                       "first_opt": None, "instruction": current_instruction})
            trailing, seen_answer = [], False
            expected += 1
        elif qs:
            if ANSWER_RE.match(t):
                seen_answer = True
                qs[-1]["lines"].append(t)
            elif seen_answer:
                trailing.append(t)  # instruction text for the NEXT question, not this one
            else:
                qs[-1]["lines"].append(t)
                if qs[-1]["first_opt"] is None and OPT_RE.match(t):
                    qs[-1]["first_opt"] = (pidx, y)  # stem ends where the first option begins
        elif not (t.startswith(HEADER_TOKENS) or t == section_name or t.isdigit()
                  or t.lower().startswith("language")):
            intro.append(t)
    return _clean(" ".join(intro)), qs


# ---------------------------------------------------------------- Stage 3: parse one question
def parse_question(lines):
    """Returns (question_text, options[(letter,text)], answer_letter, solution_text)."""
    qtext = []
    options = []
    answer = None
    solution = []
    state = "q"

    head = MARKER_RE.match(lines[0])
    if head and head.group(2).strip():
        qtext.append(head.group(2).strip())

    for ln in lines[1:]:
        ma = ANSWER_RE.match(ln)
        if ma:
            answer = ma.group(1).lower()
            state = "after"
            continue
        ms = SOLUTION_RE.match(ln)
        if ms:
            state = "sol"
            if ms.group(1).strip():
                solution.append(ms.group(1).strip())
            continue
        mo = OPT_RE.match(ln)
        if mo:
            options.append([mo.group(1).lower(), mo.group(2).strip()])
            state = "opt"
            continue
        # continuation line — attach to whatever we're currently building
        if state == "q":
            qtext.append(ln)
        elif state == "opt" and options:
            options[-1][1] += " " + ln
        elif state == "sol":
            solution.append(ln)
        # state == "after": trailing intro lines for the next question — drop

    return _clean(" ".join(qtext)), options, answer, _clean(" ".join(solution))


# ---------------------------------------------------------------- Stage 4: figures by position
def assign_images(doc, sec, qmarkers):
    """{q_index: [(page_idx, rect, xref)]} — STEM figures only, by page geometry.

    Part-3 figure layouts vary, so we keep an image as a question's STEM figure
    only when it sits in that question's stem region (between the marker and its
    first option), under one of two patterns:

      A. below the marker, above the first option   (e.g. Cube Sets candidate cubes)
      B. above the marker, with the marker as the very next text line
                                                     (e.g. Similar Cubes / Set A,B)

    Everything else is a solution/illustration artifact (e.g. the equation images
    embedded inside the Numerical 'Solution.' blocks) and is dropped — those
    questions stay valid pure-text MCQs.

    Positions are global (page, y) tuples so a question whose stem spans a page
    break (marker at the foot of one page, candidate figures at the top of the
    next, above the first option) keeps all of its figures."""
    marks = [(mk["page_idx"], mk["y"], idx, mk["first_opt"]) for idx, mk in enumerate(qmarkers)]
    assigned = {i: [] for i in range(len(qmarkers))}
    text_ys = {pidx: [y for y, _ in page_lines(doc[pidx])]
               for pidx in range(sec["start"], sec["end"])}
    for pidx in range(sec["start"], sec["end"]):
        for cy, rect, xref in page_images(doc[pidx]):
            ipos = (pidx, cy)
            owner = None
            # A: image lies in a question's stem band — last marker at/before the
            #    image, and the image is above that question's first option.
            before = [(mp, my, idx, fo) for mp, my, idx, fo in marks if (mp, my) <= ipos]
            if before:
                mp, my, idx, fo = max(before, key=lambda t: (t[0], t[1]))
                if fo is not None and ipos < fo:
                    owner = idx
            # B: figure precedes its label — the marker is the next text line below.
            if owner is None:
                after = [(mp, my, idx) for mp, my, idx, _ in marks
                         if (mp, my) > ipos and mp == pidx]
                if after:
                    mp, my, idx = min(after, key=lambda t: (t[0], t[1]))
                    next_text = min((y for y in text_ys[pidx] if y > cy), default=None)
                    if next_text is not None and abs(next_text - my) < 1:
                        owner = idx
            if owner is not None:
                assigned[owner].append((pidx, rect, xref))
    return assigned


# ---------------------------------------------------------------- type heuristics
NUM_SERIES_RE = re.compile(r"[\d/]")


def series_type(qtext):
    """Number series -> NUMERICAL; letter/word series -> VERBAL."""
    t = qtext.lower()
    if "letter" in t or "alphabet" in t:
        return "VERBAL_REASONING"
    digits = sum(c.isdigit() for c in qtext)
    return "NUMERICAL_ABILITY" if digits >= 2 else "VERBAL_REASONING"


NUMERIC_KW = re.compile(
    r"(how many|rotate|degree|\bratio\b|\bnumber\b|\brs\b|%|profit|\bsum of\b|\bdivided\b|series)",
    re.IGNORECASE,
)


def mixed_type(qtext, has_figure):
    t = qtext.lower()
    if has_figure or "cube" in t or "figure" in t:
        return "NON_VERBAL_REASONING"
    if NUMERIC_KW.search(qtext):
        return "NUMERICAL_ABILITY"
    return "VERBAL_REASONING"


def resolve_type(rule, qtext, has_figure):
    if rule == "PER_Q":
        return series_type(qtext)
    if rule == "MIXED":
        return mixed_type(qtext, has_figure)
    return rule


# ---------------------------------------------------------------- assemble
def run(target_batches, pdf_path):
    os.makedirs(IMG_DIR, exist_ok=True)
    doc = fitz.open(pdf_path)
    sections = discover_sections(doc)

    # batch_id -> list of questions (accumulated across its sub-sections)
    batches = {}
    review = {}            # batch_id -> [questionNumber,...]
    gid = 0                # global running id across the whole PDF (stable ordering)

    for sec in sections:
        batch_id, rule = classify(sec["name"])
        if batch_id is None or (target_batches and batch_id not in target_batches):
            continue

        stream, summary = section_stream(doc, sec)
        intro, qmarkers = split_questions(stream, sec["name"])
        images = assign_images(doc, sec, qmarkers)

        # A section with zero option markers is fill-in-the-blank — skip entirely.
        has_opts = any(OPT_RE.match(l) for mk in qmarkers for l in mk["lines"])
        if not has_opts:
            continue

        bucket = batches.setdefault(batch_id, [])
        flags = review.setdefault(batch_id, [])

        for idx, mk in enumerate(qmarkers):
            gid += 1
            qtext, options, answer, solution = parse_question(mk["lines"])
            rects = images.get(idx, [])
            has_fig = len(rects) > 0

            needs_review = False
            # cross-validate inline answer against the summary key (when present)
            if summary and mk["q"] in summary and answer and summary[mk["q"]] != answer:
                needs_review = True

            correct = ""
            opt_ids = [OPT_IDS["abcdef".index(letter)] for letter, _ in options]
            if answer and "abcdef".find(answer) < len(options):
                correct = OPT_IDS["abcdef".index(answer)]
            elif options:
                needs_review = True  # answer letter missing or out of range

            qnum = len(bucket) + 1
            qid = gid
            fname = None
            if has_fig:
                final = composite_figure(doc, rects)
                if final is not None:
                    fname = f"p3_q{qid:04d}.png"
                    final.save(os.path.join(IMG_DIR, fname))
                if rule == "MIXED":
                    needs_review = True  # figure question in a mixed section — eyeball it

            if not qtext:
                # Figure-only questions (e.g. cubes) carry their instruction in the
                # nearest preceding sub-instruction (or the section intro), not the
                # per-question stem — use it rather than a generic placeholder.
                fallback = mk.get("instruction") or intro
                if fallback:
                    qtext = fallback
                else:
                    qtext = "Study the figure and select the correct option."
                    needs_review = True

            q = {
                "id": f"oir_pdf_p3_q{qid:04d}",
                "questionNumber": qnum,
                "type": resolve_type(rule, qtext, has_fig),
                "questionText": qtext,
                "options": [{"id": oid, "text": txt} for oid, (_, txt) in zip(opt_ids, options)],
                "correctAnswerId": correct,
                "explanation": solution,
                "timeSeconds": 60,
            }
            if fname:
                q["questionImageUrl"] = f"{STORAGE_BASE}/{fname}"
            bucket.append(q)
            if needs_review:
                flags.append(qnum)

    # ---- emit batch JSON + preview ----
    results = []
    for batch_id in sorted(batches):
        questions = batches[batch_id]
        batch = {
            "batchId": batch_id,
            "version": "3.0",
            "source": "pdf_part3_extracted_deterministic",
            "totalQuestions": len(questions),
            "createdAt": "2026-06-07T00:00:00Z",
            "questions": questions,
        }
        with open(os.path.join(OUT_ROOT, f"{batch_id}.json"), "w") as f:
            json.dump(batch, f, indent=2, ensure_ascii=False)
        write_preview(batch_id, questions, set(review.get(batch_id, [])))

        with_fig = sum(1 for q in questions if q.get("questionImageUrl"))
        missing = [q["questionImageUrl"].split("/")[-1] for q in questions
                   if q.get("questionImageUrl") and not os.path.exists(
                       os.path.join(IMG_DIR, q["questionImageUrl"].split("/")[-1]))]
        answered = sum(1 for q in questions if q["correctAnswerId"])
        print(f"{batch_id}: {len(questions)} Q | mapped={answered} | figures={with_fig} "
              f"missingFiles={len(missing)} | review={sorted(review.get(batch_id, []))}")
        if missing:
            print(f"          MISSING IMAGE FILES: {missing}")
        results.append({"batch": batch_id, "total": len(questions),
                        "answered": answered, "figures": with_fig, "missing": missing})
    return results


def write_preview(batch_id, questions, review_set):
    rows = []
    for q in questions:
        qn = q["questionNumber"]
        badge = ('<span style="background:#c00;color:#fff;padding:2px 6px;border-radius:4px">REVIEW</span>'
                 if qn in review_set else "")
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
          <h3>Q{qn} {badge} <small style="color:#888">[{q['type']}] id={q['id']}</small></h3>
          <p><b>{html.escape(q['questionText'])}</b></p>
          {img}
          <ol type="a">{opts}</ol>
          <p style="color:#060"><b>Answer id:</b> {q['correctAnswerId'] or '(MISSING)'} </p>
          <p style="color:#444"><b>Explanation:</b> {html.escape(q['explanation'])}</p>
        </div>""")
    htmlout = (f"<html><head><meta charset='utf-8'><title>{batch_id} preview</title></head>"
               f"<body style='font-family:sans-serif;max-width:760px;margin:auto'>"
               f"<h1>{batch_id} — {len(questions)} questions</h1>{''.join(rows)}</body></html>")
    with open(os.path.join(OUT_ROOT, f"{batch_id}_preview.html"), "w") as f:
        f.write(htmlout)


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Deterministic OIR Part-3 extractor")
    ap.add_argument("--batch", help="single batch id, e.g. batch_pdf_021 (or just 021)")
    ap.add_argument("--all", action="store_true", help="run all Part-3 batches (021-028)")
    ap.add_argument("--pdf", default=DEFAULT_PDF, help="path to OIR PART 3 PDF")
    args = ap.parse_args()
    os.makedirs(IMG_DIR, exist_ok=True)

    targets = set()
    if args.batch:
        b = args.batch if args.batch.startswith("batch_pdf_") else f"batch_pdf_{args.batch}"
        targets = {b}
    elif not args.all:
        ap.error("provide --all or --batch NNN")

    results = run(targets, args.pdf)
    total = sum(r["total"] for r in results)
    missing = sum(len(r["missing"]) for r in results)
    print(f"\n=== SUMMARY === {len(results)} batches, {total} questions, "
          f"{missing} missing image files")
