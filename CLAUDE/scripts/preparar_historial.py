"""Convierte la hoja 'Rendiciones' del Excel v1.1 en los documentos de historial
(rendiciones + pagos) que se cargaron en la base de la app.

Uso:  python preparar_historial.py ../datos/original/Rendiciones_Chile_2026_version_1_1.xlsx ../datos/lists.json salida/
Genera salida/bNN.json: lotes de 50 escrituras {op, collection, doc_id, data}
listos para ArtifactData action=batch.

Reglas usadas (acordadas con el usuario):
- Se agrupan filas por (Nombre Solicitante, Nro Rend.) -> una rendición con ID = CODIGO-NNN.
- Código = inicial del nombre + 2 primeras letras del apellido (DHE = David Herce); ver datos/codes.json.
- Cada fila con montos o 'Detalle' = una línea. Old 'Detalle' = subcuenta, 'Cuenta' = cuenta, 'Concepto' = glosa.
- IVA se toma del valor guardado en la celda (hay IVAs escritos a mano), no se recalcula.
- Filas con 'Monto' = pago. Con Nro Rend -> tipo 'Pago' vinculado a esa rendición; sin Nro -> 'Anticipo';
  'Pagado por' = 'No Genera Pago' -> tipo 'No genera pago'.
- Se omite la fila 635 (107.130 sin nombre). Total migrado: 45.024.174 CLP en 182 rendiciones; 174 pagos 45.045.931 CLP.
"""
import sys, json, os, unicodedata, datetime as dt
import pandas as pd

src, lists_path, out = sys.argv[1], sys.argv[2], sys.argv[3]
L = json.load(open(lists_path))
norm = lambda s: " ".join(unicodedata.normalize("NFD", str(s)).encode("ascii", "ignore").decode().lower().split())
deacc = lambda s: "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn").upper()
codes = {}
for n in L["sol"]:
    p = n.split(); c = deacc(p[0][0] + (p[1][:2] if len(p) > 1 else p[0][1:3]))
    if c in codes.values(): c = deacc(p[0][0] + p[1][0] + p[-1][1])
    codes[norm(n)] = c
raw = lambda lst, v: next((x for x in lst if norm(x) == norm(v)), None)
df = pd.read_excel(src, sheet_name="Rendiciones", header=3).iloc[:651]
df.columns = [c.strip() if isinstance(c, str) else c for c in df.columns]
S = lambda v: v.strip() if isinstance(v, str) and v.strip() else None
D = lambda v: v.strftime("%Y-%m-%d") if isinstance(v, (dt.datetime, pd.Timestamp)) and not pd.isna(v) else ""
N = lambda v: float(v) if isinstance(v, (int, float)) and not pd.isna(v) else 0
rends, pagos = {}, []
for i, r in df.iterrows():
    name = S(r["Nombre Solicitante"])
    if not name: continue
    sol = raw(L["sol"], name) or name
    code = codes.get(norm(sol), deacc(name[:3]))
    nro = r["Nro Rend."]; rid = None
    if pd.notna(nro):
        nro = int(nro); rid = f"{code}-{nro:03d}"
        R = rends.setdefault(rid, dict(solicitante=sol, nro=nro, fecha=D(r["Fecha"]), empresa="Hecaglobal Instruments SPA", fondo="", totalForm=None,
                                       lineas=[], fotos=[], origen="Histórico", exportada=True, obs=""))
        if D(r["Fecha"]) and (not R["fecha"] or D(r["Fecha"]) < R["fecha"]): R["fecha"] = D(r["Fecha"])
        if N(r["Monto Neto"]) or N(r["Monto Exento"]) or N(r["Iva"]) or S(r["Detalle"]):
            tipo = S(r["Tipo Doc"]) or ("Factura" if N(r["Monto Neto"]) else "Boleta")
            R["lineas"].append(dict(fecha=D(r["Fecha"]) or R["fecha"], tipo=tipo, proveedor="", rut="", numero="",
                                    neto=N(r["Monto Neto"]), iva=round(N(r["Iva"]), 2), exento=N(r["Monto Exento"]), otros=0,
                                    detalle=S(r["Concepto"]) or "", sub=raw(L["sub"], r["Detalle"]) or (S(r["Detalle"]) or ""),
                                    cue=raw(L["cue"], r["Cuenta"]) or (S(r["Cuenta"]) or ""), cc=S(r["C.C."]) or ""))
    if isinstance(r["Monto"], (int, float)) and not pd.isna(r["Monto"]):
        banco = S(r["Pagado por"]) or "No informado"
        tipo = "No genera pago" if norm(banco).startswith("no genera") else ("Pago" if rid else "Anticipo")
        pagos.append(dict(solicitante=sol, fecha=D(r["Fecha de Pago"]), banco=raw(L["pag"], banco) or banco, monto=round(float(r["Monto"]), 2),
                          tipo=tipo, rends=[rid] if rid else [], cartola=None, idx=None, desc="", origen="Histórico", obs=f"Fila {i+5} del Excel v1.1"))
for R in rends.values():
    R["total"] = round(sum(l["neto"] + l["iva"] + l["exento"] + l["otros"] for l in R["lineas"]), 2)
    R["creadoEn"] = (R["fecha"] or "2026-01-01") + "T12:00:00.000Z"
os.makedirs(out, exist_ok=True)
w = [{"op": "set", "collection": "rendiciones", "doc_id": k, "data": v} for k, v in rends.items()]
w += [{"op": "set", "collection": "pagos", "doc_id": f"H{j+1:04d}", "data": p} for j, p in enumerate(pagos)]
for b in range(0, len(w), 50): json.dump(w[b:b + 50], open(f"{out}/b{b//50:02d}.json", "w"), ensure_ascii=False)
print(len(rends), "rendiciones,", len(pagos), "pagos")
