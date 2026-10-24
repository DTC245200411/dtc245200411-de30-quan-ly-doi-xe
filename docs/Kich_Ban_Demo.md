# Kịch bản demo Lam Fleet

Nguyễn Thị Lam · DTC245200411 · CNTT K23D · GVHD Vũ Việt Dũng.

## 1. Khởi động và đăng nhập

Giữ Ubuntu mở, vào thư mục nguồn và chạy `sh scripts/start.sh`. Mở http://localhost:8080, đăng nhập admin bằng mật khẩu trong `.local/secrets/admin_password`. Giới thiệu 8 xe, 6 tài xế, 10 chuyến và 5 phiếu; chỉ ra xe đang chạy/bảo dưỡng và lịch quá hạn. Không đưa mật khẩu vào slide, báo cáo hoặc GitHub.

## 2. Thực hành điều phối

Tạo xe `DEMO-XE-01`, biển số mới, kilomet 1000. Tạo tài xế `DEMO-TX-01`, giấy phép minh họa duy nhất. Lập chuyến `DEMO-LT-01` với thời gian 08:00–10:00 một ngày chọn để demo. Tạo lại một lịch trên cùng xe 09:00–11:00: hệ thống báo xung đột; thử cùng tài xế với xe khác cũng bị từ chối.

Tạo lịch kế tiếp 10:00–12:00: được chấp nhận vì tiếp giáp. Bắt đầu chuyến đầu; thử bắt đầu chuyến kế tiếp khi chuyến đầu chưa hoàn tất sẽ bị chặn. Hoàn tất chuyến đầu với kilomet 1100. Đối chiếu lịch sử và kilomet xe. Hủy chuyến kế tiếp nếu không dùng; phiếu hủy vẫn được giữ.

## 3. Thực hành bảo dưỡng

Lập `DEMO-BD-01` trên xe demo với khoảng thời gian chưa có lịch. Thử lập chuyến giao khoảng bảo dưỡng để thấy bị chặn. Bắt đầu phiếu bảo dưỡng, ghi kilomet 1100, chi phí 500000 và kết quả kiểm tra. Hoàn tất rồi xem lại lịch sử và chi phí trên dashboard. Không thay đổi các hồ sơ seed khi cần giữ nguyên ảnh minh chứng.

## 4. Database và reverse proxy

Mở pgAdmin ở cổng 8091, đăng nhập `admin@lam.edu.vn`. Kết nối server đã khai báo bằng mật khẩu role `fleet_migrate` trong secret riêng. Mở database fleet/public/Tables và xem vehicles, drivers, trips, maintenance. Chỉ ra Nginx là cổng website 8080, còn app:3000 và postgres:5432 không publish trên host. Kiểm tra `/metrics` và `/readyz` ở website trả 404.

## 5. Giám sát và log

Mở Prometheus http://localhost:9094/targets: đủ 5 job UP. Mở Grafana http://localhost:3005, dashboard Lam Fleet. Chỉ ra CPU/RAM app/nginx/postgres thuộc de30lam, số xe, trạng thái chuyến/bảo dưỡng. Tạo thêm thao tác để thay đổi counter.

Mở Explore/Loki và dùng ba truy vấn trong `observability/logql.md`. Đối chiếu request_id của sự kiện app và Nginx khi cần tra lỗi. Log lỗi PostgreSQL có thể tạo bằng ca kiểm thử mã trùng; không nhập SQL chứa mật khẩu để làm minh chứng.

## 6. Kiểm thử và phục hồi

Chạy `sh scripts/test.sh`, giới thiệu 29 ca và các tình huống đồng thời. Chạy backup rồi `restore.sh --verify-current` trên bản vừa tạo, quan sát 8/6/10/5 nếu chưa tạo thêm dữ liệu demo hoặc đúng số hiện tại nếu đã tạo; fingerprint phải khớp. Chế độ này dùng database tạm, không ghi đè dữ liệu đang phục vụ.

Kết thúc bằng `sh scripts/stop.sh` nếu muốn dừng. Dữ liệu vẫn được giữ trong volume. Không xóa volume hoặc chạy prune trong buổi demo.
