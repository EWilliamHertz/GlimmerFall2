import fitz
doc = fitz.open("/home/ewilliamhe/GlimmerFall2/Bhuvan_Instructions/Bhuvan Instructions/0.1 GlimmerFall Tuck-Box Production Handoff/01_Template/TuckInBox.pdf")
page = doc[0]
pix = page.get_pixmap(dpi=150)
pix.save("/home/ewilliamhe/.gemini/antigravity-cli/brain/a390226e-f8e9-4bcc-936b-2212d495461a/dieline_preview.png")
