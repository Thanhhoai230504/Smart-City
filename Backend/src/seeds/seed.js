const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const path = require('path');

// Load env vars
dotenv.config({ path: path.join(__dirname, '../../.env') });

const User = require('../models/User');
const Issue = require('../models/Issue');
const Place = require('../models/Place');
const EnvironmentData = require('../models/EnvironmentData');

const seedData = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing data
    await Promise.all([
      User.deleteMany({}),
      Issue.deleteMany({}),
      Place.deleteMany({}),
      EnvironmentData.deleteMany({})
    ]);
    console.log('🗑️  Cleared existing data');

    // ============ USERS ============
    const users = await User.create([
      {
        name: 'Admin Smart City',
        email: 'admin@smartcity.vn',
        password: 'admin123',
        role: 'admin',
        isActive: true
      },
      {
        name: 'Nguyễn Văn A',
        email: 'nguyenvana@gmail.com',
        password: 'user123',
        role: 'user',
        isActive: true
      },
      {
        name: 'Trần Thị B',
        email: 'tranthib@gmail.com',
        password: 'user123',
        role: 'user',
        isActive: true
      }
    ]);
    console.log(`👤 Created ${users.length} users`);

    const admin = users[0];
    const user1 = users[1];
    const user2 = users[2];

    // ============ PLACES (Đà Nẵng) ============
    const places = await Place.create([
      // Bệnh viện
      {
        name: 'Bệnh viện Đà Nẵng',
        type: 'hospital',
        address: '124 Hải Phòng, Thạch Thang, Hải Châu, Đà Nẵng',
        latitude: 16.0720,
        longitude: 108.2140,
        description: 'Bệnh viện đa khoa lớn nhất miền Trung',
        phone: '0236 3822 358',
        isActive: true
      },
      {
        name: 'Bệnh viện C Đà Nẵng',
        type: 'hospital',
        address: '122 Hải Phòng, Thạch Thang, Hải Châu, Đà Nẵng',
        latitude: 16.0718,
        longitude: 108.2135,
        description: 'Bệnh viện chuyên khoa hạng I',
        phone: '0236 3821 483',
        isActive: true
      },
      // Trường học
      {
        name: 'Đại học Bách khoa - ĐH Đà Nẵng',
        type: 'school',
        address: '54 Nguyễn Lương Bằng, Hòa Khánh Bắc, Liên Chiểu, Đà Nẵng',
        latitude: 16.0736,
        longitude: 108.1499,
        description: 'Trường đại học kỹ thuật hàng đầu miền Trung',
        phone: '0236 3842 308',
        isActive: true
      },
      {
        name: 'Đại học Kinh tế - ĐH Đà Nẵng',
        type: 'school',
        address: '71 Ngũ Hành Sơn, Mỹ An, Ngũ Hành Sơn, Đà Nẵng',
        latitude: 16.0330,
        longitude: 108.2439,
        description: 'Trường đại học kinh tế hàng đầu miền Trung',
        phone: '0236 3950 299',
        isActive: true
      },
      {
        name: 'Đại học Sư phạm - ĐH Đà Nẵng',
        type: 'school',
        address: '459 Tôn Đức Thắng, Hòa Khánh Nam, Liên Chiểu, Đà Nẵng',
        latitude: 16.0600,
        longitude: 108.1560,
        description: 'Trường đại học sư phạm uy tín',
        phone: '0236 3841 323',
        isActive: true
      },
      // Trạm xe buýt
      {
        name: 'Trạm xe buýt Chợ Hàn',
        type: 'bus_stop',
        address: '119 Trần Phú, Hải Châu 1, Hải Châu, Đà Nẵng',
        latitude: 16.0686,
        longitude: 108.2240,
        description: 'Trạm xe buýt trung tâm, gần chợ Hàn',
        isActive: true
      },
      {
        name: 'Trạm xe buýt Cầu Rồng',
        type: 'bus_stop',
        address: 'Đầu cầu Rồng, Phước Ninh, Hải Châu, Đà Nẵng',
        latitude: 16.0610,
        longitude: 108.2280,
        description: 'Trạm xe buýt gần cầu Rồng',
        isActive: true
      },
      // Công viên
      {
        name: 'Công viên APEC',
        type: 'park',
        address: 'Đường 2 Tháng 9, Hải Châu, Đà Nẵng',
        latitude: 16.0490,
        longitude: 108.2240,
        description: 'Công viên ven sông Hàn, nơi tổ chức APEC 2017',
        isActive: true
      },
      {
        name: 'Công viên Biển Đông',
        type: 'park',
        address: 'Đường Võ Nguyên Giáp, Phước Mỹ, Sơn Trà, Đà Nẵng',
        latitude: 16.0580,
        longitude: 108.2450,
        description: 'Công viên ven biển Mỹ Khê',
        isActive: true
      },
      // Đồn công an
      {
        name: 'Công an quận Hải Châu',
        type: 'police',
        address: '243 Phan Châu Trinh, Phước Ninh, Hải Châu, Đà Nẵng',
        latitude: 16.0600,
        longitude: 108.2180,
        description: 'Công an quận Hải Châu',
        phone: '0236 3871 142',
        isActive: true
      },
      {
        name: 'Công an quận Sơn Trà',
        type: 'police',
        address: '02 Ngô Quyền, An Hải Bắc, Sơn Trà, Đà Nẵng',
        latitude: 16.0750,
        longitude: 108.2340,
        description: 'Công an quận Sơn Trà',
        phone: '0236 3836 242',
        isActive: true
      }
    ]);
    console.log(`📍 Created ${places.length} places`);

    // ============ ISSUES (Sự cố mẫu) ============
    const issues = await Issue.create([
      {
        title: 'Ổ gà lớn trên đường Nguyễn Văn Linh',
        description: 'Có một ổ gà rất lớn trên đường Nguyễn Văn Linh, đoạn gần ngã tư với đường Lê Đại Hành. Xe máy dễ bị ngã khi qua đây vào ban đêm.',
        category: 'pothole',
        location: 'Đường Nguyễn Văn Linh, Hải Châu, Đà Nẵng',
        latitude: 16.0544,
        longitude: 108.2022,
        status: 'reported',
        userId: user1._id
      },
      {
        title: 'Rác thải chất đống ven đường Hoàng Diệu',
        description: 'Có một đống rác lớn chưa được thu gom ở ven đường Hoàng Diệu, gần ngã ba với đường Ông Ích Khiêm. Bốc mùi rất khó chịu.',
        category: 'garbage',
        location: 'Đường Hoàng Diệu, Hải Châu, Đà Nẵng',
        latitude: 16.0650,
        longitude: 108.2100,
        status: 'processing',
        userId: user1._id,
        adminId: admin._id
      },
      {
        title: 'Đèn đường hỏng trên đường Trần Phú',
        description: 'Cột đèn đường số 45 trên đường Trần Phú bị hỏng, đoạn bờ sông Hàn. Khu vực này rất tối vào ban đêm, gây nguy hiểm cho người đi bộ.',
        category: 'streetlight',
        location: 'Đường Trần Phú, Hải Châu, Đà Nẵng',
        latitude: 16.0680,
        longitude: 108.2250,
        status: 'resolved',
        userId: user2._id,
        adminId: admin._id,
        resolvedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) // 2 days ago
      },
      {
        title: 'Ngập nước nghiêm trọng đường 2 Tháng 9',
        description: 'Mưa lớn gây ngập nước đoạn đường 2 Tháng 9, nước dâng cao khoảng 30cm. Nhiều xe máy chết máy khi đi qua.',
        category: 'flooding',
        location: 'Đường 2 Tháng 9, Hải Châu, Đà Nẵng',
        latitude: 16.0510,
        longitude: 108.2200,
        status: 'reported',
        userId: user2._id
      },
      {
        title: 'Cây đổ chắn đường Lê Lợi',
        description: 'Cây xà cừ lớn bị đổ sau cơn bão, chắn ngang đường Lê Lợi đoạn gần trường THPT Trần Phú. Cần dọn dẹp gấp.',
        category: 'tree',
        location: 'Đường Lê Lợi, Hải Châu, Đà Nẵng',
        latitude: 16.0620,
        longitude: 108.2150,
        status: 'processing',
        userId: user1._id,
        adminId: admin._id
      },
      {
        title: 'Nắp cống bị mất trên đường Phan Châu Trinh',
        description: 'Nắp cống trên đường Phan Châu Trinh bị mất, tạo hố sâu rất nguy hiểm cho người đi đường, đặc biệt vào ban đêm.',
        category: 'other',
        location: 'Đường Phan Châu Trinh, Hải Châu, Đà Nẵng',
        latitude: 16.0590,
        longitude: 108.2160,
        status: 'rejected',
        userId: user2._id,
        adminId: admin._id
      },
      {
        title: 'Ổ gà trên đường Điện Biên Phủ',
        description: 'Nhiều ổ gà nhỏ trên đường Điện Biên Phủ, đoạn trước Vincom. Cần sửa chữa để đảm bảo an toàn giao thông.',
        category: 'pothole',
        location: 'Đường Điện Biên Phủ, Thanh Khê, Đà Nẵng',
        latitude: 16.0670,
        longitude: 108.1950,
        status: 'reported',
        userId: user1._id
      }
    ]);
    console.log(`🚨 Created ${issues.length} issues`);

    // ============ ENVIRONMENT DATA ============
    const envData = await EnvironmentData.create([
      {
        location: 'Quận Hải Châu, Đà Nẵng',
        source: 'OpenWeatherMap',
        temperature: 28.5,
        humidity: 75,
        weatherCondition: 'Clouds',
        latitude: 16.0544,
        longitude: 108.2022
      },
      {
        location: 'Quận Sơn Trà, Đà Nẵng',
        source: 'OpenWeatherMap',
        temperature: 29.2,
        humidity: 80,
        weatherCondition: 'Clear',
        latitude: 16.1100,
        longitude: 108.2478
      },
      {
        location: 'Quận Thanh Khê, Đà Nẵng',
        source: 'OpenWeatherMap',
        temperature: 27.8,
        humidity: 72,
        weatherCondition: 'Rain',
        latitude: 16.0678,
        longitude: 108.1837
      }
    ]);
    console.log(`🌡️  Created ${envData.length} environment data records`);

    // ============ SUMMARY ============
    console.log('\n========================================');
    console.log('🎉 Seed data created successfully!');
    console.log('========================================');
    console.log('\n📋 Test accounts:');
    console.log('   Admin: admin@smartcity.vn / admin123');
    console.log('   User1: nguyenvana@gmail.com / user123');
    console.log('   User2: tranthib@gmail.com / user123');
    console.log('========================================\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Seed failed:', error.message);
    process.exit(1);
  }
};

seedData();
