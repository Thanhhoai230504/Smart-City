const { assertLocalMongoUri } = require('../../src/seeds/seedAppDemo');

// Script seed demo XOÁ SẠCH database đích. Rào chắn này là thứ duy nhất đứng
// giữa một lần gõ nhầm và việc xoá dữ liệu thật trên Atlas.
describe('assertLocalMongoUri', () => {
  it.each([
    'mongodb://127.0.0.1:27017/smartcity_app_demo',
    'mongodb://localhost:27017/demo',
    'mongodb://localhost/demo',
    'mongodb://user:pass@127.0.0.1:27017/demo?authSource=admin',
  ])('chấp nhận MongoDB cục bộ: %s', (uri) => {
    expect(() => assertLocalMongoUri(uri)).not.toThrow();
  });

  it.each([
    ['Atlas SRV', 'mongodb+srv://u:p@cluster0.abcde.mongodb.net/smartcity'],
    ['host từ xa', 'mongodb://10.0.0.5:27017/smartcity'],
    ['tên miền giả dạng localhost', 'mongodb://localhost.attacker.com:27017/smartcity'],
    ['replica set có host từ xa', 'mongodb://db1.example.com:27017,db2.example.com/smartcity'],
    ['thiếu tên database', 'mongodb://127.0.0.1:27017'],
    ['rỗng', ''],
    ['undefined', undefined],
  ])('từ chối %s', (_, uri) => {
    expect(() => assertLocalMongoUri(uri)).toThrow();
  });
});
