# Confere uma tela do hub de TESTE (8090) contra o desenho do Augusto (SVG
# exportado do Illustrator, com a camada da grade) e contra a grade do hub
# (colunas de 80 e 67 linhas de 1080/67). Só lê e mede: não muda código,
# banco nem arquivos do hub. As saídas vão para uma pasta temporária.
#
# Uso (dentro de DesignHub-v2):
#   python scripts/conferir-layout.py --svg "C:/Users/arte01.FILITEC/Desktop/hubv3/v4/Pedidos.svg" --tela pedidos10
#   opções: --usuario sim.admin  --extra "&x=1"  --antes "js para rodar antes de medir"
#           --espera 2500  --saida <pasta>  --so-svg (só extrai o desenho)
#
# Saídas (padrão: %TEMP%/conferente-layout/<nome do svg>):
#   desenho.png / desenho-grade.png   o SVG sem e com a camada da grade
#   tela.png                          a tela do hub em 1920 x 1080
#   sobreposto.png                    o desenho a 50% por cima da tela
#   diferenca.png                     o que não coincide acende
#   desenho.json / tela.json          medidas dos dois lados
#   relatorio.txt                     pares desenho x tela e o que está fora da grade
#
# A senha do usuário de simulação vem de dev-data/usuarios-simulacao.json e vai
# direto para o campo: nunca é impressa.
import argparse, json, os, pathlib, re, statistics, sys, tempfile
from collections import Counter

from PIL import Image, ImageChops
from playwright.sync_api import sync_playwright

BASE = "http://localhost:8090"
LINHA = 1080 / 67
AQUI = pathlib.Path(__file__).resolve().parent.parent          # DesignHub-v2
CRED = AQUI / "dev-data" / "usuarios-simulacao.json"

JS_SVG = r"""() => {
  const r2 = (n) => Math.round(n * 100) / 100;
  const caixa = (el) => {
    const b = el.getBBox(), m = el.getCTM();
    const p = [[b.x, b.y], [b.x + b.width, b.y], [b.x, b.y + b.height], [b.x + b.width, b.y + b.height]].map(([x, y]) => new DOMPoint(x, y).matrixTransform(m));
    const xs = p.map((q) => q.x), ys = p.map((q) => q.y);
    return [r2(Math.min(...xs)), r2(Math.min(...ys)), r2(Math.max(...xs)), r2(Math.max(...ys))];
  };
  const svg = document.documentElement;
  const camadas = [...svg.children].filter((e) => e.tagName.toLowerCase() === 'g');
  const ehGrade = (g) => [...g.querySelectorAll('rect')].filter((r) => (r.getAttribute('fill') === 'none') && parseFloat(r.getAttribute('stroke-width') || '1') < 0.6).length > 40;
  const grade = camadas.filter(ehGrade);
  const linhas = [], colunas = [];
  grade.forEach((g) => g.querySelectorAll('rect').forEach((r) => {
    const c = caixa(r), w = c[2] - c[0], h = c[3] - c[1];
    if (w > 1000 && h < 40) linhas.push(c[1]);
    if (h > 600 && w < 200) colunas.push(c[0]);
  }));
  const cor = (el, k) => { const v = getComputedStyle(el)[k]; return v && v !== 'none' ? v : null; };
  const sombraDe = (el) => {
    for (let e = el; e && e !== svg; e = e.parentElement) {
      const f = e.getAttribute && e.getAttribute('filter');
      const id = f && (f.match(/#([^)'"]+)/) || [])[1];
      const fe = id && document.getElementById(id);
      if (fe) {
        const a = (s, k) => fe.querySelector(s)?.getAttribute(k);
        return { dx: a('feOffset', 'dx'), dy: a('feOffset', 'dy'), desfoque: a('feGaussianBlur', 'stdDeviation'), cor: a('feFlood', 'flood-color'), opacidade: a('feFlood', 'flood-opacity') };
      }
    }
    return null;
  };
  const itens = [];
  const formas = ['path', 'polygon', 'rect', 'polyline'];
  const visita = (el) => {
    for (const f of el.children) {
      if (grade.includes(f)) continue;
      const tag = f.tagName.toLowerCase();
      if (['defs', 'style', 'title', 'metadata'].includes(tag)) continue;
      if (tag === 'g') {
        const filhos = [...f.children];
        const contorno = filhos.length >= 2 && filhos.every((x) => formas.includes(x.tagName.toLowerCase())
          && !cor(x, 'stroke') && (caixa(x)[3] - caixa(x)[1]) < 140);
        if (contorno) { itens.push({ tipo: 'texto-em-contorno', caixa: caixa(f), glifos: filhos.map(caixa), cor: cor(filhos[0], 'fill') }); continue; }
        visita(f);
      } else if (tag === 'text') {
        const m = f.getCTM();
        const partes = [...f.querySelectorAll('tspan')];
        const ls = (partes.length ? partes : [f]).map((t) => {
          const p = new DOMPoint(parseFloat(t.getAttribute('x') || '0'), parseFloat(t.getAttribute('y') || '0')).matrixTransform(m);
          return { texto: t.textContent, x: r2(p.x), base: r2(p.y) };
        });
        itens.push({ tipo: 'texto', linhas: ls, fonte: f.getAttribute('font-family'), corpo: parseFloat(f.getAttribute('font-size')), peso: f.getAttribute('font-weight'),
          espacamento: f.getAttribute('letter-spacing'), cor: cor(f, 'fill'), caixa: caixa(f) });
      } else {
        itens.push({ tipo: tag, caixa: caixa(f), preenchimento: cor(f, 'fill'), contorno: cor(f, 'stroke'), espessura: f.getAttribute('stroke-width'),
          raio: f.getAttribute('rx'), sombra: sombraDe(f) });
      }
    }
  };
  camadas.filter((g) => !grade.includes(g)).forEach(visita);
  return { itens, linhas, colunas, gradeIds: grade.map((g) => g.id) };
}"""

