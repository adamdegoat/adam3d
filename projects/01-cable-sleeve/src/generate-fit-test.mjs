import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.resolve(scriptDir, '../models/fit-test');

const HEIGHT = 10;
const WALL = 1;
const SLOT = 1.7;
const SEGMENTS = 160;
const SIZES = [4.0, 4.2, 4.4];

function triangle(a, b, c) {
  return [a, b, c];
}

function quad(triangles, a, b, c, d) {
  triangles.push(triangle(a, b, c), triangle(a, c, d));
}

function addBox(triangles, min, max) {
  const [x0, y0, z0] = min;
  const [x1, y1, z1] = max;
  const v = [
    [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0],
    [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1],
  ];
  quad(triangles, v[0], v[3], v[2], v[1]);
  quad(triangles, v[4], v[5], v[6], v[7]);
  quad(triangles, v[0], v[1], v[5], v[4]);
  quad(triangles, v[1], v[2], v[6], v[5]);
  quad(triangles, v[2], v[3], v[7], v[6]);
  quad(triangles, v[3], v[0], v[4], v[7]);
}

function point(radius, angle, z) {
  return [radius * Math.cos(angle), radius * Math.sin(angle), z];
}

function buildSleeve(innerDiameter, markerCount) {
  const innerRadius = innerDiameter / 2;
  const outerRadius = innerRadius + WALL;
  const gapHalfAngle = Math.asin(SLOT / (2 * outerRadius));
  const start = gapHalfAngle;
  const end = Math.PI * 2 - gapHalfAngle;
  const triangles = [];

  for (let index = 0; index < SEGMENTS; index += 1) {
    const a0 = start + (end - start) * (index / SEGMENTS);
    const a1 = start + (end - start) * ((index + 1) / SEGMENTS);
    const ob0 = point(outerRadius, a0, 0);
    const ob1 = point(outerRadius, a1, 0);
    const ot0 = point(outerRadius, a0, HEIGHT);
    const ot1 = point(outerRadius, a1, HEIGHT);
    const ib0 = point(innerRadius, a0, 0);
    const ib1 = point(innerRadius, a1, 0);
    const it0 = point(innerRadius, a0, HEIGHT);
    const it1 = point(innerRadius, a1, HEIGHT);

    quad(triangles, ob0, ob1, ot1, ot0);
    quad(triangles, ib0, it0, it1, ib1);
    quad(triangles, it0, ot0, ot1, it1);
    quad(triangles, ib0, ib1, ob1, ob0);
  }

  const osb = point(outerRadius, start, 0);
  const ost = point(outerRadius, start, HEIGHT);
  const isb = point(innerRadius, start, 0);
  const ist = point(innerRadius, start, HEIGHT);
  quad(triangles, isb, osb, ost, ist);

  const oeb = point(outerRadius, end, 0);
  const oet = point(outerRadius, end, HEIGHT);
  const ieb = point(innerRadius, end, 0);
  const iet = point(innerRadius, end, HEIGHT);
  quad(triangles, oeb, ieb, iet, oet);

  const spacing = 0.65;
  const markerWidth = 0.38;
  for (let index = 0; index < markerCount; index += 1) {
    const y = (index - (markerCount - 1) / 2) * spacing;
    addBox(
      triangles,
      [-outerRadius - 0.45, y - markerWidth / 2, 0],
      [-outerRadius + 0.25, y + markerWidth / 2, 1.2],
    );
  }

  return triangles;
}

function normal(a, b, c) {
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const n = [
    u[1] * v[2] - u[2] * v[1],
    u[2] * v[0] - u[0] * v[2],
    u[0] * v[1] - u[1] * v[0],
  ];
  const length = Math.hypot(...n) || 1;
  return n.map((value) => value / length);
}

function writeBinaryStl(file, name, triangles) {
  const buffer = Buffer.alloc(84 + triangles.length * 50);
  buffer.write(`Adam3D ${name}`.slice(0, 80), 0, 'ascii');
  buffer.writeUInt32LE(triangles.length, 80);
  let offset = 84;
  for (const points of triangles) {
    const n = normal(...points);
    for (const value of n) {
      buffer.writeFloatLE(value, offset);
      offset += 4;
    }
    for (const vertex of points) {
      for (const value of vertex) {
        buffer.writeFloatLE(value, offset);
        offset += 4;
      }
    }
    buffer.writeUInt16LE(0, offset);
    offset += 2;
  }
  fs.writeFileSync(file, buffer);
}

fs.mkdirSync(outputDir, { recursive: true });
for (const [index, size] of SIZES.entries()) {
  const label = size.toFixed(1);
  const filename = path.join(outputDir, `sleeve-fit-ID-${label}mm-${index + 1}mark.stl`);
  writeBinaryStl(filename, `Sleeve fit ID ${label} mm`, buildSleeve(size, index + 1));
  console.log(filename);
}
