// O degradê de "3 cores" e "4 cores" das Facas entra pelo canto de cima da
// lista e se espalha como café no leite. A primeira versão era uma máscara em
// CSS, e máscara em CSS só sabe fazer círculo (Augusto, 30/09/2026: "se
// estende como um círculo, conseguimos deixar mais fluindo como o exemplo do
// café?"). Aqui a forma sai de um ruído que se dobra sobre si mesmo e anda com
// o tempo: a borda avança em lóbulos e fios, e as cores giram enquanto a cor
// entra e sossegam depois.
//
// Desenhado na placa de vídeo (WebGL) em meia resolução: a cor é macia, meia
// resolução não se distingue da inteira, e o quadro custa ~3 ms numa Intel HD
// 630 (a inteira custava ~9). Sem WebGL, ou com "reduzir movimento", fica a
// versão em CSS (.fer10-derrame, em styles.css).
import { useEffect, useRef, useState } from "react";

const ESCALA = 0.5;
/** raio da frente (altura da área = 1) em cada segundo. Medido no protótipo
 *  para cobrir 5% da área em 1 s, 22% em 2 s, 45% em 3 s, 68% em 4 s, 87% em 5 s
 *  e 97% em 6 s. O primeiro ponto de cor aparece no raio 0,16; com 2,2 o alfa é
 *  cheio em qualquer ponto, seja qual for o ruído (limite de conta). */
const RAIOS: [number, number][] = [[0, 0.12], [1, 0.419], [2, 0.665], [3, 0.826], [4, 0.988], [5, 1.145], [6, 1.287], [7, 1.42], [10, 2.2]];
const FIM_DO_DERRAME = 10;
const SAIDA = 600;
/** a imagem um pouco ampliada, como a camada de CSS (inset −14%): o giro das
 *  cores não chega na borda da imagem */
const ZOOM = 1 / 1.2;

const VERTICE = "attribute vec2 a; void main() { gl_Position = vec4(a, 0.0, 1.0); }";
const FRAGMENTO = `precision highp float;
uniform vec2 uRes;
uniform float uR;
uniform float uF;
uniform float uMexe;
uniform float uFade;
uniform float uTemAntes;
uniform vec2 uCobre;
uniform sampler2D uImg;
uniform sampler2D uAntes;

float h(vec2 p) { p = fract(p * vec2(233.34, 851.73)); p += dot(p, p + 23.45); return fract(p.x * p.y); }
float vn(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  return mix(mix(h(i), h(i + vec2(1.0, 0.0)), u.x), mix(h(i + vec2(0.0, 1.0)), h(i + vec2(1.0, 1.0)), u.x), u.y);
}
const mat2 M = mat2(1.6, 1.2, -1.2, 1.6);
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * vn(p); p = M * p; a *= 0.5; } return s / 0.9375; }

void main() {
  vec2 fc = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec2 p0 = fc / uRes.y;
  /* o ruído esticado ao longo da diagonal: os fios seguem o caminho da cor */
  vec2 dg = vec2(0.70710678);
  vec2 p = vec2(dot(p0, dg) / 1.3, dot(p0, vec2(-dg.y, dg.x)) * 1.3) * 1.2;
  vec2 q = vec2(fbm(p * 1.8 + uF * vec2(0.020, 0.013)), fbm(p * 1.8 + vec2(5.2, 1.3) - uF * vec2(0.015, 0.022)));
  vec2 r = vec2(fbm(p * 2.4 + 1.2 * q + vec2(1.7, 9.2) + uF * 0.030), fbm(p * 2.4 + 1.2 * q + vec2(8.3, 2.8) - uF * 0.026));
  float n = fbm(p * 1.6 + 1.4 * r);
  /* distância ao canto, dobrada pelo ruído: quanto mais longe, maiores os lóbulos */
  float d = length(p0 + vec2(0.06));
  float dd = d - (n - 0.5) * (0.22 + 0.55 * d);
  float fios = (fbm(p * 7.0 + 4.0 * r - uF * 0.05) - 0.5) * (0.03 + 0.045 * d);
  float a = clamp((uR - dd + fios) / (0.13 + 0.13 * d), 0.0, 1.0);
  a = a * a * (3.0 - 2.0 * a);
  vec2 uv = 0.5 + (fc / uRes - 0.5) * uCobre + (r - 0.5) * uMexe;
  vec4 cor = vec4(texture2D(uImg, uv).rgb * a, a);
  vec4 antes = uTemAntes > 0.5 ? texture2D(uAntes, gl_FragCoord.xy / uRes) : vec4(0.0);
  gl_FragColor = (cor + antes * (1.0 - a)) * uFade;
}`;

