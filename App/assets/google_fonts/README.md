# Inter — font tiêu đề

`google_fonts` tìm file trong thư mục này trước khi tải qua mạng. Để bản release
không cần mạng ở lần mở đầu tiên, tải từ Google Fonts (giấy phép OFL) và đặt vào đây:

- `Inter-SemiBold.ttf` (600)
- `Inter-Bold.ttf` (700)

Chỉ 2 weight — design system mục 4.1. Không có file thì app tải một lần rồi cache;
khi đang offline ở lần mở đầu tiên, tiêu đề tạm dùng font hệ thống (vẫn đủ dấu tiếng Việt).
