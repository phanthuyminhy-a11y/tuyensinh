/**
 * ============================================================
 * TRƯỜNG TIỂU HỌC RẠCH CHÈO — API TUYỂN SINH LỚP 1
 * Backend chạy trên Google Apps Script
 * Ghi dữ liệu vào Google Sheet, lưu file vào Google Drive
 * ============================================================
 *
 * CÀI ĐẶT TRƯỚC KHI DÙNG (xem chi tiết trong README.md):
 * 1. Tạo 1 Google Sheet mới, đặt tên "TuyenSinh".
 * 2. Vào Extensions > Apps Script, dán toàn bộ file này vào.
 * 3. Chạy hàm `khoiTaoLanDau` một lần để tạo cột tiêu đề + cấu hình.
 * 4. Vào Project Settings > Script Properties, kiểm tra/điền:
 *      - ADMIN_PASSWORD  : mật khẩu đăng nhập trang quản trị
 *      - DRIVE_FOLDER_ID : ID thư mục Drive để lưu file đính kèm
 * 5. Deploy > New deployment > Web app
 *      - Execute as: Me
 *      - Who has access: Anyone
 *    Copy URL và dán vào js/config.js (API_URL) trong web.
 */

const TEN_SHEET = "TuyenSinh";
const HEADERS = [
  "maHoSo", "thoiGianNop", "hoTenHocSinh", "ngaySinh", "gioiTinh", "danToc",
  "noiSinh", "hoTenCha", "sdtCha", "hoTenMe", "sdtMe", "sdtLienHe",
  "diaChiThuongTru", "diaChiTamTru", "khuVuc",
  "linkGiayKhaiSinh", "linkGiayCuTru", "linkGiayToKhac", "ghiChu",
  "trangThai", "ghiChuDuyet", "thoiGianDuyet"
];

// Danh sách giấy tờ mặc định — admin có thể sửa Ẩn/Hiện/Bắt buộc hoặc thêm loại mới
// trong trang Quản trị, không cần sửa code.
// coDinh:true nghĩa là loại giấy tờ gốc của hệ thống (khaiSinh, cuTru) — có thể ẩn nhưng không xoá được.
const DANH_SACH_GIAY_TO_MAC_DINH = [
  { id: "khaiSinh", ten: "Giấy khai sinh", batBuoc: true, an: false, coDinh: true },
  { id: "cuTru", ten: "Sổ hộ khẩu / Giấy xác nhận cư trú", batBuoc: true, an: false, coDinh: true },
  { id: "uuTien", ten: "Giấy tờ ưu tiên (nếu có)", batBuoc: false, an: false, coDinh: false }
];

// ---------- KHỞI TẠO (chạy 1 lần bằng tay) ----------
function khoiTaoLanDau() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(TEN_SHEET);
  if (!sheet) sheet = ss.insertSheet(TEN_SHEET);
  sheet.clear();
  sheet.appendRow(HEADERS);
  sheet.setFrozenRows(1);

  // Ép định dạng "Văn bản thuần" (Plain text) cho các cột số điện thoại và ngày sinh,
  // để Google Sheet không tự động xoá số 0 ở đầu hoặc đổi ngày sinh thành kiểu Date.
  dinhDangCotThanhVanBan();

  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty("ADMIN_PASSWORD")) {
    props.setProperty("ADMIN_PASSWORD", "doiMatKhauNay123");
  }
  if (!props.getProperty("DRIVE_FOLDER_ID")) {
    const folder = DriveApp.createFolder("Ho so tuyen sinh - TH Rach Cheo");
    props.setProperty("DRIVE_FOLDER_ID", folder.getId());
  }
  if (!props.getProperty("GIAY_TO_CONFIG")) {
    props.setProperty("GIAY_TO_CONFIG", JSON.stringify(DANH_SACH_GIAY_TO_MAC_DINH));
  }
  Logger.log("Đã khởi tạo xong. Nhớ vào Script Properties kiểm tra ADMIN_PASSWORD và DRIVE_FOLDER_ID.");
}