const suave = (x: number) => { const c = Math.min(1, Math.max(0, x)); return c * c * (3 - 2 * c); };

/** o raio da tabela no tempo t, por uma curva de Hermite (sem degraus de velocidade) */
function raio(t: number): number {
  const T = RAIOS;
  if (t <= T[0][0]) return T[0][1];
  for (let i = 1; i < T.length; i++) {
    if (t > T[i][0]) continue;
    const [t0, r0] = T[i - 1], [t1, r1] = T[i], dt = t1 - t0;
    const m0 = i > 1 ? (r1 - T[i - 2][1]) / (t1 - T[i - 2][0]) : (r1 - r0) / dt;
    const m1 = i < T.length - 1 ? (T[i + 1][1] - r0) / (T[i + 1][0] - t0) : (r1 - r0) / dt;
    const u = (t - t0) / dt, u2 = u * u, u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * r0 + (u3 - 2 * u2 + u) * dt * m0 + (-2 * u3 + 3 * u2) * r1 + (u3 - u2) * dt * m1;
  }
  return T[T.length - 1][1];
}
/** quanto as cores giram: bastante enquanto a cor entra, pouco depois */
const mexe = (t: number) => 0.045 + 0.045 * (1 - suave(t / 8));
/** a velocidade do ruído: a forma se mexe mais durante o derrame */
const velocidade = (t: number) => 0.6 + 0.6 * (1 - suave(t / FIM_DO_DERRAME));

type Textura = { tex: WebGLTexture; w: number; h: number };
type Alvo = { tex: WebGLTexture; fb: WebGLFramebuffer };
type Motor = { definir: (src: string | null) => void; carregar: (src: string) => void; destruir: (soltar: boolean) => void };

