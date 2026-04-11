const Issue = require('../models/Issue');
const ApiError = require('../utils/apiError');

const rateIssue = async (issueId, userId, { score, comment }) => {
  const issue = await Issue.findById(issueId);
  if (!issue) throw ApiError.notFound('Sự cố không tồn tại');

  const reporterId = issue.userId.toString();
  if (reporterId !== userId) {
    throw ApiError.forbidden('Chỉ người báo cáo mới có thể đánh giá sự cố này');
  }

  if (issue.status !== 'resolved') {
    throw ApiError.badRequest('Chỉ có thể đánh giá sự cố đã được xử lý');
  }

  if (issue.rating?.score) {
    throw ApiError.badRequest('Bạn đã đánh giá sự cố này rồi');
  }

  issue.rating = {
    score,
    comment: comment || null,
    ratedAt: new Date(),
  };
  await issue.save();

  return issue;
};

const getAverageRating = async () => {
  const result = await Issue.aggregate([
    { $match: { 'rating.score': { $ne: null } } },
    {
      $group: {
        _id: null,
        average: { $avg: '$rating.score' },
        total: { $sum: 1 },
        distribution: {
          $push: '$rating.score'
        }
      }
    }
  ]);

  if (!result.length) {
    return { average: 0, total: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } };
  }

  const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  result[0].distribution.forEach(s => { dist[s] = (dist[s] || 0) + 1; });

  return {
    average: Math.round(result[0].average * 10) / 10,
    total: result[0].total,
    distribution: dist,
  };
};

module.exports = { rateIssue, getAverageRating };