// Chạy hàm này riêng nếu Sheet đã có dữ liệu và chỉ cần sửa định dạng cột
// (không xoá dữ liệu, không cần chạy lại khoiTaoLanDau).
function dinhDangCotThanhVanBan() {
  const sheet = laySheet();
  const soDong = Math.max(sheet.getMaxRows(), 1000);
  const cacCotCanEpVanBan = ["ngaySinh", "sdtCha", "sdtMe", "sdtLienHe"];
  cacCotCanEpVanBan.forEach((ten) => {
    const cot = HEADERS.indexOf(ten) + 1;
    if (cot > 0) sheet.getRange(1, cot, soDong, 1).setNumberFormat("@");
  });
}

// ---------- ĐIỀU HƯỚNG REQUEST ----------
function doGet(e) {
  try {
    const action = e.parameter.action;
    if (action === "traCuu") return traCuuHoSo(e.parameter.tuKhoa);
    if (action === "danhSachAdmin") return danhSachAdmin(e.parameter.token, e.parameter.trangThai);
    if (action === "layBanner") return layBanner();
    if (action === "layDanhSachGiayTo") return layDanhSachGiayTo();
    if (action === "layThoiGianTuyenSinh") return layThoiGianTuyenSinh();
    return jsonOut({ ok: false, message: "Hành động không hợp lệ." });
  } catch (err) {
    return jsonOut({ ok: false, message: err.message });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;
    if (action === "nopHoSo") return nopHoSo(body);
    if (action === "dangNhap") return dangNhap(body.matKhau);
    if (action === "capNhatTrangThai") return capNhatTrangThai(body.token, body.maHoSo, body.trangThai);
    if (action === "capNhatBanner") return capNhatBanner(body.token, body.anhBanner);
    if (action === "capNhatDanhSachGiayTo") return capNhatDanhSachGiayTo(body.token, body.danhSach);
    if (action === "capNhatThoiGianTuyenSinh") return capNhatThoiGianTuyenSinh(body.token, body.ngayBatDau, body.ngayKetThuc);
    return jsonOut({ ok: false, message: "Hành động không hợp lệ." });
  } catch (err) {
    return jsonOut({ ok: false, message: err.message });
  }
}

// ---------- NỘP HỒ SƠ ----------
function nopHoSo(body) {
  const sheet = laySheet();
  const hs = body.hoSo || {};

  if (!hs.hoTenHocSinh || !hs.ngaySinh || !hs.sdtLienHe || !hs.diaChiThuongTru || !hs.khuVuc) {
    return jsonOut({ ok: false, message: "Thiếu thông tin bắt buộc." });
  }

  const kiemTraTG = kiemTraDangTrongThoiGianTuyenSinh();
  if (!kiemTraTG.dangMo) {
    return jsonOut({ ok: false, message: kiemTraTG.thongBao });
  }

  const cauHinhGiayTo = layDanhSachGiayToRaw();
  const danhSachFile = body.danhSachFile || {};

  // Kiểm tra đủ giấy tờ bắt buộc (loại đang hiện, chưa bị admin ẩn)
  for (const gt of cauHinhGiayTo) {
    if (gt.batBuoc && !gt.an && !(danhSachFile[gt.id] && danhSachFile[gt.id].base64)) {
      return jsonOut({ ok: false, message: `Thiếu giấy tờ bắt buộc: ${gt.ten}` });
    }
  }

  const folder = DriveApp.getFolderById(PropertiesService.getScriptProperties().getProperty("DRIVE_FOLDER_ID"));

  let linkKhaiSinh = "";
  let linkCuTru = "";
  const giayToKhac = [];

  cauHinhGiayTo.forEach((gt) => {
    const file = danhSachFile[gt.id];
    if (!file || !file.base64) return;
    const link = luuFileLenDrive(folder, file, hs.hoTenHocSinh + " - " + gt.ten);
    if (gt.id === "khaiSinh") linkKhaiSinh = link;
    else if (gt.id === "cuTru") linkCuTru = link;
    else giayToKhac.push({ ten: gt.ten, link: link });
  });

  const maHoSo = taoMaHoSo(sheet);
  const now = new Date();

  // Thêm dấu ' phía trước số điện thoại để buộc Google Sheet lưu dạng văn bản,
  // tránh bị tự động chuyển thành số và mất số 0 ở đầu.
  const epVanBan = (s) => (s ? "'" + String(s).replace(/\D/g, "") : "");

  sheet.appendRow([
    maHoSo,
    Utilities.formatDate(now, "GMT+7", "dd/MM/yyyy HH:mm"),
    hs.hoTenHocSinh, hs.ngaySinh, hs.gioiTinh || "", hs.danToc || "",
    hs.noiSinh || "", hs.hoTenCha || "", epVanBan(hs.sdtCha), hs.hoTenMe || "", epVanBan(hs.sdtMe),
    epVanBan(hs.sdtLienHe), hs.diaChiThuongTru, hs.diaChiTamTru || "", hs.khuVuc,
    linkKhaiSinh, linkCuTru, JSON.stringify(giayToKhac), hs.ghiChu || "",
    "Chờ duyệt", "", ""
  ]);

  return jsonOut({ ok: true, maHoSo: maHoSo });
}