function criarMotor(cvs: HTMLCanvasElement, aoPerder: () => void): Motor | null {
  const gl = cvs.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: "low-power" });
  if (!gl) return null;
  const W = cvs.width, H = cvs.height;
  const compilar = (tipo: number, fonte: string) => {
    const s = gl.createShader(tipo);
    if (!s) return null;
    gl.shaderSource(s, fonte);
    gl.compileShader(s);
    return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
  };
  const vs = compilar(gl.VERTEX_SHADER, VERTICE);
  const fs = compilar(gl.FRAGMENT_SHADER, FRAGMENTO);
  const prog = gl.createProgram();
  if (!vs || !fs || !prog) return null;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, "a");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
  const u = (n: string) => gl.getUniformLocation(prog, n);
  const U = { res: u("uRes"), r: u("uR"), f: u("uF"), mexe: u("uMexe"), fade: u("uFade"), temAntes: u("uTemAntes"), cobre: u("uCobre"), img: u("uImg"), antes: u("uAntes") };
  gl.uniform1i(U.img, 0);
  gl.uniform1i(U.antes, 1);
  gl.uniform2f(U.res, W, H);

  const novaTextura = () => {
    const tex = gl.createTexture();
    if (!tex) return null;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
  };
  /* a foto do que está na tela, para a cor nova derramar por cima dela */
  const novoAlvo = (): Alvo | null => {
    const tex = novaTextura();
    const fb = gl.createFramebuffer();
    if (!tex || !fb) return null;
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return ok ? { tex, fb } : null;
  };
  const A0 = novoAlvo(), A1 = novoAlvo();
  /* 1 px transparente no lugar da imagem enquanto ela não chega */
  const vazia = novaTextura();
  if (!A0 || !A1 || !vazia) return null;
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));

  const texturas = new Map<string, Textura | null>();
  let atual: { src: string; inicio: number | null } | null = null;
  let antes: Alvo | null = null;
  let saindoDesde: number | null = null;
  let fluxo = 0, ultimo = 0, ultimoDesenho = 0, quadro = 0, morto = false;

  const pronta = (src: string) => texturas.get(src) ?? null;
  const fadeEm = (agora: number) => (saindoDesde === null ? 1 : Math.max(0, 1 - (agora - saindoDesde) / SAIDA));
  const tempoDe = (agora: number) => (atual && atual.inicio !== null ? (agora - atual.inicio) / 1000 : 0);

  /* a composição de agora (a cor nova sobre a foto de baixo) na tela ou num alvo */
  const desenhar = (fb: WebGLFramebuffer | null, agora: number) => {
    const img = atual && atual.inicio !== null ? pronta(atual.src) : null;
    const t = tempoDe(agora);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.viewport(0, 0, W, H);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, img ? img.tex : vazia);
    gl.activeTexture(gl.TEXTURE1);
    /* nunca a textura do alvo em que se desenha */
    gl.bindTexture(gl.TEXTURE_2D, antes ? antes.tex : fb === A0.fb ? A1.tex : A0.tex);
    gl.uniform1f(U.r, img ? raio(t) : -10);
    gl.uniform1f(U.f, fluxo);
    gl.uniform1f(U.mexe, mexe(t));
    gl.uniform1f(U.fade, fadeEm(agora));
    gl.uniform1f(U.temAntes, antes ? 1 : 0);
    const asp = img ? W / H / (img.w / img.h) : 1;
    gl.uniform2f(U.cobre, asp * ZOOM, ZOOM);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const passo = (agora: number) => {
    quadro = 0;
    if (morto) return;
    const dt = Math.min(0.1, Math.max(0, (agora - ultimo) / 1000));
    ultimo = agora;
    /* a imagem ficou pronta: o relógio do derrame começa neste quadro */
    if (atual && atual.inicio === null && pronta(atual.src)) atual.inicio = agora;
    const t = tempoDe(agora);
    fluxo += dt * velocidade(t);
    /* em 10 s o raio passa de 2,2 e a cor nova cobre tudo: a foto de baixo sai */
    if (antes && atual && atual.inicio !== null && t >= FIM_DO_DERRAME) antes = null;
    if (saindoDesde !== null && fadeEm(agora) <= 0) {
      atual = null;
      antes = null;
      saindoDesde = null;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      return;
    }
    if (!atual && !antes) return;
    /* a imagem ainda não chegou: a tela já mostra o que tinha, e o onload da
       imagem volta a pedir quadros */
    if (atual && atual.inicio === null && saindoDesde === null) return;
    /* assentada, a cor só mexe devagar: 30 quadros por segundo bastam */
    const assentada = t >= FIM_DO_DERRAME && saindoDesde === null && !antes;
    if (!assentada || agora - ultimoDesenho >= 32) {
      desenhar(null, agora);
      ultimoDesenho = agora;
    }
    pedirQuadro();
  };
  const pedirQuadro = () => {
    if (quadro || morto) return;
    if (!ultimo) ultimo = performance.now();
    quadro = requestAnimationFrame(passo);
  };

  const carregar = (src: string, tentativa = 0) => {
    if (tentativa === 0 && texturas.has(src)) return;
    texturas.set(src, null);
    const img = new Image();
    img.onload = () => {
      if (morto) return;
      const tex = novaTextura();
      if (!tex) return;
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      texturas.set(src, { tex, w: img.naturalWidth, h: img.naturalHeight });
      pedirQuadro();
    };
    /* sem a imagem não há cor para derramar (o CSS usaria a mesma imagem):
       tenta mais três vezes; depois sai do mapa, e o próximo clique tenta de novo */
    img.onerror = () => {
      if (morto) return;
      if (tentativa < 3) setTimeout(() => { if (!morto) carregar(src, tentativa + 1); }, 1500);
      else texturas.delete(src);
    };
    img.src = src;
  };

  const definir = (src: string | null) => {
    const agora = performance.now();
    if (src === null) {
      if ((atual || antes) && saindoDesde === null) saindoDesde = agora;
      pedirQuadro();
      return;
    }
    carregar(src);
    if (atual && atual.src === src && saindoDesde === null) return;
    /* o que está na tela (mesmo no meio de um derrame ou de uma saída) vira a
       foto de baixo, e a cor nova derrama por cima */
    if (atual || antes) {
      const livre = antes === A0 ? A1 : A0;
      desenhar(livre.fb, agora);
      antes = livre;
    }
    atual = { src, inicio: null };
    saindoDesde = null;
    pedirQuadro();
  };

  const perdeu = (e: Event) => {
    e.preventDefault();
    morto = true;
    aoPerder();
  };
  cvs.addEventListener("webglcontextlost", perdeu);

  /* `soltar`: o canvas saiu da página, e o contexto é devolvido na hora (o
     navegador segura poucos). No StrictMode do dev o efeito desmonta e monta
     de novo com o MESMO canvas: aí o contexto fica, para o motor novo usar. */
  const destruir = (soltar: boolean) => {
    morto = true;
    if (quadro) cancelAnimationFrame(quadro);
    cvs.removeEventListener("webglcontextlost", perdeu);
    for (const t of texturas.values()) if (t) gl.deleteTexture(t.tex);
    for (const a of [A0, A1]) { gl.deleteFramebuffer(a.fb); gl.deleteTexture(a.tex); }
    gl.deleteTexture(vazia);
    gl.deleteBuffer(buf);
    gl.deleteProgram(prog);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (soltar) gl.getExtension("WEBGL_lose_context")?.loseContext();
  };

  return { definir, carregar: (src: string) => carregar(src), destruir };
}

