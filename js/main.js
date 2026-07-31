// ==========================================================
// HÀM DÙNG CHUNG — gọi API Google Apps Script
// ==========================================================

/**
 * Gửi POST tới Apps Script. Dùng Content-Type: text/plain để tránh
 * trình duyệt gửi preflight OPTIONS (Apps Script không tự xử lý OPTIONS).
 */
async function goiApiPost(action, payload) {
  const url = window.APP_CONFIG.API_URL;
  if (!url || url.includes("DÁN_URL")) {
    throw new Error("Chưa cấu hình API_URL trong js/config.js");
  }
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action, ...payload }),
  });
  if (!res.ok) throw new Error("Lỗi máy chủ: " + res.status);
  const data = await res.json();
  if (data.ok === false) throw new Error(data.message || "Có lỗi xảy ra");
  return data;
}

/**
 * Gửi GET tới Apps Script kèm tham số query.
 */
async function goiApiGet(action, params) {
  const url = window.APP_CONFIG.API_URL;
  if (!url || url.includes("DÁN_URL")) {
    throw new Error("Chưa cấu hình API_URL trong js/config.js");
  }
  const qs = new URLSearchParams({ action, ...params }).toString();
  const res = await fetch(`${url}?${qs}`, { method: "GET" });
  if (!res.ok) throw new Error("Lỗi máy chủ: " + res.status);
  const data = await res.json();
  if (data.ok === false) throw new Error(data.message || "Có lỗi xảy ra");
  return data;
}

/** Đọc file thành base64 (dùng để đính kèm giấy tờ) */
function docFileThanhBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result; // data:<mime>;base64,xxxx
      const base64 = result.split(",")[1];
      resolve({ base64, mimeType: file.type, tenFile: file.name });
    };
    reader.onerror = () => reject(new Error("Không đọc được file"));
    reader.readAsDataURL(file);
  });
}

/** Hiện thông báo trong khối .form-msg */
function hienThongBao(el, loai, noiDung) {
  el.className = "form-msg show " + loai;
  el.textContent = noiDung;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
}

function badgeTrangThai(trangThai) {
  const map = {
    "Chờ duyệt": "badge--cho",
    "Đã duyệt": "badge--duyet",
    "Từ chối": "badge--tuchoi",
  };
  const cls = map[trangThai] || "badge--cho";
  return `<span class="badge ${cls}">${trangThai || "Chờ duyệt"}</span>`;
}

/** Áp banner (ảnh nền) vào mọi khối có thuộc tính data-banner-el */
function apDungAnhBanner(url) {
  if (!url) return; // giữ banner mặc định có sẵn trong CSS nếu chưa có banner tuỳ chỉnh
  const lopPhu = "linear-gradient(180deg, rgba(15,61,62,.45) 0%, rgba(11,32,33,.82) 78%, #0B2021 100%)";
  document.querySelectorAll("[data-banner-el]").forEach((el) => {
    el.style.backgroundImage = `${lopPhu}, url('${url}')`;
    el.style.backgroundSize = "cover";
    el.style.backgroundPosition = "center 30%";
    el.style.backgroundRepeat = "no-repeat";
  });
}

async function taiBannerTuyChinh() {
  try {
    const url = window.APP_CONFIG.API_URL;
    if (!url || url.includes("DÁN_URL")) return; // chưa cấu hình API thì bỏ qua, dùng banner mặc định
    const kq = await goiApiGet("layBanner", {});
    if (kq.bannerUrl) apDungAnhBanner(kq.bannerUrl);
  } catch (err) {
    // Im lặng bỏ qua — nếu lỗi thì trang vẫn hiện banner mặc định có sẵn trong CSS
    console.warn("Không tải được banner tuỳ chỉnh:", err.message);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-nam-hoc]").forEach((el) => {
    el.textContent = window.APP_CONFIG.NAM_HOC;
  });
  document.querySelectorAll("[data-ten-truong]").forEach((el) => {
    el.textContent = window.APP_CONFIG.TEN_TRUONG;
  });
  taiBannerTuyChinh();
});
