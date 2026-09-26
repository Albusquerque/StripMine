import { useEffect, useRef } from "react";
import type { CityPlot, RGB, StripMineStatus, WorkerState } from "../types";

const RANKS = ["#ffd13f", "#35e57d", "#ff8423", "#fa4697", "#f4f7ff"];
const DEPOSIT_CENTERS = [10, 9, 11, 8, 10, 8];
const DEPOSIT_SECONDARY: RGB[] = [[255,122,44], [88,217,156], [239,94,55], [234,87,178], [255,191,63], [255,79,154]];
const rgb = (value: RGB, alpha = 1) => `rgba(${value[0]},${value[1]},${value[2]},${alpha})`;
const shade = (value: RGB, lift = 0, alpha = 1) => `rgba(${value.map((channel) => Math.max(0, Math.min(255, channel + lift))).join(",")},${alpha})`;
const hexRgb = (hex: string): RGB => [Number.parseInt(hex.slice(1,3),16), Number.parseInt(hex.slice(3,5),16), Number.parseInt(hex.slice(5,7),16)];
const shadeHex = (hex: string, lift = 0, alpha = 1) => shade(hexRgb(hex), lift, alpha);

function building(ctx: CanvasRenderingContext2D, x: number, base: number, index: number, plot: CityPlot | null, side: "left" | "right", time: number) {
  const width = [104, 94, 116][index];
  const height = [188, 238, 211][index] + (plot ? Math.min(110, Math.max(1, plot.level) * 11) : 0);
  const colour = plot ? (side === "left" ? plot.left : plot.right) : null;
  const accent = colour ? rgb(colour) : "#745a39";
  const top = base - height;
  const mirrored = side === "right";
  const poly = (fill: string, points: number[][]) => { ctx.fillStyle = fill; ctx.beginPath(); points.forEach(([px, py], point) => point ? ctx.lineTo(px, py) : ctx.moveTo(px, py)); ctx.closePath(); ctx.fill(); };
  ctx.save();
  if (!plot) {
    ctx.strokeStyle = "#6a4930"; ctx.lineWidth = 6; ctx.strokeRect(x, top, width, height);
    ctx.strokeStyle = "#9a7046"; ctx.lineWidth = 3; for (let y = top + 26; y < base; y += 37) { ctx.beginPath(); ctx.moveTo(x - 7, y); ctx.lineTo(x + width + 7, y); ctx.stroke(); }
    ctx.strokeStyle = "#4a3225"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x + 4, base - 3); ctx.lineTo(x + width - 4, top + 3); ctx.moveTo(x + width - 4, base - 3); ctx.lineTo(x + 4, top + 3); ctx.stroke();
    const ropeX = x + (mirrored ? 21 : width - 21); const sway = Math.sin(time * .0012 + x) * 3; ctx.strokeStyle = "rgba(188,155,98,.72)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(ropeX, top - 24); ctx.quadraticCurveTo(ropeX + sway, (top + base) / 2, ropeX + sway * .4, base - 39); ctx.stroke();
    ctx.fillStyle = "#a77a3f"; ctx.beginPath(); ctx.arc(ropeX + sway * .4, base - 35, 7, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#c29143"; ctx.fillRect(x + 19, base - 46, width - 38, 22); ctx.fillStyle = "#3d2b21"; ctx.fillRect(x + 24, base - 41, width - 48, 3); ctx.fillRect(x + 34, base - 34, width - 68, 3);
    ctx.restore(); return;
  }
  ctx.globalAlpha = .34; ctx.fillStyle = "#020607"; ctx.fillRect(x - 8, top + 14, 8, height - 14); ctx.fillRect(x + 8, base, width + 8, 7); ctx.globalAlpha = 1;
  if (index === 0) {
    ctx.fillStyle = "#5f3029"; ctx.fillRect(x, top + 46, width, height - 46); for (let y = top + 52; y < base - 9; y += 14) { ctx.fillStyle = y % 28 ? "#8c4938" : "#744035"; for (let xx = x + ((y / 14) % 2 ? 0 : 9); xx < x + width; xx += 20) ctx.fillRect(xx, y, 16, 9); }
    poly("#241c1c", [[x - 8, top + 51], [x + 18, top + 18], [x + 47, top + 51], [x + 74, top + 17], [x + width + 8, top + 51]]); poly(accent, [[x - 4, top + 47], [x + 18, top + 25], [x + 45, top + 47], [x + 74, top + 24], [x + width + 4, top + 47]]);
    const chimney = mirrored ? x + 10 : x + width - 27; ctx.fillStyle = "#231b1a"; ctx.fillRect(chimney - 4, top - 24, 24, 71); ctx.fillStyle = "#8e583e"; ctx.fillRect(chimney, top - 20, 16, 67); ctx.fillStyle = "#ca8253"; ctx.fillRect(chimney - 4, top - 23, 24, 8);
    const furnace = ctx.createRadialGradient(x + width / 2, base - 31, 1, x + width / 2, base - 31, 34); furnace.addColorStop(0, "rgba(255,225,122,.95)"); furnace.addColorStop(.4, "rgba(255,112,48,.72)"); furnace.addColorStop(1, "transparent"); ctx.fillStyle = furnace; ctx.fillRect(x + width / 2 - 38, base - 69, 76, 70); ctx.fillStyle = "#17191a"; ctx.fillRect(x + width / 2 - 23, base - 54, 46, 54); ctx.fillStyle = "#ef8a3d"; ctx.fillRect(x + width / 2 - 16, base - 42, 32, 35); ctx.fillStyle = "#ffe7a1"; ctx.fillRect(x + width / 2 - 8, base - 35, 16, 24);
  } else if (index === 1) {
    ctx.fillStyle = "#d0b27c"; ctx.fillRect(x, top + 38, width, height - 38); ctx.fillStyle = "#9d8059"; for (let y = top + 46; y < base - 8; y += 16) ctx.fillRect(x + 4, y, width - 8, 2);
    poly("#241d20", [[x - 9, top + 45], [x + width / 2, top - 9], [x + width + 9, top + 45]]); poly(accent, [[x - 3, top + 39], [x + width / 2, top], [x + width + 3, top + 39]]);
    ctx.fillStyle = "#6a4930"; ctx.fillRect(x, top + 38, width, 8); ctx.fillRect(x + 7, top + 38, 7, height - 38); ctx.fillRect(x + width - 14, top + 38, 7, height - 38); ctx.fillRect(x + width / 2 - 3, top + 43, 6, height - 43);
    for (let y = top + 76; y < base - 31; y += 51) { ctx.fillStyle = "#2a2522"; ctx.fillRect(x - 8, y, width + 16, 9); ctx.fillStyle = "#a36d3e"; ctx.fillRect(x - 5, y - 4, width + 10, 5); ctx.fillStyle = "#ead38f"; for (let xx = x + 10; xx < x + width - 8; xx += 24) { ctx.fillRect(xx, y - 27, 14, 20); ctx.fillStyle = "#fff4be"; ctx.fillRect(xx + 3, y - 24, 3, 14); ctx.fillStyle = "#ead38f"; } }
    ctx.fillStyle = accent; ctx.fillRect(x + width - 25, top + 57, 18, 56); ctx.fillStyle = "#251c18"; ctx.fillRect(x + width / 2 - 15, base - 42, 30, 42);
  } else {
    ctx.fillStyle = "#26383b"; ctx.fillRect(x, top + 68, width, height - 68); for (let y = top + 77; y < base - 9; y += 18) for (let xx = x + 4 + ((y / 18) % 2 ? 0 : 12); xx < x + width - 5; xx += 25) { ctx.fillStyle = y % 36 ? "#40575a" : "#354c50"; ctx.fillRect(xx, y, 20, 12); ctx.fillStyle = "#172427"; ctx.fillRect(xx, y + 11, 20, 2); }
    ctx.fillStyle = "rgba(93,205,195,.35)"; ctx.beginPath(); ctx.arc(x + width / 2, top + 59, 48, Math.PI, 0); ctx.fill(); ctx.strokeStyle = accent; ctx.lineWidth = 6; ctx.stroke(); for (let spoke = -2; spoke <= 2; spoke += 1) { ctx.strokeStyle = "rgba(210,255,244,.5)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + width / 2, top + 12); ctx.lineTo(x + width / 2 + spoke * 20, top + 61); ctx.stroke(); }
    ctx.fillStyle = "#b88b3f"; ctx.fillRect(x + width / 2 - 4, top - 15, 8, 31); ctx.fillRect(x + width / 2 - 23, top - 15, 46, 5); ctx.fillStyle = "#f0d778"; ctx.fillRect(x + width / 2 - 2, top - 30, 4, 17); ctx.fillStyle = "#151d20"; ctx.fillRect(x + width / 2 - 18, base - 45, 36, 45); ctx.fillStyle = accent; ctx.fillRect(x + width / 2 - 13, base - 38, 26, 31);
  }
  ctx.fillStyle = colour ? shade(colour, 28, .78) : "#fff0a0"; for (let y = top + 63; y < base - 48; y += 39) for (let xx = x + 15; xx < x + width - 13; xx += 27) { ctx.fillRect(xx, y, 12, 15); ctx.fillStyle = "rgba(255,255,255,.62)"; ctx.fillRect(xx + 2, y + 2, 2, 10); ctx.fillStyle = colour ? shade(colour, 28, .78) : "#fff0a0"; }
  for (let tier = 1; tier <= Math.min(5, Math.ceil(plot.level / 2)); tier += 1) { const y = base - 48 - tier * 49; ctx.fillStyle = colour ? shade(colour, -38) : "#7b603f"; ctx.fillRect(x - 5, y, width + 10, 6); ctx.fillStyle = colour ? shade(colour, 22, .92) : "#d2aa63"; ctx.fillRect(x + 4, y + 1, width - 8, 2); }
  if (plot.level >= 3) { ctx.fillStyle = colour ? shade(colour, -20) : accent; ctx.fillRect(x + width * .28, top - 21, width * .44, 22); }
  if (plot.level >= 5) { ctx.fillStyle = colour ? shade(colour, 12) : accent; ctx.fillRect(x + width * .43, top - 45, width * .14, 26); ctx.fillStyle = "#bdece5"; ctx.fillRect(x + width * .47, top - 40, width * .06, 11); }
  if (plot.level >= 7) { ctx.fillStyle = "#d7b75e"; ctx.fillRect(x + width * .49 - 2, top - 73, 4, 30); ctx.fillRect(x + width * .39, top - 71, width * .22, 4); }
  if (plot.level >= 9) { const pulse = .55 + Math.sin(time * .004 + index) * .35; ctx.globalAlpha = pulse; ctx.fillStyle = "#fff3b5"; ctx.fillRect(x + width * .5 - 5, top - 81, 11, 11); ctx.globalAlpha = 1; }
  ctx.restore();
}

function constructionLift(ctx: CanvasRenderingContext2D, x: number, base: number, index: number, plot: CityPlot | null, side: "left" | "right", progress: number, time: number) {
  const width = [104, 94, 116][index];
  const height = [188, 238, 211][index] + (plot ? Math.min(110, Math.max(1, plot.level) * 11) : 0);
  const currentTop = base - height; const floor = 36; const build = Math.max(3, floor * progress); const nextTop = currentTop - floor;
  ctx.save(); ctx.globalAlpha = .82; ctx.strokeStyle = "#d5a957"; ctx.lineWidth = 2; ctx.strokeRect(x - 7, nextTop, width + 14, floor);
  for (let yy = nextTop + 9; yy < currentTop; yy += 9) { ctx.beginPath(); ctx.moveTo(x - 12, yy); ctx.lineTo(x + width + 12, yy); ctx.stroke(); }
  ctx.fillStyle = "rgba(213,169,87,.22)"; ctx.fillRect(x, currentTop - build, width, build); ctx.fillStyle = "#f0cb73"; ctx.fillRect(x, currentTop - build, width, 3);
  const craneSide = side === "left" ? 1 : -1; const mastX = side === "left" ? x + width + 14 : x - 14; ctx.fillStyle = "#b17a3f"; ctx.fillRect(mastX, nextTop - 35, 4, floor + 38); ctx.fillRect(mastX + Math.min(0, craneSide * -54), nextTop - 35, 58, 4); ctx.fillStyle = "#e9c76d"; ctx.fillRect(mastX + craneSide * 31, nextTop - 34, 3, 19 + Math.sin(time * .002) * 3);
  ctx.font = "900 13px ui-monospace,monospace"; ctx.textAlign = side === "left" ? "left" : "right"; ctx.fillStyle = "#ffe8a6"; ctx.fillText(`L${(plot?.level || 0) + 1} · ${Math.round(progress * 100)}%`, side === "left" ? x : x + width, nextTop - 8); ctx.restore();
}

const smooth = (value: number) => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };

