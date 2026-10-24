# Giám sát Lam Fleet

Prometheus có 5 job: prometheus, lam-fleet, nginx, postgres và cadvisor. Dashboard Grafana dùng datasource UID lam-prometheus và lam-loki, thư mục Đề 30 Nguyễn Thị Lam. Các truy vấn container luôn lọc Compose project de30lam để không lấy số liệu bài khác.

Chờ ít nhất hai chu kỳ scrape 15 giây rồi chạy `node < scripts/check-monitoring.js` bên trong container app. Chỉ target UP chưa đủ: script còn kiểm tra RAM/CPU thật của app, nginx, postgres, kết nối DB và gauge xe lấy từ PostgreSQL.

Các bộ đếm HTTP/thao tác/xung đột bắt đầu lại khi app restart; gauge trạng thái đọc từ database nên giữ ý nghĩa sau restart. Không cấu hình gửi cảnh báo ra dịch vụ bên ngoài.

cAdvisor là ngoại lệ có đặc quyền và đọc Docker host. Promtail không mount Docker socket. Chi tiết truy vấn log nằm trong logql.md.
