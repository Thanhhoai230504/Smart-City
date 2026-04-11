const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const User = require('../models/User');
const Issue = require('../models/Issue');

const seedIssues = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Lấy users hiện có
    const users = await User.find({}).select('_id role');
    const admins = users.filter(u => u.role === 'admin');
    const normalUsers = users.filter(u => u.role === 'user');

    if (normalUsers.length < 2 || admins.length < 1) {
      console.error('❌ Cần ít nhất 1 admin và 2 user trong DB');
      process.exit(1);
    }

    const admin = admins[0];
    const allUsers = normalUsers;
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

    const newIssues = [
      {
        title: 'Ổ gà sâu trên đường Nguyễn Văn Linh gần cầu Tiên Sơn',
        description: 'Ổ gà sâu khoảng 20cm ngay làn xe máy trên đường Nguyễn Văn Linh, đoạn gần cầu Tiên Sơn. Nhiều vụ va chạm đã xảy ra, đặc biệt nguy hiểm vào ban đêm khi không nhìn rõ.',
        category: 'pothole',
        location: 'Đường Nguyễn Văn Linh, Hải Châu, Đà Nẵng',
        latitude: 16.0544, longitude: 108.2022,
        status: 'reported',
        imageUrl: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=800&q=80',
        userId: pick(allUsers)._id,
        votes: allUsers.slice(0, 3).map(u => u._id), voteCount: 3,
        createdAt: new Date(now - 2 * day),
      },
      {
        title: 'Rác thải chất đống phía sau chợ Cồn',
        description: 'Rác sinh hoạt và rác thải nhựa bị vứt bừa bãi tại khu vực phía sau chợ Cồn. Bốc mùi hôi thối, gây ô nhiễm nghiêm trọng cho khu dân cư xung quanh. Cần thu gom gấp.',
        category: 'garbage',
        location: 'Đường Ông Ích Khiêm, Hải Châu, Đà Nẵng',
        latitude: 16.0679, longitude: 108.2108,
        status: 'processing',
        imageUrl: 'https://images.unsplash.com/photo-1530587191325-3db32d826c18?w=800&q=80',
        userId: pick(allUsers)._id, adminId: admin._id,
        votes: allUsers.slice(0, 2).map(u => u._id), voteCount: 2,
        statusHistory: [
          { status: 'reported', changedBy: pick(allUsers)._id, changedAt: new Date(now - 5 * day) },
          { status: 'processing', changedBy: admin._id, changedAt: new Date(now - 3 * day), note: 'Đã liên hệ đơn vị vệ sinh môi trường' },
        ],
        createdAt: new Date(now - 5 * day),
      },
      {
        title: 'Đèn LED trang trí cầu Rồng bị hỏng một đoạn',
        description: 'Dải đèn LED trang trí phía Nam cầu Rồng bị hỏng 1 đoạn dài khoảng 50m. Ảnh hưởng mỹ quan đô thị và an toàn giao thông ban đêm.',
        category: 'streetlight',
        location: 'Cầu Rồng, Sơn Trà, Đà Nẵng',
        latitude: 16.0612, longitude: 108.2279,
        status: 'resolved',
        imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=800&q=80',
        userId: pick(allUsers)._id, adminId: admin._id,
        resolvedAt: new Date(now - 1 * day),
        rating: { score: 5, comment: 'Sửa chữa rất nhanh, cảm ơn đội ngũ!', ratedAt: new Date(now - 0.5 * day) },
        statusHistory: [
          { status: 'reported', changedBy: pick(allUsers)._id, changedAt: new Date(now - 7 * day) },
          { status: 'processing', changedBy: admin._id, changedAt: new Date(now - 4 * day), note: 'Đã điều kỹ thuật viên kiểm tra' },
          { status: 'resolved', changedBy: admin._id, changedAt: new Date(now - 1 * day), note: 'Đã thay thế đèn LED mới' },
        ],
        createdAt: new Date(now - 7 * day),
      },
      {
        title: 'Ngập nước nặng đoạn đường 2 Tháng 9 gần bến xe',
        description: 'Sau trận mưa lớn, nước ngập sâu khoảng 40cm trên đường 2 Tháng 9 đoạn gần bến xe trung tâm. Nhiều ô tô và xe máy bị chết máy. Giao thông tê liệt.',
        category: 'flooding',
        location: 'Đường 2 Tháng 9, Hải Châu, Đà Nẵng',
        latitude: 16.0510, longitude: 108.2200,
        status: 'resolved',
        imageUrl: 'https://images.unsplash.com/photo-1547683905-f686c993aae5?w=800&q=80',
        userId: pick(allUsers)._id, adminId: admin._id,
        resolvedAt: new Date(now - 3 * day),
        votes: allUsers.slice(0, 4).map(u => u._id), voteCount: 4,
        rating: { score: 4, comment: 'Xử lý tốt nhưng hơi chậm', ratedAt: new Date(now - 2 * day) },
        statusHistory: [
          { status: 'reported', changedBy: pick(allUsers)._id, changedAt: new Date(now - 10 * day) },
          { status: 'processing', changedBy: admin._id, changedAt: new Date(now - 8 * day), note: 'Đã triển khai máy bơm hút nước' },
          { status: 'resolved', changedBy: admin._id, changedAt: new Date(now - 3 * day), note: 'Đã khơi thông cống thoát nước' },
        ],
        createdAt: new Date(now - 10 * day),
      },
      {
        title: 'Cây phượng vĩ bật gốc sau bão chắn đường Lê Lợi',
        description: 'Cây phượng vĩ lớn bật gốc sau bão số 4, chắn toàn bộ lane đường bên phải đường Lê Lợi. Dây điện bị kéo đứt. RẤT NGUY HIỂM!',
        category: 'tree',
        location: 'Đường Lê Lợi, Hải Châu, Đà Nẵng',
        latitude: 16.0620, longitude: 108.2150,
        status: 'resolved',
        imageUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&q=80',
        userId: pick(allUsers)._id, adminId: admin._id,
        resolvedAt: new Date(now - 5 * day),
        votes: allUsers.map(u => u._id), voteCount: allUsers.length,
        rating: { score: 5, comment: 'Xử lý rất nhanh chóng, an toàn', ratedAt: new Date(now - 4 * day) },
        createdAt: new Date(now - 8 * day),
      },
      {
        title: 'Nắp cống bị mất trên vỉa hè Phan Châu Trinh',
        description: 'Nắp cống bằng gang bị mất (nghi bị trộm), tạo hố sâu 60cm ngay giữa vỉa hè. Rất nguy hiểm cho người đi bộ, đặc biệt trẻ em và người già.',
        category: 'other',
        location: 'Đường Phan Châu Trinh, Hải Châu, Đà Nẵng',
        latitude: 16.0590, longitude: 108.2160,
        status: 'processing',
        imageUrl: 'https://images.unsplash.com/photo-1584463699033-0f0a5c1e1b6c?w=800&q=80',
        userId: pick(allUsers)._id, adminId: admin._id,
        votes: allUsers.slice(0, 2).map(u => u._id), voteCount: 2,
        createdAt: new Date(now - 3 * day),
      },
      {
        title: 'Ổ gà rộng 1m trước cổng Vincom Đà Nẵng',
        description: 'Mặt đường bê tông nhựa bị lún tạo ổ gà rộng khoảng 1m trước cổng ra vào Vincom Plaza. Xe đi qua bị dằn mạnh, đã có tai nạn xe máy.',
        category: 'pothole',
        location: 'Đường Điện Biên Phủ, Thanh Khê, Đà Nẵng',
        latitude: 16.0670, longitude: 108.1950,
        status: 'reported',
        imageUrl: 'https://images.unsplash.com/photo-1601024445121-e5b839bc22d1?w=800&q=80',
        userId: pick(allUsers)._id,
        createdAt: new Date(now - 1 * day),
      },
      {
        title: 'Rác xây dựng đổ trộm ven sông Phú Lộc',
        description: 'Phát hiện bãi rác xây dựng (gạch vỡ, bê tông, sắt thép) bị đổ trộm ven sông Phú Lộc. Gây ô nhiễm nguồn nước và mất mỹ quan đô thị.',
        category: 'garbage',
        location: 'Ven sông Phú Lộc, Thanh Khê, Đà Nẵng',
        latitude: 16.0621, longitude: 108.1871,
        status: 'reported',
        imageUrl: 'https://images.unsplash.com/photo-1604187351574-c75ca79f5807?w=800&q=80',
        userId: pick(allUsers)._id,
        votes: allUsers.slice(0, 1).map(u => u._id), voteCount: 1,
        createdAt: new Date(now - 0.5 * day),
      },
      {
        title: 'Đèn tín hiệu hỏng tại ngã tư Nguyễn Tri Phương',
        description: 'Đèn tín hiệu giao thông ngã tư Nguyễn Tri Phương - Hải Phòng bị mất điện hoàn toàn. Giao thông hỗn loạn vào giờ cao điểm sáng và chiều.',
        category: 'streetlight',
        location: 'Ngã tư Nguyễn Tri Phương, Thanh Khê, Đà Nẵng',
        latitude: 16.0695, longitude: 108.1948,
        status: 'processing',
        imageUrl: 'https://images.unsplash.com/photo-1617178388636-81211b8ed684?w=800&q=80',
        userId: pick(allUsers)._id, adminId: admin._id,
        votes: allUsers.map(u => u._id), voteCount: allUsers.length,
        createdAt: new Date(now - 4 * day),
      },
      {
        title: 'Cây bàng nghiêng 45 độ đe dọa nhà dân',
        description: 'Cây bàng lá nhỏ trước số nhà 156 đường Trưng Nữ Vương bị nghiêng 45 độ sau mưa bão. Rễ cây bật khỏi mặt đất, có nguy cơ đổ vào nhà.',
        category: 'tree',
        location: 'Đường Trưng Nữ Vương, Hải Châu, Đà Nẵng',
        latitude: 16.0635, longitude: 108.2120,
        status: 'reported',
        imageUrl: 'https://images.unsplash.com/photo-1476231682828-37e571bc172f?w=800&q=80',
        userId: pick(allUsers)._id,
        createdAt: new Date(now - 1.5 * day),
      },
      {
        title: 'Ngập úng kéo dài đường Nguyễn Hữu Thọ',
        description: 'Khu vực giao lộ Nguyễn Hữu Thọ - Nguyễn Sinh Sắc bị ngập mỗi khi mưa vừa. Hệ thống thoát nước xuống cấp, nước đọng không rút sau 2 giờ.',
        category: 'flooding',
        location: 'Đường Nguyễn Hữu Thọ, Cẩm Lệ, Đà Nẵng',
        latitude: 16.0365, longitude: 108.2073,
        status: 'reported',
        imageUrl: 'https://images.unsplash.com/photo-1446824505046-e43605ffb17f?w=800&q=80',
        userId: pick(allUsers)._id,
        votes: allUsers.slice(0, 3).map(u => u._id), voteCount: 3,
        createdAt: new Date(now - 6 * day),
      },
      {
        title: 'Đường bê tông nứt vỡ tại kiệt 82 Phạm Văn Đồng',
        description: 'Đoạn đường bê tông dài 200m tại kiệt 82 đường Phạm Văn Đồng bị nứt nẻ, vỡ nhiều mảng lớn. Xe 2 bánh rất khó đi, mùa mưa lầy lội.',
        category: 'pothole',
        location: 'Đường Phạm Văn Đồng, Sơn Trà, Đà Nẵng',
        latitude: 16.0780, longitude: 108.2302,
        status: 'processing',
        imageUrl: 'https://images.unsplash.com/photo-1571455786673-9d9d6c194f90?w=800&q=80',
        userId: pick(allUsers)._id, adminId: admin._id,
        createdAt: new Date(now - 12 * day),
      },
      {
        title: 'Bãi rác tự phát cuối đường Hoàng Văn Thái',
        description: 'Khu đất trống cuối đường Hoàng Văn Thái bị biến thành bãi rác tự phát. Rác chất đống cao, ruồi muỗi phát sinh gây ảnh hưởng sức khỏe cư dân.',
        category: 'garbage',
        location: 'Đường Hoàng Văn Thái, Liên Chiểu, Đà Nẵng',
        latitude: 16.0820, longitude: 108.1510,
        status: 'reported',
        imageUrl: 'https://images.unsplash.com/photo-1567016432779-094069958ea5?w=800&q=80',
        userId: pick(allUsers)._id,
        votes: allUsers.slice(0, 2).map(u => u._id), voteCount: 2,
        createdAt: new Date(now - 4 * day),
      },
      {
        title: 'Mất chiếu sáng tuyến đường ven biển Nguyễn Tất Thành',
        description: 'Đoạn 500m đường Nguyễn Tất Thành (gần Xuân Thiều) mất chiếu sáng hoàn toàn. Khu vực vắng vẻ, gây lo ngại về an ninh trật tự cho người dân.',
        category: 'streetlight',
        location: 'Đường Nguyễn Tất Thành, Liên Chiểu, Đà Nẵng',
        latitude: 16.0910, longitude: 108.1390,
        status: 'resolved',
        imageUrl: 'https://images.unsplash.com/photo-1556760544-74068565f05c?w=800&q=80',
        userId: pick(allUsers)._id, adminId: admin._id,
        resolvedAt: new Date(now - 2 * day),
        rating: { score: 3, comment: 'Đã sửa nhưng vẫn còn vài bóng chưa sáng', ratedAt: new Date(now - 1 * day) },
        createdAt: new Date(now - 15 * day),
      },
      {
        title: 'Cây dừa gãy cành trên bãi biển Mỹ Khê',
        description: 'Cây dừa ven bãi biển Mỹ Khê bị gãy cành lớn, treo lơ lửng phía trên đường đi bộ. Rất nguy hiểm cho du khách và người tắm biển.',
        category: 'tree',
        location: 'Bãi biển Mỹ Khê, Ngũ Hành Sơn, Đà Nẵng',
        latitude: 16.0420, longitude: 108.2490,
        status: 'resolved',
        imageUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80',
        userId: pick(allUsers)._id, adminId: admin._id,
        resolvedAt: new Date(now - 6 * day),
        rating: { score: 4, comment: 'Đã cắt tỉa gọn gàng, cảm ơn', ratedAt: new Date(now - 5 * day) },
        createdAt: new Date(now - 9 * day),
      },
      {
        title: 'Ngập úng đường Trần Đại Nghĩa khu Hòa Quý',
        description: 'Đường Trần Đại Nghĩa (khu vực Hòa Quý) ngập úng nghiêm trọng mỗi trận mưa. Nước tràn vào nhà dân gây hư hỏng đồ đạc.',
        category: 'flooding',
        location: 'Đường Trần Đại Nghĩa, Ngũ Hành Sơn, Đà Nẵng',
        latitude: 16.0280, longitude: 108.2350,
        status: 'processing',
        imageUrl: 'https://images.unsplash.com/photo-1446824505046-e43605ffb17f?w=800&q=80',
        userId: pick(allUsers)._id, adminId: admin._id,
        votes: allUsers.slice(0, 2).map(u => u._id), voteCount: 2,
        createdAt: new Date(now - 14 * day),
      },
      {
        title: 'Rào chắn đường sắt hỏng tại Thanh Khê',
        description: 'Rào chắn tự động tại giao cắt đường sắt - đường Trần Cao Vân bị hỏng, không hạ thanh chắn khi tàu qua. Cực kỳ nguy hiểm cho người dân.',
        category: 'other',
        location: 'Đường Trần Cao Vân, Thanh Khê, Đà Nẵng',
        latitude: 16.0702, longitude: 108.1920,
        status: 'resolved',
        imageUrl: 'https://images.unsplash.com/photo-1474487548417-781cb71495f3?w=800&q=80',
        userId: pick(allUsers)._id, adminId: admin._id,
        resolvedAt: new Date(now - 1 * day),
        votes: allUsers.map(u => u._id), voteCount: allUsers.length,
        rating: { score: 5, comment: 'Xử lý khẩn cấp, rất hài lòng', ratedAt: new Date(now - 0.5 * day) },
        createdAt: new Date(now - 5 * day),
      },
      {
        title: 'Rác thải nhựa trôi dạt bờ biển bán đảo Sơn Trà',
        description: 'Lượng lớn rác thải nhựa, xốp, chai lọ trôi dạt vào bờ biển khu vực bán đảo Sơn Trà gần chùa Linh Ứng. Cần tổ chức thu gom.',
        category: 'garbage',
        location: 'Bán đảo Sơn Trà, Sơn Trà, Đà Nẵng',
        latitude: 16.1020, longitude: 108.2640,
        status: 'reported',
        imageUrl: 'https://images.unsplash.com/photo-1621451537084-482c73073a0f?w=800&q=80',
        userId: pick(allUsers)._id,
        votes: allUsers.slice(0, 3).map(u => u._id), voteCount: 3,
        createdAt: new Date(now - 2 * day),
      },
      {
        title: 'Mặt đường sụt lún tỉnh lộ ĐT 605 Hòa Vang',
        description: 'Mặt đường tỉnh lộ ĐT 605 đoạn qua xã Hòa Phong bị sụt lún nghiêm trọng tạo hố sâu 30cm, rộng 2m. Xe tải nặng qua lại nhiều gây nguy hiểm.',
        category: 'pothole',
        location: 'Tỉnh lộ ĐT 605, Hòa Vang, Đà Nẵng',
        latitude: 16.0100, longitude: 108.1200,
        status: 'reported',
        imageUrl: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=800&q=80',
        userId: pick(allUsers)._id,
        createdAt: new Date(now - 3 * day),
      },
    ];

    const created = await Issue.insertMany(newIssues);
    console.log(`\n✅ Đã thêm ${created.length} sự cố mới (có ảnh) vào database!`);
    console.log('   Không xóa dữ liệu cũ.\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Lỗi:', error.message);
    process.exit(1);
  }
};

seedIssues();
