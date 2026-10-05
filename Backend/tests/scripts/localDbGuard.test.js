const { assertLocalMongoUri } = require('../../src/seeds/localDbGuard');

// `npm run seed` XOÁ SẠCH users/issues/places của database đích. Trước đây nó đọc
// MONGODB_URI (Atlas thật). Rào chắn này bắt buộc một biến riêng trỏ về máy cục bộ.
describe('localDbGuard.assertLocalMongoUri', () => {
  const opts = { envName: 'SEED_MONGODB_URI', example: 'mongodb://127.0.0.1:27017/smartcity_dev' };

  it.each([
    ['mongodb://127.0.0.1:27017/smartcity_dev', '127.0.0.1', 'smartcity_dev'],
    ['mongodb://localhost/demo', 'localhost', 'demo'],
    ['mongodb://[::1]:27017/demo', '[::1]', 'demo'],
    ['mongodb://u:p@127.0.0.1:27017/demo?authSource=admin', '127.0.0.1', 'demo'],
  ])('chấp nhận %s', (uri, host, db) => {
    expect(assertLocalMongoUri(uri, opts)).toEqual({ host, db });
  });

  it.each([
    ['Atlas SRV', 'mongodb+srv://u:p@cluster0.abcde.mongodb.net/smartcity'],
    ['host từ xa', 'mongodb://10.0.0.5:27017/smartcity'],
    ['tên miền giả dạng localhost', 'mongodb://localhost.attacker.com:27017/smartcity'],
    ['replica set có host từ xa', 'mongodb://db1.example.com:27017,db2.example.com/smartcity'],
    ['thiếu tên database', 'mongodb://127.0.0.1:27017'],
    ['chưa khai biến', undefined],
  ])('từ chối %s', (_, uri) => {
    expect(() => assertLocalMongoUri(uri, opts)).toThrow();
  });

  it('thông báo lỗi nêu đúng tên biến môi trường phải khai', () => {
    expect(() => assertLocalMongoUri(undefined, opts)).toThrow(/SEED_MONGODB_URI/);
  });
});
