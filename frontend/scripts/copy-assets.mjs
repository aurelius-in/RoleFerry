import { copyFileSync, existsSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const projectRoot = join(__dirname, "../../");
const publicDir = join(__dirname, "../public");

mkdirSync(publicDir, { recursive: true });

const files = [
  { src: join(projectRoot, "wordmark.png"), dest: join(publicDir, "wordmark.png") },
  { src: join(projectRoot, "roleferry-med.gif"), dest: join(publicDir, "roleferry-med.gif") },
  { src: join(projectRoot, "ani-sm.gif"), dest: join(publicDir, "ani-sm.gif") },
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