function luuFileLenDrive(folder, fileData, tenGoiY) {
  if (!fileData || !fileData.base64) return "";
  const bytes = Utilities.base64Decode(fileData.base64);
  const blob = Utilities.newBlob(bytes, fileData.mimeType, tenGoiY + " - " + fileData.tenFile);
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return file.getUrl();
}

function taoMaHoSo(sheet) {
  const nam = new Date().getFullYear();
  const soDong = Math.max(sheet.getLastRow() - 1, 0) + 1;
  const stt = String(soDong).padStart(4, "0");
  return `RC-${nam}-${stt}`;
}

// ---------- TRA CỨU (công khai) ----------
function traCuuHoSo(tuKhoa) {
  if (!tuKhoa) return jsonOut({ ok: false, message: "Vui lòng nhập mã hồ sơ hoặc số điện thoại." });
  const sheet = laySheet();
  const data = sheet.getDataRange().getValues();
  const cols = HEADERS;
  const idx = (name) => cols.indexOf(name);

  const chuanHoaSdt = (s) => String(s).replace(/\D/g, "").replace(/^0+/, ""); // bỏ ký tự không phải số + bỏ số 0 ở đầu
  const tk = tuKhoa.trim().toLowerCase();
  const tkSdt = chuanHoaSdt(tuKhoa);

  const ketQua = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const maHoSo = String(row[idx("maHoSo")]).toLowerCase();
    const sdt = String(row[idx("sdtLienHe")]);
    const khop = maHoSo === tk || (tkSdt.length >= 8 && chuanHoaSdt(sdt) === tkSdt);
    if (khop) {
      ketQua.push({
        maHoSo: row[idx("maHoSo")],
        hoTenHocSinh: row[idx("hoTenHocSinh")],
        ngaySinh: row[idx("ngaySinh")],
        trangThai: row[idx("trangThai")] || "Chờ duyệt",
        ghiChuDuyet: row[idx("ghiChuDuyet")],
      });
    }
  }
  return jsonOut({ ok: true, danhSach: ketQua });
}

// ---------- ĐĂNG NHẬP ADMIN ----------
function dangNhap(matKhau) {
  const dung = PropertiesService.getScriptProperties().getProperty("ADMIN_PASSWORD");
  if (matKhau && matKhau === dung) {
    // Token đơn giản = chính mật khẩu đúng (đã được xác thực ở bước này).
    // Phù hợp quy mô 1 trường học; có thể nâng cấp bằng OAuth nếu cần bảo mật cao hơn.
    return jsonOut({ ok: true, token: dung });
  }
  return jsonOut({ ok: false, message: "Sai mật khẩu." });
}

function kiemTraToken(token) {
  const dung = PropertiesService.getScriptProperties().getProperty("ADMIN_PASSWORD");
  return token && token === dung;
}

// ---------- DANH SÁCH CHO ADMIN ----------
function danhSachAdmin(token, locTrangThai) {
  if (!kiemTraToken(token)) return jsonOut({ ok: false, message: "Chưa đăng nhập hoặc phiên hết hạn." });
  const sheet = laySheet();
  const data = sheet.getDataRange().getValues();
  const cols = HEADERS;
  const idx = (name) => cols.indexOf(name);

  const danhSach = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const trangThai = row[idx("trangThai")] || "Chờ duyệt";
    if (locTrangThai && trangThai !== locTrangThai) continue;
    const obj = {};
    cols.forEach((c, j) => (obj[c] = row[j]));
    danhSach.push(obj);
  }
  danhSach.reverse(); // mới nhất lên đầu
  return jsonOut({ ok: true, danhSach: danhSach });
}