JS_TELA = r"""() => {
  const r2 = (n) => Math.round(n * 100) / 100;
  const cv = document.createElement('canvas').getContext('2d');
  const textos = [];
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = w.nextNode())) {
    const t = n.nodeValue.replace(/\s+/g, ' ').trim();
    const el = n.parentElement;
    if (!t || !el) continue;
    const st = getComputedStyle(el);
    if (st.visibility === 'hidden' || parseFloat(st.opacity) === 0 || st.color === 'rgba(0, 0, 0, 0)') continue;
    const rg = document.createRange(); rg.selectNodeContents(n);
    const rs = [...rg.getClientRects()].filter((r) => r.width > 0 && r.height > 0);
    if (!rs.length) continue;
    const r0 = rs[0];
    if (r0.right < 0 || r0.left > 1920 || r0.bottom < 0 || r0.top > 1080) continue;
    // a base: o topo da caixa do texto mais a subida da fonte (a caixa de um
    // trecho de texto é a área de conteúdo: subida + descida)
    cv.font = `${st.fontStyle} ${st.fontWeight} ${st.fontSize} ${st.fontFamily}`;
    const mt = cv.measureText('Hg');
    textos.push({ texto: t.slice(0, 90), linhas: rs.map((r) => [r2(r.left), r2(r.top), r2(r.right), r2(r.bottom)]),
      base: r2(r0.top + mt.fontBoundingBoxAscent), confiavel: Math.abs(r0.height - (mt.fontBoundingBoxAscent + mt.fontBoundingBoxDescent)) < 1,
      fonte: st.fontFamily.split(',')[0].replace(/["']/g, '').trim(), corpo: parseFloat(st.fontSize), peso: st.fontWeight,
      espacamento: st.letterSpacing, cor: st.color, variacao: st.fontVariationSettings });
  }
  const caixas = [];
  for (const el of document.querySelectorAll('body *')) {
    const st = getComputedStyle(el);
    const fundo = !['rgba(0, 0, 0, 0)', 'transparent'].includes(st.backgroundColor) || st.backgroundImage !== 'none';
    const borda = parseFloat(st.borderTopWidth) > 0 && st.borderTopStyle !== 'none';
    if (!fundo && !borda && st.boxShadow === 'none') continue;
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8 || r.right < 0 || r.left > 1920 || r.bottom < 0 || r.top > 1080) continue;
    if (r.width >= 1919 && r.height >= 1079) continue;
    caixas.push({ tag: el.tagName.toLowerCase(), caixa: [r2(r.left), r2(r.top), r2(r.right), r2(r.bottom)], fundo: st.backgroundColor,
      borda: borda ? `${st.borderTopWidth} ${st.borderTopStyle} ${st.borderTopColor}` : null, raio: st.borderTopLeftRadius,
      sombra: st.boxShadow === 'none' ? null : st.boxShadow, texto: (el.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 40) });
  }
  return { textos, caixas };
}"""


