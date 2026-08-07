const { performance } = require('perf_hooks');
const { calculatePriorityScore } = require('../services/priorityService');

const iterations = Math.max(1000, Number.parseInt(process.argv[2], 10) || 100000);
const now = new Date('2026-08-01T12:00:00.000Z');
const categories = ['pothole', 'garbage', 'streetlight', 'flooding', 'tree', 'other'];
let checksum = 0;

const startedAt = performance.now();
for (let index = 0; index < iterations; index += 1) {
  const result = calculatePriorityScore({
    issue: {
      category: categories[index % categories.length],
      voteCount: index % 80,
      createdAt: new Date(now.getTime() - (index % 168) * 60 * 60 * 1000),
      assignedAt: null,
      dueAt: null,
    },
    nearbyCount: index % 14,
    nearestSensitivePlace: index % 5 === 0
      ? null
      : { type: index % 2 ? 'school' : 'hospital', distanceMeters: index % 550 },
    now,
  });
  checksum += result.priorityScore;
}
const elapsedMs = performance.now() - startedAt;

console.log(JSON.stringify({
  iterations,
  elapsedMs: Math.round(elapsedMs * 100) / 100,
  scoresPerSecond: Math.round(iterations / (elapsedMs / 1000)),
  checksum: Math.round(checksum * 10) / 10,
}, null, 2));
