import React, { useState, useEffect } from "react";
import JSZip from "jszip";
import { Users, FileDiff, CheckCircle, AlertOctagon, Edit, MessageSquare, Clipboard, ExternalLink, Calendar, Search, Plus, Trash2, Check, Bell, Settings, Eye, EyeOff } from "lucide-react";
import { ApplicationStatus, AdmissionApplication, SchoolAnnouncement } from "../types";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { doc, updateDoc, deleteDoc, collection, addDoc, setDoc } from "firebase/firestore";

interface AdminPanelProps {
  allApplications: AdmissionApplication[];
  onUpdateApplication: (updated: AdmissionApplication) => void;
  onDeleteApplication: (id: string) => void;
  isRegistrationOpen?: boolean;
  onToggleRegistration?: (val: boolean) => void;
  enrollmentQuota?: number;
  onUpdateQuota?: (val: number) => void;
  reqAvatar?: "required" | "optional" | "hidden";
  reqBirthCert?: "required" | "optional" | "hidden";
  reqResidenceCert?: "required" | "optional" | "hidden";
  onUpdateReqAvatar?: (val: "required" | "optional" | "hidden") => void;
  onUpdateReqBirthCert?: (val: "required" | "optional" | "hidden") => void;
  onUpdateReqResidenceCert?: (val: "required" | "optional" | "hidden") => void;
  adminPassword?: string;
  onUpdateAdminPassword?: (val: string) => void;
  isSyncConnected?: boolean;
  syncError?: string | null;

  // Customizations
  announcements?: SchoolAnnouncement[];
  onAddAnnouncement?: (val: SchoolAnnouncement) => void;
  onUpdateAnnouncement?: (val: SchoolAnnouncement) => void;
  onDeleteAnnouncement?: (id: string) => void;
  contactHotline?: string;
  onUpdateContactHotline?: (val: string) => void;
  contactEmail?: string;
  onUpdateContactEmail?: (val: string) => void;
  contactAddress?: string;
  onUpdateContactAddress?: (val: string) => void;
  initialSection?: "applications" | "announcements";
  onSectionChange?: (section: "applications" | "announcements") => void;
}

