# Cổng tuyển sinh lớp 1 — Trường Tiểu học Rạch Chèo

Website tuyển sinh online: **Google Sheet + Apps Script** làm backend, **Google Drive** lưu file đính kèm, mã nguồn trên **GitHub**, triển khai bằng **Vercel**. Không cần server riêng, không tốn phí.

## Cấu trúc dự án

```
tuyensinh-rachcheo/
├── index.html              trang chủ giới thiệu + tuyển sinh
├── dangky.html              form đăng ký (có upload file)
├── tracuu.html               tra cứu hồ sơ theo mã hồ sơ / SĐT
├── admin.html                 trang quản trị duyệt hồ sơ (có đăng nhập)
├── css/style.css
├── js/config.js              ← nơi dán URL Apps Script sau khi deploy
├── js/main.js
└── google-apps-script/
    └── Code.gs                mã backend, dán vào Apps Script
```

---

## BƯỚC 1 — Tạo Google Sheet + Apps Script (backend)

1. Vào [sheets.google.com](https://sheets.google.com) → tạo **Google Sheet mới**, đặt tên bất kỳ, ví dụ "Tuyển sinh Rạch Chèo".
2. Vào menu **Extensions (Tiện ích mở rộng) → Apps Script**.
3. Xoá hết code mẫu, mở file `google-apps-script/Code.gs` trong dự án này, **copy toàn bộ nội dung** rồi dán vào.
4. Nhấn **Save** (biểu tượng đĩa mềm).
5. Ở thanh chọn hàm phía trên (cạnh nút ▶ Run), chọn hàm `khoiTaoLanDau`, rồi bấm **Run**.
   - Lần đầu Google sẽ hỏi cấp quyền → chọn tài khoản Google của trường → bấm **Advanced/Nâng cao** → **Go to ... (unsafe)** → **Allow**. Đây là quyền script tự quản lý Sheet/Drive của chính bạn, an toàn.
   - Hàm này tự tạo dòng tiêu đề trong Sheet, tạo 1 thư mục Drive tên **"Ho so tuyen sinh - TH Rach Cheo"** để lưu file phụ huynh nộp, và đặt mật khẩu quản trị mặc định.
6. Vào **Project Settings** (biểu tượng bánh răng bên trái) → mục **Script Properties**, kiểm tra 2 dòng:
   - `ADMIN_PASSWORD` → **đổi thành mật khẩu riêng của trường**, ví dụ `RachCheo@2026`.
   - `DRIVE_FOLDER_ID` → giữ nguyên (đã tự tạo).

### Deploy thành Web App
7. Bấm nút **Deploy → New deployment**.
8. Chọn loại **Web app**.
9. Cấu hình:
   - **Execute as**: `Me (email của bạn)`
   - **Who has access**: `Anyone`
10. Bấm **Deploy** → cấp quyền lần nữa nếu được hỏi → **Copy URL** dạng:
    `https://script.google.com/macros/s/AKfycb.../exec`

> ⚠️ Mỗi khi bạn sửa code trong Apps Script, phải vào **Deploy → Manage deployments → nút bút chì (Edit) → Version: New version → Deploy** thì thay đổi mới có hiệu lực trên URL cũ.

---

## BƯỚC 2 — Gắn URL vào website

Mở file `js/config.js`, dán URL vừa copy vào:

```js
window.APP_CONFIG = {
  API_URL: "https://script.google.com/macros/s/AKfycb.../exec",
  TEN_TRUONG: "Trường Tiểu học Rạch Chèo",
  DIA_CHI: "Xã Nguyễn Việt Khái, tỉnh Cà Mau",
  NAM_HOC: "2026 - 2027"
};
```

---

## BƯỚC 3 — Đưa mã nguồn lên GitHub

1. Vào [github.com](https://github.com) → **New repository**, đặt tên ví dụ `tuyensinh-rachcheo` → Create.
2. Trên máy tính, trong thư mục dự án, chạy:
   ```bash
   git init
   git add .
   git commit -m "Website tuyển sinh lớp 1 - TH Rạch Chèo"
   git branch -M main
   git remote add origin https://github.com/<ten-cua-ban>/tuyensinh-rachcheo.git
   git push -u origin main
   ```
   (Nếu không quen dòng lệnh, dùng GitHub Desktop hoặc chức năng "uploading an existing file" trên trang GitHub.)

---

## BƯỚC 4 — Triển khai lên Vercel

1. Vào [vercel.com](https://vercel.com) → đăng nhập bằng tài khoản GitHub.
2. Bấm **Add New → Project** → chọn repo `tuyensinh-rachcheo` vừa tạo.
3. Vercel tự nhận diện đây là site tĩnh (HTML/CSS/JS thuần) → **không cần chỉnh Build Command / Output Directory**, để mặc định → bấm **Deploy**.
4. Sau ~30 giây, Vercel cấp cho bạn 1 domain dạng `https://tuyensinh-rachcheo.vercel.app`.
5. Từ nay, mỗi lần bạn `git push` code mới lên GitHub, Vercel **tự động deploy lại**.

---

## Cách dùng sau khi hoàn tất

- **Phụ huynh**: vào trang chủ → "Đăng ký tuyển sinh" → điền form, đính kèm giấy khai sinh + xác nhận cư trú → nhận **mã hồ sơ** (VD: `RC-2026-0001`).
- **Tra cứu**: vào trang "Tra cứu hồ sơ" → nhập mã hồ sơ hoặc SĐT đã đăng ký.
- **Nhà trường**: vào trang "Quản trị" → nhập mật khẩu (`ADMIN_PASSWORD` đã đặt ở Bước 1) → xem danh sách, xem file đính kèm trên Drive, bấm **Duyệt**/**Từ chối** cho từng hồ sơ. Dữ liệu đồng thời có thể mở trực tiếp trong Google Sheet để lọc, in, xuất Excel.

## Quản lý Banner (không cần code)

Vào trang Quản trị → khối **"🖼️ Quản lý banner trang web"** → chọn ảnh mới (khuyến nghị **1600 × 500px**, JPG/PNG, dưới 5MB) → bấm **Cập nhật banner**. Banner mới tự hiện trên Trang chủ, Đăng ký, Tra cứu.

## Quản lý thời gian tuyển sinh (không cần code)

Vào trang Quản trị → khối **"📅 Thời gian tuyển sinh"** → đặt ngày mở/đóng → **Lưu**. Ngoài khoảng thời gian này, form đăng ký tự khoá và hiện thông báo cho phụ huynh; trang chủ cũng tự hiện đúng khoảng thời gian này. Để trống cả 2 ô nếu không muốn giới hạn thời gian.

## Quản lý giấy tờ đính kèm (không cần code)

Vào trang Quản trị → khối **"📋 Quản lý giấy tờ đính kèm"**:
- Tick/bỏ tick **"Bắt buộc"** để quy định giấy tờ đó có bắt buộc nộp hay không.
- Tick **"Ẩn khỏi form"** để tạm ẩn 1 loại giấy tờ khỏi form đăng ký (VD: hết cần "Giấy tờ ưu tiên" trong đợt tuyển sinh mới).
- Gõ tên vào ô cuối và bấm **"+ Thêm"** để tạo loại giấy tờ mới (VD: "Giấy chứng nhận hộ nghèo", "Giấy xác nhận dân tộc thiểu số"...).
- Giấy khai sinh và Sổ hộ khẩu là 2 loại gốc của hệ thống — có thể ẩn nhưng không xoá được (đảm bảo hồ sơ luôn đủ dữ liệu cốt lõi).
- Nhớ bấm **"Lưu thay đổi"** sau khi chỉnh sửa.

## Lưu ý bảo mật & vận hành

- File đính kèm (giấy khai sinh, sổ hộ khẩu) được chia sẻ ở chế độ "Bất kỳ ai có link đều xem được" để cán bộ tuyển sinh mở nhanh — vì đây là thông tin cá nhân, **không đăng công khai link này ở đâu khác**. Nếu cần bảo mật cao hơn, có thể đổi `DriveApp.Access.ANYONE_WITH_LINK` trong `Code.gs` sang chế độ giới hạn theo domain trường (`DOMAIN_WITH_LINK`) nếu trường dùng Google Workspace riêng.
- Cơ chế đăng nhập quản trị hiện dùng 1 mật khẩu chung, phù hợp quy mô một trường tiểu học. Nếu cần nhiều tài khoản quản trị riêng biệt, có thể mở rộng bằng Google OAuth — liên hệ người phát triển để nâng cấp thêm.
- Google Apps Script miễn phí có giới hạn khoảng 20.000 lượt gọi API/ngày cho tài khoản cá nhân — dư sức cho quy mô tuyển sinh 1 trường.
- Nên thử nộp 1 hồ sơ thật + duyệt thử trước khi công bố rộng rãi, để chắc chắn luồng Sheet/Drive hoạt động đúng.

## Tuỳ chỉnh nội dung

- Đổi tên trường, năm học, địa chỉ: sửa trong `js/config.js`.
- Đổi danh sách ấp/khu vực tuyển sinh: sửa `<select name="khuVuc">` trong `dangky.html`.
- Đổi màu sắc/giao diện: chỉnh biến màu ở đầu file `css/style.css` (phần `:root`).
