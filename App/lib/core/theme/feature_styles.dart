import 'package:flutter/material.dart';

/// Icon + sắc màu của một tính năng xuất hiện ở nhiều nơi (lối tắt trang chủ,
/// menu Cá nhân, header của cán bộ).
@immutable
class FeatureStyle {
  const FeatureStyle(this.icon, this.color);

  final IconData icon;

  /// Màu gốc — luôn đi qua `CategoryTone` để đủ tương phản ở cả hai theme.
  final Color color;
}

/// Mỗi tính năng **một** icon và **một** màu ở mọi màn. Trước đây mỗi màn tự
/// gán: "Chờ gửi" xám ở Trang chủ nhưng cam ở Cá nhân, "Xếp hạng" cam ở chỗ này
/// tím ở chỗ kia. Năm sắc theo nhóm nghĩa, màu chỉ để nhận ra nhanh — ô nào cũng
/// có nhãn chữ:
/// - xanh trời: xem thành phố (bản đồ, camera)
/// - chàm: dữ liệu công khai (danh sách, thống kê)
/// - xanh ngọc: việc của tôi (sự cố của tôi, phiếu chờ gửi)
/// - vàng hổ phách: cúp, huy hiệu
/// - tím: trợ lý AI
/// Mục tài khoản (hồ sơ, mật khẩu, cài đặt) dùng chung màu trung tính [account].
abstract final class AppFeatures {
  static const _sky = Color(0xFF0EA5E9);
  static const _indigo = Color(0xFF6366F1);
  static const _teal = Color(0xFF14B8A6);

  static const map = FeatureStyle(Icons.map_outlined, _sky);
  static const cameras = FeatureStyle(Icons.videocam_outlined, _sky);
  static const issues = FeatureStyle(Icons.view_list_outlined, _indigo);
  static const statistics = FeatureStyle(Icons.insights_outlined, _indigo);
  static const myIssues = FeatureStyle(Icons.assignment_ind_outlined, _teal);
  static const pending = FeatureStyle(Icons.schedule_send_outlined, _teal);
  static const badges = FeatureStyle(Icons.emoji_events_outlined, Color(0xFFF59E0B));
  static const chatbot = FeatureStyle(Icons.smart_toy_outlined, Color(0xFF8B5CF6));

  static const account = Color(0xFF64748B);
}
