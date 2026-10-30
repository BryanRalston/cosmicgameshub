import { inflateSync } from 'node:zlib';

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

export function decodePng(buffer) {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const sig = '89504e470d0a1a0a';
  if (buf.subarray(0, 8).toString('hex') !== sig) throw new Error('not a png');
  let o = 8;
  let width = 0;
  let height = 0;
  let colorType = 6;
  const idat = [];
  while (o < buf.length) {
    const len = buf.readUInt32BE(o);
    const type = buf.toString('ascii', o + 4, o + 8);
    const data = buf.subarray(o + 8, o + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      const depth = data[8];
      colorType = data[9];
      if (depth !== 8 || data[12] !== 0) throw new Error('unsupported png');
      if (colorType !== 2 && colorType !== 6) throw new Error('png color type ' + colorType);
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
    o += 12 + len;
  }
  const bpp = colorType === 6 ? 4 : 3;
  const stride = width * bpp;
  const raw = inflateSync(Buffer.concat(idat));
  const out = new Uint8Array(width * height * 4);
  let i = 0;
  let prev = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[i++];
    const row = new Uint8Array(stride);
    for (let x = 0; x < stride; x++) {
      const v = raw[i++];
      const left = x >= bpp ? row[x - bpp] : 0;
      const up = prev[x];
      const ul = x >= bpp ? prev[x - bpp] : 0;
      let n = v;
      if (filter === 1) n = (v + left) & 255;
      else if (filter === 2) n = (v + up) & 255;
      else if (filter === 3) n = (v + ((left + up) >> 1)) & 255;
      else if (filter === 4) n = (v + paeth(left, up, ul)) & 255;
      else if (filter !== 0) throw new Error('png filter ' + filter);
      row[x] = n;
    }
    for (let x = 0; x < width; x++) {
      const s = x * bpp;
      const d = (y * width + x) * 4;
      out[d] = row[s];
      out[d + 1] = row[s + 1];
      out[d + 2] = row[s + 2];
      out[d + 3] = bpp === 4 ? row[s + 3] : 255;
    }
    prev = row;
  }
  return { width, height, data: out };
}

export function hueOf(r, g, b) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  if (d < 0.0001) return 0;
  let h;
  if (max === rn) h = ((gn - bn) / d) % 6;
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return h;
}