function finaleSky(ctx: CanvasRenderingContext2D, elapsed: number, time: number) {
  const open = smooth((elapsed - 15) / 7); if (open <= 0) return;
  const sky = ctx.createLinearGradient(0, 0, 0, 390); sky.addColorStop(0, `rgba(7,17,42,${open})`); sky.addColorStop(1, `rgba(19,54,67,${open * .72})`); ctx.fillStyle = sky; ctx.fillRect(0, 0, 1920, 390 * open);
  for (let i = 0; i < 88; i += 1) { const x = (i * 337) % 1920; const y = 18 + (i * 173) % 315; const flicker = .38 + .42 * Math.sin(time * .0018 + i * 1.7); ctx.fillStyle = `rgba(232,250,255,${open * flicker})`; ctx.fillRect(x, y, i % 9 ? 2 : 4, i % 9 ? 2 : 4); }
}

function finaleBeacon(ctx: CanvasRenderingContext2D, ground: number, elapsed: number, time: number, colour: RGB) {
  const rise = smooth((elapsed - 5) / 13); const fracture = smooth(elapsed / 5); const x = 960;
  if (elapsed < 10) {
    const size = 82 + Math.sin(time * .008) * 7; crystal(ctx, x, ground - 76, size, colour, [255, 255, 255], time * .001);
    ctx.strokeStyle = `rgba(4,10,13,${fracture})`; ctx.lineWidth = 7; for (let i = 0; i < 6; i += 1) { ctx.beginPath(); ctx.moveTo(x, ground - 155); ctx.lineTo(x + Math.sin(i * 8.1) * 45, ground - 95 + i * 18); ctx.lineTo(x + Math.cos(i * 5.7) * 72, ground - 30); ctx.stroke(); }
  }
  if (rise <= 0) return;
  const height = 370 * rise; const top = ground - height;
  ctx.save(); ctx.shadowColor = "#e8ffff"; ctx.shadowBlur = 34 * rise; const tower = ctx.createLinearGradient(x - 95, 0, x + 95, 0); tower.addColorStop(0, "#14272d"); tower.addColorStop(.28, "#9dece1"); tower.addColorStop(.5, "#f7ffff"); tower.addColorStop(.72, "#9dece1"); tower.addColorStop(1, "#14272d"); ctx.fillStyle = tower;
  ctx.beginPath(); ctx.moveTo(x - 92, ground); ctx.lineTo(x - 72, top + 82); ctx.lineTo(x - 28, top + 46); ctx.lineTo(x, top); ctx.lineTo(x + 28, top + 46); ctx.lineTo(x + 72, top + 82); ctx.lineTo(x + 92, ground); ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(255,255,255,.72)"; ctx.lineWidth = 4; ctx.stroke();
  const lit = smooth((elapsed - 10) / 9); for (let row = 0; row < 8; row += 1) { const y = ground - 42 - row * 35; if (y < top + 68 || row / 8 > lit) continue; ctx.fillStyle = row % 2 ? "#fff0a0" : "#76eadb"; ctx.fillRect(x - 39, y, 21, 12); ctx.fillRect(x + 18, y, 21, 12); ctx.fillStyle = "#ffffff"; ctx.fillRect(x - 35, y + 2, 5, 4); }
  ctx.fillStyle = "#ffffff"; ctx.fillRect(x - 4, top - 56, 8, 57); ctx.fillRect(x - 30, top - 54, 60, 6); ctx.shadowColor = "#ffffff"; ctx.shadowBlur = 28; ctx.fillRect(x - 8, top - 70, 16, 16); ctx.shadowBlur = 0;
  const bridge = smooth((elapsed - 16) / 5); if (bridge > 0) { ctx.strokeStyle = "#d8c681"; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(x - 72, ground - 168); ctx.lineTo(x - 72 - 560 * bridge, ground - 168); ctx.moveTo(x + 72, ground - 168); ctx.lineTo(x + 72 + 560 * bridge, ground - 168); ctx.stroke(); ctx.strokeStyle = "#65e3d1"; ctx.lineWidth = 3; ctx.stroke(); }
  ctx.restore();
  const fragments = Math.min(42, Math.floor(Math.max(0, elapsed - 3) * 5)); for (let i = 0; i < fragments; i += 1) { const p = ((elapsed - 3) * .22 + i / fragments) % 1; const direction = i % 2 ? 1 : -1; const fx = x + direction * p * (360 + (i % 7) * 58); const fy = ground - 100 - Math.sin(p * Math.PI) * (170 + (i % 5) * 24); ctx.fillStyle = i % 3 ? "#dffff8" : "#ffe28a"; ctx.fillRect(fx, fy, 4 + i % 5, 4 + i % 5); }
}