// ---------- DANH SÁCH GIẤY TỜ ĐÍNH KÈM (admin có thể ẩn/hiện, thêm loại mới) ----------
function layDanhSachGiayToRaw() {
  const raw = PropertiesService.getScriptProperties().getProperty("GIAY_TO_CONFIG");
  if (!raw) return DANH_SACH_GIAY_TO_MAC_DINH;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return DANH_SACH_GIAY_TO_MAC_DINH;
  }
}

function layDanhSachGiayTo() {
  return jsonOut({ ok: true, danhSach: layDanhSachGiayToRaw() });
}

function capNhatDanhSachGiayTo(token, danhSach) {
  if (!kiemTraToken(token)) return jsonOut({ ok: false, message: "Chưa đăng nhập hoặc phiên hết hạn." });
  if (!Array.isArray(danhSach) || danhSach.length === 0) {
    return jsonOut({ ok: false, message: "Danh sách giấy tờ không hợp lệ." });
  }
  // Không cho phép xoá 2 loại giấy tờ gốc (khaiSinh, cuTru) — chỉ được ẩn.
  const coDuKhaiSinh = danhSach.some((g) => g.id === "khaiSinh");
  const coDuCuTru = danhSach.some((g) => g.id === "cuTru");
  if (!coDuKhaiSinh || !coDuCuTru) {
    return jsonOut({ ok: false, message: "Không thể xoá Giấy khai sinh hoặc Sổ hộ khẩu — chỉ có thể ẩn." });
  }
  PropertiesService.getScriptProperties().setProperty("GIAY_TO_CONFIG", JSON.stringify(danhSach));
  return jsonOut({ ok: true, danhSach: danhSach });
}

// ---------- THỜI GIAN TUYỂN SINH (admin đặt ngày mở / đóng) ----------
function layThoiGianTuyenSinh() {
  const props = PropertiesService.getScriptProperties();
  const ngayBatDau = props.getProperty("NGAY_BAT_DAU_TS") || "";
  const ngayKetThuc = props.getProperty("NGAY_KET_THUC_TS") || "";
  const kt = kiemTraDangTrongThoiGianTuyenSinh();
  return jsonOut({
    ok: true,
    ngayBatDau: ngayBatDau,
    ngayKetThuc: ngayKetThuc,
    dangMo: kt.dangMo,
    thongBao: kt.thongBao,
  });
}

function capNhatThoiGianTuyenSinh(token, ngayBatDau, ngayKetThuc) {
  if (!kiemTraToken(token)) return jsonOut({ ok: false, message: "Chưa đăng nhập hoặc phiên hết hạn." });
  const props = PropertiesService.getScriptProperties();
  props.setProperty("NGAY_BAT_DAU_TS", ngayBatDau || "");
  props.setProperty("NGAY_KET_THUC_TS", ngayKetThuc || "");
  return jsonOut({ ok: true });
}

// Trả về { dangMo: boolean, thongBao: string } — dùng chung cho cả doGet và nopHoSo
function kiemTraDangTrongThoiGianTuyenSinh() {
  const props = PropertiesService.getScriptProperties();
  const ngayBatDauStr = props.getProperty("NGAY_BAT_DAU_TS") || "";
  const ngayKetThucStr = props.getProperty("NGAY_KET_THUC_TS") || "";

  // Nếu admin chưa đặt lịch, coi như luôn mở (không giới hạn)
  if (!ngayBatDauStr && !ngayKetThucStr) return { dangMo: true, thongBao: "" };

  const homNay = new Date();
  homNay.setHours(0, 0, 0, 0);

  if (ngayBatDauStr) {
    const batDau = new Date(ngayBatDauStr + "T00:00:00");
    if (homNay < batDau) {
      return {
        dangMo: false,
        thongBao: `Chưa đến thời gian tuyển sinh. Đợt tuyển sinh sẽ mở từ ngày ${dinhDangNgayVN(batDau)}.`,
      };
    }
  }
  if (ngayKetThucStr) {
    const ketThuc = new Date(ngayKetThucStr + "T23:59:59");
    if (homNay > ketThuc) {
      return {
        dangMo: false,
        thongBao: `Đã hết thời gian tuyển sinh (kết thúc ngày ${dinhDangNgayVN(ketThuc)}). Vui lòng liên hệ trực tiếp nhà trường nếu cần hỗ trợ.`,
      };
    }
  }
  return { dangMo: true, thongBao: "" };
}

