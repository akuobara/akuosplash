#!/usr/bin/env python3
"""CVV v3: borde superior del input detectado en y=2129. Analizar interior 2130-2290."""
from PIL import Image
import numpy as np

im = Image.open("/home/z/my-project/upload/17947973518201833051909040895325.jpg").convert("L")
w, h = im.size
arr = np.array(im)

# Interior del input CVV: debajo del borde 2129, lado izquierdo (el '123' va a la izquierda)
zones = {
    "input CVV interior (x 6%-55%, y 2140-2270)": (0.06, 0.55, 2140, 2270),
    "etiqueta 'Código de seguridad' (y 2050-2125)": (0.06, 0.60, 2050, 2125),
    "texto normal 'Mastercard Crédito' (y 1960-2030)": (0.08, 0.55, 1960, 2030),
}
for name, (x0r, x1r, ya, yb) in zones.items():
    z = arr[ya:yb, int(w*x0r):int(w*x1r)]
    tp = z[z < 200]
    print(f"\n{name}: {len(tp)} píxeles <200")
    if len(tp):
        print(f"  min={tp.min()} p25={np.percentile(tp,25):.0f} mediana={np.percentile(tp,50):.0f} p75={np.percentile(tp,75):.0f}")
        hist, _ = np.histogram(tp, bins=[0,60,100,130,160,200])
        print(f"  hist [<60,60-100,100-130,130-160,160-200]: {hist.tolist()}")

# También: ¿hay texto tipeado (oscuro) en el interior del input?
inner = arr[2140:2270, int(w*0.06):int(w*0.55)]
dark = (inner < 100).sum()
gray = ((inner > 130) & (inner < 190)).sum()
print(f"\ninterior input: píxeles oscuros(<100)={dark}, píxeles grises(130-190)={gray}")
if dark > 100:
    print("=> CVV TIPEADO (texto oscuro presente)")
elif gray > 100:
    print("=> CVV VACÍO con placeholder gris")
else:
    print("=> CVV VACÍO (sin texto visible)")

# ¿Dónde está el texto oscuro del interior? (fila con más píxeles oscuros)
row_dark = (inner < 100).sum(axis=1)
if row_dark.max() > 0:
    peak = row_dark.argmax()
    print(f"fila con más texto oscuro: {2140+peak} (n={row_dark.max()})")
    band = inner[max(0,peak-20):peak+25]
    cols = np.where((band < 100).sum(axis=0) > 0)[0]
    if len(cols):
        print(f"columnas con texto oscuro: {cols.min()}-{cols.max()} (relativo a x={int(w*0.06)})")
        seg = band[:, cols.min():cols.max()+1]
        px = seg[seg < 200]
        print(f"segmento de texto: n={len(px)} mediana={np.percentile(px,50):.0f}")
