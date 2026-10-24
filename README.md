# Lam Fleet — Hệ thống Quản lý Đội xe

**Nguyễn Thị Lam · DTC245200411 · CNTT K23D**  
Giảng viên hướng dẫn: **Vũ Việt Dũng**. Đề 30, môn Triển khai và Quản trị Hệ thống Phần mềm.

Website tiếng Việt quản lý xe, tài xế, chuyến đi và bảo dưỡng. Node.js 24, Express 5, EJS, PostgreSQL 17, pgAdmin và Nginx; Prometheus/Grafana giám sát, Loki/Promtail thu log. Toàn bộ dịch vụ triển khai bằng Docker Compose trong Ubuntu WSL2.

## Chạy trên máy đang bàn giao

Nguồn chính: `/home/hai/projects/de30-quan-ly-doi-xe`, mở từ Windows bằng `\\wsl.localhost\Ubuntu-24.04\home\hai\projects\de30-quan-ly-doi-xe`. Docker Engine chạy trực tiếp trong Ubuntu; không cần Docker Desktop. Không sửa đồng thời một bản sao ở ổ C.

Trong cửa sổ Ubuntu đang mở:

```sh
cd /home/hai/projects/de30-quan-ly-doi-xe
sh scripts/start.sh
```

Giữ cửa sổ Ubuntu hoạt động trong buổi demo. PowerShell wrapper trên máy này:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/start.ps1
powershell -ExecutionPolicy Bypass -File scripts/test.ps1
powershell -ExecutionPolicy Bypass -File scripts/stop.ps1
```

Wrapper giữ phiên WSL tối đa 4 giờ; khi demo lâu hơn, chạy lại hoặc giữ cửa sổ Ubuntu mở. Wrapper đã cấu hình distro `Ubuntu-24.04`, Linux user `hai` và đường dẫn nguồn ở trên. Khi chuyển máy, sửa các giá trị này hoặc chạy trực tiếp script Linux. Không bật Docker Desktop WSL Integration vào distro đang dùng Engine riêng.

## Clone trên môi trường mới

Cần Git, OpenSSL, Python 3, Docker Engine và Docker Compose có `up --wait`. Repository private nên tài khoản clone phải được cấp quyền.

```sh
git clone https://github.com/DTC245200411/dtc245200411-de30-quan-ly-doi-xe.git de30-quan-ly-doi-xe
cd de30-quan-ly-doi-xe
sh scripts/start.sh
```

`prepare.sh` sinh secret một lần; migration tạo schema/seed rồi app khởi động. Chạy lại giữ mật khẩu và dữ liệu. `BASE_ONLY=1 sh scripts/start.sh` chỉ chạy website/database/pgAdmin. `.env.example` có cổng mặc định; có thể chép thành `.env` để cấu hình. Không thay cổng web 8080 trên máy bàn giao; nếu bị chiếm phải xác định dịch vụ trước.

| Thành phần | Địa chỉ | Tài khoản | Mật khẩu khởi tạo |
|---|---|---|---|
| Website | http://localhost:8080 | admin | `.local/secrets/admin_password` |
| pgAdmin | http://localhost:8091 | admin@lam.edu.vn | `.local/secrets/pgadmin_password` |
| Grafana | http://localhost:3005 | admin | `.local/secrets/grafana_password` |
| Prometheus | http://localhost:9094 | Không yêu cầu | Chỉ bind localhost |

Xem mật khẩu trong Ubuntu: `cat .local/secrets/admin_password`. Trên PowerShell: `Get-Content .local/secrets/admin_password` khi đang ở thư mục nguồn UNC. Không đưa secret lên GitHub. Sau khi đổi mật khẩu trên website, file khởi tạo không tự cập nhật.

pgAdmin có sẵn server **Lam Fleet PostgreSQL**, host `postgres`, port `5432`, database `fleet`, user `fleet_migrate`. Mật khẩu kết nối DB nằm trong `.local/secrets/db_migrate_password`, khác mật khẩu đăng nhập pgAdmin.

## Nghiệp vụ và giới hạn

Quản lý hồ sơ xe, tài xế; tạo/sửa/hủy lịch dự kiến; bắt đầu và hoàn tất chuyến hoặc bảo dưỡng. Biển số, mã hồ sơ và số giấy phép không trùng. Số kilomet không giảm; chi phí bảo dưỡng là VND nguyên không âm. Hoàn tất bảo dưỡng cần kết quả thực hiện. Lịch sử được giữ lại, không có xóa vật lý hồ sơ nghiệp vụ.

Khoảng thời gian dùng quy ước `[start,end)`: hai lịch tiếp giáp được phép. Lịch dự kiến/đang thực hiện được đối chiếu để chặn trùng xe, tài xế và chuyến với bảo dưỡng. Mỗi mutation khóa xe theo ID tăng dần, rồi tài xế và lịch; đọc lại trạng thái trước khi ghi. `version` bảo vệ biểu mẫu cũ. Công việc đang thực hiện phải kết thúc trước khi bắt đầu công việc khác trên cùng tài nguyên, kể cả quá giờ dự kiến.

Giờ biểu mẫu là giờ Việt Nam; database dùng timestamptz. Chuyển trạng thái bắt đầu do người quản trị chủ động xác nhận, không có tác vụ tự động bắt đầu/kết thúc theo đồng hồ. Chưa điều chỉnh tự động các lịch tiếp theo khi chuyến kéo dài; người quản trị xử lý lại lịch dự kiến. Cảnh báo bảo dưỡng dựa trên thời gian, chưa tính chu kỳ kilomet.

Seed có **8 xe, 6 tài xế, 10 chuyến, 5 phiếu bảo dưỡng**, gồm trạng thái dự kiến/đang thực hiện/hoàn tất/đã hủy và xe ngừng sử dụng. Hồ sơ, số điện thoại, giấy phép là dữ liệu minh họa. Một quản trị viên, một đơn vị đội xe; chưa có GPS, thanh toán hoặc ứng dụng di động.

## Kiểm thử

```sh
sh scripts/test.sh
```

Bộ test gồm 29 ca qua HTTP/Nginx/PostgreSQL và validation, bao gồm chống trùng lịch đồng thời, vòng đời công việc, kilomet/chi phí, CSRF, headers, quyền DB và vô hiệu hóa phiên khi đổi mật khẩu. Test tạo tài khoản QA riêng và dọn dữ liệu thử; không đổi mật khẩu admin chính. `BASE_ONLY=1 sh scripts/test.sh` chỉ chạy 29 ca ứng dụng.

Kết quả mới nhất lưu ở `.local/test-results/`; bản minh chứng đã kiểm tra trong `docs/evidence/`. Có thêm kiểm thử Chrome desktop/mobile và kiểm chứng khởi tạo mới. Không coi HTTP 200 hoặc target UP đơn lẻ là đủ cho toàn bộ bài.

## Giám sát và log

Grafana → Dashboards → **Đề 30 Nguyễn Thị Lam** → **Lam Fleet | Đội xe và vận hành**. Dashboard có 17 panel: 14 metrics và 3 log. Prometheus có 5 job `prometheus`, `lam-fleet`, `nginx`, `postgres`, `cadvisor`. CPU/RAM lọc đúng project `de30lam` và từng service app/nginx/postgres. Chờ ít nhất hai chu kỳ scrape 15 giây để xem rate.

```sh
docker compose -f compose.yaml -f compose.monitoring.yaml -f compose.logging.yaml exec -T app node < scripts/check-monitoring.js
docker compose -f compose.yaml -f compose.monitoring.yaml -f compose.logging.yaml exec -T app node < scripts/check-logs.js
python3 scripts/check-hardening.py
```

Ba [truy vấn LogQL](observability/logql.md) tìm lỗi HTTP, sự kiện chuyến/bảo dưỡng và lỗi PostgreSQL. Chạy test/demo để tạo sự kiện rồi chọn đúng thời gian trong Grafana. Promtail đọc volume log chỉ đọc, không mount Docker socket, có volume lưu vị trí đọc. File được xoay vòng; Loki/Prometheus giữ dữ liệu 7 ngày. Counter ứng dụng bắt đầu lại khi restart, gauge nghiệp vụ đọc DB.

Promtail đã hết hỗ trợ từ 02/03/2026 theo [Grafana](https://grafana.com/docs/loki/latest/send-data/promtail/). Bài giữ đúng công cụ theo đề; hướng chuyển đổi là Grafana Alloy. Các alert khai báo trong Prometheus chưa gửi thông báo ra dịch vụ ngoài.

## Sao lưu và phục hồi

```sh
sh scripts/backup.sh
sh scripts/restore.sh --verify-current .local/backups/<ten-tep>.dump
sh scripts/restore.sh --verify .local/backups/<ban-cu>.dump
```

Backup dạng PostgreSQL custom archive, kèm SHA-256, có dữ liệu tài khoản/phiên nên chỉ giữ trong `.local/backups`. `--verify` phục hồi database tạm và tự dọn; `--verify-current` còn yêu cầu fingerprint của bốn bảng nghiệp vụ khớp database hiện tại.

Chỉ khi chủ động thay dữ liệu hiện có:

```sh
sh scripts/restore.sh --apply .local/backups/<ten-tep>.dump
```

Script kiểm tra archive trước, yêu cầu nhập `PHUC HOI LAM FLEET`, dừng app/Nginx và phục hồi cả ownership/ACL. Khi lỗi, ứng dụng giữ trạng thái dừng để xử lý. Mật khẩu sau restore theo database backup, không theo file khởi tạo. PowerShell có wrapper `backup.ps1`, `restore.ps1 -BackupFile <duong-dan-Linux> -CompareCurrent`; thêm `-Apply` khi muốn phục hồi đè.

## Hardening và xử lý lỗi

App/Nginx non-root, read-only, bỏ capabilities và bật no-new-privileges. PostgreSQL tách role owner/migration/app/exporter; app không CREATE schema hoặc DELETE lịch sử. CSRF, scrypt, session HttpOnly/SameSite, giới hạn đăng nhập, SQL tham số hóa, giới hạn body và security headers Nginx đã kiểm tra. Các cổng chỉ bind `127.0.0.1`; PostgreSQL/Loki/exporter không publish.

Ngoại lệ: cAdvisor privileged để đọc host/Docker; storage-init root tạm thời đặt quyền volume; PostgreSQL bootstrap root rồi chuyển postgres; logrotate có capability hẹp; pgAdmin dùng cơ chế khởi động của image chính thức. Không khẳng định mọi container đều non-root. HTTP localhost là demo; khi công khai cần HTTPS và `COOKIE_SECURE=true`.

- Không truy cập được: giữ Ubuntu đang hoạt động, kiểm tra `systemctl is-active docker`, `docker info` và `docker compose -f compose.yaml -f compose.monitoring.yaml -f compose.logging.yaml ps -a`.
- Cổng 8080 bị chiếm: xác định tiến trình/dịch vụ; không tự dừng bài khác hoặc đổi web sang cổng khác.
- App lỗi sau restart: xem log app/migrate/postgres; Nginx dùng DNS nội bộ để cập nhật địa chỉ container.
- Thiếu biểu đồ: đợi hai scrape, xem `/targets`, kiểm tra `pg_up`, nhãn project và khoảng thời gian.
- Thiếu log: tạo thao tác mới, kiểm tra Loki/Promtail, quyền file và thời gian truy vấn.
- Không đổi mật khẩu role bằng cách sửa secret đã dùng cho volume DB có sẵn.
- Dừng giữ dữ liệu. Không dùng `docker system prune`, shutdown toàn WSL hoặc xóa volume bài khác để sửa bài này.

## Tài liệu bàn giao

- [Báo cáo Word](docs/Bao_Cao_De30_Nguyen_Thi_Lam.docx) và [bản PDF](docs/Bao_Cao_De30_Nguyen_Thi_Lam.pdf).
- [Kịch bản demo](docs/Kich_Ban_Demo.md), [sơ đồ DOT/SVG/PNG](docs/diagrams/README.md), [minh chứng](docs/evidence/README.md).
- Ba mốc Git: ứng dụng/database/Nginx; Prometheus/Grafana; Loki/Promtail và bàn giao.

Báo cáo Word/PDF gồm 20 trang, được biên soạn theo mẫu cung cấp và tập trung vào phát triển ứng dụng, thiết kế dữ liệu, xử lý đồng thời, phân quyền và quản trị dữ liệu. Bốn hình gồm kiến trúc, ERD, giao diện ứng dụng và transaction; kết quả giám sát/log được trình bày bằng phân tích và bảng. Mẫu gốc được giữ tại `docs/report-template.docx` để tái tạo định dạng.

Tái tạo báo cáo: dùng Python và thư viện trong `docs/requirements-report.txt`, chạy `python scripts/build-report.py`; xuất PDF bằng Microsoft Word qua `scripts/export-report.ps1 -ProjectRoot <thu-muc-du-an>`. `scripts/render-report.py` dùng pipeline render_docx của Codex để tạo ảnh QA từ PDF đã xuất bằng Word khi Windows không có LibreOffice. Script chụp ảnh trình duyệt cần Playwright và Chrome, đọc secret trong bộ nhớ và không in mật khẩu.