def tinta_esquerda(img, caixa, folga=6, limiar=70):
    """Primeira coluna com tinta dentro da 1ª linha de um texto (contraste com o fundo da própria caixa)."""
    x0, y0, x1, y1 = caixa
    x0 = max(0, int(x0) - folga); x1 = min(img.width, int(x1) + 1); y0 = max(0, int(y0)); y1 = min(img.height, int(y1) + 1)
    if x1 - x0 < 2 or y1 - y0 < 2:
        return None
    rec = img.crop((x0, y0, x1, y1)).convert("L")
    px = rec.load(); w, h = rec.size
    fundo = statistics.median(px[x, y] for x in range(w) for y in range(0, h, max(1, h // 8)))
    for x in range(w):
        if any(abs(px[x, y] - fundo) > limiar for y in range(h)):
            return x0 + x
    return None


def base_dos_glifos(glifos):
    """A base de um texto em contorno: o pé mais comum entre as letras (as que descem são minoria)."""
    pes = Counter(round(g[3] * 2) / 2 for g in glifos)
    return max(pes.items(), key=lambda kv: (kv[1], -kv[0]))[0]


def perto(v, passo, desloc=0.0):
    k = round((v - desloc) / passo)
    return k, round(v - (desloc + k * passo), 2)


def iou(a, b):
    ix = max(0, min(a[2], b[2]) - max(a[0], b[0])); iy = max(0, min(a[3], b[3]) - max(a[1], b[1]))
    inter = ix * iy
    ua = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter
    return inter / ua if ua > 0 else 0


def senha(usuario):
    dados = json.loads(CRED.read_text(encoding="utf-8"))
    for u in dados["usuarios"]:
        if u["username"] == usuario:
            return u["senha"]
    raise SystemExit(f"usuário {usuario} não está em {CRED.name}")


def main():
    # o console do Windows é cp1252: sem isso o "Δ" do relatório derruba o print
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser()
    ap.add_argument("--svg", required=True)
    ap.add_argument("--tela")
    ap.add_argument("--usuario", default="sim.admin")
    ap.add_argument("--extra", default="")
    ap.add_argument("--antes", default="")
    ap.add_argument("--espera", type=int, default=2500)
    ap.add_argument("--saida")
    ap.add_argument("--so-svg", action="store_true")
    a = ap.parse_args()
    svg = pathlib.Path(a.svg)
    saida = pathlib.Path(a.saida) if a.saida else pathlib.Path(tempfile.gettempdir()) / "conferente-layout" / re.sub(r"[^\w-]+", "-", svg.stem)
    saida.mkdir(parents=True, exist_ok=True)
    assert BASE.startswith("http://localhost:8090")

    with sync_playwright() as pw:
        b = pw.chromium.launch()
        pg = b.new_page(viewport={"width": 1920, "height": 1080})
        pg.goto(svg.as_uri()); pg.wait_for_timeout(1200)
        des = pg.evaluate(JS_SVG)
        pg.screenshot(path=str(saida / "desenho-grade.png"))
        pg.evaluate("(ids) => ids.forEach((id) => { const g = document.getElementById(id); if (g) g.style.display = 'none'; })", des["gradeIds"])
        pg.wait_for_timeout(200)
        pg.screenshot(path=str(saida / "desenho.png"))
        pg.close()
        img_d = Image.open(saida / "desenho.png").convert("RGB")
        for it in des["itens"]:
            if it["tipo"] == "texto-em-contorno":
                it["tinta_esq"] = min(g[0] for g in it["glifos"])
                it["base"] = base_dos_glifos(it["glifos"])
            elif it["tipo"] == "texto":
                for ln in it["linhas"]:
                    cx = [ln["x"] - 4, ln["base"] - it["corpo"], ln["x"] + it["corpo"], ln["base"] + it["corpo"] * 0.1]
                    ln["tinta_esq"] = tinta_esquerda(img_d, cx)
        (saida / "desenho.json").write_text(json.dumps(des, ensure_ascii=False, indent=1), encoding="utf-8")

        rel = []
        rel.append(f"DESENHO: {svg}")
        if des["linhas"]:
            ls = sorted(des["linhas"]); passos = [round(y2 - y1, 3) for y1, y2 in zip(ls, ls[1:])]
            rel.append(f"grade do desenho: {len(ls)} linhas, passo {statistics.median(passos) if passos else '?'} a partir de y={ls[0]}; {len(des['colunas'])} colunas")
        rel.append("")
        rel.append("ELEMENTOS DO DESENHO (fora da grade = distância até a coluna de 80 / linha de 1080/67 mais perto)")
        for it in des["itens"]:
            c = it["caixa"]
            if it["tipo"] == "texto":
                for ln in it["linhas"]:
                    tk = ln.get("tinta_esq"); kc, dc = perto(tk, 80) if tk is not None else (None, None); kl, dl = perto(ln["base"], LINHA)
                    rel.append(f"  texto  '{ln['texto'].strip()}'  {it['corpo']}px {it['fonte']}  tinta x={tk} (c{kc} {dc:+})  base y={ln['base']} (linha {kl} {dl:+})" if tk is not None
                               else f"  texto  '{ln['texto'].strip()}'  base y={ln['base']} (linha {kl} {dl:+})")
            elif it["tipo"] == "texto-em-contorno":
                kc, dc = perto(it["tinta_esq"], 80); kl, dl = perto(it["base"], LINHA)
                rel.append(f"  texto em contorno ({len(it['glifos'])} letras) caixa {c}  tinta x={it['tinta_esq']} (c{kc} {dc:+})  base y={it['base']} (linha {kl} {dl:+})  cor {it['cor']}")
            else:
                kc, dc = perto(c[0], 80); kc2, dc2 = perto(c[2], 80)
                extra = f" raio {it['raio']}" if it.get("raio") else ""
                extra += f" contorno {it['contorno']} {it['espessura']}" if it.get("contorno") else ""
                extra += f" sombra {it['sombra']}" if it.get("sombra") else ""
                rel.append(f"  {it['tipo']}  {c}  esq c{kc} {dc:+}  dir c{kc2} {dc2:+}  preenchimento {it.get('preenchimento')}{extra}")

        if not a.so_svg and a.tela:
            ctx = b.new_context(viewport={"width": 1920, "height": 1080}, locale="pt-BR", timezone_id="America/Sao_Paulo")
            p = ctx.new_page()
            p.goto(BASE + "/auth", wait_until="domcontentloaded"); p.wait_for_load_state("networkidle")
            p.locator("input[type=text]:visible, input:not([type]):visible").first.fill(a.usuario)
            p.locator("input[type=password]:visible").first.fill(senha(a.usuario))
            p.locator("button[type=submit]", has_text="Entrar").first.click()
            # a URL do login pode trazer "/hub" no endereço de volta: espera sair do /auth
            p.wait_for_url(lambda u: "/hub" in u and "/auth" not in u, timeout=30000)
            p.wait_for_load_state("networkidle")
            p.goto(f"{BASE}/hub?tela={a.tela}{a.extra}", wait_until="domcontentloaded")
            try:
                p.wait_for_load_state("networkidle", timeout=15000)
            except Exception:
                pass
            p.wait_for_timeout(a.espera)
            if a.antes:
                p.evaluate(a.antes); p.wait_for_timeout(800)
            p.mouse.move(2, 1078)
            p.wait_for_timeout(300)
            tel = p.evaluate(JS_TELA)
            p.screenshot(path=str(saida / "tela.png"))
            img_t = Image.open(saida / "tela.png").convert("RGB")
            for t in tel["textos"]:
                t["tinta_esq"] = tinta_esquerda(img_t, t["linhas"][0])
            (saida / "tela.json").write_text(json.dumps(tel, ensure_ascii=False, indent=1), encoding="utf-8")
            Image.blend(img_t, img_d, 0.5).save(saida / "sobreposto.png")
            ImageChops.difference(img_t, img_d).save(saida / "diferenca.png")

            rel.append("")
            rel.append("PARES DESENHO x TELA (texto igual; ou, no texto em contorno, o da tela mais perto)")
            norm = lambda s: re.sub(r"\s+", " ", s).strip().lower()
            usados = set()
            for it in des["itens"]:
                if it["tipo"] == "texto":
                    for ln in it["linhas"]:
                        alvo = [t for t in tel["textos"] if norm(t["texto"]) == norm(ln["texto"])]
                        if not alvo:
                            rel.append(f"  '{ln['texto'].strip()}': não achei na tela (texto do desenho é exemplo? compare pela posição)")
                            continue
                        t = min(alvo, key=lambda t: abs(t["base"] - ln["base"]) + abs((t["tinta_esq"] or 0) - (ln.get("tinta_esq") or 0)))
                        usados.add(id(t))
                        dx = None if t["tinta_esq"] is None or ln.get("tinta_esq") is None else t["tinta_esq"] - ln["tinta_esq"]
                        rel.append(f"  '{ln['texto'].strip()}': tinta x desenho {ln.get('tinta_esq')} tela {t['tinta_esq']} (Δ {dx})  base desenho {ln['base']} tela {t['base']} (Δ {round(t['base'] - ln['base'], 2)})"
                                   f"  corpo desenho {it['corpo']} tela {t['corpo']}  fonte tela {t['fonte']} {t['peso']}")
                elif it["tipo"] == "texto-em-contorno":
                    cand = [t for t in tel["textos"] if t["tinta_esq"] is not None and abs(t["tinta_esq"] - it["tinta_esq"]) < 60 and abs(t["base"] - it["base"]) < 30]
                    if not cand:
                        rel.append(f"  contorno em x={it['tinta_esq']} y={it['base']}: nada na tela por perto")
                        continue
                    t = min(cand, key=lambda t: abs(t["tinta_esq"] - it["tinta_esq"]) + abs(t["base"] - it["base"]))
                    rel.append(f"  contorno em x={it['tinta_esq']} y={it['base']} -> tela '{t['texto'][:30]}': Δx {round(t['tinta_esq'] - it['tinta_esq'], 2)}  Δbase {round(t['base'] - it['base'], 2)}  corpo tela {t['corpo']}")
            rel.append("")
            rel.append("CAIXAS DO DESENHO x CAIXAS DA TELA (sobreposição de pelo menos 50%)")
            for it in des["itens"]:
                if it["tipo"] not in ("rect", "circle", "ellipse"):
                    continue
                c = it["caixa"]
                if (c[2] - c[0]) > 1900 and (c[3] - c[1]) > 100:
                    continue
                cand = sorted(((iou(c, x["caixa"]), x) for x in tel["caixas"]), key=lambda kv: -kv[0])
                if not cand or cand[0][0] < 0.5:
                    rel.append(f"  {it['tipo']} {c}: sem caixa correspondente na tela")
                    continue
                s, x = cand[0]
                d = [round(x["caixa"][i] - c[i], 2) for i in range(4)]
                rel.append(f"  {it['tipo']} {c} -> tela {x['caixa']} Δ(esq, topo, dir, pé) {d}  raio desenho {it.get('raio')} tela {x['raio']}  fundo desenho {it.get('preenchimento')} tela {x['fundo']}"
                           + (f"  sombra desenho {it['sombra']} tela {x['sombra']}" if it.get("sombra") else ""))
            rel.append("")
            rel.append("TELA FORA DA GRADE (tinta a 1–6 px de uma coluna de 80, base a 1–6 px de uma linha de 1080/67)")
            for t in tel["textos"]:
                if t["tinta_esq"] is not None:
                    kc, dc = perto(t["tinta_esq"], 80)
                    if 1 <= abs(dc) <= 6:
                        rel.append(f"  '{t['texto'][:40]}' tinta x={t['tinta_esq']} -> c{kc} ({dc:+})")
                kl, dl = perto(t["base"], LINHA)
                if 1 <= abs(dl) <= 6:
                    rel.append(f"  '{t['texto'][:40]}' base y={t['base']} -> linha {kl} ({dl:+})")
            ctx.close()
        b.close()
    (saida / "relatorio.txt").write_text("\n".join(rel), encoding="utf-8")
    print(f"saídas em {saida}")
    print("\n".join(rel[:400]))


if __name__ == "__main__":
    main()
