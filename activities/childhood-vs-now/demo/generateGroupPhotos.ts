import type { Rect } from '../../../src/core/types';
type Ctx = OffscreenCanvasRenderingContext2D;
const ellipse = (c: Ctx, x: number, y: number, rx: number, ry: number, fill: string) => { c.fillStyle = fill; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill(); };
function photo(child: boolean) {
  const canvas = new OffscreenCanvas(1800, 1100), c = canvas.getContext('2d')!;
  c.fillStyle = '#e9dec6'; c.fillRect(0, 0, 1800, 1100);
  c.fillStyle = '#e1d0b1'; for (let y = 0; y < 900; y += 70) for (let x = (y / 70 % 2) * -120; x < 1800; x += 240) { c.fillRect(x + 5, y + 5, 230, 60); }
  c.fillStyle = '#466e61'; c.fillRect(240, 85, 1320, 440);
  c.strokeStyle = '#a5784f'; c.lineWidth = 25; c.strokeRect(240, 85, 1320, 440);
  c.fillStyle = '#e5ebd5'; c.font = 'bold 66px sans-serif'; c.textAlign = 'center'; c.fillText(child ? 'CLASS OF GOOD TIMES' : 'STILL THE SAME GANG', 900, 230);
  c.font = '32px sans-serif'; c.fillText('★   FRIDAY IS OUR FAVOURITE SUBJECT   ★', 900, 300);
  c.strokeStyle = '#a0b99c'; c.lineWidth = 3; c.beginPath(); c.moveTo(600, 345); c.lineTo(1200, 345); c.stroke();
  c.fillStyle = '#b79671'; c.fillRect(0, 970, 1800, 130);
  c.strokeStyle = '#9c7b5a'; for (let x = 0; x < 1800; x += 150) { c.beginPath(); c.moveTo(x, 970); c.lineTo(x - 100, 1100); c.stroke(); }
  const skin = ['#b97b56', '#e1af89', '#d49571', '#a96847'], shirts = ['#dd9aab', '#779bad', '#e1b84e', '#81a795'], hair = ['#332b2a', '#644731', '#302b29', '#2f2824'];
  const faces: Rect[] = [];
  for (let i = 0; i < 4; i++) {
    const x = 330 + i * 380 + (child ? [-8, 9, -9, 7][i] : 0), y = child ? 650 : 570;
    const rx = child ? 89 : 96, ry = child ? 104 : 122;
    ellipse(c, x, 988, 150, 24, '#947b61');
    c.fillStyle = '#344c55'; c.fillRect(x - 85, 885, 70, 115); c.fillRect(x + 15, 885, 70, 115);
    c.fillStyle = shirts[i]; c.beginPath(); c.roundRect(x - 145, y + 80, 290, child ? 215 : 310, [95, 95, 18, 18]); c.fill();
    ellipse(c, x - 136, y + 230, 28, 70, skin[i]); ellipse(c, x + 136, y + 230, 28, 70, skin[i]);
    c.fillStyle = skin[i]; c.fillRect(x - 28, y + 70, 56, 65);
    if (i === 0 || i === 2) ellipse(c, x, y + 5, rx + 25, ry + 30, hair[i]);
    ellipse(c, x - rx + 1, y + 8, 19, 28, skin[i]); ellipse(c, x + rx - 1, y + 8, 19, 28, skin[i]);
    ellipse(c, x, y, rx, ry, skin[i]);
    c.fillStyle = hair[i]; c.beginPath(); c.ellipse(x, y - 67, rx + 3, child ? 53 : 69, -.12, Math.PI, Math.PI * 2); c.lineTo(x + rx, y - 23); c.quadraticCurveTo(x + 30, y - 112, x - rx, y - 31); c.closePath(); c.fill();
    if (i === 2) { ellipse(c, x + 92, y - 68, 44, 48, hair[i]); ellipse(c, x + 99, y - 64, 10, 14, '#dd9aab'); }
    ellipse(c, x - 34, y - 2, 7, 10, '#332b2a'); ellipse(c, x + 34, y - 2, 7, 10, '#332b2a');
    c.strokeStyle = '#533a2b'; c.lineWidth = 4; c.lineCap = 'round';
    c.beginPath(); c.moveTo(x - 49, y - 28); c.quadraticCurveTo(x - 35, y - 37, x - 21, y - 28); c.moveTo(x + 21, y - 28); c.quadraticCurveTo(x + 35, y - 36, x + 49, y - 28); c.stroke();
    c.strokeStyle = '#946246'; c.beginPath(); c.moveTo(x + 2, y + 8); c.lineTo(x - 5, y + 25); c.lineTo(x + 5, y + 27); c.stroke();
    c.fillStyle = '#653e30'; c.beginPath(); c.ellipse(x, y + 41, 28, 22, 0, 0, Math.PI); c.fill();
    c.fillStyle = '#ffefde'; c.fillRect(x - 22, y + 40, 44, 7);
    if (child) { ellipse(c, x - 60, y + 33, 15, 8, '#cf8874'); ellipse(c, x + 60, y + 33, 15, 8, '#cf8874'); }
    if (i === 1 || (i === 3 && !child)) {
      c.strokeStyle = '#3c3935'; c.lineWidth = 5;
      c.beginPath(); c.roundRect(x - 63, y - 19, 54, 40, 10); c.roundRect(x + 9, y - 19, 54, 40, 10); c.moveTo(x - 9, y - 6); c.lineTo(x + 9, y - 6); c.stroke();
    }
    c.fillStyle = '#f8edd8'; c.beginPath(); c.moveTo(x - 48, y + 115); c.lineTo(x, y + 144); c.lineTo(x - 22, y + 165); c.closePath(); c.fill(); c.beginPath(); c.moveTo(x + 48, y + 115); c.lineTo(x, y + 144); c.lineTo(x + 22, y + 165); c.closePath(); c.fill();
    for (let b = 0; b < 3; b++) ellipse(c, x, y + 181 + b * 32, 4, 4, '#f8edd8');
    faces.push({ x: (x - rx) / 1800, y: (y - ry) / 1100, width: rx * 2 / 1800, height: ry * 2 / 1100 });
  }
  return { canvas, faces };
}
export async function generateDemo() {
  const now = photo(false), then = photo(true);
  return { now: await now.canvas.convertToBlob({ type: 'image/jpeg', quality: .95 }), then: await then.canvas.convertToBlob({ type: 'image/jpeg', quality: .95 }), nowFaces: now.faces, thenFaces: then.faces, width: 1800, height: 1100 };
}
