# Minh chứng Lam Fleet

Ảnh 01–09 là website thật trong Chrome headless với tài khoản quản trị của dự án; 09 là viewport 390 px. 10 là Prometheus Targets, 11 là dashboard metrics, 12 là log đã có dữ liệu, 13 là pgAdmin kết nối PostgreSQL. Hồ sơ seed là dữ liệu minh họa. Không có ảnh của bài mẫu.

`tests.tap`: 29/29 trường hợp đạt. `monitoring.json`: 5 target UP và CPU/RAM thật của app/nginx/postgres thuộc de30lam. `logging.json`: cả ba truy vấn có sự kiện. `hardening.txt`: kiểm tra cấu hình đang chạy. `restore.txt`: kiểm tra archive trong database tạm và fingerprint bốn bảng. `browser-*.json`: kết quả kiểm tra/chụp UI. `fresh-start.json` và `fresh-tests.tap` ghi nhận clone mới từ GitHub main, volume mới, 29/29 ca đạt; migration chạy lại giữ seed và mật khẩu. `npm-audit.json` ghi nhận 0 lỗ hổng của dependency production.

Secret, dữ liệu phiên, SQL dump và profile trình duyệt không được lưu trong thư mục này. Các file JSON/TAP là kết quả một lần chạy đã xác minh, không thay thế việc chạy lại script trên môi trường mới.
