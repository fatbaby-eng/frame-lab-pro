import { CREDIT } from '../site';

/**
 * The credit in the bottom-right corner of every exported frame.
 *
 * White type on a dark pill with a light hairline, so it reads on a white
 * frame, a black frame and anything busy in between. Sized from the frame it
 * is drawn on, with a floor, so it stays legible in a 480 px GIF and small in
 * 1080p. Draw it on the canvas that is actually encoded (the GIF's scaled
 * canvas, not the full-size one), or the downscale makes it unreadable.
 */
export function drawCredit(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const short = Math.min(w, h);
  const size = Math.max(9, Math.round(short * 0.018));
  const padX = Math.round(size * 0.7);
  const padY = Math.round(size * 0.42);
  const margin = Math.max(6, Math.round(short * 0.022));

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.filter = 'none';
  ctx.shadowColor = 'transparent';
  ctx.font = `600 ${size}px Inter, system-ui, -apple-system, "Segoe UI", sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';

  const textW = Math.ceil(ctx.measureText(CREDIT).width);
  const boxW = textW + padX * 2;
  const boxH = size + padY * 2;
  const x = w - margin - boxW;
  const y = h - margin - boxH;
  const r = boxH / 2;

  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, boxW, boxH, r);
  else ctx.rect(x, y, boxW, boxH);
  ctx.fillStyle = 'rgba(10, 10, 15, 0.58)';
  ctx.fill();
  ctx.lineWidth = Math.max(1, size / 14);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.stroke();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
  ctx.fillText(CREDIT, x + padX, y + boxH / 2 + size * 0.04);
  ctx.restore();
}