function crystal(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, colour: RGB, light: RGB, phase: number) {
  ctx.save(); ctx.translate(x, y);
  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 4.2);
  glow.addColorStop(0, rgb(light, 0.34)); glow.addColorStop(0.42, rgb(colour, 0.12)); glow.addColorStop(1, rgb(colour, 0));
  ctx.fillStyle = glow; ctx.fillRect(-size * 4.2, -size * 4.2, size * 8.4, size * 8.4);
  const shape = () => { ctx.beginPath(); ctx.moveTo(size * .06, -size); ctx.lineTo(size * .72, -size * .3); ctx.lineTo(size * .58, size * .74); ctx.lineTo(-size * .12, size); ctx.lineTo(-size * .74, size * .26); ctx.lineTo(-size * .54, -size * .65); ctx.closePath(); };
  ctx.shadowColor = rgb(light); ctx.shadowBlur = 20; shape(); ctx.clip(); const body = ctx.createLinearGradient(-size, size, size, -size); body.addColorStop(0, shade(colour, -48)); body.addColorStop(.3, shade(colour, -12)); body.addColorStop(.62, shade(colour, 24)); body.addColorStop(1, shade(light, 8)); ctx.fillStyle = body; ctx.fillRect(-size, -size, size * 2, size * 2);
  const facet = (fill: string, points: number[][]) => { ctx.fillStyle = fill; ctx.beginPath(); points.forEach(([px, py], index) => index ? ctx.lineTo(px, py) : ctx.moveTo(px, py)); ctx.closePath(); ctx.fill(); };
  facet(shade(colour, -62, .72), [[-size * .74,size * .26],[-size * .1,-size * .05],[size * .06,-size],[-size * .54,-size * .65]]); facet(shade(light, 18, .42), [[size * .06,-size],[size * .72,-size * .3],[size * .1,size * .03],[-size * .1,-size * .05]]); facet("rgba(255,255,255,.18)", [[size*.72,-size*.3],[size*.58,size*.74],[size*.1,size*.03]]); facet(shade(colour,-22,.36), [[-size*.1,-size*.05],[size*.1,size*.03],[-size*.12,size],[-size*.74,size*.26]]);
  ctx.shadowBlur = 0; ctx.strokeStyle = "rgba(255,255,255,.55)"; ctx.lineWidth = 1.5; [[size*.06,-size,-size*.1,-size*.05],[size*.72,-size*.3,size*.1,size*.03],[-size*.1,-size*.05,-size*.12,size],[size*.1,size*.03,size*.58,size*.74]].forEach(([x1,y1,x2,y2]) => { ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke(); });
  for (let i = 0; i < 70; i += 1) { const px = -size * .72 + ((i * 37) % Math.max(1, Math.floor(size * 1.35))); const py = -size + ((i * 47) % Math.max(1, Math.floor(size * 1.9))); ctx.fillStyle = i % 8 ? "rgba(255,255,255,.10)" : "rgba(255,255,255,.44)"; ctx.fillRect(px, py, i % 5 ? 1 : 2, 1); }
  const sweep = ((phase % 1) * 1.8 - 0.9) * size;
  ctx.globalCompositeOperation = "screen"; const shine = ctx.createLinearGradient(sweep - 10, 0, sweep + 10, 0); shine.addColorStop(0, "transparent"); shine.addColorStop(.5, "rgba(255,255,255,.72)"); shine.addColorStop(1, "transparent"); ctx.fillStyle = shine; ctx.fillRect(-size, -size, size * 2, size * 2); ctx.restore(); ctx.save(); ctx.translate(x, y); shape(); ctx.strokeStyle = shade(light, 10, .92); ctx.lineWidth = 3; ctx.stroke(); ctx.strokeStyle = "rgba(255,255,255,.68)"; ctx.lineWidth = 1; ctx.stroke(); ctx.restore();
}

function facetedCrystal(ctx: CanvasRenderingContext2D, x: number, baseY: number, width: number, height: number, lean: number, colour: RGB, light: RGB, seed: number, shimmer: number) {
  const topX = x + lean; const left = x - width * .58; const right = x + width * .63; const shoulderY = baseY - height * .62;
  const shape = () => { ctx.beginPath(); ctx.moveTo(topX, baseY - height); ctx.lineTo(right, shoulderY); ctx.lineTo(x + width * .45, baseY - 8); ctx.lineTo(x - width * .16, baseY); ctx.lineTo(left, baseY - height * .22); ctx.lineTo(x - width * .43, baseY - height * .72); ctx.closePath(); };
  ctx.save(); shape(); ctx.clip();
  const body = ctx.createLinearGradient(left, baseY, right, baseY - height); body.addColorStop(0, shade(colour, -48)); body.addColorStop(.28, shade(colour, -12)); body.addColorStop(.58, shade(colour, 24)); body.addColorStop(1, shade(light, 8)); ctx.fillStyle = body; ctx.fillRect(left - 4, baseY - height - 4, width * 1.35, height + 8);
  const facet = (fill: string, points: number[][]) => { ctx.fillStyle = fill; ctx.beginPath(); points.forEach(([px, py], index) => index ? ctx.lineTo(px, py) : ctx.moveTo(px, py)); ctx.closePath(); ctx.fill(); };
  facet(shade(colour, -62, .72), [[left,baseY-height*.22],[x-width*.09,baseY-height*.42],[topX,baseY-height],[x-width*.43,baseY-height*.72]]);
  facet(shade(light, 18, .42), [[topX,baseY-height],[right,shoulderY],[x+width*.1,baseY-height*.4],[x-width*.09,baseY-height*.42]]);
  facet("rgba(255,255,255,.18)", [[right,shoulderY],[x+width*.45,baseY-8],[x+width*.1,baseY-height*.4]]);
  facet(shade(colour, -22, .36), [[x-width*.09,baseY-height*.42],[x+width*.1,baseY-height*.4],[x-width*.16,baseY],[left,baseY-height*.22]]);
  ctx.strokeStyle = "rgba(255,255,255,.48)"; ctx.lineWidth = 2; [[topX,baseY-height,x-width*.09,baseY-height*.42],[right,shoulderY,x+width*.1,baseY-height*.4],[x-width*.09,baseY-height*.42,x-width*.16,baseY],[x+width*.1,baseY-height*.4,x+width*.45,baseY-8]].forEach(([x1,y1,x2,y2]) => { ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke(); });
  ctx.strokeStyle = "rgba(20,27,31,.48)"; ctx.lineWidth = 1; for (let i = 0; i < 9; i += 1) { const yy = baseY - height * (.17 + ((i * 19 + seed * 7) % 71) / 100); const xx = left + ((i * 37 + seed * 13) % Math.max(1, Math.floor(width))); ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx + (i % 2 ? 12 : -10), yy + 9); ctx.lineTo(xx + (i % 3 ? 18 : -15), yy + 17); ctx.stroke(); }
  for (let i = 0; i < 190; i += 1) { const px = left + ((i * 83 + seed * 29) % Math.max(1, Math.floor(width * 1.18))); const py = baseY - ((i * 47 + seed * 31) % Math.max(1, Math.floor(height))); ctx.fillStyle = i % 8 ? "rgba(255,255,255,.10)" : "rgba(255,255,255,.42)"; ctx.fillRect(px, py, i % 5 ? 1 : 2, 1); }
  const sweep = ((shimmer * 115 + seed * 23) % (width * 2.5)) - width; ctx.globalCompositeOperation = "screen"; const shine = ctx.createLinearGradient(x + sweep - 13, 0, x + sweep + 13, 0); shine.addColorStop(0, "transparent"); shine.addColorStop(.5, "rgba(255,255,255,.66)"); shine.addColorStop(1, "transparent"); ctx.fillStyle = shine; ctx.fillRect(left, baseY - height, width * 1.25, height); ctx.globalCompositeOperation = "source-over";
  ctx.restore(); shape(); ctx.strokeStyle = shade(light, 10, .92); ctx.lineWidth = 3; ctx.stroke(); ctx.strokeStyle = "rgba(255,255,255,.68)"; ctx.lineWidth = 1; ctx.stroke();
}

