import { copyFileSync, existsSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const projectRoot = join(__dirname, "../../");
const publicDir = join(__dirname, "../public");

mkdirSync(publicDir, { recursive: true });

// Resolve the official wordmark
const wordmarkPath = join(projectRoot, "wordmark.png");
const wordmarkSrc = existsSync(wordmarkPath) ? wordmarkPath : null;

const files = [
  ...(wordmarkSrc ? [{ src: wordmarkSrc, dest: join(publicDir, "wordmark.png") }] : []),
  { src: join(projectRoot, "roleferry-med.gif"), dest: join(publicDir, "roleferry-med.gif") },
  { src: join(projectRoot, "ani-sm.gif"), dest: join(publicDir, "ani-sm.gif") },
  { src: join(projectRoot, "about.png"), dest: join(publicDir, "about.png") },
  // Prefer the transparent logo if present; support a common double-extension typo
  ...(function () {
    const candidates = [
      join(projectRoot, "roleferry_trans.png"),
      join(projectRoot, "roleferry_trans.png.png"),
    ];
    for (const c of candidates) {
      if (existsSync(c)) {
        return [{ src: c, dest: join(publicDir, "roleferry_trans.png") }];
      }
    }
    return [];
  })(),
];

for (const f of files) {
  if (existsSync(f.src)) {
    try {
      copyFileSync(f.src, f.dest);
      console.log(`Copied ${f.src} -> ${f.dest}`);
    } catch (e) {
      console.warn(`Failed to copy ${f.src}:`, e.message);
    }
  }
}


