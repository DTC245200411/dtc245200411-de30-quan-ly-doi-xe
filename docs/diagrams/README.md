# Sơ đồ Lam Fleet

Nguồn chỉnh sửa là DOT; mỗi sơ đồ có SVG và PNG 2400 px, metadata 300 DPI. Kiến trúc mô tả luồng HTTP/SQL thực tế. ERD rút gọn chỉ trình bày bốn bảng nghiệp vụ; các trường phụ và ba bảng quản trị admins, sessions, seed_versions được mô tả trong báo cáo và schema.sql. Không có FK giữa sessions và admins: thông tin người dùng nằm trong JSON phiên.

Quan hệ: một xe có 0..n chuyến và 0..n phiếu bảo dưỡng; một tài xế có 0..n chuyến. Mỗi chuyến bắt buộc có một xe và một tài xế; mỗi phiếu bắt buộc có một xe. Use Case chỉ có một actor quản trị viên. Giám sát/log chạy trên mạng monitoring, PostgreSQL trên mạng database nội bộ.

Đối chiếu với app/db/schema.sql, app/src/domain.js và các tệp Compose trước khi sửa sơ đồ. Các ảnh được render từ đúng nguồn DOT bằng Graphviz WASM.
