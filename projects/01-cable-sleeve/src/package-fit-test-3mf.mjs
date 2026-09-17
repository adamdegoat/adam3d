import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const modelDir = path.resolve(scriptDir, '../models/fit-test');
const output = path.join(modelDir, 'Adam3D-Cable-Sleeve-Fit-Test-P2S.3mf');
const inputs = [
  ['Sleeve Fit 4.0 mm - 1 mark', 'sleeve-fit-ID-4.0mm-1mark.stl', 10],
  ['Sleeve Fit 4.2 mm - 2 marks', 'sleeve-fit-ID-4.2mm-2mark.stl', 22],
  ['Sleeve Fit 4.4 mm - 3 marks', 'sleeve-fit-ID-4.4mm-3mark.stl', 34],
];

function readBinaryStl(filename) {
  const data = fs.readFileSync(filename);
  const count = data.readUInt32LE(80);
  const vertices = [];
  const vertexIndex = new Map();
  const triangles = [];
  let offset = 84;
  for (let face = 0; face < count; face += 1) {
    offset += 12;
    const indices = [];
    for (let corner = 0; corner < 3; corner += 1) {
      const vertex = [
        data.readFloatLE(offset),
        data.readFloatLE(offset + 4),
        data.readFloatLE(offset + 8),
      ];
      offset += 12;
      const key = vertex.map((value) => value.toFixed(6)).join(',');
      if (!vertexIndex.has(key)) {
        vertexIndex.set(key, vertices.length);
        vertices.push(vertex);
      }
      indices.push(vertexIndex.get(key));
    }
    triangles.push(indices);
    offset += 2;
  }
  return { vertices, triangles };
}

function meshXml(mesh) {
  const vertices = mesh.vertices
    .map(([x, y, z]) => `<vertex x="${x}" y="${y}" z="${z}"/>`)
    .join('');
  const triangles = mesh.triangles
    .map(([v1, v2, v3]) => `<triangle v1="${v1}" v2="${v2}" v3="${v3}"/>`)
    .join('');
  return `<mesh><vertices>${vertices}</vertices><triangles>${triangles}</triangles></mesh>`;
}

const objects = inputs.map(([name, filename], index) => {
  const mesh = readBinaryStl(path.join(modelDir, filename));
  return `<object id="${index + 1}" type="model" name="${name}">${meshXml(mesh)}</object>`;
}).join('');

const items = inputs.map(([, , x], index) =>
  `<item objectid="${index + 1}" transform="1 0 0 0 1 0 0 0 1 ${x} 15 0"/>`
).join('');

const model = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <metadata name="Title">Adam3D Cable Sleeve Fit Test</metadata>
  <metadata name="Designer">Adam3D</metadata>
  <metadata name="Description">P2S 0.4 mm PETG fit test: 4.0, 4.2, and 4.4 mm internal diameters</metadata>
  <resources>${objects}</resources>
  <build>${items}</build>
</model>`;

const contentTypes = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
</Types>`;

const relationships = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>`;

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'adam3d-3mf-'));
try {
  fs.mkdirSync(path.join(temp, '_rels'));
  fs.mkdirSync(path.join(temp, '3D'));
  fs.writeFileSync(path.join(temp, '[Content_Types].xml'), contentTypes);
  fs.writeFileSync(path.join(temp, '_rels/.rels'), relationships);
  fs.writeFileSync(path.join(temp, '3D/3dmodel.model'), model);
  fs.rmSync(output, { force: true });
  execFileSync('zip', ['-q', '-r', output, '[Content_Types].xml', '_rels', '3D'], { cwd: temp });
  console.log(output);
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