function caveEntrance(ctx: CanvasRenderingContext2D, x: number, ground: number, time: number, colour: RGB, light: RGB, foreground = false) {
  const outerLeft = x - 340; const outerRight = x + 340; const top = ground - 320;
  const mouthPoints: Array<[number, number]> = [
    [x - 276, ground], [x - 270, ground - 66], [x - 286, ground - 104], [x - 252, ground - 130],
    [x - 260, ground - 164], [x - 226, ground - 181], [x - 214, ground - 219], [x - 166, ground - 235],
    [x - 127, ground - 224], [x - 91, ground - 254], [x - 39, ground - 238], [x + 4, ground - 247],
    [x + 43, ground - 226], [x + 91, ground - 239], [x + 126, ground - 211], [x + 174, ground - 204],
    [x + 190, ground - 174], [x + 231, ground - 154], [x + 224, ground - 119], [x + 263, ground - 91],
    [x + 249, ground - 54], [x + 267, ground],
  ];
  const mouth = () => {
    ctx.beginPath();
    mouthPoints.forEach(([px, py], index) => index ? ctx.lineTo(px, py) : ctx.moveTo(px, py));
    ctx.closePath();
  };
  if (!foreground) {
    ctx.save();
    const rock = ctx.createLinearGradient(outerLeft, top, outerRight, ground); rock.addColorStop(0, "#0d171b"); rock.addColorStop(.37, "#304143"); rock.addColorStop(.7, "#1c2c2f"); rock.addColorStop(1, "#091216"); ctx.fillStyle = rock;
    ctx.beginPath(); ctx.moveTo(outerLeft, ground); ctx.lineTo(outerLeft + 8, ground - 95); ctx.lineTo(outerLeft + 42, ground - 132); ctx.lineTo(outerLeft + 31, ground - 193); ctx.lineTo(outerLeft + 88, ground - 224); ctx.lineTo(x - 192, top + 18); ctx.lineTo(x - 117, top - 5); ctx.lineTo(x - 52, top + 15); ctx.lineTo(x + 7, top - 12); ctx.lineTo(x + 83, top + 11); ctx.lineTo(x + 146, top - 1); ctx.lineTo(x + 225, top + 45); ctx.lineTo(outerRight - 31, ground - 192); ctx.lineTo(outerRight - 51, ground - 142); ctx.lineTo(outerRight - 7, ground - 89); ctx.lineTo(outerRight, ground); ctx.closePath(); ctx.fill();

    const depth = ctx.createLinearGradient(x - 240, ground - 238, x + 226, ground); depth.addColorStop(0, "#101b1e"); depth.addColorStop(.5, "#020709"); depth.addColorStop(1, "#071114"); ctx.fillStyle = depth; mouth(); ctx.fill();
    ctx.save(); mouth(); ctx.clip();

    // Broken shelves, not concentric outlines: the tunnel is a natural excavation.
    ctx.fillStyle = "rgba(47,66,67,.74)"; ctx.beginPath(); ctx.moveTo(x - 286, ground - 172); ctx.lineTo(x - 207, ground - 218); ctx.lineTo(x - 127, ground - 205); ctx.lineTo(x - 82, ground - 171); ctx.lineTo(x - 151, ground - 184); ctx.lineTo(x - 223, ground - 145); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "rgba(36,53,55,.82)"; ctx.beginPath(); ctx.moveTo(x + 8, ground - 247); ctx.lineTo(x + 91, ground - 239); ctx.lineTo(x + 174, ground - 204); ctx.lineTo(x + 201, ground - 167); ctx.lineTo(x + 120, ground - 185); ctx.lineTo(x + 54, ground - 174); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "rgba(13,24,27,.92)"; ctx.beginPath(); ctx.moveTo(x - 260, ground - 120); ctx.lineTo(x - 175, ground - 151); ctx.lineTo(x - 108, ground - 128); ctx.lineTo(x - 38, ground - 143); ctx.lineTo(x + 29, ground - 122); ctx.lineTo(x + 118, ground - 139); ctx.lineTo(x + 224, ground - 109); ctx.lineTo(x + 267, ground); ctx.lineTo(x - 276, ground); ctx.closePath(); ctx.fill();

    const vanishingX = x + 37; const horizon = ground - 83;
    const farTunnel = ctx.createRadialGradient(vanishingX, horizon - 12, 3, vanishingX, horizon - 12, 63); farTunnel.addColorStop(0, "rgba(93,130,126,.20)"); farTunnel.addColorStop(.48, "rgba(24,45,46,.26)"); farTunnel.addColorStop(1, "rgba(1,5,7,0)"); ctx.fillStyle = farTunnel; ctx.fillRect(vanishingX - 76, horizon - 88, 152, 145);
    const leftOreGlow = ctx.createRadialGradient(x - 149, ground - 142, 2, x - 149, ground - 142, 88); leftOreGlow.addColorStop(0, rgb(light, .18 + Math.sin(time * .004) * .025)); leftOreGlow.addColorStop(1, rgb(colour, 0)); ctx.fillStyle = leftOreGlow; ctx.fillRect(x - 245, ground - 238, 192, 192);
    const rightOreGlow = ctx.createRadialGradient(x + 149, ground - 126, 2, x + 149, ground - 126, 76); rightOreGlow.addColorStop(0, rgb(colour, .14)); rightOreGlow.addColorStop(1, rgb(colour, 0)); ctx.fillStyle = rightOreGlow; ctx.fillRect(x + 69, ground - 206, 160, 160);

    // Rough mine floor, rails and sleepers converge off-centre into the working tunnel.
    ctx.fillStyle = "rgba(43,55,54,.44)"; ctx.beginPath(); ctx.moveTo(x - 249, ground); ctx.lineTo(vanishingX - 33, horizon); ctx.lineTo(vanishingX + 35, horizon); ctx.lineTo(x + 267, ground); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "rgba(171,193,185,.38)"; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x - 118, ground); ctx.lineTo(vanishingX - 18, horizon); ctx.moveTo(x + 104, ground); ctx.lineTo(vanishingX + 17, horizon); ctx.stroke();
    for (let tie = 0; tie < 8; tie += 1) { const p = tie / 8; const y = horizon + Math.pow(p, 1.62) * 84; const half = 18 + p * 96; ctx.strokeStyle = tie % 2 ? "rgba(111,83,51,.58)" : "rgba(185,137,70,.45)"; ctx.lineWidth = 3 + p * 2; ctx.beginPath(); ctx.moveTo(vanishingX - half, y); ctx.lineTo(vanishingX + half, y + (p > .55 ? 3 : 1)); ctx.stroke(); }

    // One crooked, distant timber frame sells a worked mine without turning it into architecture.
    ctx.strokeStyle = "rgba(118,83,48,.55)"; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(x - 61, ground - 74); ctx.lineTo(x - 68, ground - 159); ctx.moveTo(x + 120, ground - 72); ctx.lineTo(x + 112, ground - 151); ctx.moveTo(x - 69, ground - 157); ctx.lineTo(x + 113, ground - 149); ctx.stroke();
    ctx.strokeStyle = "rgba(198,145,71,.25)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 64, ground - 156); ctx.lineTo(x + 108, ground - 148); ctx.stroke();
    ctx.restore();

    // Fracture marks stop short of becoming a clean outline around the mouth.
    const fractures: Array<[number, number, number, number, number, number]> = [
      [-292,-229,-264,-214,-279,-194],[-224,-286,-201,-261,-214,-241],[-137,-301,-119,-277,-91,-269],
      [-42,-292,-17,-271,-28,-250],[78,-287,92,-265,123,-251],[177,-261,158,-235,189,-222],
      [256,-215,229,-193,247,-174],[-306,-139,-281,-127,-294,-104],[291,-144,264,-127,278,-104],
    ];
    ctx.strokeStyle = "rgba(114,146,143,.34)"; ctx.lineWidth = 2; fractures.forEach(([ax, ay, bx, by, cx, cy]) => { ctx.beginPath(); ctx.moveTo(x + ax, ground + ay); ctx.lineTo(x + bx, ground + by); ctx.lineTo(x + cx, ground + cy); ctx.stroke(); });
    for (let i = 0; i < 30; i += 1) { const side = i % 3 ? -1 : 1; const px = x + side * (236 + (i * 41) % 91); const py = ground - 15 - ((i * 59) % 259); ctx.fillStyle = i % 6 ? "#314345" : rgb(colour, .28); ctx.fillRect(px, py, 7 + i % 18, 4 + i % 9); }
    ctx.restore(); return;
  }
  ctx.save();
  // Asymmetric loose scree frames a broad, walkable opening.
  const rubble = [[-318,0,82,38],[-263,-6,58,61],[-211,2,57,27],[163,3,43,25],[211,-9,76,48],[281,1,53,31]];
  rubble.forEach(([dx, dy, width, height], index) => { ctx.fillStyle = index % 2 ? "#1a292c" : "#283a3c"; ctx.beginPath(); ctx.moveTo(x + dx, ground + dy); ctx.lineTo(x + dx + width * .18, ground + dy - height * .62); ctx.lineTo(x + dx + width * .47, ground + dy - height); ctx.lineTo(x + dx + width * .81, ground + dy - height * .53); ctx.lineTo(x + dx + width, ground + dy); ctx.closePath(); ctx.fill(); ctx.strokeStyle = "rgba(111,143,141,.28)"; ctx.lineWidth = 2; ctx.stroke(); });
  ctx.restore();
}

