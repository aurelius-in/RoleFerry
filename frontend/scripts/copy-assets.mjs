import { copyFileSync, existsSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const projectRoot = join(__dirname, "../../");
const publicDir = join(__dirname, "../public");

mkdirSync(publicDir, { recursive: true });

// Resolve wordmark from either "wordmark.png" or common typo "woodmark.png"
const wordmarkCandidates = ["wordmark.png", "woodmark.png"]; 
let wordmarkSrc = null;
for (const name of wordmarkCandidates) {
  const p = join(projectRoot, name);
  if (existsSync(p)) { wordmarkSrc = p; break; }
}

const files = [
  ...(wordmarkSrc ? [{ src: wordmarkSrc, dest: join(publicDir, "wordmark.png") }] : []),
  { src: join(projectRoot, "roleferry-med.gif"), dest: join(publicDir, "roleferry-med.gif") },
  { src: join(projectRoot, "ani-sm.gif"), dest: join(publicDir, "ani-sm.gif") },
  { src: join(projectRoot, "about.png"), dest: join(publicDir, "about.png") },
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


