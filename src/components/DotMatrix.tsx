import { useEffect, useRef } from "react";
import type { StripMineStatus } from "../types";

const PAGES = ["SETTLEMENT", "CREW", "TWIN CITY", "DEPOSIT", "PROGRESSION"];
const RANKS = ["#ffd13f", "#35e57d", "#ff8423", "#fa4697", "#f4f7ff"];
const MATRIX_COLS = 512;
const MATRIX_ROWS = 384;
const DESIGN_WIDTH = 256;
const OUTPUT_SCALE = 2;
export const MATRIX_DOTS = MATRIX_COLS * MATRIX_ROWS;
export const MATRIX_PAGE_MS = 6000;

export function DotMatrix({ status }: { status: StripMineStatus }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const artRef = useRef<HTMLCanvasElement | null>(null);
  const statusRef = useRef(status); statusRef.current = status;

  useEffect(() => {
    const art = document.createElement("canvas"); art.width = MATRIX_COLS; art.height = MATRIX_ROWS; artRef.current = art;
    let timer = 0;
    const draw = () => {
      const canvas = canvasRef.current; const s = statusRef.current; if (!canvas) return;
      const ctx = canvas.getContext("2d"); const a = artRef.current?.getContext("2d", { willReadFrequently: true }); if (!ctx || !a) return;
      const now = performance.now();
      const page = s.reward_pending || s.complete ? -1 : Math.floor(now / MATRIX_PAGE_MS) % PAGES.length;
      const colour = `rgb(${s.deposit_light.join(",")})`; const rank = `rgb(${s.rank_color.join(",")})`;
      a.setTransform(1, 0, 0, 1, 0, 0); a.clearRect(0, 0, MATRIX_COLS, MATRIX_ROWS);
      const scale = MATRIX_COLS / DESIGN_WIDTH; a.setTransform(scale, 0, 0, scale, 0, 0);
      a.textBaseline = "middle"; a.textAlign = "center"; a.lineCap = "round"; a.lineJoin = "round";
      const text = (value: string, x: number, y: number, size: number, fill = "#fff4bd", weight = 800, max = 240) => { a.font = `${weight} ${size}px ui-monospace,monospace`; a.fillStyle = fill; a.fillText(value, x, y, max); };
      const panel = (x: number, y: number, width: number, height: number) => { a.strokeStyle = colour; a.lineWidth = 1.5; a.strokeRect(x, y, width, height); a.fillStyle = colour; a.fillRect(x, y, width, 2.5); };
      const skylineFloors = s.city.reduce((sum, plot) => sum + (plot?.level ?? 0) * 2, 0);

      if (s.last_cashout && s.cue_active && s.cue_kind.startsWith("cashout")) {
        panel(8, 8, 240, 176); text(s.last_cashout.label, 128, 25, 14, "#ffcf70", 900);
        text(`+${s.last_cashout.total.toLocaleString()}`, 128, 82, 43, "#fff7c7", 900);
        text(s.last_cashout.steps.slice(1).map((step) => `×${step.multiplier} ${step.label}`).join("  "), 128, 124, 10, colour, 900);
        text(`${s.last_cashout.payload} PAYLOAD`, 128, 151, 11, "#ffffff", 900);
        text(`CITY VALUE ${s.city_value.toLocaleString()}`, 128, 174, 10, "#70e2d6", 900);
      } else if (s.complete) {
        text("METROPOLIS COMPLETE", 128, 17, 14, "#ffdb83", 900);
        const heights = [66, 92, 124, 151, 124, 92, 66];
        heights.forEach((height, index) => { const x = 9 + index * 35; a.fillStyle = index === 3 ? "#f4f7ff" : RANKS[(index + 3) % RANKS.length]; a.fillRect(x, 174 - height, 27, height); a.fillStyle = "#fff6b8"; for (let y = 166 - height; y < 164; y += 13) { a.fillRect(x + 5, y, 4, 6); a.fillRect(x + 17, y, 4, 6); } });
        text("LIGHT", 128, 83, 38, "#ffffff", 900); text("30 VEINS · 4 MASTERS", 128, 184, 10, "#7de8dc", 900);
      } else if (s.reward_pending) {
        panel(8, 8, 240, 176); text(s.cue_kind === "finale_armed" ? "THE LAST SHIFT" : "VEIN CLEARED", 128, 29, 14, "#ffcf70", 900);
        text(s.cue_kind === "finale_armed" ? "PRESS A" : s.cue_label, 128, 91, s.cue_kind === "finale_armed" ? 41 : 27, "#fff1a8", 900);
        text(s.cue_kind === "finale_armed" ? "FOUR MINERS" : `${s.deposit_short} RECOVERED`, 128, 143, 12, "#70e2d6", 900);
        text(s.cue_kind === "finale_armed" ? "ONE FINAL STRIKE" : "TWIN CITY UPDATED", 128, 166, 10, "#ffffff", 900);
      } else if (page === 0) {
        text(`SETTLEMENT · ${s.tempo_name} ×${s.tempo}`, 128, 15, 12, "#ffcf76", 900); text("CITY VALUE", 128, 42, 15, colour, 900);
        text(s.city_value.toLocaleString(), 128, 83, 39, "#fff2a8", 900); text(`+${s.production_per_minute.toLocaleString()}/MIN · BEST +${s.best_delivery.toLocaleString()}`, 128, 119, 10, "#ffffff");
        a.fillStyle = "#31494f"; a.fillRect(8, 176, 240, 4); s.city.forEach((plot, index) => { const height = 15 + (plot?.level ?? 0) * 4; [24 + index * 35, 232 - index * 35].forEach((x, side) => { a.fillStyle = plot ? (side ? `rgb(${plot.right.join(",")})` : `rgb(${plot.left.join(",")})`) : "#34484e"; a.fillRect(x - 11, 175 - height, 22, height); a.fillStyle = "#fff0a0"; for (let y = 169 - height; plot && y < 169; y += 10) { a.fillRect(x - 6, y, 3, 4); a.fillRect(x + 3, y, 3, 4); } }); });
        text(`ORE ${s.ore.toLocaleString()} · ${skylineFloors} FLOORS`, 128, 145, 10, "#70e2d6", 900);
      } else if (page === 1) {
        text(`CREW · ${s.worker_count}/4 ACTIVE`, 128, 14, 13, "#ffcf76", 900);
        s.workers.slice(0, 4).forEach((worker, index) => { const col = index % 2; const row = Math.floor(index / 2); const x = 67 + col * 122; const y = 58 + row * 67; panel(x - 48, y - 23, 96, 51); a.fillStyle = RANKS[worker.rank]; a.beginPath(); a.arc(x - 25, y - 5, 11, Math.PI, 0); a.lineTo(x - 12, y + 3); a.lineTo(x - 38, y + 3); a.fill(); a.fillRect(x - 41, y + 1, 32, 4); a.fillStyle = "#dca474"; a.fillRect(x - 33, y + 5, 16, 13); a.fillStyle = RANKS[worker.rank]; a.fillRect(x - 36, y + 18, 22, 8); text(`${worker.side === "left" ? "W" : "E"}${Math.floor(worker.id / 2) + 1}`, x + 17, y - 7, 11, "#fff", 900, 48); text(`×${worker.power}`, x + 17, y + 11, 10, RANKS[worker.rank], 900, 48); });
        text(`${s.pending_convoy ? `${s.pending_convoy} LOADED · ` : ""}${s.rank_name.toUpperCase()} ×${s.workers[0]?.power ?? 1}`, 128, 179, 10, "#8de9dc", 900);
      } else if (page === 2) {
        text("TWIN CITY · LIVE SKYLINE", 128, 15, 13, "#ffcf76", 900); a.fillStyle = "#31494f"; a.fillRect(8, 169, 240, 4);
        s.city.forEach((plot, index) => { const height = 48 + (plot?.level ?? 0) * 9; [28 + index * 39, 228 - index * 39].forEach((x, side) => { a.strokeStyle = plot ? (side ? `rgb(${plot.right.join(",")})` : `rgb(${plot.left.join(",")})`) : "#3a5057"; a.lineWidth = 3; a.strokeRect(x - 15, 169 - height, 30, height); if (plot) { a.fillStyle = "#fff0a0"; for (let y = 161 - height; y < 159; y += 12) { a.fillRect(x - 9, y, 4, 6); a.fillRect(x + 5, y, 4, 6); } text(`L${plot.level}`, x, 181, 8, a.strokeStyle as string, 900, 30); } }); });
        text(`${skylineFloors} FLOORS`, 128, 92, 19, "#ffffff", 900, 92); text(`NEXT LIFT · ${Math.round(s.progress * 100)}%`, 128, 117, 10, colour, 900);
      } else if (page === 3) {
        text("DEPOSIT PROFILE", 128, 14, 13, "#ffcf76", 900); panel(12, 34, 88, 128); a.fillStyle = colour; a.beginPath(); a.moveTo(56, 43); a.lineTo(90, 77); a.lineTo(80, 148); a.lineTo(39, 155); a.lineTo(21, 81); a.closePath(); a.fill(); a.strokeStyle = "#fff"; a.stroke();
        text(s.deposit_pattern, 177, 61, 22, colour, 900, 142); text(s.deposit_name.toUpperCase(), 177, 91, 13, "#fff1aa", 900, 142); text(`${Math.max(0, Math.round((1 - s.progress) * 100))}% ORE LEFT`, 177, 119, 12, "#fff", 900, 142); text(`${s.visible_cells.length}/4 MINERAL LEDS`, 177, 144, 10, "#70e2d6", 900, 142); text(s.deposit_story.toUpperCase(), 128, 180, 8, "#b8d0ce", 700);
      } else {
        text(`CAMPAIGN · AGE ${s.age + 1} OF 5`, 128, 15, 13, "#ffcf76", 900); text(`${Math.round(s.campaign_progress * 100)}%`, 128, 61, 42, "#fff2a8", 900); a.fillStyle = "#31484e"; a.fillRect(21, 103, 214, 6); a.fillStyle = rank; a.fillRect(21, 103, 214 * s.campaign_progress, 6);
        [0, 1, 2, 3, 4].forEach((age) => { const x = 21 + age * 53.5; a.fillStyle = age <= s.age ? RANKS[age] : "#40555b"; a.beginPath(); a.arc(x, 106, age === s.age ? 8 : 5, 0, Math.PI * 2); a.fill(); text(String(age + 1), x, 128, 9, a.fillStyle as string, 900); }); text(`${s.completed_veins}/30 VEINS · ${skylineFloors} FLOORS`, 128, 153, 10, "#b8d1cf", 900); text(`EST. ${s.campaign_estimate_hours}H · ${s.tempo_name}`, 128, 177, 10, "#70e2d6", 900);
      }

      a.setTransform(1, 0, 0, 1, 0, 0); const pixels = a.getImageData(0, 0, MATRIX_COLS, MATRIX_ROWS).data;
      const outputWidth = MATRIX_COLS * OUTPUT_SCALE; const outputHeight = MATRIX_ROWS * OUTPUT_SCALE; ctx.clearRect(0, 0, outputWidth, outputHeight);
      const bg = ctx.createRadialGradient(outputWidth / 2, outputHeight * .45, 0, outputWidth / 2, outputHeight * .45, outputWidth * .58); bg.addColorStop(0, "#17252a"); bg.addColorStop(1, "#020507"); ctx.fillStyle = bg; ctx.fillRect(0, 0, outputWidth, outputHeight);
      for (let row = 0; row < MATRIX_ROWS; row += 1) for (let col = 0; col < MATRIX_COLS; col += 1) { const offset = (row * MATRIX_COLS + col) * 4; const on = pixels[offset + 3] > 24; const pulse = .94 + Math.sin(now * .0016 + col * .07) * .06; ctx.fillStyle = on ? `rgba(${Math.min(255, pixels[offset] * 1.28 + 18)},${Math.min(255, pixels[offset + 1] * 1.28 + 18)},${Math.min(255, pixels[offset + 2] * 1.28 + 18)},${.98 * pulse})` : "rgba(118,76,38,.13)"; const size = on ? 1.58 : .44; ctx.beginPath(); ctx.arc(col * OUTPUT_SCALE + 1, row * OUTPUT_SCALE + 1, size / 2, 0, Math.PI * 2); ctx.fill(); }
      canvas.setAttribute("aria-label", `${page < 0 ? s.cue_label : PAGES[page]}. ${s.message}`);
    };
    draw(); timer = window.setInterval(draw, 280);
    return () => window.clearInterval(timer);
  }, []);

  return <canvas ref={canvasRef} className="sm-matrix" width={MATRIX_COLS * OUTPUT_SCALE} height={MATRIX_ROWS * OUTPUT_SCALE} />;
}