function convoyGate(ctx: CanvasRenderingContext2D, x: number, ground: number, direction: -1 | 1, time: number, pending: number) {
  const pulse = .62 + Math.sin(time * .012) * .18;
  ctx.save();
  ctx.fillStyle = "#071012"; ctx.fillRect(x - 11, ground - 108, 22, 108);
  ctx.fillStyle = "#35474a"; ctx.fillRect(x - 8, ground - 104, 16, 104);
  ctx.fillStyle = "#75908d"; ctx.fillRect(x - 5, ground - 101, 4, 98);
  ctx.shadowColor = "#ffad35"; ctx.shadowBlur = 24; ctx.fillStyle = `rgba(255,174,48,${pulse})`; ctx.beginPath(); ctx.arc(x, ground - 116, 10, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
  ctx.strokeStyle = "#0a1113"; ctx.lineWidth = 16; ctx.beginPath(); ctx.moveTo(x, ground - 82); ctx.lineTo(x + direction * 112, ground - 82); ctx.stroke();
  ctx.strokeStyle = "#d9a13b"; ctx.lineWidth = 11; ctx.beginPath(); ctx.moveTo(x, ground - 82); ctx.lineTo(x + direction * 112, ground - 82); ctx.stroke();
  ctx.strokeStyle = "#1a2425"; ctx.lineWidth = 6; for (let offset = 14; offset < 108; offset += 25) { ctx.beginPath(); ctx.moveTo(x + direction * offset, ground - 88); ctx.lineTo(x + direction * (offset + 10), ground - 76); ctx.stroke(); }
  ctx.fillStyle = "#091114"; ctx.fillRect(x - 34, ground - 151, 68, 23); ctx.strokeStyle = "#b77e2e"; ctx.lineWidth = 2; ctx.strokeRect(x - 34, ground - 151, 68, 23);
  ctx.fillStyle = "#ffd77a"; ctx.font = "900 13px ui-monospace, monospace"; ctx.textAlign = "center"; ctx.fillText(`HOLD ${pending}/4`, x, ground - 135);
  ctx.restore();
}

function miner(ctx: CanvasRenderingContext2D, worker: WorkerState, x: number, ground: number, time: number, strikeProgress: number | null, cargoColour: RGB, cargoLight: RGB) {
  const striking = strikeProgress !== null;
  const colour = RANKS[worker.rank]; const skin = ["#dca474", "#b97852", "#efc093", "#8e573e", "#c98b62", "#f1c7a5"][worker.id % 6]; const skinLight = ["#f0c39b", "#d79a70", "#ffd6aa", "#b97957", "#e6aa7d", "#ffe0bf"][worker.id % 6];
  const hair = ["#4b2c22", "#261f20", "#9a5c2f", "#37241f", "#c18a4f", "#19191c"][worker.id % 6]; const coat = ["#28515b", "#51445f", "#415b3b", "#5c4635", "#314b68", "#5b3b4a"][worker.id % 6];
  const destination = worker.outbound ? worker.target : worker.home; const facing = Math.sign(destination - worker.position) || (worker.side === "left" ? 1 : -1); const phase = time * .011 + worker.id * 1.37; const gait = striking ? 0 : Math.sin(phase); const bob = striking ? 0 : Math.abs(gait) * 4; const armSwing = gait * 12; const legSwing = gait * 10;
  const part = (ox: number, oy: number, angle: number, width: number, height: number, fill: string, accent?: string) => { ctx.save(); ctx.translate(ox, oy); ctx.rotate(angle); ctx.fillStyle = "#091012"; ctx.fillRect(-width / 2 - 2, -2, width + 4, height + 4); ctx.fillStyle = fill; ctx.fillRect(-width / 2, 0, width, height); if (accent) { ctx.fillStyle = accent; ctx.fillRect(-width / 2 + 2, 2, Math.max(2, width - 4), 3); } ctx.restore(); };
  const poly = (fill: string, points: number[][]) => { ctx.fillStyle = fill; ctx.beginPath(); points.forEach(([px, py], index) => index ? ctx.lineTo(px, py) : ctx.moveTo(px, py)); ctx.closePath(); ctx.fill(); };
  const swing = strikeProgress ?? 0;
  const ease = (value: number) => value * value * (3 - 2 * value);
  const lerp = (from: number, to: number, amount: number) => from + (to - from) * amount;
  let toolAngle = -.9; let impact = 0;
  if (striking) {
    if (swing < .48) toolAngle = lerp(-.9, -1.38, ease(swing / .48));
    else if (swing < .69) toolAngle = lerp(-1.38, .62, Math.pow((swing - .48) / .21, 2.2));
    else if (swing < .78) { toolAngle = .62; impact = 1 - (swing - .69) / .09; }
    else toolAngle = lerp(.62, -.9, ease((swing - .78) / .22));
  }
  const toolDirection = { x: Math.cos(toolAngle), y: Math.sin(toolAngle) };
  const rearGrip = { x: 23, y: -63 };
  const frontGrip = { x: rearGrip.x + toolDirection.x * 19, y: rearGrip.y + toolDirection.y * 19 };
  const elbow = (shoulder: { x: number; y: number }, hand: { x: number; y: number }, bend: number) => {
    const dx = hand.x - shoulder.x; const dy = hand.y - shoulder.y; const distance = Math.max(1, Math.hypot(dx, dy));
    const reach = Math.min(46, distance); const height = Math.sqrt(Math.max(0, 24 * 24 - (reach * reach) / 4));
    return { x: (shoulder.x + hand.x) / 2 - dy / distance * height * bend, y: (shoulder.y + hand.y) / 2 + dx / distance * height * bend };
  };
  const articulatedArm = (shoulder: { x: number; y: number }, hand: { x: number; y: number }, bend: number, fill: string) => {
    const joint = elbow(shoulder, hand, bend); ctx.save(); ctx.lineCap = "square"; ctx.lineJoin = "bevel";
    ctx.strokeStyle = "#081012"; ctx.lineWidth = 14; ctx.beginPath(); ctx.moveTo(shoulder.x, shoulder.y); ctx.lineTo(joint.x, joint.y); ctx.lineTo(hand.x, hand.y); ctx.stroke();
    ctx.strokeStyle = fill; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(shoulder.x, shoulder.y); ctx.lineTo(joint.x, joint.y); ctx.lineTo(hand.x, hand.y); ctx.stroke();
    ctx.fillStyle = skin; ctx.fillRect(hand.x - 5, hand.y - 5, 10, 10); ctx.restore();
  };
  ctx.save(); ctx.translate(x, ground - bob); ctx.scale(facing, 1); ctx.globalAlpha = .3; ctx.fillStyle = "#020607"; ctx.beginPath(); ctx.ellipse(0, 2, 38 + Math.abs(gait) * 3, 8, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
  const rearLeg = legSwing * Math.PI / 180; part(-8, -43, rearLeg, 11, 36, "#283840", "#49606a"); part(10, -43, -rearLeg, 11, 36, "#324650", "#5d7580"); ctx.fillStyle = "#11191c"; ctx.fillRect(-22 + legSwing * .2, -9, 24, 9); ctx.fillRect(4 - legSwing * .2, -9, 25, 9); ctx.fillStyle = "#59656a"; ctx.fillRect(-19 + legSwing * .2, -8, 15, 3); ctx.fillRect(7 - legSwing * .2, -8, 15, 3);
  if (striking) articulatedArm({ x: -18, y: -83 }, rearGrip, -.68, shadeHex(coat, -20));
  else { part(-21, -84, -armSwing * Math.PI / 180, 10, 35, shadeHex(coat, -20), colour); ctx.fillStyle = skin; ctx.fillRect(-29 + armSwing * .16, -55, 9, 9); }
  ctx.fillStyle = "#081012"; ctx.fillRect(-23, -91, 48, 53); ctx.fillStyle = coat; ctx.fillRect(-20, -88, 42, 47); poly(shadeHex(coat, 18), [[-20,-88],[2,-88],[-4,-41],[-20,-41]]); ctx.fillStyle = colour; ctx.fillRect(-18, -88, 38, 7);
  ctx.fillStyle = "#d7aa61"; ctx.fillRect(-21, -52, 44, 7); ctx.fillStyle = "#614228"; ctx.fillRect(-13, -50, 8, 10); ctx.fillRect(10, -50, 9, 12); ctx.fillStyle = "#ead59b"; ctx.fillRect(-10, -49, 3, 4); ctx.fillStyle = "#19262b"; ctx.fillRect(-30, -86, 11, 35); ctx.fillStyle = "#5d4832"; ctx.fillRect(-28, -82, 7, 25); ctx.fillStyle = "#d9c187"; ctx.fillRect(-26, -78, 3, 8);
  if (striking) articulatedArm({ x: 19, y: -83 }, frontGrip, .72, shadeHex(coat, 8));
  else { part(21, -84, armSwing * Math.PI / 180, 10, 35, shadeHex(coat, 8), colour); ctx.fillStyle = skinLight; ctx.fillRect(24 - armSwing * .12, -56, 9, 9); }
  ctx.fillStyle = "#071012"; ctx.fillRect(-15, -122, 36, 36); ctx.fillStyle = hair; ctx.fillRect(-14, -121, 33, 12); ctx.fillRect(-14, -113, worker.id % 2 ? 7 : 5, 18); ctx.fillStyle = skin; ctx.fillRect(-9, -116, 29, 27); ctx.fillStyle = skinLight; ctx.fillRect(9, -113, 11, 14); ctx.fillStyle = hair; if (worker.id % 3 === 0) { ctx.fillRect(-4, -96, 25, 8); ctx.fillRect(13, -104, 9, 12); } else if (worker.id % 3 === 1) ctx.fillRect(-7, -94, 15, 5); else ctx.fillRect(14, -100, 8, 8); ctx.fillStyle = "#17191b"; ctx.fillRect(11, -109, 4, 4); ctx.fillStyle = "#fff7d2"; ctx.fillRect(12, -109, 2, 1); ctx.fillStyle = skinLight; ctx.fillRect(20, -106, 5, 7); ctx.fillStyle = "#8d5140"; ctx.fillRect(10, -95, 9, 2);
  ctx.fillStyle = "#081011"; ctx.fillRect(-22, -136, 51, 19); ctx.fillStyle = colour; ctx.fillRect(-18, -134, 42, 15); ctx.fillRect(-11, -143, 29, 10); ctx.fillStyle = shadeHex(colour, 36); ctx.fillRect(-9, -141, 22, 4); ctx.fillStyle = "#10191b"; ctx.fillRect(-24, -121, 55, 6); ctx.fillStyle = colour; ctx.fillRect(-21, -123, 49, 5); ctx.fillStyle = "#f8eaa9"; ctx.fillRect(22, -132, 9, 9); ctx.fillStyle = "#fff"; ctx.fillRect(25, -130, 4, 3); const lampGlow = ctx.createRadialGradient(29, -128, 1, 29, -128, 43); lampGlow.addColorStop(0, shadeHex(colour, 35, .56)); lampGlow.addColorStop(1, "transparent"); ctx.fillStyle = lampGlow; ctx.fillRect(-14, -171, 86, 86); ctx.globalAlpha = .12; ctx.fillStyle = colour; ctx.beginPath(); ctx.moveTo(30, -129); ctx.lineTo(132, -162); ctx.lineTo(132, -91); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
  if (worker.loaded && !striking) {
    const ore = rgb(cargoColour); const oreLight = rgb(cargoLight);
    ctx.save(); ctx.shadowColor = oreLight; ctx.shadowBlur = worker.boost >= 3 ? 30 : worker.held ? 23 : 15;
    poly("#071012", [[-33,-78],[-55,-64],[-53,-24],[-43,-15],[-21,-20],[-19,-69]]);
    poly(ore, [[-35,-74],[-51,-61],[-49,-27],[-41,-20],[-25,-24],[-23,-66]]);
    poly(shadeHex(ore, -34), [[-51,-61],[-40,-53],[-41,-20],[-49,-27]]);
    poly(oreLight, [[-40,-69],[-28,-62],[-31,-42],[-40,-53]]);
    poly(shadeHex(oreLight, 24), [[-45,-72],[-40,-86],[-34,-72],[-28,-90],[-24,-66]]);
    ctx.fillStyle = worker.held ? "#ffe18b" : "#d7aa61"; ctx.fillRect(-52, -58, 30, 4); ctx.fillRect(-44, -72, 4, 52);
    ctx.shadowBlur = 0; ctx.fillStyle = "rgba(255,255,255,.72)"; ctx.fillRect(-35, -68, 7, 3); ctx.restore();
  }
  if (worker.rank >= 1) { ctx.fillStyle = colour; ctx.fillRect(-35, -88, 7, 40); ctx.fillStyle = "#eafff7"; ctx.fillRect(-33, -80, 3, 12); } if (worker.rank >= 2) { ctx.fillStyle = shadeHex(colour, 26); ctx.fillRect(-25, -91, 13, 7); ctx.fillRect(14, -91, 13, 7); } if (worker.rank >= 3) { ctx.fillStyle = "#d9fbff"; ctx.fillRect(5, -113, 15, 2); ctx.fillRect(8, -117, 2, 10); } if (worker.rank >= 4) { ctx.strokeStyle = "rgba(255,255,255,.75)"; ctx.lineWidth = 2; ctx.strokeRect(-24, -145, 57, 25); }
  if (striking) {
    const handleRoot = { x: rearGrip.x - toolDirection.x * 17, y: rearGrip.y - toolDirection.y * 17 };
    const head = { x: rearGrip.x + toolDirection.x * 73, y: rearGrip.y + toolDirection.y * 73 };
    const normal = { x: -toolDirection.y, y: toolDirection.x };
    ctx.save(); ctx.lineCap = "square";
    ctx.strokeStyle = "#071012"; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(handleRoot.x, handleRoot.y); ctx.lineTo(head.x, head.y); ctx.stroke();
    ctx.strokeStyle = "#6b4229"; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(handleRoot.x, handleRoot.y); ctx.lineTo(head.x, head.y); ctx.stroke();
    ctx.strokeStyle = "#071012"; ctx.lineWidth = 13; ctx.beginPath(); ctx.moveTo(head.x - normal.x * 29, head.y - normal.y * 29); ctx.lineTo(head.x + normal.x * 29, head.y + normal.y * 29); ctx.stroke();
    ctx.strokeStyle = "#c9d9d7"; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(head.x - normal.x * 27, head.y - normal.y * 27); ctx.lineTo(head.x + normal.x * 27, head.y + normal.y * 27); ctx.stroke();
    ctx.strokeStyle = "#f4ffff"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(head.x - normal.x * 23, head.y - normal.y * 23); ctx.lineTo(head.x - normal.x * 4, head.y - normal.y * 4); ctx.stroke(); ctx.restore();
    if (impact > 0) { ctx.globalAlpha = impact * .62; ctx.fillStyle = rgb(cargoLight); for (let chip = 0; chip < 5; chip += 1) { const spread = 18 + chip * 9; ctx.fillRect(head.x + 5 + chip * 4, Math.min(-2, head.y) - spread * impact, 5 + chip % 2 * 3, 4); } ctx.globalAlpha = 1; }
  } else {
    const walkingToolAngle = -.52 + gait * .14; ctx.save(); ctx.translate(27, -65); ctx.rotate(walkingToolAngle); ctx.fillStyle = "#5d3b26"; ctx.fillRect(-3, -4, 6, 63); ctx.fillStyle = "#c9d9d7"; ctx.fillRect(-28, -9, 56, 7); ctx.fillStyle = "#f4ffff"; ctx.fillRect(-24, -8, 18, 2); ctx.fillStyle = "#819698"; ctx.fillRect(-31, -6, 7, 10); ctx.fillRect(25, -6, 7, 10); ctx.restore();
  }
  const dust = striking ? impact : Math.abs(gait); ctx.globalAlpha = dust * .3; ctx.fillStyle = "#a0aaa1"; ctx.fillRect(-facing * 26, -3, 13, 3); ctx.fillRect(-facing * 39, -10 - dust * 8, 7, 4); ctx.fillRect(-facing * 51, -18 - dust * 12, 3, 3); ctx.globalAlpha = 1; ctx.restore();
}

export function World({ status }: { status: StripMineStatus }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const statusRef = useRef(status);
  statusRef.current = status;
  const celebrationRef = useRef({ seq: status.cue_seq, start: performance.now() });
  const impactRef = useRef(new Map<number, { seq: number; start: number }>());
  const finaleRef = useRef({ active: false, start: 0, base: 0 });

  useEffect(() => {
    let animation = 0;
    const draw = (time: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const s = statusRef.current;
      const finaleArmed = s.reward_pending && s.cue_kind === "finale_armed";
      if (s.complete && !finaleRef.current.active) finaleRef.current = { active: true, start: time, base: s.finale_elapsed };
      if (!s.complete) finaleRef.current.active = false;
      const finaleElapsed = s.complete ? Math.min(30, finaleRef.current.base + (time - finaleRef.current.start) / 1000) : finaleArmed ? Math.max(0, 5 - s.reward_remaining) : -1;
      if (celebrationRef.current.seq !== s.cue_seq) celebrationRef.current = { seq: s.cue_seq, start: time };
      ctx.imageSmoothingEnabled = false; ctx.clearRect(0, 0, 1920, 720);
      // This is the exact 640×240 base composition from deep17, enlarged on a strict 3× grid.
      ctx.save(); ctx.setTransform(3, 0, 0, 3, 0, 0);
      const sky = ctx.createLinearGradient(0, 0, 0, 240); sky.addColorStop(0, "#050b10"); sky.addColorStop(.52, "#10272b"); sky.addColorStop(1, "#061015"); ctx.fillStyle = sky; ctx.fillRect(0, 0, 640, 240);
      const center = DEPOSIT_CENTERS[s.deposit] ?? 8; const oreGlow = ctx.createRadialGradient(40 + center / 16 * 560, 147, 5, 40 + center / 16 * 560, 147, 180); oreGlow.addColorStop(0, rgb(s.deposit_color, .21)); oreGlow.addColorStop(.55, rgb(s.deposit_color, .063)); oreGlow.addColorStop(1, rgb(s.deposit_color, 0)); ctx.fillStyle = oreGlow; ctx.fillRect(0, 10, 640, 210);
      ctx.fillStyle = "#14262b"; ctx.beginPath(); ctx.moveTo(0, 72); for (let x = 0; x <= 640; x += 22) ctx.lineTo(x, 46 + ((x * 11) % 43)); ctx.lineTo(640, 0); ctx.lineTo(0, 0); ctx.fill();
      ctx.fillStyle = "#0a151a"; ctx.beginPath(); ctx.moveTo(0, 39); for (let x = 0; x <= 640; x += 29) ctx.lineTo(x, 20 + ((x * 17) % 39)); ctx.lineTo(640, 0); ctx.lineTo(0, 0); ctx.fill();
      ctx.fillStyle = "#31464a"; for (let x = 12; x < 640; x += 47) { const y = 51 + ((x * 13) % 46); ctx.fillRect(x, y, 3, 3); ctx.fillRect(x + 7, y + 8, 2, 2); }
      ctx.fillStyle = "#192c31"; ctx.fillRect(0, 181, 640, 59); ctx.fillStyle = "#405458"; ctx.fillRect(0, 181, 640, 5); ctx.fillStyle = "#79603d"; for (let x = 0; x < 640; x += 20) ctx.fillRect(x, 188, 13, 4);
      ctx.fillStyle = "#263b40"; ctx.fillRect(119, 71, 5, 111); ctx.fillRect(516, 71, 5, 111); ctx.fillStyle = "#91ded4"; for (let y = 82; y < 176; y += 18) { ctx.fillRect(118, y, 17, 3); ctx.fillRect(505, y, 17, 3); } ctx.fillStyle = "#e8c96d"; ctx.fillRect(124, 77, 5, 5); ctx.fillRect(511, 77, 5, 5);
      const platformGlow = ctx.createLinearGradient(0, 160, 0, 190); platformGlow.addColorStop(0, "#83e5d20d"); platformGlow.addColorStop(1, "transparent"); ctx.fillStyle = platformGlow; ctx.fillRect(126, 146, 389, 43); ctx.fillStyle = "#13242a"; ctx.fillRect(132, 163, 376, 18); ctx.fillStyle = "#50686a"; for (let x = 136; x < 505; x += 16) { ctx.fillRect(x, 168, 10, 4); ctx.fillRect(x + 5, 174, 3, 7); }
      ctx.fillStyle = "#020608"; ctx.fillRect(0, 211, 640, 29); s.colors.forEach((colour, index) => { const x = 12 + index * 37; ctx.fillStyle = "#132027"; ctx.fillRect(x, 218, 28, 13); ctx.fillStyle = rgb(colour); ctx.fillRect(x + 3, 221, 22, 6); ctx.globalAlpha = .35; ctx.fillStyle = "#fff"; ctx.fillRect(x + 5, 221, 7, 2); ctx.globalAlpha = 1; }); ctx.restore();
      if (s.complete) finaleSky(ctx, finaleElapsed, time);
      const ground = 543; const left = [24, 132, 237]; const right = [1794, 1695, 1578]; s.city.forEach((plot, index) => { const localRise = s.complete ? smooth((finaleElapsed - 6 - index * 1.2) / 4) : 1; const shown = plot && s.complete ? { ...plot, level: Math.max(1, plot.level - 1 + localRise) } : plot; building(ctx, left[index], ground, index, shown, "left", time); building(ctx, right[index], ground, index, shown, "right", time); });
      if (!s.complete && !finaleArmed) { const activePlot = s.deposit % 3; constructionLift(ctx, left[activePlot], ground, activePlot, s.city[activePlot], "left", s.progress, time); constructionLift(ctx, right[activePlot], ground, activePlot, s.city[activePlot], "right", s.progress, time); }
      const cellX = (cell: number) => (40 + cell / 16 * 560) * 3;
      if (s.complete || finaleArmed) {
        finaleBeacon(ctx, ground, finaleElapsed, time, s.deposit_color);
        const formation = [735, 850, 1070, 1185]; s.workers.forEach((worker, index) => miner(ctx, { ...worker, rank: 4, power: 16, outbound: true, loaded: false, held: false }, formation[index], ground - 4, time, finaleArmed || finaleElapsed < 5 ? (time % (720 / s.tempo)) / (720 / s.tempo) : null, s.deposit_color, s.deposit_light));
      } else {
        const oreX = cellX(center); const secondary = DEPOSIT_SECONDARY[s.deposit] ?? s.deposit_light; const baseY = 535; const icon = s.deposit_icon;
        const remaining = .24 + (1 - s.progress) * .76;
        caveEntrance(ctx, oreX, ground, time, s.deposit_color, s.deposit_light);
        // Ore grows from the inner walls while the centre remains an unmistakable open passage.
        const clusters: Array<[number, number, number, number, RGB]> = icon === "twin" ? [[-120,70,170,-10,s.deposit_color],[120,70,170,10,secondary]]
          : icon === "branch" ? [[-140,54,150,-16,s.deposit_color],[-78,58,180,12,secondary],[128,45,105,8,s.deposit_color]]
          : icon === "flame" ? [[-120,75,190,18,s.deposit_color],[115,48,130,-9,secondary]]
          : icon === "prism" ? [[-112,72,205,-6,s.deposit_color],[112,56,158,8,secondary]]
          : icon === "core" ? [[-112,66,190,-4,s.deposit_color],[112,66,190,4,secondary]]
          : [[-120,65,205,-6,s.deposit_color],[-58,38,96,-9,secondary],[120,55,125,8,secondary]];
        clusters.forEach(([dx, width, height, lean, colour], index) => facetedCrystal(ctx, oreX + dx * remaining, baseY - (1 - remaining) * 13, width * remaining, height * remaining, lean * remaining, colour, s.deposit_light, index + s.deposit * 5, time * .0018));
        s.workers.forEach((worker) => {
          const recorded = impactRef.current.get(worker.id);
          if (!recorded) impactRef.current.set(worker.id, { seq: worker.impact_seq, start: -Infinity });
          else if (recorded.seq !== worker.impact_seq) impactRef.current.set(worker.id, { seq: worker.impact_seq, start: time });
          const impact = impactRef.current.get(worker.id)!;
          const duration = 720 / s.tempo;
          const swing = (time - impact.start) / duration;
          miner(ctx, worker, cellX(worker.position), ground + 1, time, swing >= 0 && swing < 1 ? swing : null, s.deposit_color, s.deposit_light);
        });
        caveEntrance(ctx, oreX, ground, time, s.deposit_color, s.deposit_light, true);
        if (s.convoy_held) { convoyGate(ctx, cellX(3) - 20, ground, 1, time, s.pending_convoy); convoyGate(ctx, cellX(13) + 20, ground, -1, time, s.pending_convoy); }
      }
      // Match the HTML concept's local lighting: ore light falls across steel, tools and nearby silhouettes.
      if (!s.complete && !finaleArmed) {
        const oreX = cellX(center); ctx.save(); ctx.globalCompositeOperation = "screen";
        const bounce = ctx.createRadialGradient(oreX, 485, 8, oreX, 485, 430); bounce.addColorStop(0, rgb(s.deposit_light, .29)); bounce.addColorStop(.34, rgb(s.deposit_color, .1)); bounce.addColorStop(1, rgb(s.deposit_color, 0)); ctx.fillStyle = bounce; ctx.fillRect(Math.max(0, oreX - 440), 175, Math.min(880, 1920 - oreX + 440), 400);
        for (let x = 410; x < 1510; x += 48) { const falloff = Math.max(0, 1 - Math.abs(x - oreX) / 540); if (!falloff) continue; ctx.fillStyle = rgb(s.deposit_light, falloff * .47); ctx.fillRect(x, ground - 66, 31, 3); ctx.fillStyle = rgb(s.deposit_color, falloff * .22); ctx.fillRect(x + 7, ground - 55, 17, 2); }
        ctx.restore();
      }
      // Fine geological seams, suspended work lamps and slow foundry smoke keep the mine alive without flat light panels.
      ctx.strokeStyle = "rgba(116,157,158,.11)"; ctx.lineWidth = 1; for (let i = 0; i < 21; i += 1) { const y = 52 + i * 19; const x = (i * 263 + 97) % 1850; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 37, y - 8); ctx.lineTo(x + 89, y + 3); ctx.lineTo(x + 136, y - 5); ctx.stroke(); }
      [285, 658, 1021, 1423, 1810].forEach((x, index) => { const y = index % 2 ? 112 : 103; ctx.strokeStyle = "rgba(115,150,151,.48)"; ctx.beginPath(); ctx.moveTo(x, 84); ctx.lineTo(x, y); ctx.stroke(); ctx.fillStyle = "#d8bc6a"; ctx.fillRect(x - 7, y, 14, 4); const lamp = ctx.createRadialGradient(x, y + 6, 0, x, y + 6, 48); lamp.addColorStop(0, "rgba(255,221,139,.17)"); lamp.addColorStop(1, "transparent"); ctx.fillStyle = lamp; ctx.fillRect(x - 48, y - 8, 96, 80); });
      if (s.city[0]) [94, 1819].forEach((originX, side) => { for (let i = 0; i < 7; i += 1) { const travel = (time * .018 + i * 29) % 155; const drift = Math.sin(time * .0013 + i * 1.9 + side) * 13 + (side ? -travel * .14 : travel * .14); const radius = 7 + travel * .085; ctx.globalAlpha = Math.max(0, .19 - travel / 1000); ctx.fillStyle = i % 2 ? "#a5bbb7" : "#647c7b"; ctx.beginPath(); ctx.arc(originX + drift, 278 - travel, radius, 0, Math.PI * 2); ctx.fill(); } ctx.globalAlpha = 1; });
      // The wet reflection is clipped above the physical LED row, exactly as in deep17.
      ctx.save(); ctx.beginPath(); ctx.rect(0, 548, 1920, 78); ctx.clip(); ctx.globalAlpha = .16; ctx.globalCompositeOperation = "screen"; ctx.translate(0, 828); ctx.scale(1, -1); ctx.drawImage(canvas, 0, 255, 1920, 300, 0, 0, 1920, 300); ctx.restore();
      const fade = ctx.createLinearGradient(0, 548, 0, 626); fade.addColorStop(0, "rgba(4,11,14,.15)"); fade.addColorStop(1, "rgba(4,11,14,.92)"); ctx.fillStyle = fade; ctx.fillRect(0, 548, 1920, 78);
      const reflectionOreX = cellX(center); for (let i = 0; i < 34; i += 1) { const y = 553 + i * 2.1; const offset = Math.sin(time * .0015 + i * 1.7) * (4 + i * .25); ctx.fillStyle = i % 3 ? "rgba(200,235,228,.055)" : rgb(s.deposit_color, .085); ctx.fillRect(Math.max(0, reflectionOreX - 250 + offset), y, 500 - i * 9, 1); }
      ctx.fillStyle = "rgba(215,176,86,.58)"; for (let x = 18; x < 1902; x += 42) { ctx.fillRect(x, 570, 22, 5); ctx.fillStyle = "rgba(12,20,22,.9)"; ctx.fillRect(x + 15, 570, 7, 5); ctx.fillStyle = "rgba(215,176,86,.58)"; }
      // Dust, cable glints and moving mine light.
      for (let i = 0; i < 92; i += 1) { const x = (i * 373 + time * (0.002 + (i % 4) * 0.0005)) % 1920; const y = 80 + ((i * 227 + time * 0.004) % 440); ctx.fillStyle = i % 7 ? "rgba(205,241,233,.09)" : rgb(s.deposit_light, 0.16); ctx.fillRect(x, y, i % 5 ? 2 : 4, i % 5 ? 2 : 4); }
      const celebrationAge = time - celebrationRef.current.start;
      if (s.cue_active && celebrationAge >= 0 && celebrationAge < 1050 && ["strike", "miss", "critical"].includes(s.cue_kind)) {
        const duration = s.cue_kind === "critical" ? 1050 : 720; const p = Math.min(1, celebrationAge / duration); const impactX = cellX(center); const impactY = 454;
        const impactColour = s.cue_kind === "miss" ? "#d29a58" : s.cue_kind === "critical" ? "#fff0a0" : rgb(s.deposit_light);
        ctx.save(); ctx.globalCompositeOperation = "screen";
        const flash = Math.max(0, 1 - p * 1.7); const impactGlow = ctx.createRadialGradient(impactX, impactY, 4, impactX, impactY, 42 + p * 150); impactGlow.addColorStop(0, s.cue_kind === "miss" ? `rgba(210,154,88,${flash * .48})` : rgb(s.deposit_light, flash * .62)); impactGlow.addColorStop(.3, rgb(s.deposit_color, flash * .22)); impactGlow.addColorStop(1, rgb(s.deposit_color, 0)); ctx.fillStyle = impactGlow; ctx.fillRect(impactX - 210, impactY - 210, 420, 420);
        for (let i = 0; i < (s.cue_kind === "critical" ? 24 : 13); i += 1) { const angle = i * 2.399 + .35; const travel = (26 + (i % 6) * 15) * Math.sin(Math.min(1, p) * Math.PI * .72); const chipX = impactX + Math.cos(angle) * travel; const chipY = impactY + Math.sin(angle) * travel * .62 - p * 19; ctx.save(); ctx.translate(chipX, chipY); ctx.rotate(angle + p * 3); ctx.globalAlpha = (1 - p) * (s.cue_kind === "miss" ? .54 : .86); ctx.fillStyle = i % 3 ? impactColour : rgb(s.deposit_color); ctx.fillRect(-5, -3, 10 + i % 4, 6); ctx.restore(); }
        ctx.globalAlpha = (1 - p) * .74; ctx.strokeStyle = impactColour; ctx.lineWidth = s.cue_kind === "critical" ? 9 : 5; ctx.beginPath(); ctx.ellipse(impactX, impactY, 26 + p * 136, 12 + p * 48, -.08, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      }
      if (s.cue_active && celebrationAge >= 0 && celebrationAge < 2500 && s.cue_kind && !["strike", "miss", "critical", "recall", "convoy_hold", "convoy_release"].includes(s.cue_kind)) {
        const p = celebrationAge / 2500; ctx.save(); ctx.globalCompositeOperation = "screen";
        if (s.cue_kind.startsWith("cashout")) {
          const flash = Math.max(0, 1 - p * 3.4);
          const flashX = cellX(s.visible_cells[Math.floor(s.visible_cells.length / 2)] ?? center);
          const halo = ctx.createRadialGradient(flashX, 450, 15, flashX, 450, 610);
          halo.addColorStop(0, rgb(s.deposit_light, .54 * flash));
          halo.addColorStop(.26, rgb(s.deposit_color, .22 * flash));
          halo.addColorStop(1, rgb(s.deposit_color, 0));
          ctx.fillStyle = halo; ctx.fillRect(0, 0, 1920, 650);
          ctx.globalAlpha = flash * .14; ctx.fillStyle = rgb(s.deposit_light); ctx.fillRect(0, 0, 1920, 626);
          ctx.globalAlpha = 1;
        }
        for (let ring = 0; ring < 5; ring += 1) { const local = Math.max(0, Math.min(1, p * 1.8 - ring * 0.11)); ctx.globalAlpha = (1 - local) * 0.6; ctx.strokeStyle = ring % 2 ? rgb(s.deposit_light) : "#fff4bd"; ctx.lineWidth = 4 + ring * 2; ctx.beginPath(); ctx.ellipse(cellX(s.visible_cells[Math.floor(s.visible_cells.length / 2)]), 475, 90 + local * 520, 34 + local * 165, 0, 0, Math.PI * 2); ctx.stroke(); }
        for (let i = 0; i < 72; i += 1) { const travel = (p * (1.1 + (i % 5) * 0.14) + (i % 11) / 11) % 1; const x = 960 + (i % 2 ? 1 : -1) * (75 + (i % 13) * 43) + Math.sin(i * 9.7 + p * 8) * 46; const y = 560 - travel * (300 + (i % 7) * 22); const size = i % 6 === 0 ? 10 : 5; ctx.globalAlpha = (1 - travel) * 0.8; ctx.fillStyle = i % 4 ? rgb(s.deposit_light) : "#fff7cf"; ctx.fillRect(x - size, y - 2, size * 2, 4); ctx.fillRect(x - 2, y - size, 4, size * 2); }
        ctx.restore();
      }
      // Texture without smoothing keeps the image authored rather than glossy-vector flat.
      for (let i = 0; i < 2600; i += 1) { const x = (i * 977 + 71) % 1920; const y = (i * 613 + 29) % 720; ctx.fillStyle = i % 7 ? "rgba(0,0,0,.04)" : "rgba(205,255,242,.035)"; ctx.fillRect(x, y, 1, 1); }
      animation = requestAnimationFrame(draw);
    };
    animation = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animation);
  }, []);

  return <canvas ref={canvasRef} className="sm-world" width={1920} height={720}
    aria-label={`${status.worker_count} miners extracting ${status.deposit_name}. ${Math.round(status.progress * 100)} percent revealed.`} />;
}
