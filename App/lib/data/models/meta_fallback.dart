// GENERATED — đừng sửa tay. Sinh từ Backend/src/utils/metaConfig.js:
//   cd Project/Backend && node ../App/tool/gen_meta_fallback.js
//
// Bản dự phòng khi chưa tải được GET /api/meta/enums (cold start không mạng —
// nghiệm thu task 0.7). Test test/data/meta_test.dart so khớp bản này với
// fixture lấy thật từ API để phát hiện lệch.
// ignore_for_file: prefer_single_quotes, lines_longer_than_80_chars

const Map<String, Object?> kMetaFallbackJson = {
  "version": "2026-10-01",
  "categories": [
    {
      "value": "pothole",
      "label": "Ổ gà",
      "icon": "🕳️",
      "color": "#FF6B35",
      "slaHours": 72,
      "intakeHours": 24
    },
    {
      "value": "garbage",
      "label": "Rác thải",
      "icon": "🗑️",
      "color": "#8B5CF6",
      "slaHours": 24,
      "intakeHours": 8
    },
    {
      "value": "streetlight",
      "label": "Đèn đường hỏng",
      "icon": "💡",
      "color": "#F59E0B",
      "slaHours": 48,
      "intakeHours": 12
    },
    {
      "value": "flooding",
      "label": "Ngập nước",
      "icon": "🌊",
      "color": "#3B82F6",
      "slaHours": 12,
      "intakeHours": 2
    },
    {
      "value": "tree",
      "label": "Cây đổ",
      "icon": "🌳",
      "color": "#10B981",
      "slaHours": 12,
      "intakeHours": 2
    },
    {
      "value": "other",
      "label": "Khác",
      "icon": "📌",
      "color": "#6B7280",
      "slaHours": 72,
      "intakeHours": 24
    }
  ],
  "statuses": [
    {
      "value": "reported",
      "label": "Mới báo cáo",
      "color": "#A82C22",
      "container": "#FBE9E7",
      "icon": "🟡"
    },
    {
      "value": "processing",
      "label": "Đang xử lý",
      "color": "#7D4F05",
      "container": "#FDF2E0",
      "icon": "🔵"
    },
    {
      "value": "resolved",
      "label": "Đã xử lý",
      "color": "#17543E",
      "container": "#E6F2EC",
      "icon": "🟢"
    },
    {
      "value": "rejected",
      "label": "Từ chối",
      "color": "#485862",
      "container": "#EDF1F4",
      "icon": "🔴"
    }
  ],
  "statusTransitions": {
    "reported": [
      "processing",
      "resolved",
      "rejected"
    ],
    "processing": [
      "resolved",
      "rejected"
    ],
    "resolved": [
      "processing"
    ],
    "rejected": [
      "processing"
    ]
  },
  "priorities": [
    {
      "value": "low",
      "label": "Thấp",
      "color": "#485862",
      "container": "#EDF1F4",
      "minScore": 0
    },
    {
      "value": "medium",
      "label": "Trung bình",
      "color": "#6B4E00",
      "container": "#FCF3DA",
      "minScore": 35
    },
    {
      "value": "high",
      "label": "Cao",
      "color": "#8A3D10",
      "container": "#FCEDE2",
      "minScore": 60
    },
    {
      "value": "critical",
      "label": "Khẩn cấp",
      "color": "#8C1D16",
      "container": "#FBE7E5",
      "minScore": 80
    }
  ],
  "slaStatuses": [
    {
      "value": "none",
      "label": "Chưa có hạn"
    },
    {
      "value": "on_time",
      "label": "Còn hạn"
    },
    {
      "value": "due_soon",
      "label": "Sắp đến hạn"
    },
    {
      "value": "overdue",
      "label": "Quá hạn"
    },
    {
      "value": "met",
      "label": "Hoàn thành đúng hạn"
    },
    {
      "value": "breached",
      "label": "Hoàn thành trễ hạn"
    }
  ],
  "notificationTypes": [
    {
      "value": "issue_created",
      "label": "Sự cố mới"
    },
    {
      "value": "issue_updated",
      "label": "Cập nhật sự cố"
    },
    {
      "value": "issue_resolved",
      "label": "Sự cố đã xử lý"
    },
    {
      "value": "issue_rejected",
      "label": "Sự cố bị từ chối"
    },
    {
      "value": "comment",
      "label": "Bình luận"
    },
    {
      "value": "area_alert",
      "label": "Cảnh báo khu vực"
    },
    {
      "value": "issue_assigned",
      "label": "Được phân công"
    },
    {
      "value": "sla_reminder",
      "label": "Nhắc hạn xử lý"
    },
    {
      "value": "sla_escalated",
      "label": "Leo cấp quá hạn"
    },
    {
      "value": "issue_merged",
      "label": "Sự cố được gộp"
    },
    {
      "value": "intake_overdue",
      "label": "Quá hạn tiếp nhận"
    },
    {
      "value": "issue_reopened",
      "label": "Sự cố được mở lại"
    },
    {
      "value": "issue_rated",
      "label": "Người dân đã đánh giá"
    },
    {
      "value": "issue_unassigned",
      "label": "Sự cố được thu hồi"
    }
  ],
  "areas": [
    {
      "value": "Hải Châu",
      "label": "Hải Châu",
      "level": "district"
    },
    {
      "value": "Thanh Khê",
      "label": "Thanh Khê",
      "level": "district"
    },
    {
      "value": "Sơn Trà",
      "label": "Sơn Trà",
      "level": "district"
    },
    {
      "value": "Ngũ Hành Sơn",
      "label": "Ngũ Hành Sơn",
      "level": "district"
    },
    {
      "value": "Liên Chiểu",
      "label": "Liên Chiểu",
      "level": "district"
    },
    {
      "value": "Cẩm Lệ",
      "label": "Cẩm Lệ",
      "level": "district"
    },
    {
      "value": "Hòa Vang",
      "label": "Hòa Vang",
      "level": "district"
    },
    {
      "value": "Hoàng Sa",
      "label": "Hoàng Sa",
      "level": "district"
    },
    {
      "value": "Khác",
      "label": "Khác",
      "level": "district"
    }
  ],
  "limits": {
    "maxImages": 5,
    "maxImageMb": 5,
    "maxTitleLength": 200,
    "maxDescriptionLength": 2000,
    "maxNoteLength": 500,
    "maxCommentLength": 1000
  },
  "reopen": {
    "maxCount": 2,
    "windowDays": 30,
    "minReasonLength": 10,
    "maxReasonLength": 500
  }
};
