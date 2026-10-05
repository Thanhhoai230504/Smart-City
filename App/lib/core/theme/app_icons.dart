import 'package:flutter/material.dart';

import '../../data/models/issue.dart';

/// Icon trạng thái — **cố định, không đổi theo theme** (design system mục 6.2).
/// Mọi chip có đủ ba kênh màu + icon + nhãn chữ: ~8% nam giới mù màu đỏ–lục,
/// đúng cặp phân biệt `reported`/`resolved`, và dưới nắng màu mất đầu tiên.
///
/// Các bộ icon đứng cạnh nhau (danh mục, trạng thái, SLA, loại địa điểm) dùng
/// chung kiểu nét viền; icon đặc chỉ dành cho tab đang chọn.
abstract final class AppIcons {
  static IconData status(IssueStatus s) => switch (s) {
        IssueStatus.reported => Icons.radio_button_checked,
        // Búa + tua vít: "đang sửa". `engineering` (người + bánh răng) nhoè thành
        // một vệt ở cỡ 16 dp của chip.
        IssueStatus.processing => Icons.handyman_outlined,
        IssueStatus.resolved => Icons.task_alt,
        IssueStatus.rejected => Icons.block,
        IssueStatus.unknown => Icons.help_outline,
      };

  static IconData priority(PriorityLevel p) => switch (p) {
        PriorityLevel.critical => Icons.priority_high,
        PriorityLevel.high => Icons.arrow_upward,
        PriorityLevel.medium => Icons.remove,
        PriorityLevel.low => Icons.arrow_downward,
      };

  static IconData sla(SlaStatus s) => switch (s) {
        SlaStatus.none => Icons.hourglass_empty,
        SlaStatus.onTime => Icons.check_circle_outline,
        SlaStatus.dueSoon => Icons.warning_amber,
        SlaStatus.overdue => Icons.error_outline,
        SlaStatus.met => Icons.verified_outlined,
        SlaStatus.breached => Icons.gpp_bad_outlined,
      };

  /// 14 loại thông báo (Phụ lục E.5) + **nhánh mặc định** cho loại backend thêm
  /// sau khi app đã phát hành.
  static IconData notification(String type) => switch (type) {
        'issue_created' => Icons.add_alert,
        'issue_updated' => Icons.update,
        'issue_resolved' => Icons.task_alt,
        'issue_rejected' => Icons.block,
        'comment' => Icons.chat_bubble_outline,
        'area_alert' => Icons.location_on_outlined,
        'issue_assigned' => Icons.assignment_ind_outlined,
        'sla_reminder' => Icons.alarm,
        'sla_escalated' => Icons.trending_up,
        'intake_overdue' => Icons.pending_actions,
        'issue_reopened' => Icons.replay,
        'issue_rated' => Icons.star_outline,
        'issue_unassigned' => Icons.assignment_return_outlined,
        'issue_merged' => Icons.merge_type,
        _ => Icons.notifications_none,
      };

  /// Icon danh mục — thay emoji của meta bằng nét icon đồng bộ với phần còn lại
  /// của app. Danh mục backend thêm sau rơi vào nhánh mặc định.
  static IconData category(String key) => switch (key) {
        // Mặt đường hỏng. `construction` (búa + cờ lê) đọc ra "đang thi công" và
        // trùng icon camera công trường.
        'pothole' => Icons.edit_road_outlined,
        'garbage' => Icons.delete_outline,
        'streetlight' => Icons.lightbulb_outline,
        'flooding' => Icons.flood_outlined,
        'tree' => Icons.park_outlined,
        // "Khác" (`other`) dùng chung nhánh mặc định: icon báo sự cố. Dấu "…" trên
        // ghim bản đồ trông như nút "xem thêm", đinh ghim thì không nói lên gì.
        _ => Icons.report_outlined,
      };

  static IconData placeType(String type) => switch (type) {
        'hospital' => Icons.local_hospital_outlined,
        'school' => Icons.school_outlined,
        'bus_stop' => Icons.directions_bus_outlined,
        // Không dùng `park_outlined` — đó là icon danh mục "Cây đổ", hai loại
        // ghim nằm chung một bản đồ.
        'park' => Icons.nature_people_outlined,
        'police' => Icons.local_police_outlined,
        _ => Icons.place_outlined,
      };

  static String placeTypeLabel(String type) => switch (type) {
        'hospital' => 'Bệnh viện',
        'school' => 'Trường học',
        'bus_stop' => 'Trạm xe buýt',
        'park' => 'Công viên',
        'police' => 'Công an',
        _ => 'Địa điểm',
      };
}
