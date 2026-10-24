# Truy vấn LogQL của Lam Fleet

Mở Grafana → Explore → datasource Loki. Các truy vấn dưới đây cũng có trong dashboard. Chọn khoảng thời gian có hoạt động demo hoặc kiểm thử.

## 1. Lỗi HTTP từ Nginx

```logql
{job="nginx", project="de30lam"} | json | status >= 400
```

## 2. Lịch sử điều phối và bảo dưỡng

```logql
{job="app", project="de30lam"} | json | event=~"(trip|maintenance)_(scheduled|started|completed|cancelled)"
```

## 3. Lỗi PostgreSQL

```logql
{job="postgres", project="de30lam"} | json | error_severity=~"ERROR|FATAL|PANIC"
```

Chạy `sh scripts/test.sh` tạo sự kiện kiểm chứng, bao gồm trường hợp mã trùng gây lỗi PostgreSQL. SQL chứa giá trị mật khẩu, cookie và nội dung form không được ghi trong log. Log PostgreSQL dùng JSON; Promtail đọc file qua mount chỉ đọc và giữ vị trí đọc riêng. Loki giữ dữ liệu 7 ngày.
