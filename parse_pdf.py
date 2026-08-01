import fitz
doc = fitz.open("/home/ewilliamhe/GlimmerFall2/Bhuvan_Instructions/Bhuvan Instructions/0.1 GlimmerFall Tuck-Box Production Handoff/01_Template/TuckInBox.pdf")
page = doc[0]
lines = []
for p in page.get_drawings():
    for item in p["items"]:
        if item[0] == "l":
            lines.append((item[1], item[2]))
        elif item[0] == "re":
            rect = item[1]
            lines.append((fitz.Point(rect.x0, rect.y0), fitz.Point(rect.x1, rect.y0)))
            lines.append((fitz.Point(rect.x1, rect.y0), fitz.Point(rect.x1, rect.y1)))
            lines.append((fitz.Point(rect.x1, rect.y1), fitz.Point(rect.x0, rect.y1)))
            lines.append((fitz.Point(rect.x0, rect.y1), fitz.Point(rect.x0, rect.y0)))

v_lines = []
h_lines = []
for p1, p2 in lines:
    if abs(p1.x - p2.x) < 1:
        v_lines.append(p1.x)
    if abs(p1.y - p2.y) < 1:
        h_lines.append(p1.y)

v_lines = sorted(list(set([round(x, 1) for x in v_lines])))
h_lines = sorted(list(set([round(y, 1) for y in h_lines])))

print("Vertical line X coords:", v_lines)
print("Horizontal line Y coords:", h_lines)
