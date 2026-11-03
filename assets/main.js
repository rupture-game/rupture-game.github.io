/* RUPTURE — site officiel. Tout est dessiné ici : la vitre du fond, les vitres qui volent en éclats au défilement,
   le perso découpé dans les éclats (comme l'écran titre du jeu), le casting qui défile à l'horizontale. */
(() => {
  "use strict";

  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const ease = (t) => 1 - Math.pow(1 - t, 3);
  const smooth = (a, b, t) => { t = clamp((t - a) / (b - a)); return t * t * (3 - 2 * t); };
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  function rng(seed) {
    let s = (seed * 2654435761) >>> 0 || 1;
    return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return (s % 1000003) / 1000003; };
  }

  // Grille d'éclats autour d'un impact (même principe qu'Eclats.fracture dans le jeu) : rayons x anneaux.
  function fracture(px, py, rays, radii, seed) {
    const r = rng(seed);
    const angs = [];
    for (let j = 0; j < rays; j++) angs.push((Math.PI * 2 * j) / rays + (r() - 0.5) * ((Math.PI * 2) / rays) * 0.6);
    const V = radii.map((rad, i) => angs.map((a) => {
      const k = i ? rad * (0.84 + r() * 0.32) : 0;
      return [px + Math.cos(a) * k, py + Math.sin(a) * k];
    }));
    const shards = [];
    for (let i = 0; i < radii.length - 1; i++) {
      for (let j = 0; j < rays; j++) {
        const j2 = (j + 1) % rays;
        const poly = i === 0 ? [[px, py], V[1][j2], V[1][j]] : [V[i][j], V[i][j2], V[i + 1][j2], V[i + 1][j]];
        let cx = 0, cy = 0;
        for (const p of poly) { cx += p[0]; cy += p[1]; }
        shards.push({ poly, cx: cx / poly.length, cy: cy / poly.length, ring: i,
          rot: (r() - 0.5) * 2.6, spd: 0.7 + r() * 0.7, zk: 0.5 + r() * 1.0, drift: (r() - 0.5) * 0.8, lum: r() });
      }
    }
    return { shards, V, angs, ix: px, iy: py };
  }

  function path(ctx, poly) {
    ctx.beginPath();
    poly.forEach((p, k) => (k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.closePath();
  }

  /* ================================================================ fond : vitre brisée qui respire */
  const bg = $("#bg");
  const bctx = bg.getContext("2d");
  let bgBuf = null;
  const mouse = { x: innerWidth * 0.7, y: innerHeight * 0.35, tx: innerWidth * 0.7, ty: innerHeight * 0.35 };
  let bgCovered = false;

  function buildBg() {
    const w = Math.max(1, innerWidth), h = Math.max(1, innerHeight);
    bg.width = Math.round(w * DPR); bg.height = Math.round(h * DPR);
    bgBuf = document.createElement("canvas");
    bgBuf.width = bg.width; bgBuf.height = bg.height;
    const c = bgBuf.getContext("2d");
    c.scale(DPR, DPR);
    const g = c.createLinearGradient(0, 0, w * 0.4, h);
    g.addColorStop(0, "#0c0d22"); g.addColorStop(1, "#040510");
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    const diag = Math.hypot(w, h);
    const ix = w * 0.8, iy = h * 0.3;
    const f = fracture(ix, iy, 17, [0, 0.04, 0.1, 0.18, 0.3, 0.46, 0.68, 1].map((x) => x * diag), 7);
    const r = rng(99);
    for (const s of f.shards) {
      path(c, s.poly);
      c.fillStyle = `rgba(115,128,219,${(0.012 + s.lum * 0.05).toFixed(3)})`; c.fill();
      c.strokeStyle = `rgba(204,214,255,${(0.04 + r() * 0.09).toFixed(3)})`; c.lineWidth = 1; c.stroke();
    }
    // fêlure rouge : la marque de l'encre
    c.save();
    c.strokeStyle = "rgba(224,36,58,.7)"; c.lineWidth = 1.5; c.shadowColor = "rgba(224,36,58,.9)"; c.shadowBlur = 12;
    let x = ix, y = iy, a = Math.PI * 0.82;
    c.beginPath(); c.moveTo(x, y);
    for (let i = 0; i < 46; i++) {
      a += (r() - 0.5) * 0.75;
      const st = 12 + r() * 24;
      x += Math.cos(a) * st; y += Math.sin(a) * st;
      c.lineTo(x, y);
    }
    c.stroke(); c.restore();
  }

  function drawBg(t) {
    if (!bgBuf || bgCovered || !bgBuf.width || !bgBuf.height) return;
    mouse.x += (mouse.tx - mouse.x) * 0.05;
    mouse.y += (mouse.ty - mouse.y) * 0.05;
    bctx.setTransform(1, 0, 0, 1, 0, 0);
    bctx.globalCompositeOperation = "source-over";
    bctx.drawImage(bgBuf, 0, 0);
    bctx.globalCompositeOperation = "lighter";
    const breathe = 0.13 + Math.sin(t * 0.0009) * 0.04;
    const mx = mouse.x * DPR, my = mouse.y * DPR, R = Math.max(bg.width, bg.height) * 0.42;
    const rg = bctx.createRadialGradient(mx, my, 0, mx, my, R);
    rg.addColorStop(0, `rgba(115,128,219,${breathe.toFixed(3)})`); rg.addColorStop(1, "rgba(115,128,219,0)");
    bctx.fillStyle = rg; bctx.fillRect(0, 0, bg.width, bg.height);
    // reflet qui balaie la vitre
    const sweep = ((t * 0.00005) % 1.6 - 0.3) * bg.width;
    const lg = bctx.createLinearGradient(sweep - 200 * DPR, 0, sweep + 200 * DPR, bg.height * 0.3);
    lg.addColorStop(0, "rgba(204,214,255,0)"); lg.addColorStop(0.5, "rgba(204,214,255,.035)"); lg.addColorStop(1, "rgba(204,214,255,0)");
    bctx.fillStyle = lg; bctx.fillRect(0, 0, bg.width, bg.height);
    bctx.globalCompositeOperation = "source-over";
  }

  addEventListener("pointermove", (e) => { mouse.tx = e.clientX; mouse.ty = e.clientY; }, { passive: true });

  /* ================================================================ données des combattants */
  const CHARS = [
    ["nyx", "NYX", "L'Ombre", "#9b6bff", "Chaque pas laisse une ombre. Chaque ombre frappe avec moi.", [6, 142, 374]],
    ["zephyr", "ZÉPHYR", "Le Vent", "#6dffcf", "On ne frappe pas le vent. On le subit.", [5, 224, 390]],
    ["volta", "VOLTA", "La Foudre", "#ffe94d", "Tu as vu l'éclair ? Trop tard.", [6, 200, 380]],
    ["ignis", "IGNIS", "Le Feu", "#ff7a2b", "Tout finit en cendres. Surtout toi.", [5, 206, 334]],
    ["borea", "BORÉA", "La Glace", "#8fe3ff", "Le froid est patient. Moi aussi."],
    ["tellur", "TELLUR", "Le Géomancien", "#d9a35b", "La montagne ne recule pas."],
    ["kairos", "KAIROS", "Le Chronomancien", "#ffcf6b", "J'ai déjà vu comment ça se termine."],
    ["kragg", "KRAGG", "Le Berserker", "#ff3b3b", "Saigne avec moi."],
    ["vespera", "VESPERA", "L'Alchimiste", "#9dff4d", "Respire profondément. Voilà."],
    ["rivet", "RIVET", "L'Ingénieur", "#ffb03b", "J'ai un outil pour ça. Il fait BOUM."],
    ["satori", "SATORI", "Le Moine", "#ffe7a8", "La paix est un coup de poing bien placé."],
    ["oboro", "OBORO", "Le Shinobi", "#ff4dd2", "Tu frappes une bûche."],
    ["ac130", "AC-130", "L'Artilleur", "#ff6a3d", "Cible verrouillée. Feu à volonté."],
    ["astra", "ASTRA", "L'Anomalie", "#5dd6ff", "Tout ce que tu me lances finit par te revenir.", [6, 226, 385]],
    ["ronin", "RONIN", "La Lame Solitaire", "#e4e8ff", "Une seconde. Une coupe."],
    ["maree", "MARÉE", "La Houle des Abysses", "#3d8bff", "Tout finit par repartir au large."],
  ];

  function spriteEl(id, sp) {
    const s = document.createElement("div");
    s.className = "sprite";
    s.style.backgroundImage = `url(assets/chars/${id}_idle.webp)`;
    s.style.setProperty("--n", sp[0]); s.style.setProperty("--w", sp[1]); s.style.setProperty("--h", sp[2]);
    return s;
  }

  /* ================================================================ HÉROS : perso découpé dans les éclats */
  const hero = $(".shardhero");
  const frame = $(".frame", hero);
  const drawn = CHARS.filter((c) => c[5]);
  const heroShards = [];
  {
    const f = fracture(58, 44, 7, [0, 26, 170], 12);
    const r = rng(5);
    const edges = [];
    for (const s of f.shards) {
      const d = document.createElement("div");
      d.className = "sh";
      d.style.setProperty("--poly", "polygon(" + s.poly.map((p) => `${p[0].toFixed(2)}% ${p[1].toFixed(2)}%`).join(",") + ")");
      const dx = s.cx - 58, dy = s.cy - 44, n = Math.hypot(dx, dy) || 1;
      d.style.setProperty("--fx", `${((dx / n) * (40 + r() * 60)).toFixed(1)}%`);
      d.style.setProperty("--fy", `${((dy / n) * (40 + r() * 60) + 20).toFixed(1)}%`);
      d.style.setProperty("--fz", `${Math.round(120 + r() * 380)}px`);
      d.style.setProperty("--fr", `${Math.round((r() - 0.5) * 70)}deg`);
      d.style.transitionDelay = `${(r() * 0.18).toFixed(2)}s`;
      frame.appendChild(d);
      heroShards.push(d);
      edges.push("M" + s.poly.map((p) => `${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(" L") + " Z");
    }
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "edges"); svg.setAttribute("viewBox", "0 0 100 100"); svg.setAttribute("preserveAspectRatio", "none");
    for (const e of edges) {
      const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
      p.setAttribute("d", e); svg.appendChild(p);
    }
    frame.appendChild(svg);
  }
  let heroIdx = 0;
  function setHero(i) {
    const c = drawn[i % drawn.length];
    hero.style.setProperty("--c", c[3]);
    for (const d of heroShards) {
      d.textContent = "";
      d.appendChild(spriteEl(c[0], c[5]));
    }
    $("[data-who-name]").textContent = c[1];
    $("[data-who-title]").textContent = c[2];
    $("[data-who-line]").textContent = c[4];
    sizeHero();
  }
  function sizeHero() { hero.style.setProperty("--box", Math.round(hero.clientHeight * 0.84)); }
  setHero(0);
  if (!reduce) {
    hero.classList.add("flying");
    setTimeout(() => hero.classList.remove("flying"), 700);
    setInterval(() => {
      if (document.hidden || hero.getBoundingClientRect().bottom < 0) return;
      hero.classList.add("flying");
      setTimeout(() => { heroIdx++; setHero(heroIdx); hero.classList.remove("flying"); }, 620);
    }, 5200);
  }
  addEventListener("pointermove", (e) => {
    if (reduce) return;
    const rx = (e.clientY / innerHeight - 0.5) * -8, ry = (e.clientX / innerWidth - 0.5) * 12;
    frame.style.transform = `rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
  }, { passive: true });

  /* ================================================================ LA RUPTURE : vitres qui volent en éclats */
  const sh = $(".shatter");
  const cv = $("canvas", sh);
  const cx = cv.getContext("2d");
  const caps = $$(".cap", sh);
  const panes = caps.map((el) => { const img = new Image(); img.decoding = "async"; img.src = el.dataset.img; img.onload = () => (dirty = true); return { el, img }; });
  const IMPACTS = [[0.64, 0.42], [0.36, 0.52], [0.68, 0.56], [0.5, 0.4]];
  let W = 0, H = 0, frs = [], lastKey = "";
  let dirty = true;

  function layoutShatter() {
    W = Math.max(1, cv.clientWidth); H = Math.max(1, cv.clientHeight);
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    const diag = Math.hypot(W, H);
    frs = panes.map((_, i) => {
      const ip = IMPACTS[i % IMPACTS.length];
      return fracture(W * ip[0], H * ip[1], 13, [0, 0.045, 0.1, 0.18, 0.29, 0.43, 0.62, 0.9, 1.3].map((x) => x * diag), 31 + i * 17);
    });
    lastKey = ""; dirty = true;
  }

  function cover(img) {
    const ir = img.naturalWidth / img.naturalHeight, r = W / H;
    let w, h;
    if (ir > r) { h = H; w = H * ir; } else { w = W; h = W / ir; }
    return [(W - w) / 2, (H - h) / 2, w, h];
  }
  function drawImg(img, s = 1, alpha = 1) {
    if (!img.complete || !img.naturalWidth) return;
    const [x, y, w, h] = cover(img);
    cx.globalAlpha = alpha;
    cx.drawImage(img, x - (w * (s - 1)) / 2, y - (h * (s - 1)) / 2, w * s, h * s);
    cx.globalAlpha = 1;
  }

  // Les fêlures partent de l'impact et gagnent la vitre (c : 0 -> 1).
  function drawCracks(f, c) {
    const maxR = Math.hypot(W, H) * ease(c) * 1.05;
    cx.save();
    cx.lineCap = "round"; cx.lineJoin = "round";
    if (c < 0.35) {
      const fl = 1 - c / 0.35;
      const rg = cx.createRadialGradient(f.ix, f.iy, 0, f.ix, f.iy, 260);
      rg.addColorStop(0, `rgba(255,255,255,${(0.85 * fl).toFixed(3)})`); rg.addColorStop(1, "rgba(255,255,255,0)");
      cx.fillStyle = rg; cx.fillRect(f.ix - 260, f.iy - 260, 520, 520);
    }
    for (let i = 1; i < f.V.length; i++) {
      const rr = Math.hypot(f.V[i][0][0] - f.ix, f.V[i][0][1] - f.iy);
      if (rr > maxR * 0.9) break;
      path(cx, f.V[i]);
      cx.strokeStyle = "rgba(204,214,255,.5)"; cx.lineWidth = 1; cx.shadowColor = "rgba(204,214,255,.9)"; cx.shadowBlur = 4; cx.stroke();
    }
    for (let j = 0; j < f.angs.length; j++) {
      cx.beginPath(); cx.moveTo(f.ix, f.iy);
      for (let i = 1; i < f.V.length; i++) {
        const p = f.V[i][j], q = f.V[i - 1][j];
        const d = Math.hypot(p[0] - f.ix, p[1] - f.iy);
        if (d > maxR) {
          const dq = Math.hypot(q[0] - f.ix, q[1] - f.iy), k = (maxR - dq) / Math.max(1, d - dq);
          cx.lineTo(q[0] + (p[0] - q[0]) * k, q[1] + (p[1] - q[1]) * k);
          break;
        }
        cx.lineTo(p[0], p[1]);
      }
      const red = j === 3;
      cx.strokeStyle = red ? "rgba(255,53,80,.95)" : "rgba(235,240,255,.92)";
      cx.lineWidth = red ? 2.4 : 1.4;
      cx.shadowColor = red ? "#e0243a" : "rgba(204,214,255,.95)"; cx.shadowBlur = red ? 14 : 8;
      cx.stroke();
    }
    cx.restore();
  }

  // Chaque éclat emporte son morceau d'image et vole vers nous (e : 0 -> 1).
  function drawShards(f, img, e) {
    if (!img.complete || !img.naturalWidth) return;
    const [x, y, w, h] = cover(img);
    const ee = Math.pow(e, 1.5);
    const order = f.shards; // anneaux du centre en dernier : ils passent devant
    for (let k = order.length - 1; k >= 0; k--) {
      const s = order[k];
      const dx = s.cx - f.ix, dy = s.cy - f.iy, d = Math.hypot(dx, dy) || 1;
      const push = ee * (140 + d * 1.15) * s.spd;
      const tx = s.cx + (dx / d) * push + s.drift * ee * 220;
      const ty = s.cy + (dy / d) * push + e * e * 300 * s.spd;
      const z = 1 + e * e * (0.5 + 1.6 / (1 + s.ring * 0.5)) * s.zk;
      const a = 1 - smooth(0.6, 1, e);
      if (a <= 0.01) continue;
      cx.save();
      cx.globalAlpha = a;
      cx.translate(tx, ty); cx.rotate(s.rot * ee); cx.scale(z, z); cx.translate(-s.cx, -s.cy);
      path(cx, s.poly);
      cx.save(); cx.clip();
      cx.drawImage(img, x, y, w, h);
      cx.fillStyle = `rgba(204,214,255,${(0.04 + 0.22 * e * s.lum).toFixed(3)})`; cx.fill();
      cx.restore();
      cx.strokeStyle = `rgba(235,240,255,${(0.85 * a).toFixed(3)})`; cx.lineWidth = 1.3 / z; cx.stroke();
      cx.restore();
    }
  }

  function renderShatter() {
    const r = sh.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) return;
    const total = sh.offsetHeight - innerHeight;
    const prog = clamp(-r.top / total);
    const n = panes.length;
    const P = prog * (n - 1 + 0.3);
    let i = Math.floor(P), t = P - i;
    if (i >= n - 1) { i = n - 1; t = 0; }
    const key = `${W}x${H}:${P.toFixed(4)}`;
    if (key === lastKey && !dirty) return;
    lastKey = key; dirty = false;

    cx.setTransform(DPR, 0, 0, DPR, 0, 0);
    cx.fillStyle = "#040510"; cx.fillRect(0, 0, W, H);
    const cur = panes[i].img, nxt = panes[Math.min(i + 1, n - 1)].img;
    if (reduce || i === n - 1 || t < 0.3) {
      drawImg(cur, 1 + 0.04 * (1 - smooth(0, 0.3, t)) * (i === 0 ? 0 : 1));
    } else if (t < 0.5) {
      const c = (t - 0.3) / 0.2;
      const shake = c < 0.25 ? (1 - c / 0.25) * 7 : 0;
      cx.save(); cx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
      drawImg(cur, 1.0);
      drawCracks(frs[i], c);
      cx.restore();
    } else {
      const e = (t - 0.5) / 0.5;
      drawImg(nxt, 1.04 - 0.04 * ease(e), 0.25 + 0.75 * ease(e));
      drawShards(frs[i], cur, e);
    }
    // légendes : celle de la vitre en place, la suivante quand la nouvelle vitre est là
    const on = reduce ? i : (t < 0.42 ? i : t > 0.82 ? i + 1 : -1);
    caps.forEach((c, k) => c.classList.toggle("on", k === on));
    $("[data-count]", sh).textContent = String(Math.min(n, (t > 0.75 ? i + 2 : i + 1))).padStart(2, "0");
    $("[data-hint]", sh).style.opacity = i === 0 && t < 0.25 ? 1 - t * 4 : 0;
  }

  /* ================================================================ COMBATTANTS : défilement horizontal */
  const roster = $(".roster");
  const track = $(".track", roster);
  CHARS.forEach((c, k) => {
    const a = document.createElement("article");
    a.className = "card";
    a.style.setProperty("--c", c[3]);
    const art = document.createElement("div");
    art.className = "art";
    if (c[5]) {
      art.appendChild(spriteEl(c[0], c[5]));
    } else {
      art.innerHTML = `<img class="glyph-bg" src="assets/chars/glyph_${c[0]}.png" alt=""><img class="glyph" src="assets/chars/glyph_${c[0]}.png" alt="" loading="lazy">`;
    }
    a.appendChild(art);
    a.insertAdjacentHTML("beforeend",
      `<span class="no">${String(k + 1).padStart(2, "0")}</span><h3>${c[1]}</h3><div class="title">${c[2]}</div>` +
      `<svg class="brush" viewBox="0 0 400 24" preserveAspectRatio="none" aria-hidden="true"><path pathLength="1" d="M6 15 C 70 6, 130 20, 200 11 S 330 16, 394 9"/></svg>` +
      `<q>${c[4]}</q>`);
    track.appendChild(a);
  });
  let rosterExtra = 0;
  function layoutRoster() {
    const last = track.lastElementChild, gut = parseFloat(getComputedStyle(track).paddingLeft) || 0;
    rosterExtra = Math.max(0, last.offsetLeft + last.offsetWidth + gut - innerWidth);
    roster.style.height = `${innerHeight + rosterExtra}px`;
    for (const art of $$(".card .art", track)) art.style.setProperty("--box", Math.round(art.clientHeight * 0.96));
  }
  let tilt = 0;
  function renderRoster(vel) {
    const r = roster.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) return;
    const p = clamp(-r.top / Math.max(1, roster.offsetHeight - innerHeight));
    track.style.transform = `translate3d(${(-p * rosterExtra).toFixed(1)}px,0,0)`;
    $(".progress i", roster).style.setProperty("--p", p.toFixed(4));
    tilt += (clamp(-vel * 0.5, -16, 16) - tilt) * 0.12;
    track.style.setProperty("--tilt", `${tilt.toFixed(2)}deg`);
  }

  /* ================================================================ ARÈNES : la vitre se recompose en arrivant */
  const mosaic = $("[data-mosaic]");
  function renderMosaic() {
    const r = mosaic.getBoundingClientRect();
    if (r.bottom < -200 || r.top > innerHeight + 200) return;
    const p = reduce ? 1 : ease(clamp((innerHeight - r.top) / (innerHeight * 0.95)));
    mosaic.style.setProperty("--p", p.toFixed(4));
  }
  function closeMosaic() {
    $$(".piece.open", mosaic).forEach((x) => x.classList.remove("open"));
    mosaic.classList.remove("has-open");
  }
  $$(".piece", mosaic).forEach((pc) => {
    const open = () => {
      const was = pc.classList.contains("open");
      closeMosaic();
      if (was) return;
      pc.classList.add("open"); mosaic.classList.add("has-open");
      $("[data-open-name]", mosaic).textContent = pc.dataset.name;
      $("[data-open-theme]", mosaic).textContent = pc.dataset.theme;
    };
    pc.addEventListener("click", open);
    pc.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
  });
  addEventListener("keydown", (e) => { if (e.key === "Escape") closeMosaic(); });

  /* ================================================================ cinématique d'ulti */
  const cine = $(".cine");
  function renderCine() {
    const r = cine.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) return;
    const prog = clamp((innerHeight - r.top) / (cine.offsetHeight));
    cine.style.setProperty("--p", smooth(0.2, 0.55, prog).toFixed(4));
    cine.style.setProperty("--q", smooth(0.45, 0.7, prog).toFixed(4));
  }

  /* ================================================================ fil d'encre + navigation */
  const inkFill = $(".inkline .fill");
  const nav = $(".nav");
  const links = $$(".nav ul a");
  const sections = links.map((a) => $(a.getAttribute("href")));
  let lastY = scrollY;
  function renderChrome() {
    const max = document.documentElement.scrollHeight - innerHeight;
    inkFill.setAttribute("stroke-dashoffset", (1 - clamp(scrollY / Math.max(1, max))).toFixed(4));
    nav.classList.toggle("scrolled", scrollY > 40);
    if (Math.abs(scrollY - lastY) > 6) { nav.classList.toggle("hide", scrollY > lastY && scrollY > 300); lastY = scrollY; }
    let on = -1;
    sections.forEach((s, k) => { if (s && s.getBoundingClientRect().top < innerHeight * 0.5) on = k; });
    links.forEach((a, k) => a.classList.toggle("on", k === on));
    // le fond n'est pas dessiné quand une scène plein écran le recouvre
    const sr = sh.getBoundingClientRect(), cr = cine.getBoundingClientRect(), rr = roster.getBoundingClientRect();
    bgCovered = (sr.top <= 0 && sr.bottom >= innerHeight) || (cr.top <= -innerHeight * 0.1 && cr.bottom >= innerHeight);
    void rr;
  }

  /* ================================================================ apparitions, compteurs, reflets */
  const io = new IntersectionObserver((ents) => {
    for (const en of ents) {
      if (!en.isIntersecting) continue;
      en.target.classList.add("in");
      io.unobserve(en.target);
      for (const b of $$("[data-to]", en.target)) countUp(b);
    }
  }, { threshold: 0.18 });
  $$(".watch, .reveal").forEach((el) => io.observe(el));

  function countUp(b) {
    const to = +b.dataset.to, suf = b.dataset.suffix ? `<sup>${b.dataset.suffix}</sup>` : "";
    if (reduce || to === 0) { b.innerHTML = to + suf; return; }
    const t0 = performance.now(), dur = 1400;
    const step = (now) => {
      const k = clamp((now - t0) / dur);
      b.innerHTML = Math.round(ease(k) * to) + suf;
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  $$(".feat").forEach((f) => f.addEventListener("pointermove", (e) => {
    const r = f.getBoundingClientRect();
    f.style.setProperty("--mx", `${e.clientX - r.left}px`); f.style.setProperty("--my", `${e.clientY - r.top}px`);
  }));

  // ancres : défilement doux (sans toucher au défilement natif)
  $$('a[href^="#"]').forEach((a) => a.addEventListener("click", (e) => {
    const t = $(a.getAttribute("href"));
    if (!t) return;
    e.preventDefault();
    t.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }));

  /* ================================================================ dernière version (API GitHub, sinon la page des versions) */
  fetch("https://api.github.com/repos/Yoyotaa/rupture-releases/releases/latest", { headers: { Accept: "application/vnd.github+json" } })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      if (!d) return;
      const v = String(d.tag_name || "").replace(/^v/, "");
      for (const a of d.assets || []) {
        if (/windows\.zip$/i.test(a.name)) $('[data-dl="windows"]').href = a.browser_download_url;
        if (/macos\.zip$/i.test(a.name)) $('[data-dl="macos"]').href = a.browser_download_url;
      }
      const when = d.published_at ? new Date(d.published_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "";
      $("[data-version-long]").textContent = `Version ${v}${when ? ` · publiée le ${when}` : ""} · Windows 10+ et macOS 11+`;
      $("[data-version]").textContent = `v${v} · Windows · macOS`;
    })
    .catch(() => {});

  /* ================================================================ boucle */
  function layout() {
    buildBg();
    layoutShatter();
    layoutRoster();
    sizeHero();
  }
  let rt = 0;
  addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(layout, 120); });
  let prevY = scrollY, vel = 0;
  function loop(t) {
    const y = scrollY;
    vel = vel * 0.8 + (y - prevY) * 0.2;
    prevY = y;
    renderChrome();
    drawBg(t);
    renderShatter();
    renderRoster(vel);
    renderMosaic();
    renderCine();
    requestAnimationFrame(loop);
  }
  document.fonts && document.fonts.ready.then(layoutRoster);
  layout();
  requestAnimationFrame(loop);
})();
