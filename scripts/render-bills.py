"""Render the demo supplier bills as phone-photo-style JPEGs.
Usage: python scripts/render-bills.py scripts/sample-bills.json public/samples
"""
import json
import random
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

src, out = Path(sys.argv[1]), Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=True)
F = "C:/Windows/Fonts/"


def font(name, size):
    return ImageFont.truetype(F + name, size)


def inr(n):
    s = f"{n:,.2f}"
    whole, dec = s.split(".")
    whole = whole.replace(",", "")
    if len(whole) > 3:
        head, tail = whole[:-3], whole[-3:]
        parts = []
        while len(head) > 2:
            parts.insert(0, head[-2:])
            head = head[:-2]
        if head:
            parts.insert(0, head)
        whole = ",".join(parts + [tail])
    return f"{whole}.{dec}"


for b in json.load(open(src, encoding="utf-8")):
    random.seed(b["key"])
    W, H = 900, 1180
    paper = Image.new("RGB", (W, H), (252, 250, 244))
    d = ImageDraw.Draw(paper)
    hand = b.get("handwritten", False)
    title = font("georgiab.ttf", 38)
    reg = font("arial.ttf", 22)
    bold = font("arialbd.ttf", 22)
    small = font("arial.ttf", 18)
    pen = font("segoepr.ttf", 26) if hand else reg
    penb = font("segoeprb.ttf", 26) if hand else bold
    ink = (30, 40, 120) if hand else (25, 25, 25)

    d.text((W / 2, 50), "TAX INVOICE", font=bold, fill=(90, 90, 90), anchor="mm")
    d.text((W / 2, 100), b["supplierName"].upper(), font=title, fill=(120, 20, 20), anchor="mm")
    d.text((W / 2, 140), b["supplierAddress"], font=small, fill=(60, 60, 60), anchor="mm")
    d.text((W / 2, 170), f"GSTIN: {b['supplierGstin']}", font=bold, fill=(30, 30, 30), anchor="mm")
    d.line((50, 200, W - 50, 200), fill=(120, 20, 20), width=3)

    d.text((60, 225), "Bill No:", font=reg, fill=(60, 60, 60))
    d.text((170, 222), b["billNo"], font=penb, fill=ink)
    from datetime import date, timedelta
    dt = date.today() - timedelta(days=b["daysAgo"])
    d.text((560, 225), "Date:", font=reg, fill=(60, 60, 60))
    d.text((640, 222), dt.strftime("%d/%m/%Y"), font=penb, fill=ink)
    d.text((60, 275), "Buyer:", font=reg, fill=(60, 60, 60))
    d.text((170, 272), "Kushwaha Handloom, Chanderi (M.P.)", font=pen, fill=ink)

    top = 340
    cols = [60, 100, 430, 515, 610, 740, 840]
    heads = ["#", "Description", "HSN", "Qty", "Rate", "Amount"]
    d.rectangle((50, top, W - 50, top + 44), fill=(245, 236, 228), outline=(160, 140, 120))
    for i, h in enumerate(heads):
        d.text((cols[i] + 6, top + 11), h, font=bold, fill=(40, 40, 40))
    y = top + 44
    for i, it in enumerate(b["items"], 1):
        d.rectangle((50, y, W - 50, y + 70), outline=(190, 180, 170))
        d.text((cols[0] + 6, y + 20), str(i), font=rowf if False else pen, fill=ink)
        rowf = font("segoepr.ttf", 21) if hand else reg
        words = it["description"].split(" ")
        line1 = " ".join(words[: (len(words) + 1) // 2]) if len(it["description"]) > 22 else it["description"]
        line2 = it["description"][len(line1):].strip()
        d.text((cols[1] + 6, y + 6), line1, font=rowf, fill=ink)
        if line2:
            d.text((cols[1] + 6, y + 36), line2, font=rowf, fill=ink)
        d.text((cols[2] + 6, y + 20), it["hsn"], font=rowf, fill=ink)
        d.text((cols[3] + 6, y + 20), f"{it['qty']} {it['unit']}", font=rowf, fill=ink)
        d.text((cols[4] + 6, y + 20), inr(it["rate"]), font=rowf, fill=ink)
        d.text((cols[6] - 4, y + 20), inr(it["qty"] * it["rate"]), font=rowf, fill=ink, anchor="ra")
        y += 70
    for _ in range(3):
        d.rectangle((50, y, W - 50, y + 50), outline=(220, 212, 204))
        y += 50

    t = b["totals"]
    rows = [("Taxable Value", t["taxable"])]
    if t["igst"]:
        rows.append((f"IGST @ {b['gstRate']}%", t["igst"]))
    else:
        rows += [(f"CGST @ {b['gstRate']/2:g}%", t["cgst"]), (f"SGST @ {b['gstRate']/2:g}%", t["sgst"])]
    rows.append(("GRAND TOTAL", t["total"]))
    y += 20
    for label, val in rows:
        f_ = bold if label == "GRAND TOTAL" else reg
        d.text((430, y), label, font=f_, fill=(40, 40, 40))
        d.text((W - 60, y - 3), "Rs. " + inr(val), font=penb if hand else f_, fill=ink, anchor="ra")
        y += 42
    d.line((420, y - 50, W - 50, y - 50), fill=(150, 150, 150), width=1)

    d.text((60, H - 170), "Terms: Goods once sold will not be taken back. Subject to Surat jurisdiction." if "Surat" in b["supplierAddress"] else "Terms: Payment within 15 days. Subject to local jurisdiction.", font=small, fill=(110, 110, 110))
    d.text((W - 60, H - 110), f"For {b['supplierName']}", font=small, fill=(60, 60, 60), anchor="ra")
    d.text((W - 90, H - 75), "Authorised Signatory", font=font("segoepr.ttf", 22), fill=(30, 40, 120), anchor="ra")

    # phone-photo look: slight rotation, table background, soft shadow, mild blur
    angle = random.uniform(-2.5, 2.5)
    rot = paper.rotate(angle, expand=True, fillcolor=(0, 0, 0, 0), resample=Image.BICUBIC)
    bg = Image.new("RGB", (rot.width + 140, rot.height + 140), (122, 96, 72))
    shadow = Image.new("L", rot.size, 0)
    shadow.paste(120, (0, 0, rot.width, rot.height), rot.convert("L").point(lambda v: 255 if v > 0 else 0))
    bg.paste((60, 45, 35), (88, 92), shadow.filter(ImageFilter.GaussianBlur(14)))
    mask = rot.convert("L").point(lambda v: 255 if v > 0 else 0)
    bg.paste(rot, (70, 70), mask)
    bg = bg.filter(ImageFilter.GaussianBlur(0.6))
    bg = bg.resize((bg.width * 3 // 4, bg.height * 3 // 4))
    path = out / f"bill-{b['key']}.jpg"
    bg.save(path, quality=86)
    print("wrote", path, bg.size)
