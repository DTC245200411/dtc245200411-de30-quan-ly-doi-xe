# Lam Fleet — Hệ thống Quản lý Đội xe

**Nguyễn Thị Lam · DTC245200411 · CNTT K23D**  
Giảng viên hướng dẫn: **Vũ Việt Dũng**. Đề 30, môn Triển khai và Quản trị Hệ thống Phần mềm.

Website tiếng Việt quản lý xe, tài xế, chuyến đi và bảo dưỡng. Stack: Node.js 24, Express 5, EJS, PostgreSQL 17, pgAdmin, Nginx. Các dịch vụ dùng Docker Compose.

## Chạy ứng dụng

Clone repository riêng tư bằng tài khoản có quyền truy cập. Trong Ubuntu WSL2 có Docker Engine và Compose:

```sh
git clone https://github.com/DTC245200411/dtc245200411-de30-quan-ly-doi-xe.git
cd dtc245200411-de30-quan-ly-doi-xe
BASE_ONLY=1 sh scripts/start.sh
BASE_ONLY=1 sh scripts/test.sh
```

Website: http://localhost:8080, tài khoản `admin`, mật khẩu khởi tạo trong `.local/secrets/admin_password`. pgAdmin: http://localhost:8091, email `admin@lam.edu.vn`, mật khẩu trong `.local/secrets/pgadmin_password`. Kết nối database `fleet` với role `fleet_migrate`, mật khẩu trong `.local/secrets/db_migrate_password`. Secret được sinh riêng và không nằm trong Git.

Nguồn trên máy thực hiện đặt tại `/home/hai/projects/de30-quan-ly-doi-xe`. Script PowerShell là wrapper gọi Docker Engine trong Ubuntu, không dùng Docker Desktop.

## Nghiệp vụ

Một quản trị viên điều phối toàn bộ đội xe. Không cho xe/tài xế nhận lịch trùng thời gian, không cho chuyến chồng lịch bảo dưỡng. Hai khoảng tiếp giáp được chấp nhận. Transaction khóa xe trước, tài xế sau và cuối cùng khóa lịch để xử lý yêu cầu đồng thời.

Lịch dự kiến có thể sửa hoặc hủy. Khi bắt đầu, trạng thái chuyển sang đang thực hiện; chỉ hoàn tất với kilomet không giảm. Bảo dưỡng cần ghi chi phí VND nguyên không âm và kết quả. Công việc đang thực hiện phải hoàn tất trước khi bắt đầu công việc khác trên cùng xe/tài xế. Lịch sử được giữ lại, không có chức năng xóa hồ sơ đã phát sinh.

Seed có 8 xe, 6 tài xế, 10 chuyến và 5 phiếu bảo dưỡng; hồ sơ mẫu là dữ liệu minh họa. Khởi động lại không nhân đôi seed hoặc đặt lại mật khẩu.

## Bảo mật

App/Nginx chạy non-root, filesystem chỉ đọc, bỏ capabilities, bật no-new-privileges. PostgreSQL tách role ứng dụng, migration, owner và exporter. Form có CSRF; mật khẩu băm scrypt; cookie HttpOnly/SameSite; giới hạn đăng nhập; truy vấn tham số hóa và Nginx security headers. Cổng chỉ bind localhost.

HTTP localhost phục vụ demo; khi triển khai Internet cần HTTPS và cookie Secure. PostgreSQL bootstrap và bước chuẩn bị volume cần quyền root tạm thời. Dừng thông thường giữ dữ liệu; không chạy prune toàn máy.
