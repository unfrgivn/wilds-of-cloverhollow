import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";

export type RgbaImage = { width: number; height: number; rgba: Uint8Array };

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

export function decodeRgbaPngBuffer(raw: Buffer, label: string): RgbaImage {
  const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
  let width = 0;
  let height = 0;
  const chunks: Uint8Array[] = [];
  for (let offset = 8; offset + 8 <= raw.length;) {
    const length = view.getUint32(offset);
    const type = raw.subarray(offset + 4, offset + 8).toString("ascii");
    const body = raw.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = view.getUint32(offset + 8);
      height = view.getUint32(offset + 12);
      const bitDepth = body[8];
      const colorType = body[9];
      if (bitDepth !== 8 || colorType !== 6) {
        throw new Error(
          `${label}: expected 8-bit RGBA PNG, got depth=${bitDepth} type=${colorType}`,
        );
      }
    } else if (type === "IDAT") {
      chunks.push(body);
    } else if (type === "IEND") {
      break;
    }
    offset += 12 + length;
  }
  const inflated = inflateSync(Buffer.concat(chunks));
  const stride = width * 4;
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (stride + 1);
    const filter = inflated[rowStart] ?? 0;
    const outStart = y * stride;
    for (let x = 0; x < stride; x += 1) {
      const value = inflated[rowStart + 1 + x] ?? 0;
      const a = x >= 4 ? (rgba[outStart + x - 4] ?? 0) : 0;
      const b = y > 0 ? (rgba[outStart - stride + x] ?? 0) : 0;
      const c = x >= 4 && y > 0 ? (rgba[outStart - stride + x - 4] ?? 0) : 0;
      const recon = filter === 0 ? value
        : filter === 1 ? value + a
          : filter === 2 ? value + b
            : filter === 3 ? value + Math.floor((a + b) / 2)
              : value + paeth(a, b, c);
      rgba[outStart + x] = recon & 0xff;
    }
  }
  return { width, height, rgba };
}

function decodePamBuffer(raw: Buffer, label: string): RgbaImage {
  const marker = Buffer.from("ENDHDR\n");
  const endHdr = raw.indexOf(marker);
  if (endHdr < 0) throw new Error(`${label}: missing PAM ENDHDR`);
  const header = raw.subarray(0, endHdr).toString("ascii");
  const field = (name: string): number => {
    const match = new RegExp(`^${name}\\s+(\\d+)$`, "m").exec(header);
    return match?.[1] === undefined ? 0 : Number(match[1]);
  };
  const width = field("WIDTH");
  const height = field("HEIGHT");
  const depth = field("DEPTH");
  const pixels = raw.subarray(endHdr + marker.length);
  if (width <= 0 || height <= 0 || (depth !== 3 && depth !== 4)) {
    throw new Error(`${label}: unsupported PAM (${width}x${height}, depth=${depth})`);
  }
  if (depth === 4) {
    return {
      width,
      height,
      rgba: new Uint8Array(pixels.buffer, pixels.byteOffset, width * height * 4),
    };
  }
  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    rgba[i * 4] = pixels[i * 3] ?? 0;
    rgba[i * 4 + 1] = pixels[i * 3 + 1] ?? 0;
    rgba[i * 4 + 2] = pixels[i * 3 + 2] ?? 0;
    rgba[i * 4 + 3] = 255;
  }
  return { width, height, rgba };
}

type WebpDecoder = (file: string) => RgbaImage;
let cachedDecoder: WebpDecoder | undefined;

const MAX_BUFFER = 64 * 1024 * 1024;

function webpDecoders(): WebpDecoder[] {
  return [
    (file) => decodePamBuffer(
      execFileSync("dwebp", [file, "-quiet", "-pam", "-o", "-"], { maxBuffer: MAX_BUFFER }),
      file,
    ),
    (file) => decodeRgbaPngBuffer(
      execFileSync("magick", [file, "-alpha", "on", "-depth", "8", "png32:-"], {
        maxBuffer: MAX_BUFFER,
      }),
      file,
    ),
    (file) => decodeRgbaPngBuffer(
      execFileSync("convert", [file, "-alpha", "on", "-depth", "8", "png32:-"], {
        maxBuffer: MAX_BUFFER,
      }),
      file,
    ),
    (file) => decodeRgbaPngBuffer(
      execFileSync(
        "ffmpeg",
        ["-v", "error", "-i", file, "-f", "image2pipe", "-vcodec", "png", "-pix_fmt", "rgba", "-"],
        { maxBuffer: MAX_BUFFER },
      ),
      file,
    ),
  ];
}

export function decodeRgbaImage(file: string): RgbaImage {
  if (file.endsWith(".png")) return decodeRgbaPngBuffer(readFileSync(file), file);
  if (cachedDecoder !== undefined) return cachedDecoder(file);
  const errors: string[] = [];
  for (const candidate of webpDecoders()) {
    try {
      const decoded = candidate(file);
      cachedDecoder = candidate;
      return decoded;
    } catch (error: unknown) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  throw new Error(`Unable to decode ${file} (tried dwebp, magick, convert, ffmpeg): ${errors[0]}`);
}
