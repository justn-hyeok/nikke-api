import crypto from "node:crypto";

export const CDN_BASE = "https://sg-tools-cdn.blablalink.com";

const LARGE_PRIMES = [224737, 1000639, 2654435761, 2654435769, 1000621, 4294967291];

const md5 = (s: string) => crypto.createHash("md5").update(s, "utf8").digest("hex");

// djb2 variant seeded by a large prime, kept uint32
function djb2Mod(str: string, seed: number): number {
  let h = seed;
  for (let i = 0; i < str.length; i++) {
    h = (h * 33 + str.charCodeAt(i)) & 4294967295;
  }
  return h;
}

function twoLetterHash(str: string, prime: number): string {
  const h = ((djb2Mod(str, prime) % prime) + prime) % prime;
  return String.fromCharCode(97 + (Math.floor(h / 26) % 26), 97 + (h % 26));
}

function twoNumberHash(str: string, prime: number): string {
  return String((((djb2Mod(str, prime) % prime) + prime) % prime) % 99).padStart(2, "0");
}

function file2md5(filename: string): string {
  const parts = filename.split(".");
  const first = parts.shift()!;
  return `${md5(first)}.${parts.join(".")}`;
}

function createSpineAnimationPath(path: string): string {
  const segs = path.split("/").filter(Boolean);
  const dirPath = segs.slice(0, -1).join("/");
  return segs
    .map((seg, i) =>
      i === segs.length - 1
        ? file2md5(seg)
        : `${twoLetterHash(dirPath, LARGE_PRIMES[i])}-${twoNumberHash(dirPath, LARGE_PRIMES[i])}`,
    )
    .join("/");
}

function createNormalObfuscatedPath(path: string): string {
  const segs = path.split("/").filter(Boolean);
  return segs
    .map((seg, i) => {
      if (i === segs.length - 1) {
        const parts = seg.split(".");
        const name = parts.shift()!;
        const ext = parts.join(".");
        return `${md5(path)}.${ext || name}`;
      }
      return `${twoLetterHash(path, LARGE_PRIMES[i])}-${twoNumberHash(path, LARGE_PRIMES[i])}`;
    })
    .join("/");
}

export function obfuscatedPath(path: string): string {
  const p = path.replace(/^\//, "");
  return p.startsWith("spine") ? createSpineAnimationPath(p) : createNormalObfuscatedPath(p);
}

export function cdnUrl(path: string): string {
  return `${CDN_BASE}/${obfuscatedPath(path)}`;
}

export async function fetchJson<T = unknown>(path: string): Promise<T> {
  const url = cdnUrl(path);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json() as Promise<T>;
}

/** same substitution as the site's getLFormatLangUrl */
export function langPath(template: string, locale: string): string {
  return template.replace(/\{lang\}/g, locale).replace(/\{l_lang\}/g, locale);
}