export default function AdminPanel({
  allApplications,
  onUpdateApplication,
  onDeleteApplication,
  isRegistrationOpen = true,
  onToggleRegistration,
  enrollmentQuota = 120,
  onUpdateQuota,
  reqAvatar = "required",
  reqBirthCert = "required",
  reqResidenceCert = "required",
  onUpdateReqAvatar,
  onUpdateReqBirthCert,
  onUpdateReqResidenceCert,
  adminPassword = "buivandat1987@",
  onUpdateAdminPassword,
  isSyncConnected = false,
  syncError = null,

  // Customizations
  announcements = [],
  onAddAnnouncement,
  onUpdateAnnouncement,
  onDeleteAnnouncement,
  contactHotline = "0290.3888.222",
  onUpdateContactHotline,
  contactEmail = "th.rachcheo@phutun.edu.vn",
  onUpdateContactEmail,
  contactAddress = "Ấp Rạch Chèo, Xã Nguyễn Việt Khái, Tỉnh Cà Mau",
  onUpdateContactAddress,
  initialSection = "applications",
  onSectionChange,
}: AdminPanelProps) {
  const [showAdminPwd, setShowAdminPwd] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(
    allApplications.length > 0 ? allApplications[0].id : null
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");

  // Edit action state
  const [notesInput, setNotesInput] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [newPasswordInput, setNewPasswordInput] = useState("");
  const [pwdMsg, setPwdMsg] = useState("");

  // Lightbox preview state
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // ZIP packaging state
  const [isZipping, setIsZipping] = useState(false);
  const [zipProgress, setZipProgress] = useState("");

  const [adminSection, setAdminSection] = useState<"applications" | "announcements">(initialSection);

  // Contact inputs states
  const [hotlineInput, setHotlineInput] = useState(contactHotline);
  const [emailInput, setEmailInput] = useState(contactEmail);
  const [addressInput, setAddressInput] = useState(contactAddress);
  const [contactFormMsg, setContactFormMsg] = useState("");

  // Keep section synchronized if parent updates initialSection
  useEffect(() => {
    if (initialSection) {
      setAdminSection(initialSection);
    }
  }, [initialSection]);

  // Handle section changes
  const handleSectionSwitch = (section: "applications" | "announcements") => {
    setAdminSection(section);
    onSectionChange?.(section);
  };

  // Sync state values with props when they update dynamically (e.g. from localStorage/Firestore)
  useEffect(() => {
    setHotlineInput(contactHotline);
  }, [contactHotline]);

  useEffect(() => {
    setEmailInput(contactEmail);
  }, [contactEmail]);

  useEffect(() => {
    setAddressInput(contactAddress);
  }, [contactAddress]);

  // Announcement form states
  const [editingAnn, setEditingAnn] = useState<Partial<SchoolAnnouncement> | null>(null);
  const [annError, setAnnError] = useState("");
  const [annFormSuccess, setAnnFormSuccess] = useState("");

  const selectedApp = allApplications.find((a) => a.id === selectedId);

  // Statistics calculation
  const total = allApplications.length;
  const pending = allApplications.filter((a) => a.status === ApplicationStatus.PENDING).length;
  const processing = allApplications.filter((a) => a.status === ApplicationStatus.PROCESSING).length;
  const actionRequired = allApplications.filter((a) => a.status === ApplicationStatus.ACTION_REQUIRED).length;
  const accepted = allApplications.filter((a) => a.status === ApplicationStatus.ACCEPTED).length;

  const handleExportAcceptedToExcel = () => {
    const admittedApps = allApplications.filter(a => a.status === ApplicationStatus.ACCEPTED);
    if (admittedApps.length === 0) {
      alert("Hiện tại chưa có học sinh nào được duyệt trạng thái 'Đã tiếp nhận' (trúng tuyển) để xuất danh sách!");
      return;
    }

    // Header row for CSV Excel file with clear labels matching the requested image exactly
    const headers = [
      "STT",
      "Mã hồ sơ",
      "Họ và tên học sinh",
      "Giới tính",
      "Ngày sinh",
      "Nơi sinh",
      "Địa chỉ cư trú",
      "Họ tên cha/mẹ",
      "Số điện thoại",
      "Email liên",
      "Trạng thái tuyển sinh",
      "Xác nhận",
      "Ghi chú cử",
      "Ngày nộp hồ sơ"
    ];

    const rows = admittedApps.map((app, index) => {
      let regDateStr = "";
      if (app.createdAt) {
        try {
          if (app.createdAt.seconds) {
            regDateStr = new Date(app.createdAt.seconds * 1000).toLocaleString("vi-VN");
          } else {
            regDateStr = new Date(app.createdAt).toLocaleString("vi-VN");
          }
        } catch (e) {
          regDateStr = String(app.createdAt);
        }
      }

      return [
        index + 1,
        app.applicationCode,
        app.studentName,
        app.gender,
        app.birthDate,
        app.birthPlace,
        app.address.replace(/[",\n\r]/g, " "),
        app.parentName,
        app.parentPhone,
        app.parentEmail || "",
        app.status,
        app.status === ApplicationStatus.ACCEPTED ? "Đã xác nhận" : "Chưa xác nhận",
        (app.statusNotes || "").replace(/[",\n\r]/g, " "),
        regDateStr
      ];
    });

    // Add BOM (\uFEFF) so Excel opens Vietnamese UTF-8 accents perfectly
    const BOM = "\uFEFF";
    const csvContent = BOM + [headers, ...rows]
      .map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))
      .join("\r\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "DANH_SACH_HOC_SINH_TRUNG_TUYEN_RACH_CHEO_2026.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportAcceptedDocsZip = async () => {
    const admittedApps = allApplications.filter(a => a.status === ApplicationStatus.ACCEPTED);
    if (admittedApps.length === 0) {
      alert("Hiện tại chưa có học sinh nào được duyệt trạng thái 'Đã tiếp nhận' (trúng tuyển) để tải file ảnh nén ZIP!");
      return;
    }

    setIsZipping(true);
    setZipProgress("Đang khởi tạo gói nén ZIP...");

    const zip = new JSZip();
    const mainFolder = zip.folder("HO_SO_TRUNG_TUYEN_RACH_CHEO_2026");

    let processedCount = 0;
    const totalApps = admittedApps.length;

    // Helper to sanitize filenames for safe usage within zip archives
    const cleanFileName = (str: string) => {
      return str
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // remove accents
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D")
        .replace(/[^a-zA-Z0-9_\-\s]/g, "") // remove special characters
        .trim()
        .replace(/\s+/g, "_"); // replace spaces with underscore
    };

    const fetchUrlAsBlobOrBase64 = async (urlStr: string | undefined): Promise<{ data: any; isBase64: boolean; extension: string } | null> => {
      if (!urlStr) return null;

      if (urlStr.startsWith("data:")) {
        // It's a data URL (base64)
        const match = urlStr.match(/^data:([^;]+);base64,(.*)$/);
        if (match) {
          const mimeType = match[1];
          const base64Data = match[2];
          let extension = "png";
          if (mimeType.includes("jpeg") || mimeType.includes("jpg")) extension = "jpg";
          else if (mimeType.includes("gif")) extension = "gif";
          else if (mimeType.includes("pdf")) extension = "pdf";
          else if (mimeType.includes("svg")) extension = "svg";
          return { data: base64Data, isBase64: true, extension };
        }
      }

      // It's a standard URL, let's fetch it with fallback handling
      try {
        const response = await fetch(urlStr, { referrerPolicy: "no-referrer" });
        if (!response.ok) throw new Error("Fetch failed");
        const blobObj = await response.blob();
        
        // Guess extension from MIME type
        const mimeType = blobObj.type;
        let extension = "jpg"; // default
        if (mimeType.includes("png")) extension = "png";
        else if (mimeType.includes("gif")) extension = "gif";
        else if (mimeType.includes("pdf")) extension = "pdf";
        else if (mimeType.includes("svg")) extension = "svg";
        else if (mimeType.includes("jpeg")) extension = "jpg";
        
        return { data: blobObj, isBase64: false, extension };
      } catch (error) {
        console.error(`Error fetching URL: ${urlStr}`, error);
        return null;
      }
    };

    for (const app of admittedApps) {
      processedCount++;
      const studentCleanName = cleanFileName(app.studentName);
      const studentFolder = mainFolder?.folder(`${app.applicationCode}_${studentCleanName}`);
      
      setZipProgress(`Đang tải & nén ảnh ${processedCount}/${totalApps}: ${app.studentName}...`);

      // 1. Avatar Photo (Ảnh chân dung 3x4)
      if (app.avatarUrl && (app.avatarUrl.startsWith("http") || app.avatarUrl.startsWith("data:"))) {
        const res = await fetchUrlAsBlobOrBase64(app.avatarUrl);
        if (res) {
          studentFolder?.file(`1_Anh_Chan_Dung_3x4.${res.extension}`, res.data, { base64: res.isBase64 });
        }
      }

      // 2. Birth Certificate Photo (Giấy khai sinh học sinh)
      if (app.birthCertUrl && (app.birthCertUrl.startsWith("http") || app.birthCertUrl.startsWith("data:"))) {
        const res = await fetchUrlAsBlobOrBase64(app.birthCertUrl);
        if (res) {
          studentFolder?.file(`2_Giay_Khai_Sinh.${res.extension}`, res.data, { base64: res.isBase64 });
        }
      }

      // 3. Residence Certificate / VNeID Photo (Xác nhận cư trú / VNeID)
      if (app.residenceCertUrl && (app.residenceCertUrl.startsWith("http") || app.residenceCertUrl.startsWith("data:"))) {
        const res = await fetchUrlAsBlobOrBase64(app.residenceCertUrl);
        if (res) {
          studentFolder?.file(`3_Xac_Nhan_Cu_Tru_VNeID.${res.extension}`, res.data, { base64: res.isBase64 });
        }
      }
    }

    setZipProgress("Đang hoàn thành nén dữ liệu và tạo file tải về...");

    try {
      const content = await zip.generateAsync({ type: "blob" });
      const downloadUrl = URL.createObjectURL(content);
      const link = document.createElement("a");
      link.setAttribute("href", downloadUrl);
      link.setAttribute("download", "HO_SO_ANH_CHUNG_THUC_TRUNG_TUYEN_RACH_CHEO_2026.zip");
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setZipProgress("🎉 Tải xuống trọn bộ hồ sơ ZIP thành công!");
      setTimeout(() => {
        setIsZipping(false);
        setZipProgress("");
      }, 3000);
    } catch (e) {
      console.error(e);
      alert("Có lỗi xảy ra trong quá trình nén ZIP.");
      setIsZipping(false);
      setZipProgress("");
    }
  };

  const handleUpdateStatus = async (status: ApplicationStatus) => {
    if (!selectedApp) return;
    setIsUpdating(true);

    const updatedPayload = {
      ...selectedApp,
      status,
      statusNotes: notesInput.trim() || `Quyết định cập nhật trạng thái bởi Hội đồng tuyển sinh: ${status}`,
      updatedAt: new Date(),
    };

    const pathString = `applications/${selectedApp.id}`;
    try {
      await updateDoc(doc(db, "applications", selectedApp.id), {
        status,
        statusNotes: notesInput.trim() || `Quyết định cập nhật trạng thái bởi Hội đồng tuyển sinh: ${status}`,
        updatedAt: new Date(),
      });
      onUpdateApplication(updatedPayload);
      setNotesInput("");
    } catch (err) {
      console.warn("Firestore update failure, falling back to sandboxed local state:", err);
      // Fallback: still apply update locally to ensure functional simulation flow
      onUpdateApplication(updatedPayload);
      setNotesInput("");
      try {
        handleFirestoreError(err, OperationType.UPDATE, pathString);
      } catch (logErr) {
        console.error("System error logged:", logErr);
      }
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async (appId: string) => {
    if (!confirm("Quý thầy cô có chắc chắn muốn xoá hồ sơ tuyển sinh này ra khỏi hệ thống của trường? Hành động này không thể hoàn tác.")) return;
    try {
      await deleteDoc(doc(db, "applications", appId));
      onDeleteApplication(appId);
      setSelectedId(allApplications.length > 1 ? allApplications.filter(a => a.id !== appId)[0].id : null);
    } catch (err) {
      console.warn("Firestore delete failure, performing sandboxed local delete:", err);
      onDeleteApplication(appId);
      setSelectedId(allApplications.length > 1 ? allApplications.filter(a => a.id !== appId)[0].id : null);
      try {
        handleFirestoreError(err, OperationType.DELETE, `applications/${appId}`);
      } catch (logErr) {
        console.error("System error logged:", logErr);
      }
    }
  };

  // Filter & Search logic
  const filteredApps = allApplications.filter((app) => {
    const matchesSearch =
      app.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.parentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.parentPhone.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.applicationCode.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "All" || app.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6" id="admin-dashboard-panel">
      {/* Tab Controller inside AdminPanel */}
      <div className="flex border-b border-slate-100 bg-slate-50/50 p-1.5 rounded-xl gap-1">
        <button
          type="button"
          onClick={() => handleSectionSwitch("applications")}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${
            adminSection === "applications"
              ? "bg-teal-600 text-white shadow-xs"
              : "text-slate-500 hover:text-slate-800 hover:bg-slate-100/60"
          }`}
        >
          <Users className="w-4 h-4" />
          Duyệt Hồ Sơ Tuyển Sinh
        </button>
        <button
          type="button"
          onClick={() => handleSectionSwitch("announcements")}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${
            adminSection === "announcements"
              ? "bg-amber-500 text-white shadow-xs"
              : "text-slate-500 hover:text-slate-800 hover:bg-slate-100/60"
          }`}
        >
          <Calendar className="w-4 h-4" />
          Bảng tin, Hướng dẫn & Liên hệ
        </button>
      </div>

      {adminSection === "announcements" ? (
        /* CUSTOMIZE ANNOUNCEMENTS & SCHOOL DETAILS VIEW */
        <div className="space-y-6" id="announcements-management-panel">
          {/* ADMISSIONS CONTACT SETTINGS CARD */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-2xs space-y-4">
            <div className="flex items-center gap-2 text-slate-700">
              <Settings className="w-5 h-5 text-amber-500" />
              <h3 className="text-xs font-bold uppercase tracking-wider">Cấu hình thông tin liên hệ tuyển sinh</h3>
            </div>
            <p className="text-[11px] text-slate-400 font-sans">
              Thông tin bên dưới hiển thị trực tiếp ở chân trang (Footer), đầu trang (Header) và thư mục chỉ dẫn tuyển sinh liên lạc của phụ huynh. Thay đổi theo từng năm học tương ứng.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 block uppercase">📞 Hotline Tuyển sinh</label>
                <input
                  type="text"
                  value={hotlineInput}
                  onChange={(e) => setHotlineInput(e.target.value)}
                  className="w-full text-xs font-semibold border border-slate-200 focus:border-amber-500 rounded-xl px-3 py-2 bg-white outline-none font-mono font-bold"
                  placeholder="Ví dụ: 0290.3888.222"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 block uppercase">✉️ Email liên hệ</label>
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="w-full text-xs font-semibold border border-slate-200 focus:border-amber-500 rounded-xl px-3 py-2 bg-white outline-none"
                  placeholder="Ví dụ: th.rachcheo@phutun.edu.vn"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 block uppercase">📍 Địa chỉ trường</label>
                <input
                  type="text"
                  value={addressInput}
                  onChange={(e) => setAddressInput(e.target.value)}
                  className="w-full text-xs font-semibold border border-slate-200 focus:border-amber-500 rounded-xl px-3 py-2 bg-white outline-none"
                  placeholder="Ví dụ: Ấp Rạch Chèo, Xã Nguyễn Việt Khái, Tỉnh Cà Mau"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 pt-1 flex-wrap sm:flex-nowrap">
              {contactFormMsg ? (
                <span className="text-[10px] font-bold text-emerald-700 font-sans">{contactFormMsg}</span>
              ) : (
                <span className="text-[10px] text-slate-400 font-sans">Nhấn lưu để đồng bộ thông tin tuyển sinh mới của năm lên hệ thống.</span>
              )}
              <button
                type="button"
                onClick={() => {
                  try {
                    const trimmedHotline = hotlineInput.trim();
                    const trimmedEmail = emailInput.trim();
                    const trimmedAddress = addressInput.trim();

                    if (!trimmedHotline || !trimmedEmail || !trimmedAddress) {
                      setContactFormMsg("❌ Không được để trống bất kỳ trường thông tin liên hệ nào.");
                      setTimeout(() => setContactFormMsg(""), 4000);
                      return;
                    }

                    onUpdateContactHotline?.(trimmedHotline);
                    onUpdateContactEmail?.(trimmedEmail);
                    onUpdateContactAddress?.(trimmedAddress);

                    setContactFormMsg("✅ Đã cập nhật thông tin liên hệ tuyển sinh thành công!");
                    setTimeout(() => setContactFormMsg(""), 5050);
                  } catch (err) {
                    setContactFormMsg("❌ Có lỗi xảy ra trong quá trình lưu.");
                  }
                }}
                className="bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white text-xs font-bold py-2 px-4 rounded-xl cursor-pointer shadow-3xs transition-colors shrink-0"
              >
                Cập nhật thông tin liên hệ
              </button>
            </div>
          </div>

          {/* ANNOUNCEMENT BOARD BUILDER CRUD LIST */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between gap-4 border-b border-slate-50 pb-3 flex-wrap sm:flex-nowrap">
              <div className="space-y-1">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5 font-sans">
                  <Bell className="w-4 h-4 text-amber-500" />
                  Quản lý Bảng tin, Hướng dẫn & Lịch tuyển sinh niên khóa mới
                </h3>
                <p className="text-[10px] text-slate-400 font-sans">
                  Thay đổi, ghim thông báo quan trọng, cập nhật ngày phát hành hoặc đăng chỉ thị hướng dẫn trực tiếp lớp 1.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingAnn({
                    id: "ann-" + Date.now(),
                    title: "",
                    content: "",
                    category: "Thông báo",
                    publishedAt: new Date().toISOString().split("T")[0],
                    important: false
                  });
                  setAnnError("");
                  setAnnFormSuccess("");
                }}
                className="bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white text-xs font-bold py-2 px-3.5 rounded-xl cursor-pointer flex items-center gap-1.5 shadow-3xs transition-colors shrink-0"
              >
                <Plus className="w-3.5 h-3.5" /> Thêm thông báo mới
              </button>
            </div>

            {/* CREATING OR EDITING FORM INLINE */}
            {editingAnn && (
              <div className="bg-slate-55 bg-slate-50/70 border border-teal-200/60 p-5 rounded-2xl space-y-4 animate-fade-in">
                <h4 className="text-xs font-bold text-teal-800 uppercase tracking-wide border-b border-teal-100 pb-2">
                  {announcements.some(a => a.id === editingAnn.id) ? "📝 Chỉnh sửa thông báo" : "✨ Tạo thông báo tuyển sinh mới"}
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1 font-sans">
                    <label className="text-[10px] font-bold text-slate-500 block uppercase">Tiêu đề thông báo</label>
                    <input
                      type="text"
                      value={editingAnn.title || ""}
                      onChange={(e) => setEditingAnn({ ...editingAnn, title: e.target.value })}
                      className="w-full text-xs border border-slate-200 focus:border-teal-500 rounded-xl px-3 py-2 bg-white outline-none"
                      placeholder="Kế hoạch tuyển sinh tiểu học 2026-2027..."
                    />
                  </div>

                  <div className="space-y-1 font-sans">
                    <label className="text-[10px] font-bold text-slate-500 block uppercase">Chuyên mục</label>
                    <select
                      value={editingAnn.category || "Thông báo"}
                      onChange={(e) => setEditingAnn({ ...editingAnn, category: e.target.value as any })}
                      className="w-full text-xs border border-slate-200 focus:border-teal-500 rounded-xl p-2 bg-white outline-none cursor-pointer text-slate-700 font-semibold"
                    >
                      <option value="Thông báo">Thông báo</option>
                      <option value="Hướng dẫn">Hướng dẫn</option>
                      <option value="Lịch tuyển sinh">Lịch tuyển sinh</option>
                    </select>
                  </div>

                  <div className="space-y-1 font-sans">
                    <label className="text-[10px] font-bold text-slate-500 block uppercase">Ngày phát hành</label>
                    <input
                      type="date"
                      value={editingAnn.publishedAt || ""}
                      onChange={(e) => setEditingAnn({ ...editingAnn, publishedAt: e.target.value })}
                      className="w-full text-xs border border-slate-200 focus:border-teal-500 rounded-xl px-3 py-2 bg-white outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Nội dung văn bản thông báo</label>
                    <span className="text-[9px] text-slate-400 font-sans">Có thể chép văn bản dòng có ngắt hàng. Sau đó lưu sẽ hiển thị đúng chuẩn.</span>
                  </div>
                  <textarea
                    value={editingAnn.content || ""}
                    onChange={(e) => setEditingAnn({ ...editingAnn, content: e.target.value })}
                    className="w-full text-xs border border-slate-200 focus:border-teal-500 rounded-xl p-3 outline-none h-32 bg-white font-sans whitespace-pre-line leading-relaxed"
                    placeholder="Nhập nội dung thông báo tuyển sinh chi tiết..."
                  />
                </div>

                <div className="flex items-center justify-between pt-1 select-none flex-wrap gap-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="important-ann-toggle"
                      checked={editingAnn.important || false}
                      onChange={(e) => setEditingAnn({ ...editingAnn, important: e.target.checked })}
                      className="w-4 h-4 text-teal-650 text-teal-600 border-slate-200 rounded focus:ring-teal-500 cursor-pointer"
                    />
                    <label htmlFor="important-ann-toggle" className="text-[10px] font-bold text-slate-600 uppercase block cursor-pointer">
                      📌 Ghim lên đầu bảng tin (Quan trọng)
                    </label>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingAnn(null);
                        setAnnError("");
                        setAnnFormSuccess("");
                      }}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold py-2 px-3.5 rounded-xl cursor-pointer transition-colors"
                    >
                      Hủy bỏ
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const title = editingAnn.title?.trim();
                          const content = editingAnn.content?.trim();
                          const category = editingAnn.category;
                          const publishedAt = editingAnn.publishedAt || new Date().toISOString().split("T")[0];
                          const important = !!editingAnn.important;

                          if (!title) {
                            setAnnError("❌ Tiêu đề thông báo không được để trống.");
                            return;
                          }
                          if (!content) {
                            setAnnError("❌ Nội dung thông báo không được để trống.");
                            return;
                          }

                          const resultDoc: SchoolAnnouncement = {
                            id: editingAnn.id || "ann-" + Date.now(),
                            title,
                            content,
                            category: category || "Thông báo",
                            publishedAt,
                            important
                          };

                          // Write to firestore (with error handling and feedback)
                          try {
                            const docRef = doc(db, "announcements", resultDoc.id);
                            await setDoc(docRef, resultDoc);
                          } catch (fsErr: any) {
                            console.error("Firestore update announcements failed:", fsErr);
                            setAnnError("❌ Lỗi lưu dữ liệu lên hệ thống (Firestore): " + (fsErr?.message || String(fsErr)));
                            return;
                          }

                          const isNew = !announcements.some(a => a.id === resultDoc.id);
                          if (isNew) {
                            onAddAnnouncement?.(resultDoc);
                            setAnnFormSuccess("✅ Đăng tải thông báo mới thành công!");
                          } else {
                            onUpdateAnnouncement?.(resultDoc);
                            setAnnFormSuccess("✅ Đã cập nhật văn bản thông báo thành công!");
                          }

                          setTimeout(() => {
                            setEditingAnn(null);
                            setAnnError("");
                            setAnnFormSuccess("");
                          }, 1500);

                        } catch (err) {
                          setAnnError("❌ Lỗi: " + String(err));
                        }
                      }}
                      className="bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white text-xs font-bold py-2 px-4 rounded-xl cursor-pointer flex items-center gap-1 shadow-3xs transition-all"
                    >
                      💾 Đăng / Lưu lại
                    </button>
                  </div>
                </div>

                {annError && <p className="text-[10px] font-bold text-rose-700 font-sans mt-1">{annError}</p>}
                {annFormSuccess && <p className="text-[10px] font-bold text-emerald-700 font-sans mt-1">{annFormSuccess}</p>}
              </div>
            )}

            {/* TABLE LIST OF ANNOUNCEMENTS */}
            <div className="border border-slate-100 rounded-xl overflow-hidden bg-slate-50/10">
              <div className="grid grid-cols-12 bg-slate-100/60 p-3 font-sans text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-150">
                <div className="col-span-2">Chuyên mục</div>
                <div className="col-span-5">Tiêu đề bản tin / thông báo</div>
                <div className="col-span-2 text-center">Ngày đăng</div>
                <div className="col-span-1 text-center">Ghim</div>
                <div className="col-span-2 text-right">Lựa chọn</div>
              </div>

              {announcements.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-8 font-sans">Chưa có thông báo nào được tạo trên trường.</p>
              ) : (
                announcements.map((ann) => (
                  <div key={ann.id} className="grid grid-cols-12 p-3 border-b border-slate-100 items-center bg-white hover:bg-slate-50/30 text-xs font-sans text-slate-700 transition-colors">
                    <div className="col-span-2">
                      <span className="text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-100 p-1 px-1.5 rounded">
                        {ann.category}
                      </span>
                    </div>
                    <div className="col-span-5 min-w-0 pr-4">
                      <span className="font-semibold block text-slate-850 truncate" title={ann.title}>{ann.title}</span>
                      <span className="text-[10px] text-slate-400 block truncate font-sans">{ann.content}</span>
                    </div>
                    <div className="col-span-2 text-center text-[11px] font-mono text-slate-500">
                      {new Date(ann.publishedAt).toLocaleDateString("vi-VN")}
                    </div>
                    <div className="col-span-1 text-center">
                      {ann.important ? (
                        <span className="text-rose-600 font-bold font-mono">📌</span>
                      ) : (
                        <span className="text-slate-300 font-mono">—</span>
                      )}
                    </div>
                    <div className="col-span-2 text-right flex items-center justify-end gap-2 text-[10px] font-bold">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingAnn(ann);
                          setAnnError("");
                          setAnnFormSuccess("");
                        }}
                        className="text-teal-700 hover:text-teal-900 bg-teal-50 border border-teal-100 p-1 px-2 rounded cursor-pointer transition-colors"
                      >
                        Sửa
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!confirm(`Quý thầy cô thực sự muốn xoá vĩnh viễn tin "${ann.title}"?`)) return;
                          try {
                            await deleteDoc(doc(db, "announcements", ann.id));
                            onDeleteAnnouncement?.(ann.id);
                          } catch (fsErr: any) {
                            console.error("Firestore delete failed:", fsErr);
                            alert("❌ Lỗi khi xóa từ hệ thống: " + (fsErr?.message || String(fsErr)));
                          }
                        }}
                        className="text-rose-700 hover:text-rose-900 bg-rose-50 border border-rose-100 p-1 px-2 rounded cursor-pointer transition-colors"
                      >
                        Xóa
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* PORTAL TOGGLE GATE & QUOTA SETTINGS */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-2xs space-y-4">
            {/* Cloud Sync Diagnostic Indicator */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100/70 text-[10px] text-slate-500 font-sans">
              <div className="flex items-center gap-1.5">
                <Settings className="w-3.5 h-3.5 text-slate-400 rotate-180 transition-transform duration-700 animate-spin" style={{ animationDuration: '3s' }} />
                <span>Trạng thái kết nối đồng bộ đám mây (Cloud Sync Monitor):</span>
              </div>
              {isSyncConnected ? (
                <span className="inline-flex items-center gap-1.5 font-bold text-emerald-700 bg-emerald-50 border border-emerald-100/60 px-2.5 py-0.5 rounded-full select-none animate-fade-in">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Đang đồng bộ trực tuyến với Firestore Cloud
                </span>
              ) : syncError ? (
                <span className="inline-flex items-center gap-1.5 font-bold text-rose-700 bg-rose-50 border border-rose-100/60 px-2.5 py-0.5 rounded-full select-none break-all animate-fade-in" title={syncError}>
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                  Mất kết nối: {syncError.length > 40 ? syncError.slice(0, 40) + "..." : syncError}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 font-bold text-amber-700 bg-amber-50 border border-amber-100/60 px-2.5 py-0.5 rounded-full select-none animate-fade-in">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-bounce"></span>
                  Đang kiểm tra kết nối cơ sở dữ liệu...
                </span>
              )}
            </div>

            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${isRegistrationOpen ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`}></span>
              Vành đai kiểm soát thời gian đăng ký trực tuyến (Dành cho Hội đồng)
            </h3>
            <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
              {isRegistrationOpen 
                ? "Cổng đăng ký của trường hiện đang **MỞ**. Phụ huynh học sinh có thể điền tờ khai và tải tài liệu tuyển sinh lớp 1 bình thường." 
                : "Cổng đăng ký hiện đang **TẠM KHÓA**. Hệ thống sẽ hiển thị thông báo tạm dừng thu nhận hồ sơ trực tuyến đối với phụ huynh."}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onToggleRegistration?.(true)}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all border cursor-pointer ${
                isRegistrationOpen 
                  ? "bg-teal-600 border-teal-500 text-white shadow-xs" 
                  : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
              }`}
            >
              🟢 Mở đăng ký
            </button>
            <button
              type="button"
              onClick={() => onToggleRegistration?.(false)}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all border cursor-pointer ${
                !isRegistrationOpen 
                  ? "bg-rose-600 border-rose-500 text-white shadow-xs" 
                  : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
              }`}
            >
              🔴 Khóa đăng ký
            </button>
          </div>
        </div>

        <div className="h-px bg-slate-100 w-full"></div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
          <div className="space-y-1">
            <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">Cấu hình chỉ tiêu tuyển sinh (Học sinh)</h4>
            <p className="text-[10px] text-slate-400 font-sans">Quý thầy cô cập nhật tổng số chỉ tiêu tiếp nhận vào khối 1 cho năm học 2026-2027.</p>
          </div>
          <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-auto">
            <input
              type="number"
              min="1"
              max="999"
              value={enrollmentQuota}
              onChange={(e) => onUpdateQuota?.(Math.max(1, parseInt(e.target.value) || 100))}
              className="w-24 text-xs font-bold text-center border border-slate-200 focus:border-teal-500 rounded-xl px-2.5 py-1.5 bg-white outline-none font-mono"
            />
            <span className="text-[11px] font-bold text-slate-500 font-sans">Học sinh</span>
          </div>
        </div>

        <div className="h-px bg-slate-100 w-full"></div>

        <div className="space-y-3.5">
          <div className="space-y-1">
            <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">Tùy biến tài liệu đính kèm yêu cầu (Hồ sơ số hóa)</h4>
            <p className="text-[10px] text-slate-400 font-sans">
              Chọn mức độ yêu cầu cho từng loại chứng từ đính kèm. Hệ thống sẽ thay đổi tờ khai và điều kiện đăng ký của phụ huynh theo thời gian thực.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {/* Birth Cert Config */}
            <div className="bg-slate-50 border border-slate-100 p-3.5 rounded-xl flex flex-col justify-between gap-2.5">
              <div>
                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">📑 Giấy khai sinh học sinh</span>
                <p className="text-[9px] text-slate-400 mt-0.5 leading-relaxed font-sans">Ảnh chụp hoặc bản quét sao khai sinh gốc của học sinh.</p>
              </div>
              <select
                value={reqBirthCert}
                onChange={(e) => onUpdateReqBirthCert?.(e.target.value as "required" | "optional" | "hidden")}
                className="w-full text-xs font-semibold bg-white border border-slate-200 hover:border-teal-500 rounded-lg p-2 outline-none cursor-pointer text-slate-700"
              >
                <option value="required">🔴 Bắt buộc nộp</option>
                <option value="optional">🟡 Tùy chọn (Không bắt buộc)</option>
                <option value="hidden">⚪ Không yêu cầu (Ẩn đi)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="h-px bg-slate-100 w-full animate-fade-in"></div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-amber-500/5 p-4 rounded-xl border border-amber-500/10 hover:border-amber-500/20 transition-all">
          <div className="space-y-1">
            <h4 className="text-[11px] font-bold text-amber-900 uppercase tracking-wide flex items-center gap-1.5">
              <span>🔐 Thay đổi mật khẩu Quản trị (mật khẩu truy cập hệ thống)</span>
            </h4>
            <p className="text-[10px] text-slate-500 font-sans leading-relaxed flex items-center gap-2">
              <span>Mật khẩu truy cập ban quản trị hiện tại là:</span>
              <span className="font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200 p-0.5 px-2 rounded-md">
                {showAdminPwd ? adminPassword : "••••••••"}
              </span>
              <button
                type="button"
                onClick={() => setShowAdminPwd(!showAdminPwd)}
                className="p-1 hover:bg-amber-100 rounded text-slate-500 hover:text-slate-700 cursor-pointer"
                title={showAdminPwd ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              >
                {showAdminPwd ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </p>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            <input
              type="text"
              placeholder="Mật khẩu mới..."
              value={newPasswordInput}
              onChange={(e) => setNewPasswordInput(e.target.value)}
              className="w-40 text-xs font-semibold border border-slate-200 focus:border-amber-500 rounded-xl px-2.5 py-1.5 bg-white outline-none"
            />
            <button
              type="button"
              onClick={() => {
                const trimmed = newPasswordInput.trim();
                if (!trimmed) {
                  setPwdMsg("❌ Vui lòng nhập mật khẩu hợp lệ.");
                  return;
                }
                if (trimmed.length < 4) {
                  setPwdMsg("❌ Mật khẩu quá ngắn (Yêu cầu ít nhất 4 ký tự).");
                  return;
                }
                onUpdateAdminPassword?.(trimmed);
                setNewPasswordInput("");
                setPwdMsg("✅ Đã đổi mật khẩu hành chính quản trị viên thành công!");
                setTimeout(() => setPwdMsg(""), 5000);
              }}
              className="bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white text-xs font-bold py-1.5 px-3.5 rounded-lg cursor-pointer shadow-xs transition-colors"
            >
              Cập nhật
            </button>
          </div>
        </div>
        {pwdMsg && (
          <p className="text-[10px] font-semibold text-amber-800 font-sans mt-1 bg-amber-50 border border-amber-100 p-2 rounded-lg animate-fade-in">{pwdMsg}</p>
        )}
      </div>

      {/* ZIP PACKAGING PROGRESS BANNER */}
      {isZipping && (
        <div className="mb-4 bg-teal-50 border border-teal-200 text-teal-900 px-4 py-3 rounded-2xl flex items-center justify-between gap-4 animate-fade-in shadow-3xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-4 h-4 border-2 border-teal-600 border-t-transparent rounded-full animate-spin shrink-0"></div>
            <p className="text-xs font-semibold truncate font-sans">{zipProgress}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setIsZipping(false);
              setZipProgress("");
            }}
            className="text-[10px] font-bold text-teal-700 hover:text-teal-950 uppercase shrink-0 px-2 py-1 bg-teal-100 rounded-md cursor-pointer transition-colors"
          >
            Hủy tải
          </button>
        </div>
      )}

      {/* STATS BENTO ROW */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-2xs">
          <div className="flex items-center gap-2 mb-2 text-slate-400">
            <Users className="w-4 h-4 text-teal-600" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Tổng Hồ Sơ</span>
          </div>
          <p className="text-xl font-bold text-slate-800">{total}</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-2xs">
          <div className="flex items-center gap-2 mb-2 text-slate-400">
            <Clipboard className="w-4 h-4 text-amber-500" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Chờ Duyệt</span>
          </div>
          <p className="text-xl font-bold text-amber-600">{pending}</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-2xs">
          <div className="flex items-center gap-2 mb-2 text-slate-400">
            <FileDiff className="w-4 h-4 text-blue-500" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Đang Xử Lý</span>
          </div>
          <p className="text-xl font-bold text-blue-600">{processing}</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-2xs">
          <div className="flex items-center gap-2 mb-2 text-slate-400">
            <AlertOctagon className="w-4 h-4 text-rose-500" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Cần Sửa Đổi</span>
          </div>
          <p className="text-xl font-bold text-rose-600">{actionRequired}</p>
        </div>

        <div className="col-span-2 md:col-span-1 bg-white rounded-xl border border-slate-100 p-4 shadow-2xs flex flex-col justify-between font-sans">
          <div>
            <div className="flex items-center gap-2 mb-2 text-slate-400">
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Đã Trúng Tuyển</span>
            </div>
            <p className="text-xl font-bold text-emerald-600">{accepted}</p>
          </div>
          {accepted > 0 && (
            <div className="mt-2 space-y-1.5">
              <button
                type="button"
                onClick={handleExportAcceptedToExcel}
                className="w-full text-[9px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100/80 p-1.5 rounded-lg border border-emerald-100 transition-all flex items-center justify-center gap-1 cursor-pointer"
                title="Xuất file danh sách trúng tuyển Excel (.csv)"
              >
                📥 Xuất file Excel
              </button>
              <button
                type="button"
                disabled={isZipping}
                onClick={handleExportAcceptedDocsZip}
                className={`w-full text-[9px] font-bold p-1.5 rounded-lg border transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  isZipping
                    ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                    : "text-blue-700 hover:text-blue-800 bg-blue-50 hover:bg-blue-100/80 border-blue-100"
                }`}
                title="Tải ảnh khai sinh, chân dung, cư trú đóng gói ZIP"
              >
                🗂️ Tải hồ sơ ảnh (ZIP)
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* APP LIST WITH SEARCH AND FILTERS */}
        <div className="lg:col-span-1 bg-white border border-slate-100 rounded-2xl p-5 shadow-xs flex flex-col h-[580px]">
          <div className="flex items-center justify-between mb-3 gap-2 border-b border-slate-50 pb-2 flex-wrap sm:flex-nowrap">
            <h3 className="font-bold text-xs uppercase text-slate-500 tracking-wider">Danh sách ứng viên</h3>
            {accepted > 0 && (
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={handleExportAcceptedToExcel}
                  className="text-[9px] bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold px-2 py-1 rounded-lg flex items-center gap-0.5 cursor-pointer transition-colors shadow-3xs"
                  title="Xuất danh sách trúng tuyển ra Excel (.csv)"
                >
                  📥 Excel
                </button>
                <button
                  type="button"
                  disabled={isZipping}
                  onClick={handleExportAcceptedDocsZip}
                  className="text-[9px] bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-slate-300 text-white font-bold px-2 py-1 rounded-lg flex items-center gap-0.5 cursor-pointer transition-colors shadow-3xs"
                  title="Tải nén trọn bộ hồ sơ ảnh (ZIP)"
                >
                  🗂️ ZIP Ảnh
                </button>
              </div>
            )}
          </div>

          {/* Search bar & Filter bar */}
          <div className="space-y-2 mb-4">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Tìm tên bé, tên cha mẹ, mã..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs border border-slate-200 focus:border-teal-500 rounded-xl pl-9 pr-3 py-2 outline-none font-sans"
              />
            </div>

            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {["All", "Chờ duyệt", "Đang xử lý", "Yêu cầu bổ sung", "Đã tiếp nhận"].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`text-[10px] font-medium px-2 py-1 rounded-md border shrink-0 cursor-pointer ${
                    statusFilter === st
                      ? "bg-teal-600 border-teal-600 text-white"
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {st === "All" ? "Tất cả" : st}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {filteredApps.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-10">Không tìm thấy hồ sơ phù hợp.</p>
            ) : (
              filteredApps.map((app) => (
                <button
                  key={app.id}
                  onClick={() => {
                    setSelectedId(app.id);
                    setNotesInput("");
                  }}
                  className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer flex gap-3 ${
                    app.id === selectedId
                      ? "bg-teal-50/50 border-teal-300 shadow-sm"
                      : "bg-white border-slate-100 hover:bg-slate-50"
                  }`}
                >
                  <div className="w-10 h-10 bg-teal-50 border border-teal-150 rounded-lg shrink-0 flex items-center justify-center font-bold text-teal-800">
                    {app.studentName.split(" ").pop()?.[0] || app.studentName[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-bold text-xs text-slate-800 block truncate">{app.studentName}</span>
                      <span className="text-[9px] font-mono text-teal-600 uppercase shrink-0 font-bold">{app.applicationCode}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 truncate mb-1">PH: {app.parentName} - {app.parentPhone}</p>
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] text-slate-400">Sinh: {new Date(app.birthDate).getFullYear()}</span>
                      <span className="text-[9px] font-medium bg-slate-100 text-slate-600 border border-slate-200 px-1.5 py-0.5 rounded">
                        {app.status}
                      </span>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* WORKSTATION REVIEW DETAIL */}
        <div className="lg:col-span-2">
          {selectedApp ? (
            <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-xs h-[580px] overflow-y-auto space-y-6">
              {/* Header profile */}
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-slate-100 pb-4 gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-teal-50 border border-teal-150 rounded-xl shrink-0 flex items-center justify-center font-bold text-teal-800 text-xl">
                    {selectedApp.studentName.split(" ").pop()?.[0] || selectedApp.studentName[0]}
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-sm text-slate-800">{selectedApp.studentName}</h3>
                      <span className="bg-teal-50 border border-teal-100 text-teal-800 text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded">
                        {selectedApp.applicationCode}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1 font-sans flex items-center gap-1">
                      <Calendar className="w-3.5" />
                      Ngày sinh: <span className="font-semibold text-slate-600">{selectedApp.birthDate}</span> • Nơi sinh: <span className="font-semibold text-slate-600">{selectedApp.birthPlace}</span>
                    </p>
                  </div>
                </div>

                <div className="flex gap-1.5">
                  <button
                    onClick={() => handleDelete(selectedApp.id)}
                    className="bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-sans font-medium px-3 py-2 rounded-lg cursor-pointer border border-rose-100 transition-colors"
                  >
                    Xoá hồ sơ
                  </button>
                </div>
              </div>

              {/* Information bodygrid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100/60 workspace-box-info">
                  <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Thông tin học sinh</h4>
                  <ul className="text-xs font-sans space-y-1.5 text-slate-700">
                    <li>Giới tính: <span className="font-semibold">{selectedApp.gender}</span></li>
                    <li>Nơi sinh: <span className="font-semibold">{selectedApp.birthPlace}</span></li>
                    <li className="line-clamp-2">Địa chỉ: <span className="font-semibold">{selectedApp.address}</span></li>
                  </ul>
                </div>

                <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100/60 workspace-box-info">
                  <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Thông tin phụ huynh liên lạc</h4>
                  <ul className="text-xs font-sans space-y-1.5 text-slate-700">
                    <li>Họ tên người đỡ đầu: <span className="font-semibold text-slate-800">{selectedApp.parentName}</span></li>
                    <li>SĐT: <span className="font-semibold text-teal-800 underline">{selectedApp.parentPhone}</span></li>
                    {selectedApp.parentEmail && (
                      <li>Email: <span className="font-semibold text-slate-600 block truncate">{selectedApp.parentEmail}</span></li>
                    )}
                  </ul>
                </div>
              </div>

              {/* ATTACHMENT DIGITAL SCAN REVIEW */}
              <div className="bg-slate-50/50 border border-slate-150 rounded-xl p-4 space-y-2">
                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Hạ tầng tài liệu đính kèm kèm VNeID</h4>
                <div className="max-w-xs mx-auto">
                  {reqBirthCert !== "hidden" ? (
                    <div className="bg-white border border-slate-200 p-2.5 rounded-lg text-center flex flex-col items-center justify-between min-h-[150px]">
                      <span className="text-[10px] font-bold text-slate-500">Khai sinh học sinh</span>
                      {selectedApp.birthCertUrl && (selectedApp.birthCertUrl.startsWith("data:") || selectedApp.birthCertUrl.startsWith("http")) ? (
                        <div
                          onClick={() => setLightboxUrl(selectedApp.birthCertUrl)}
                          className="w-full h-24 bg-slate-50 hover:bg-slate-100 rounded border border-slate-100 mt-2 cursor-zoom-in relative group overflow-hidden"
                        >
                          <img src={selectedApp.birthCertUrl} alt="" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[9px] font-sans">Chi tiết</div>
                        </div>
                      ) : (
                        <div className="w-full h-24 bg-slate-100/55 rounded border border-dashed border-slate-200 mt-2 flex items-center justify-center text-slate-400 text-[9px] p-2 leading-tight">
                          Chưa nộp<br />({reqBirthCert === "required" ? "Bắt buộc" : "Tùy chọn"})
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="py-4 text-center text-slate-400 text-xs font-sans">
                      Hội đồng không yêu cầu hồ sơ đính kèm số hóa trong năm học này.
                    </div>
                  )}
                </div>
              </div>

              {/* AUDIT WORKSPACE ACTIONS */}
              <div className="bg-emerald-50/15 border border-teal-600/10 rounded-2xl p-4.5 space-y-4">
                <h4 className="text-[11px] font-bold text-teal-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Edit className="w-4" /> Bảng phê duyệt của hội đồng tuyển sinh
                </h4>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 block">Ý kiến phê duyệt hoặc Lý do yêu cầu sửa đổi bổ sung của hội đồng:</label>
                  <textarea
                    placeholder="Ví dụ: Giấy khai sinh bị mờ số định danh cá nhân, yêu cầu phụ huynh chụp bổ sung trước ngày 15/07..."
                    value={notesInput}
                    onChange={(e) => setNotesInput(e.target.value)}
                    className="w-full text-xs border border-slate-250 focus:border-teal-500 rounded-xl p-3 outline-none h-20 bg-white shadow-xs resize-none font-sans"
                  />
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
                  <div className="flex items-center gap-1 text-[11px] text-slate-400 font-sans">
                    <MessageSquare className="w-3.5" /> Ghi chú hiện tại: <span className="italic text-slate-600 line-clamp-1 max-w-[200px]">{selectedApp.statusNotes || "Chưa có phản hồi"}</span>
                  </div>

                  <div className="flex flex-wrap gap-2 justify-end w-full sm:w-auto">
                    <button
                      onClick={() => handleUpdateStatus(ApplicationStatus.ACTION_REQUIRED)}
                      disabled={isUpdating}
                      className="bg-rose-500 hover:bg-rose-600 text-white text-[11px] font-bold px-3 py-2 rounded-lg cursor-pointer transition-colors disabled:opacity-55"
                    >
                      Yêu Cầu Bổ Sung
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(ApplicationStatus.PROCESSING)}
                      disabled={isUpdating}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold px-3 py-2 rounded-lg cursor-pointer transition-colors disabled:opacity-55"
                    >
                      Thẩm Định Đơn
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(ApplicationStatus.ACCEPTED)}
                      disabled={isUpdating}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold px-4 py-2 rounded-lg cursor-pointer transition-colors disabled:opacity-55 flex items-center gap-1.5"
                    >
                      Tiếp Nhập Nhập Học • Đạt!
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-slate-100 rounded-2xl p-8 text-center shadow-xs text-slate-400 h-[580px] flex flex-col items-center justify-center">
              <Users className="w-12 h-12 mx-auto text-slate-200 mb-2" />
              <p className="text-xs font-sans">Hệ thống chưa ghi nhận bất kỳ hồ sơ tuyển sinh trực tuyến nào. Chuyển sang **Đăng ký tuyển sinh** để bắt đầu nộp hồ sơ.</p>
            </div>
          )}
        </div>
      </div>
      {/* STANDARD APP REVIEW BLOCK END */}
        </>
      )}

      {/* LIGHTBOX FLOATING POPUP */}
      {lightboxUrl && (
        <div
          onClick={() => setLightboxUrl(null)}
          className="fixed inset-0 bg-slate-900/80 z-50 flex items-center justify-center p-6 backdrop-blur-xs animate-fade-in cursor-zoom-out"
        >
          <div className="max-w-3xl max-h-[85vh] relative bg-white border border-white rounded-xl overflow-hidden p-1 shadow-2xl">
            <img src={lightboxUrl} alt="Phóng to" className="max-w-full max-h-[80vh] object-contain" />
          </div>
        </div>
      )}
    </div>
  );
}