/** A versão em CSS: sem WebGL ou com "reduzir movimento". Trocando de cor, a
 *  nova derrama por cima e a velha sai quando a nova já cobriu; desligando, a
 *  cor esmaece. */
function DerrameCss({ src, left, top, width, height }: { src: string | null; left: number; top: number; width: number; height: number }) {
  const [camadas, setCamadas] = useState<{ id: number; src: string; saindo: boolean }[]>([]);
  const id = useRef(0);
  useEffect(() => {
    setCamadas((atual) => {
      const vivas = atual.filter((d) => !d.saindo);
      if (src && vivas.length && vivas[vivas.length - 1].src === src) return atual;
      if (!src) return vivas.length ? atual.map((d) => ({ ...d, saindo: true })) : atual;
      return [...atual, { id: ++id.current, src, saindo: false }];
    });
  }, [src]);
  useEffect(() => {
    if (!camadas.length) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    if (camadas.some((d) => d.saindo)) timers.push(setTimeout(() => setCamadas((a) => a.filter((d) => !d.saindo)), 650));
    const topo = camadas[camadas.length - 1];
    if (camadas.some((d) => !d.saindo && d.id !== topo.id)) {
      /* a mancha do canto chega ao raio 100% em 6,8 s (curva e tempos no
         CSS): dali em diante a nova cobre a área toda sem transparência, e a
         velha, embaixo, só pesaria na animação */
      timers.push(setTimeout(() => setCamadas((a) => a.filter((d) => d.saindo || d === a[a.length - 1])), 7200));
    }
    return () => timers.forEach(clearTimeout);
  }, [camadas]);
  return (
    <>
      {camadas.map((d) => (
        <div key={d.id} aria-hidden className={`fer10-derrame${d.saindo ? " sai" : ""}`} style={{ left, top, width, height }}>
          <i style={{ backgroundImage: `url(${d.src})` }} />
        </div>
      ))}
    </>
  );
}

export function DerrameHub10({ src, left, top, width, height, imagens }: {
  src: string | null; left: number; top: number; width: number; height: number;
  /** as imagens que podem ser pedidas, carregadas já na abertura */
  imagens?: string[];
}) {
  const [modo, setModo] = useState<"gl" | "css">("gl");
  const cvs = useRef<HTMLCanvasElement | null>(null);
  const motor = useRef<Motor | null>(null);
  const srcAgora = useRef(src);
  srcAgora.current = src;
  const imagensAgora = useRef(imagens);
  imagensAgora.current = imagens;

  useEffect(() => {
    const el = cvs.current;
    if (modo !== "gl" || !el) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { setModo("css"); return; }
    const m = criarMotor(el, () => setModo("css"));
    if (!m) { setModo("css"); return; }
    motor.current = m;
    imagensAgora.current?.forEach(m.carregar);
    m.definir(srcAgora.current);
    return () => { m.destruir(!el.isConnected); motor.current = null; };
  }, [modo]);
  useEffect(() => { motor.current?.definir(src); }, [src]);

  if (modo === "css") return <DerrameCss src={src} left={left} top={top} width={width} height={height} />;
  return (
    <canvas ref={cvs} aria-hidden className="fer10-cafe" width={Math.round(width * ESCALA)} height={Math.round(height * ESCALA)}
      style={{ position: "absolute", left, top, width, height, pointerEvents: "none" }} />
  );
}