function dinhDangNgayVN(d) {
  return Utilities.formatDate(d, "GMT+7", "dd/MM/yyyy");
}

// ---------- CẬP NHẬT TRẠNG THÁI ----------
function capNhatTrangThai(token, maHoSo, trangThai) {
  if (!kiemTraToken(token)) return jsonOut({ ok: false, message: "Chưa đăng nhập hoặc phiên hết hạn." });
  if (!["Đã duyệt", "Từ chối", "Chờ duyệt"].includes(trangThai)) {
    return jsonOut({ ok: false, message: "Trạng thái không hợp lệ." });
  }
  const sheet = laySheet();
  const data = sheet.getDataRange().getValues();
  const idxMa = HEADERS.indexOf("maHoSo");
  const idxTrangThai = HEADERS.indexOf("trangThai") + 1;
  const idxThoiGianDuyet = HEADERS.indexOf("thoiGianDuyet") + 1;

  for (let i = 1; i < data.length; i++) {
    if (data[i][idxMa] === maHoSo) {
      sheet.getRange(i + 1, idxTrangThai).setValue(trangThai);
      sheet.getRange(i + 1, idxThoiGianDuyet).setValue(
        Utilities.formatDate(new Date(), "GMT+7", "dd/MM/yyyy HH:mm")
      );
      return jsonOut({ ok: true });
    }
  }
  return jsonOut({ ok: false, message: "Không tìm thấy hồ sơ." });
}

// ---------- BANNER TRANG WEB ----------

// Kích thước banner khuyến nghị: 1600 x 500px (tỉ lệ ~3.2:1)
// Ảnh sẽ tự động được cắt/co giãn vừa khung (object-fit: cover) trên mọi trang.
const KICH_THUOC_BANNER_KHUYEN_NGHI = "1600x500";

function layBanner() {
  const url = PropertiesService.getScriptProperties().getProperty("BANNER_URL") || "";
  return jsonOut({ ok: true, bannerUrl: url, kichThuocKhuyenNghi: KICH_THUOC_BANNER_KHUYEN_NGHI });
}

function capNhatBanner(token, anhBanner) {
  if (!kiemTraToken(token)) return jsonOut({ ok: false, message: "Chưa đăng nhập hoặc phiên hết hạn." });
  if (!anhBanner || !anhBanner.base64) return jsonOut({ ok: false, message: "Chưa chọn ảnh banner." });

  const props = PropertiesService.getScriptProperties();
  let bannerFolderId = props.getProperty("BANNER_FOLDER_ID");
  let bannerFolder;
  if (bannerFolderId) {
    bannerFolder = DriveApp.getFolderById(bannerFolderId);
  } else {
    bannerFolder = DriveApp.createFolder("Banner website - TH Rach Cheo");
    props.setProperty("BANNER_FOLDER_ID", bannerFolder.getId());
  }

  const bytes = Utilities.base64Decode(anhBanner.base64);
  const blob = Utilities.newBlob(bytes, anhBanner.mimeType, "banner-" + Date.now());
  const file = bannerFolder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  // Link dạng thumbnail chính thức của Drive — ổn định hơn nhiều so với "uc?export=view"
  // khi dùng để nhúng trực tiếp vào <img>/CSS background trên website.
  const urlAnhTrucTiep = "https://drive.google.com/thumbnail?id=" + file.getId() + "&sz=w2000";
  props.setProperty("BANNER_URL", urlAnhTrucTiep);

  return jsonOut({ ok: true, bannerUrl: urlAnhTrucTiep });
}

// ---------- TIỆN ÍCH ----------
function laySheet() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TEN_SHEET);
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
