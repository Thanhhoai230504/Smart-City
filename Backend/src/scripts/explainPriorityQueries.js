const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const Issue = require('../models/Issue');
const Place = require('../models/Place');
const { configureDnsServers } = require('../config/dns');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const buildPlaceExplainCommand = (near) => ({
  explain: {
    aggregate: Place.collection.collectionName,
    pipeline: [
      {
        $geoNear: {
          near,
          key: 'geo',
          distanceField: 'distanceMeters',
          maxDistance: 500,
          spherical: true,
          query: { isActive: true, type: { $in: ['hospital', 'school'] } },
        },
      },
      { $limit: 1 },
    ],
    cursor: {},
  },
  verbosity: 'executionStats',
});

const run = async () => {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');
  configureDnsServers();
  await mongoose.connect(process.env.MONGODB_URI);
  await Promise.all([Issue.createIndexes(), Place.createIndexes()]);

  const sample = await Issue.findOne({
    isDeleted: false,
    mergedInto: null,
    status: { $in: ['reported', 'processing'] },
  }).select('geo').lean();
  if (!sample?.geo?.coordinates?.length) throw new Error('No open issue with GeoJSON coordinates');

  const queueExplain = await Issue.find({
    isDeleted: false,
    mergedInto: null,
    departmentId: null,
    status: { $in: ['reported', 'processing'] },
  })
    .sort({ priorityScore: -1, createdAt: 1 })
    .limit(20)
    .explain('executionStats');

  // Gửi lệnh explain trực tiếp để URI có `w=majority` không bị driver gắn
  // writeConcern vào aggregate explain (MongoDB không cho phép tổ hợp đó).
  const placeExplain = await mongoose.connection.db.command(
    buildPlaceExplainCommand(sample.geo)
  );

  console.log(JSON.stringify({ queueExplain, placeExplain }, null, 2));
};

if (require.main === module) {
  run()
    .catch((error) => {
      console.error('Priority explain failed:', error.message);
      process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect());
}

module.exports = { buildPlaceExplainCommand, run };
