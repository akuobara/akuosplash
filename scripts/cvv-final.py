#!/usr/bin/env python3
"""CVV DEFINITIVO: 
1) Detectar el borde izquierdo de la pantalla (transición bezel oscuro → pantalla blanca)
2) Detectar la caja del input CVV (bordes horizontales)
3) Analizar SOLO el interior izquierdo de la caja (donde va '123')
4) Comparar con la etiqueta 'Código de seguridad' (gris oscuro) y con texto negro conocido
"""
from PIL import Image
import numpy as np

im = Image.open("/home/z/my-project/upload/17947973518201833051909040895325.jpg").convert("L")
w, h = im.size
arr = np.array(im)
print(f"imagen {w}x{h}")

# 1) Borde izquierdo de la pantalla en varias filas (donde pasa de oscuro <100 a claro >200)
for y in [2000, 2200, 2400, 2600]:
    row = arr[y]
    # buscar primera transición oscuro→claro sostenida
    edge = None
    for x in range(100, w // 2):
        if row[x] > 200 and row[max(0, x-20):x].mean() < 120:
            # confirmar que sigue claro
            if row[x:x+80].mean() > 200:
                edge = x
                break
    print(f"  y={y}: borde izquierdo pantalla ≈ x={edge}")

# usar el borde de y=2200 (dentro del input)
row = arr[2200]
screen_left = None
for x in range(100, w // 2):
    if row[x] > 200 and row[max(0, x-20):x].mean() < 120 and row[x:x+80].mean() > 200:
        screen_left = x
        break
if not screen_left:
    screen_left = int(w * 0.08)
print(f"\nborde pantalla usado: x={screen_left}")

# 2) Bordes del input CVV: filas con franja horizontal clara-gris (borde 170-235) entre y 2050-2350
region = arr[2050:2350, screen_left+30:min(w, screen_left+2500)]
H, W = region.shape
border_frac = ((region > 170) & (region < 238)).mean(axis=1)
lines = [2050 + i for i in range(H) if border_frac[i] > 0.5]
# agrupar
groups = []
for r in lines:
    if groups and r - groups[-1][-1] <= 4:
        groups[-1].append(r)
    else:
        groups.append([r])
glines = [int(np.mean(g)) for g in groups]
print(f"líneas de borde detectadas: {glines}")

# 3) La caja del input: la línea en 2129 (top). Bottom = siguiente línea o 2129+alto típico
top = None
for g in glines:
    if 2100 <= g <= 2160:
        top = g
if top is None:
    top = 2129
# bottom: línea siguiente después de top+60
bottom = None
for g in glines:
    if g > top + 60 and g < top + 250:
        bottom = g
        break
if bottom is None:
    bottom = top + 160
print(f"caja input: y {top}-{bottom} (alto {bottom-top}px)")

# 4) Interior izquierdo de la caja: x screen_left+60 .. screen_left+500, y top+25 .. bottom-25
#    (el '123' está a la izquierda; el '?' está a la derecha, fuera de este rango)
inner = arr[top+25:bottom-25, screen_left+60:screen_left+500]
print(f"interior analizado: y {top+25}-{bottom-25}, x {screen_left+60}-{screen_left+500}, shape {inner.shape}")
tp = inner[inner < 205]
print(f"píxeles de posible texto (<205): {len(tp)}")
if len(tp):
    print(f"  min={tp.min()} p10={np.percentile(tp,10):.0f} p25={np.percentile(tp,25):.0f} mediana={np.percentile(tp,50):.0f} p75={np.percentile(tp,75):.0f}")
    hist, _ = np.histogram(tp, bins=[0,60,100,130,160,205])
    print(f"  hist [<60, 60-100, 100-130, 130-160, 160-205]: {hist.tolist()}")

# 5) Referencias en la MISMA columna x (para descartar sombra/ángulo):
#    etiqueta 'Código de seguridad' (y ~2060-2120) — texto gris oscuro MP (#333 aprox)
lbl = arr[2060:2120, screen_left+60:screen_left+900]
lp = lbl[lbl < 205]
if len(lp):
    print(f"\netiqueta 'Código de seguridad': n={len(lp)} mediana={np.percentile(lp,50):.0f}")
# texto negro confirmado 'Mastercard Crédito' (y ~1960-2030)
mc = arr[1960:2030, screen_left+60:screen_left+900]
mp_ = mc[mc < 205]
if len(mp_):
    print(f"'Mastercard Crédito' (texto normal): n={len(mp_)} mediana={np.percentile(mp_,50):.0f}")

# 6) ¿Hay 3 dígitos? Contar componentes de texto por columnas en el interior
col_dark = (inner < 150).sum(axis=0)
cols_with = np.where(col_dark > 2)[0]
if len(cols_with):
    # agrupar columnas contiguas
    runs = []
    start = cols_with[0]
    prev = cols_with[0]
    for c in cols_with[1:]:
        if c - prev > 15:
            runs.append((start, prev))
            start = c
        prev = c
    runs.append((start, prev))
    print(f"\nsegmentos de dígitos detectados en el input: {len(runs)} → {runs}")
    total_text = int((inner < 150).sum())
    print(f"total píxeles de texto (<150): {total_text}")
    if len(runs) >= 2 and total_text > 800:
        px = inner[inner < 150]
        print(f"luminancia del texto: mediana={np.percentile(px,50):.0f}")
        med = np.percentile(px, 50)
        print("  => TIPEADO (oscuro como el texto normal)" if med < 90 else "  => PLACEHOLDER (más claro que texto normal)")
    else:
        print("  => campo VACÍO o placeholder muy tenue")
