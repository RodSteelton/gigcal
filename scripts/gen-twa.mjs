// One-off script: generates the android/ TWA project without Bubblewrap's
// interactive wizard (which can't run in a non-TTY shell). Bypasses
// `bubblewrap init`'s prompts by calling the same @bubblewrap/core APIs
// directly. Safe to delete after the Android project has been generated;
// re-run only if starting the android/ folder over from scratch.
import { createRequire } from 'module';
import { join } from 'path';
import { promises as fs } from 'fs';
import crypto from 'crypto';

const require = createRequire(import.meta.url);
const { TwaManifest, TwaGenerator, BufferedLog, ConsoleLog } = require('@bubblewrap/core');

const MANIFEST_URL = 'https://rodsteelton.github.io/gigcal/manifest.webmanifest';
const TARGET_DIR = 'C:\\Users\\ssber\\Dropbox\\Programs\\GigCal\\android';
const KEYSTORE_PATH = 'C:\\Users\\ssber\\tools\\gigcal-signing\\android.keystore';

async function main() {
  await fs.mkdir(TARGET_DIR, { recursive: true });

  let twaManifest = await TwaManifest.fromWebManifest(MANIFEST_URL);

  twaManifest.packageId = 'io.github.rodsteelton.gigcal';
  twaManifest.name = 'GigCal';
  twaManifest.launcherName = 'GigCal';
  twaManifest.signingKey = { path: KEYSTORE_PATH, alias: 'gigcal' };

  const manifestPath = join(TARGET_DIR, 'twa-manifest.json');
  await twaManifest.saveToFile(manifestPath);
  console.log('Wrote', manifestPath);

  const twaGenerator = new TwaGenerator();
  const log = new BufferedLog(new ConsoleLog('gen-twa'));
  await twaGenerator.createTwaProject(TARGET_DIR, twaManifest, log, () => {});
  log.flush();

  const manifestContents = await fs.readFile(manifestPath);
  const checksum = crypto.createHash('sha1').update(manifestContents).digest('hex');
  await fs.writeFile(join(TARGET_DIR, 'manifest-checksum.txt'), checksum);
  console.log('Wrote manifest-checksum.txt:', checksum);

  console.log('Done. Android project generated at', TARGET_DIR);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
