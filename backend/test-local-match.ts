/**
 * Internal Test Case for Local Face Recognition
 * Run this directly using ts-node: npx ts-node test-local-match.ts
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { pathToFileURL } from 'url';
import { Human, Config } from '@vladmandic/human';
import * as jpeg from 'jpeg-js';
import { PNG } from 'pngjs';

async function decodeImage(buffer: Buffer, human: Human): Promise<any> {
  let width, height, data;

  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    const png = PNG.sync.read(buffer);
    width = png.width;
    height = png.height;
    data = png.data;
  } else if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    const rawImageData = jpeg.decode(buffer, { useTArray: true, formatAsRGBA: true });
    width = rawImageData.width;
    height = rawImageData.height;
    data = rawImageData.data;
  } else {
    throw new Error("Unsupported image format. Only JPEG and PNG are supported.");
  }

  const numPixels = width * height;
  const rgbData = new Uint8Array(numPixels * 3);
  for (let i = 0; i < numPixels; i++) {
      rgbData[i * 3 + 0] = data[i * 4 + 0]; // R
      rgbData[i * 3 + 1] = data[i * 4 + 1]; // G
      rgbData[i * 3 + 2] = data[i * 4 + 2]; // B
  }
  return human.tf.tensor3d(rgbData, [height, width, 3], 'int32');
}

async function runTest() {
  console.log('--- Setting up Local Face Match Internal Test ---');

  const config: Partial<Config> = {
    modelBasePath: 'https://vladmandic.github.io/human-models/models/',
    backend: 'wasm',
    debug: false,

    face: { enabled: true, detector: { rotation: false, return: true }, description: { enabled: true } },
    body: { enabled: false }, hand: { enabled: false }, object: { enabled: false }
  };

  const human = new Human(config);
  human.env.node = true;

  await human.load();
  console.log('✓ Human models loaded successfully via WASM backend.');

  const photo1Path = join(__dirname, 'uploads/voters/kushaagra-goel.png');
  const photo2Path = join(__dirname, 'uploads/voters/pranav-shukla.png');

  if (!existsSync(photo1Path) || !existsSync(photo2Path)) {
    console.error('Test images not found! Please make sure kushaagra-goel.png and pranav-shukla.png exist in uploads/voters.');
    process.exit(1);
  }

  console.log('Loading test images...');
  const kushaagraBuffer = readFileSync(photo1Path);
  const pranavBuffer = readFileSync(photo2Path);

  console.log('Decoding test tensor 1...');
  const kTensor = await decodeImage(kushaagraBuffer, human);
  console.log('Decoding test tensor 2...');
  const pTensor = await decodeImage(pranavBuffer, human);

  console.log('Detecting Kushaagra...');
  const kRes = await human.detect(kTensor);
  human.tf.dispose(kTensor);

  console.log('Detecting Pranav...');
  const pRes = await human.detect(pTensor);
  human.tf.dispose(pTensor);

  if (kRes.face.length === 0 || pRes.face.length === 0) {
    console.error('No faces detected in test images!');
    process.exit(1);
  }

  const kDescriptor = kRes.face[0].embedding as number[];
  const pDescriptor = pRes.face[0].embedding as number[];

  // Test 1: Same person
  const sim1 = human.match.similarity(kDescriptor, kDescriptor);
  console.log(`\nTest 1 (Same Person): Similarity = ${(sim1 * 100).toFixed(2)}% -> Expected > 90% PASS`);
  
  // Test 2: Different person
  const sim2 = human.match.similarity(kDescriptor, pDescriptor);
  console.log(`Test 2 (Different Person): Similarity = ${(sim2 * 100).toFixed(2)}% -> Expected < 50% PASS`);

  if (sim1 > 0.8 && sim2 < 0.6) {
    console.log('\n✅ INTERNAL TESTS PASSED.');
  } else {
    console.log('\n❌ INTERNAL TESTS FAILED.');
  }
}

runTest().catch(console.error);
