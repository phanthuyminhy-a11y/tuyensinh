import React, { useState, useEffect } from "react";
import { School, Bell, Eye, EyeOff, Lock, Calendar, BookOpen, Clock, AlertCircle, FileText, Bot, HelpCircle, Check, Users, Settings, UserCheck } from "lucide-react";
import { ApplicationStatus, AdmissionApplication, SchoolAnnouncement } from "./types";
import { defaultAnnouncements } from "./data/defaultAnnouncements";
import { db, auth, handleFirestoreError, OperationType } from "./firebase";
import { signInAnonymously, onAuthStateChanged, signOut, User as FirebaseUser } from "firebase/auth";
import { collection, onSnapshot, query, getDocs } from "firebase/firestore";

import ApplicationForm from "./components/ApplicationForm";
import ApplicationTracker from "./components/ApplicationTracker";
import AdminPanel from "./components/AdminPanel";
import AIAssistant from "./components/AIAssistant";

export default function App() {
  const [activeTab, setActiveTab] = useState<"news" | "register" | "track" | "ai">("register");
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Simulation mode toggler ("parent" vs "admin")
  const [roleMode, setRoleMode] = useState<"parent" | "admin">("parent");

  // Mật khẩu ban quản trị (mặc định là admin123)
  const [adminPassword, setAdminPassword] = useState<string>(() => {
    try {
      const saved = localStorage.getItem("RachCheo_AdminPassword");
      return saved || "admin123";
    } catch {
      return "admin123";
    }
  });

  const [isAdminUnlocked, setIsAdminUnlocked] = useState<boolean>(() => {
    try {
      return localStorage.getItem("RachCheo_IsAdminUnlocked") === "true";
    } catch {
      return false;
    }
  });

  const [showPasswordModal, setShowPasswordModal] = useState<boolean>(false);
  const [passwordInput, setPasswordInput] = useState<string>("");
  const [passwordError, setPasswordError] = useState<string>("");
  const [showTypedPassword, setShowTypedPassword] = useState<boolean>(false);
  const [passwordModalTab, setPasswordModalTab] = useState<"unlock" | "change">("unlock");
  const [currentPasswordInput, setCurrentPasswordInput] = useState<string>("");
  const [newPasswordInputGate, setNewPasswordInputGate] = useState<string>("");
  const [passwordSuccessMsg, setPasswordSuccessMsg] = useState<string>("");

  // Cấu hình trạng thái hoạt động của Cổng đăng ký (Mở / Tạm khóa)
  const [isRegistrationOpen, setIsRegistrationOpen] = useState<boolean>(() => {
    try {
      const savedStatus = localStorage.getItem("RachCheo_IsRegistrationOpen");
      return savedStatus !== "false";
    } catch {
      return true;
    }
  });

  // Chỉ tiêu tuyển sinh khối lớp 1 của năm học
  const [enrollmentQuota, setEnrollmentQuota] = useState<number>(() => {
    try {
      const savedQuota = localStorage.getItem("RachCheo_EnrollmentQuota");
      return savedQuota ? Number(savedQuota) : 120;
    } catch {
      return 120;
    }
  });

  // Cấu hình linh hoạt cho hồ sơ đính kèm số hóa của từng năm học
  const [reqAvatar, setReqAvatar] = useState<"required" | "optional" | "hidden">(() => {
    try {
      const saved = localStorage.getItem("RachCheo_ReqAvatar");
      return (saved as "required" | "optional" | "hidden") || "required";
    } catch {
      return "required";
    }
  });

  const [reqBirthCert, setReqBirthCert] = useState<"required" | "optional" | "hidden">(() => {
    try {
      const saved = localStorage.getItem("RachCheo_ReqBirthCert");
      return (saved as "required" | "optional" | "hidden") || "required";
    } catch {
      return "required";
    }
  });

  const [reqResidenceCert, setReqResidenceCert] = useState<"required" | "optional" | "hidden">(() => {
    try {
      const saved = localStorage.getItem("RachCheo_ReqResidenceCert");
      return (saved as "required" | "optional" | "hidden") || "required";
    } catch {
      return "required";
    }
  });

  // All applications pulled in real-time
  const [applications, setApplications] = useState<AdmissionApplication[]>([]);
  const [appsLoading, setAppsLoading] = useState(true);
  const [activeAnnouncement, setActiveAnnouncement] = useState<string | null>("ann-1");

  const [announcements, setAnnouncements] = useState<SchoolAnnouncement[]>(() => {
    try {
      const saved = localStorage.getItem("RachCheo_Announcements");
      return saved ? JSON.parse(saved) : defaultAnnouncements;
    } catch {
      return defaultAnnouncements;
    }
  });

  const [contactHotline, setContactHotline] = useState<string>(() => {
    try {
      const saved = localStorage.getItem("RachCheo_ContactHotline");
      return saved || "0290.3888.222";
    } catch {
      return "0290.3888.222";
    }
  });

  const [contactEmail, setContactEmail] = useState<string>(() => {
    try {
      const saved = localStorage.getItem("RachCheo_ContactEmail");
      return saved || "th.rachcheo@phutun.edu.vn";
    } catch {
      return "th.rachcheo@phutun.edu.vn";
    }
  });

  const [contactAddress, setContactAddress] = useState<string>(() => {
    try {
      const saved = localStorage.getItem("RachCheo_ContactAddress");
      return saved || "Ấp Rạch Chèo, Xã Nguyễn Việt Khái, Tỉnh Cà Mau";
    } catch {
      return "Ấp Rạch Chèo, Xã Nguyễn Việt Khái, Tỉnh Cà Mau";
    }
  });

  const [adminSectionTab, setAdminSectionTab] = useState<"applications" | "announcements">("applications");

  // Track user-submitted and manually searched application IDs so that even if their anonymous session
  // is reset, their application stays pinned in "Hồ sơ tự nộp của tôi".
  const [localAppIds, setLocalAppIds] = useState<string[]>(() => {
    try {
      const localApps = localStorage.getItem("RachCheo_Apps");
      if (localApps) {
        const parsed = JSON.parse(localApps) as AdmissionApplication[];
        return parsed.map((a) => a.id);
      }
    } catch (e) {
      console.warn("Error parsing RachCheo_Apps for initial tracked IDs", e);
    }
    return [];
  });

  // Authentication Setup & Anonymous Auto-sign-in for seamless preview tracking
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setAuthLoading(false);
      } else {
        try {
          // Seamless anonymous auth so Firestore Security rules have request.auth
          const cred = await signInAnonymously(auth);
          setUser(cred.user);
        } catch (err) {
          // Silent automatic fallback for offline development & restricted sandbox modes
          // Create dummy structured user object to ensure non-blocking UX flow
          setUser({
            uid: "rachcheo_offline_parent",
            isAnonymous: true,
            emailVerified: false,
          } as any);
          setAuthLoading(false);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Real-time synchronization of the admission applications database
  useEffect(() => {
    setAppsLoading(true);

    // Fallback seed apps to make the portal immediately functional and premium-looking
    const seedApps: AdmissionApplication[] = [
      {
        id: "app_53812_demo",
        applicationCode: "RC-2026-53812",
        studentName: "Trần Minh Khang",
        gender: "Nam",
        birthDate: "2020-08-20",
        birthPlace: "Trạm y tế xã Nguyễn Việt Khái",
        address: "Ấp Rạch Chèo, Xã Nguyễn Việt Khái, Tỉnh Cà Mau",
        parentName: "Trần Anh Tuấn",
        parentPhone: "0944123XXX",
        parentEmail: "phuhuynh.tuan.demo@gmail.com",
        avatarUrl: "https://images.unsplash.com/photo-1595152772835-219674b2a8a6?w=150",
        birthCertUrl: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=300",
        residenceCertUrl: "https://images.unsplash.com/photo-1543269865-cbf427effbad?w=300",
        status: ApplicationStatus.PENDING,
        statusNotes: "Hồ sơ của bé đang được kiểm tra hành chính sơ bộ đối soát số định danh.",
        createdBy: "demo_parent_user",
        createdAt: new Date(Date.now() - 3600000 * 24 * 2), // 2 days ago
        updatedAt: new Date(Date.now() - 3600000 * 24 * 2),
      },
      {
        id: "app_19204_demo",
        applicationCode: "RC-2026-19204",
        studentName: "Lê Thị Mai Thy",
        gender: "Nữ",
        birthDate: "2020-11-04",
        birthPlace: "Trạm y tế xã Nguyễn Việt Khái, Cà Mau",
        address: "Ấp Mương Đào B, Xã Nguyễn Việt Khái, Tỉnh Cà Mau",
        parentName: "Lê Văn Hợp",
        parentPhone: "0987654XXX",
        parentEmail: "phuhuynh.hop.demo@gmail.com",
        avatarUrl: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150",
        birthCertUrl: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=300",
        residenceCertUrl: "https://images.unsplash.com/photo-1543269865-cbf427effbad?w=300",
        status: ApplicationStatus.ACTION_REQUIRED,
        statusNotes: "Ảnh quét Xác nhận cư trú bị mờ nhòe chữ bên dưới. Vui lòng cập nhật tờ khai số hoặc chụp bổ sung bản ảnh khác thay thế rõ hơn.",
        createdBy: "demo_parent_user_2",
        createdAt: new Date(Date.now() - 3600000 * 24 * 5), // 5 days ago
        updatedAt: new Date(Date.now() - 3600000 * 12), // 12 hours ago
      },
    ];

    try {
      // Query standard Firestore applications path collection
      const q = query(collection(db, "applications"));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetchedList: AdmissionApplication[] = [];
        snapshot.forEach((doc) => {
          fetchedList.push(doc.data() as AdmissionApplication);
        });

        // Merge standard database items with demo items for complete preview data completeness
        const combined = [...fetchedList];
        seedApps.forEach((demoApp) => {
          if (!combined.some((a) => a.id === demoApp.id)) {
            combined.push(demoApp);
          }
        });

        // Sort by creation time newest first
        combined.sort((a, b) => {
          const aTime = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt).getTime();
          const bTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt).getTime();
          return bTime - aTime;
        });

        setApplications(combined);
        setAppsLoading(false);
      }, (error) => {
        // Fallback to local storage or defaults if permissions fail or user is offline
        const localData = localStorage.getItem("RachCheo_Apps");
        if (localData) {
          try {
            const parsed = JSON.parse(localData);
            setApplications([...parsed, ...seedApps]);
          } catch {
            setApplications(seedApps);
          }
        } else {
          setApplications(seedApps);
        }
        setAppsLoading(false);
      });

      return () => unsubscribe();
    } catch (err) {
      console.error("Firestore onSnapshot subscription initialization failed:", err);
      setApplications(seedApps);
      setAppsLoading(false);
    }
  }, []);

  // Real-time synchronization of the announcements database from Firestore
  useEffect(() => {
    try {
      const q = query(collection(db, "announcements"));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetchedList: SchoolAnnouncement[] = [];
        snapshot.forEach((doc) => {
          fetchedList.push({ id: doc.id, ...doc.data() } as SchoolAnnouncement);
        });

        if (fetchedList.length > 0) {
          // Sort by important pinned first, then new publishedAt
          fetchedList.sort((a, b) => {
            if (a.important && !b.important) return -1;
            if (!a.important && b.important) return 1;
            return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
          });
          setAnnouncements(fetchedList);
          try {
            localStorage.setItem("RachCheo_Announcements", JSON.stringify(fetchedList));
          } catch (e) {
            console.warn(e);
          }
        } else {
          setAnnouncements(defaultAnnouncements);
        }
      }, (error) => {
        // Fallback silently
      });
      return () => unsubscribe();
    } catch (err) {
      console.error("Firestore announcements sub error:", err);
    }
  }, []);

  const handleAddAnnouncement = (newAnn: SchoolAnnouncement) => {
    const updated = [newAnn, ...announcements];
    setAnnouncements(updated);
    try {
      localStorage.setItem("RachCheo_Announcements", JSON.stringify(updated));
    } catch (e) {
      console.warn("Storage set failed", e);
    }
  };

  const handleUpdateAnnouncement = (updatedAnn: SchoolAnnouncement) => {
    const updated = announcements.map((ann) => (ann.id === updatedAnn.id ? updatedAnn : ann));
    setAnnouncements(updated);
    try {
      localStorage.setItem("RachCheo_Announcements", JSON.stringify(updated));
    } catch (e) {
      console.warn("Storage set failed", e);
    }
  };

  const handleDeleteAnnouncement = (id: string) => {
    const updated = announcements.filter((ann) => ann.id !== id);
    setAnnouncements(updated);
    try {
      localStorage.setItem("RachCheo_Announcements", JSON.stringify(updated));
    } catch (e) {
      console.warn("Storage set failed", e);
    }
  };

  // Handle addition of new application to either list/backend
  const handleAddNewApplication = (newApp: AdmissionApplication) => {
    const updated = [newApp, ...applications];
    setApplications(updated);

    // Persist contingency locally
    const filteredLocal = updated.filter((a) => !a.id.endsWith("_demo"));
    localStorage.setItem("RachCheo_Apps", JSON.stringify(filteredLocal));

    // Keep tracked ID
    setLocalAppIds((prev) => {
      if (prev.includes(newApp.id)) return prev;
      return [...prev, newApp.id];
    });

    // Redirect to parent tracking view so they instantly see progress!
    setActiveTab("track");
  };

  // Handle reactive updates (acting as upsert for searched documents)
  const handleUpdateApplication = (updatedApp: AdmissionApplication) => {
    const exists = applications.some((a) => a.id === updatedApp.id);
    let updatedList;
    if (exists) {
      updatedList = applications.map((a) => (a.id === updatedApp.id ? updatedApp : a));
    } else {
      updatedList = [updatedApp, ...applications];
    }
    setApplications(updatedList);

    const filteredLocal = updatedList.filter((a) => !a.id.endsWith("_demo"));
    localStorage.setItem("RachCheo_Apps", JSON.stringify(filteredLocal));

    // Ensure this app ID is tracked in localAppIds
    setLocalAppIds((prev) => {
      if (prev.includes(updatedApp.id)) return prev;
      return [...prev, updatedApp.id];
    });
  };

  const handleDeleteApplication = (appId: string) => {
    const updatedList = applications.filter((a) => a.id !== appId);
    setApplications(updatedList);

    const filteredLocal = updatedList.filter((a) => !a.id.endsWith("_demo"));
    localStorage.setItem("RachCheo_Apps", JSON.stringify(filteredLocal));

    // Remove from local tracked IDs
    setLocalAppIds((prev) => prev.filter((id) => id !== appId));
  };

  // Filter applications owned by the active user/anonymous session OR pinned in their localStorage
  const parentApps = applications.filter(
    (app) =>
      app.createdBy === (user?.uid || "demo_parent_user") ||
      app.createdBy === "demo_parent_user" ||
      localAppIds.includes(app.id)
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc]" id="app-root-view">
      {/* ⚠️ MOCK INTEGRATIVE SIMULATION HEADER CONTROLLER */}
      <div className="bg-slate-900 text-slate-100 py-2.5 px-4 font-sans text-xs flex flex-wrap items-center justify-end gap-3 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setRoleMode("parent");
              setActiveTab("news");
            }}
            className={`px-3 py-1.5 rounded-lg border flex items-center gap-1.5 font-bold transition-all cursor-pointer ${
              roleMode === "parent"
                ? "bg-teal-600 border-teal-500 text-white shadow-xs"
                : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            Đăng ký xét tuyển ({parentApps.length} đơn)
          </button>

          <button
            onClick={() => {
              if (isAdminUnlocked) {
                setRoleMode("admin");
                setActiveTab("news");
              } else {
                setShowPasswordModal(true);
              }
            }}
            className={`px-3 py-1.5 rounded-lg border flex items-center gap-1.5 font-bold transition-all cursor-pointer ${
              roleMode === "admin"
                ? "bg-amber-600 border-amber-500 text-white shadow-xs"
                : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            Hội đồng tuyển sinh (Admin)
          </button>
        </div>
      </div>

      {/* PRIMARY SCHOOL HEAD BRANDING BAR */}
      <header className="bg-white border-b border-slate-100 shadow-2xs py-4.5 px-4 sm:px-6 shrink-0 header-brand-school">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-center sm:text-left self-center sm:self-auto">
            <div className="w-13 h-13 bg-teal-600 text-white rounded-2xl flex items-center justify-center border-b-4 border-teal-800 shrink-0 shadow-md">
              <School className="w-7 h-7" />
            </div>
            <div>
              <h1 className="font-display font-[700] text-lg sm:text-xl text-slate-900 tracking-tight leading-none">
                TRƯỜNG TIỂU HỌC RẠCH CHÈO
              </h1>
              <p className="text-[11px] sm:text-xs text-slate-400 mt-1 uppercase tracking-wider font-semibold font-sans">
                {contactAddress}
              </p>
            </div>
          </div>

          {/* REAL TIME ENROLLMENT STATUS INDICATORS */}
          <div className="hidden md:flex items-center gap-4 bg-emerald-50/50 border border-emerald-100 px-4 py-2.5 rounded-2xl">
            <div className="text-right">
              <span className="text-[10px] text-emerald-800 font-bold uppercase tracking-wider block">Chỉ tiêu khối lớp 1</span>
              <span className="text-xs text-slate-500 font-sans">{enrollmentQuota} Học sinh • Năm học 2026-2027</span>
            </div>
            <div className="w-px h-8 bg-emerald-200"></div>
            <div className={`text-center ${isRegistrationOpen ? "bg-teal-600" : "bg-rose-600 animate-pulse"} text-white px-2.5 py-1 rounded-lg text-xs font-mono font-bold tracking-wide`}>
              {isRegistrationOpen ? "ĐANG MỞ ĐĂNG KÝ" : "TẠM KHÓA ĐĂNG KÝ"}
            </div>
          </div>
        </div>
      </header>

      {/* PRIMARY NAVIGATION TAB BAR */}
      <nav className="bg-white border-b border-slate-200/60 sticky top-0 z-30 shadow-3xs shrink-0 px-4">
        <div className="max-w-7xl mx-auto flex items-center overflow-x-auto gap-1 sm:gap-2 py-2">
          <button
            onClick={() => setActiveTab("news")}
            className={`px-4 py-2.5 text-xs font-bold font-sans rounded-xl tracking-wide transition-all shrink-0 cursor-pointer ${
              activeTab === "news" ? "bg-teal-600/10 text-teal-700" : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
            }`}
          >
            Bảng tin & Hướng dẫn
          </button>

          {roleMode === "parent" ? (
            <>
              <button
                onClick={() => setActiveTab("register")}
                className={`px-4 py-2.5 text-xs font-bold font-sans rounded-xl tracking-wide transition-all shrink-0 cursor-pointer ${
                  activeTab === "register" ? "bg-teal-600/10 text-teal-700" : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                }`}
              >
                Đăng ký xét tuyển
              </button>

              <button
                onClick={() => setActiveTab("track")}
                className={`px-4 py-2.5 text-xs font-bold font-sans rounded-xl tracking-wide transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                  activeTab === "track" ? "bg-teal-600/10 text-teal-700" : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                }`}
              >
                Tra cứu hồ sơ
                {parentApps.length > 0 && (
                  <span className="bg-teal-600 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                    {parentApps.length}
                  </span>
                )}
              </button>
            </>
          ) : (
            <button
              onClick={() => setActiveTab("news")} // handled below or custom override in section
              className="px-4 py-2.5 text-xs font-bold font-sans rounded-xl tracking-wide bg-amber-500/10 text-amber-800 shrink-0 uppercase pointer-events-none"
            >
              💼 BÀN LÀM VIỆC ĐIỀU HÀNH
            </button>
          )}

          <button
            onClick={() => setActiveTab("ai")}
            className={`px-4 py-2.5 text-xs font-bold font-sans rounded-xl tracking-wide transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
              activeTab === "ai" ? "bg-emerald-600/10 text-emerald-700" : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
            }`}
          >
            <Bot className="w-4 h-4 text-emerald-600" />
            Tuyển sinh AI
          </button>
        </div>
      </nav>

      {/* MAIN LAYOUT CANVAS */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {roleMode === "admin" ? (
          /* ADMINISTRATIVE ADMISSIONS DESK (ADMIN VIEW) */
          <div className="space-y-4">
            <div className="bg-amber-500/10 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-amber-900">
              <div className="space-y-1">
                <span className="text-[10px] bg-amber-600 text-white font-bold px-2 py-0.5 rounded uppercase tracking-wide">Quyền quản trị viên</span>
                <p className="text-xs font-sans">
                  Thầy cô đang làm việc dưới tư cách **Hội đồng Trường Tiểu học Rạch Chèo** (Hồ sơ lưu trữ khớp email <span className="font-semibold underline">giaoanlop4chantroi@gmail.com</span>).
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto shrink-0">
                <button
                  onClick={() => setRoleMode("parent")}
                  className="bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold border border-slate-200 p-2 px-3.5 rounded-xl cursor-pointer shadow-3xs"
                >
                  Dạo xem vai Phụ huynh
                </button>
                <button
                  onClick={() => {
                    setIsAdminUnlocked(false);
                    try {
                      localStorage.removeItem("RachCheo_IsAdminUnlocked");
                    } catch (e) {
                      console.warn(e);
                    }
                    setRoleMode("parent");
                    setActiveTab("news");
                  }}
                  className="bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-bold p-2 px-3.5 rounded-xl cursor-pointer flex items-center gap-1 shadow-sm transition-colors"
                >
                  🔒 Thoát & Khóa quyền Admin
                </button>
              </div>
            </div>
            <AdminPanel
              allApplications={applications}
              onUpdateApplication={handleUpdateApplication}
              onDeleteApplication={handleDeleteApplication}
              isRegistrationOpen={isRegistrationOpen}
              onToggleRegistration={(val) => {
                setIsRegistrationOpen(val);
                try {
                  localStorage.setItem("RachCheo_IsRegistrationOpen", String(val));
                } catch (e) {
                  console.warn("Storage set failed", e);
                }
              }}
              enrollmentQuota={enrollmentQuota}
              onUpdateQuota={(val) => {
                setEnrollmentQuota(val);
                try {
                  localStorage.setItem("RachCheo_EnrollmentQuota", String(val));
                } catch (e) {
                  console.warn("Storage set failed", e);
                }
              }}
              reqAvatar={reqAvatar}
              reqBirthCert={reqBirthCert}
              reqResidenceCert={reqResidenceCert}
              onUpdateReqAvatar={(val) => {
                setReqAvatar(val);
                try {
                  localStorage.setItem("RachCheo_ReqAvatar", val);
                } catch (e) {
                  console.warn("Storage set failed", e);
                }
              }}
              onUpdateReqBirthCert={(val) => {
                setReqBirthCert(val);
                try {
                  localStorage.setItem("RachCheo_ReqBirthCert", val);
                } catch (e) {
                  console.warn("Storage set failed", e);
                }
              }}
              onUpdateReqResidenceCert={(val) => {
                setReqResidenceCert(val);
                try {
                  localStorage.setItem("RachCheo_ReqResidenceCert", val);
                } catch (e) {
                  console.warn("Storage set failed", e);
                }
              }}
              adminPassword={adminPassword}
              onUpdateAdminPassword={(val) => {
                setAdminPassword(val);
                try {
                  localStorage.setItem("RachCheo_AdminPassword", val);
                } catch (e) {
                  console.warn("Storage set failed", e);
                }
              }}
              announcements={announcements}
              onAddAnnouncement={handleAddAnnouncement}
              onUpdateAnnouncement={handleUpdateAnnouncement}
              onDeleteAnnouncement={handleDeleteAnnouncement}
              contactHotline={contactHotline}
              onUpdateContactHotline={(val) => {
                setContactHotline(val);
                try {
                  localStorage.setItem("RachCheo_ContactHotline", val);
                } catch (e) {
                  console.warn(e);
                }
              }}
              contactEmail={contactEmail}
              onUpdateContactEmail={(val) => {
                setContactEmail(val);
                try {
                  localStorage.setItem("RachCheo_ContactEmail", val);
                } catch (e) {
                  console.warn(e);
                }
              }}
              contactAddress={contactAddress}
              onUpdateContactAddress={(val) => {
                setContactAddress(val);
                try {
                  localStorage.setItem("RachCheo_ContactAddress", val);
                } catch (e) {
                  console.warn(e);
                }
              }}
              initialSection={adminSectionTab}
              onSectionChange={setAdminSectionTab}
            />
          </div>
        ) : (
          /* PARENTS VIEWS (TABS) */
          <>
            {activeTab === "news" && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in" id="news-tab-panel">
                {/* Collapsible details for school guidelines and criteria list */}
                <div className="lg:col-span-2 space-y-5">
                  <div className="bg-gradient-to-r from-teal-700 to-emerald-700 rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
                    <div className="absolute right-[-40px] bottom-[-40px] opacity-15 text-white">
                      <School className="w-[180px] h-[180px]" />
                    </div>
                    <span className="text-[9px] uppercase tracking-wider font-semibold bg-emerald-500 text-white px-2 py-0.5 rounded-md">Chào mừng</span>
                    <h2 className="font-display font-[750] text-xl sm:text-2xl mt-2 leading-tight">
                      Cổng Tuyển Sinh Trực Tuyến Lớp 1
                    </h2>
                    <p className="text-xs text-teal-100 max-w-lg mt-2 font-sans leading-relaxed">
                      Chào mừng quý phụ huynh đến với cổng xét tuyển lớp 1 Trường Tiểu học Rạch Chèo. Mọi tờ khai đăng ký số hóa, tải tài liệu chứng từ, tiêm chủng và theo dõi phản hồi thực tế của nhà trường đều thực hiện tiện lợi ngay tại đây.
                    </p>
                    <div className="mt-5 flex flex-wrap gap-2">
                      <button
                        onClick={() => setActiveTab("register")}
                        className="bg-white hover:bg-slate-50 text-teal-800 text-xs font-bold px-4 py-2.5 rounded-xl cursor-pointer transition-colors shadow-sm"
                      >
                        Nộp tờ khai trực tuyến mới
                      </button>
                      <button
                        onClick={() => setActiveTab("ai")}
                        className="bg-teal-800/40 hover:bg-teal-800/55 text-white text-xs font-semibold px-4 py-2.5 rounded-xl cursor-pointer transition-colors border border-teal-500/20"
                      >
                        Hỏi ý kiến trợ lý AI
                      </button>
                    </div>
                  </div>

                  {/* ANNOUNCEMENT BLOCKS */}
                  <div className="space-y-4">
                    <h3 className="font-bold text-xs uppercase text-slate-500 tracking-wider">Tin tức & Hướng dẫn mới nhất</h3>

                    <div className="space-y-3">
                      {announcements.map((ann) => {
                        const isOpen = activeAnnouncement === ann.id;
                        return (
                          <div
                            key={ann.id}
                            className={`bg-white border rounded-2xl transition-all overflow-hidden ${
                              isOpen ? "border-teal-200/80 shadow-sm" : "border-slate-100 shadow-3xs hover:border-slate-200"
                            }`}
                          >
                            <button
                              onClick={() => setActiveAnnouncement(isOpen ? null : ann.id)}
                              className="w-full text-left p-4 flex items-start gap-3 justify-between"
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  {ann.important && (
                                    <span className="bg-rose-500 text-white text-[9px] uppercase font-bold px-1.5 py-0.5 rounded">Ghim</span>
                                  )}
                                  <span className="text-[10px] text-teal-600 bg-teal-50 px-2 py-0.5 rounded font-sans font-medium">{ann.category}</span>
                                </div>
                                <h4 className="font-bold text-sm text-slate-800 mt-1 hover:text-teal-700 leading-snug">{ann.title}</h4>
                                <span className="text-[10px] text-slate-400 block font-sans">
                                  Đăng ngày: {new Date(ann.publishedAt).toLocaleDateString("vi-VN")}
                                </span>
                              </div>
                              <span className="text-xs text-slate-400 font-bold bg-slate-50 px-2 py-1 rounded-lg">
                                {isOpen ? "Thu lại" : "Xem chi tiết"}
                              </span>
                            </button>

                            {isOpen && (
                              <div className="px-5 pb-5 pt-1 border-t border-slate-50 animate-fade-in">
                                <div className="prose prose-sm max-w-none text-slate-600 text-xs leading-relaxed space-y-3 font-sans pr-4 whitespace-pre-line">
                                  {ann.content}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* ADMISSION SIDE GENERAL PANELS */}
                <div className="space-y-6">
                  {/* HOTLINE/CONTACT INFO */}
                  <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Thông tin liên lạc tuyển sinh</h4>
                      <div className="space-y-3 font-sans text-xs text-slate-600 leading-relaxed">
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 font-mono text-[11px] text-slate-700">
                          📞 Hotline: <strong>{contactHotline}</strong>
                          <br />
                          ✉️ Email: <strong>{contactEmail}</strong>
                        </div>
                        <p>Quý phụ huynh cần hỗ trợ nhập học trực tiếp tại trường, điền tờ khai hộ hoặc phản ánh lỗi hệ thống vui lòng liên lạc trong giờ hành chính.</p>
                      </div>
                    </div>
                  </div>

                  {/* STEPS PREVIEW MAP */}
                  <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs space-y-4">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide">Quy trình tuyển sinh 4 bước</h4>
                    <div className="relative pl-6 space-y-4 before:content-[''] before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                      <div className="relative flex items-start gap-3">
                        <span className="absolute -left-[20px] top-0.5 w-[11px] h-[11px] rounded-full bg-teal-600 border-2 border-white ring-2 ring-teal-100"></span>
                        <div className="pl-2">
                          <h5 className="text-[11px] font-bold text-slate-700">Khai báo hồ sơ trực tuyến</h5>
                          <p className="text-[10px] text-slate-400 font-sans">Phụ huynh điền tờ khai kèm ảnh chụp tài liệu liên quan.</p>
                        </div>
                      </div>

                      <div className="relative flex items-start gap-3">
                        <span className="absolute -left-[20px] top-0.5 w-[11px] h-[11px] rounded-full bg-slate-300 border-2 border-white"></span>
                        <div className="pl-2">
                          <h5 className="text-[11px] font-bold text-slate-500">Đối chiếu và xác minh số</h5>
                          <p className="text-[10px] text-slate-400 font-sans">Hội đồng xem xét tính xác thực hồ sơ đính kèm.</p>
                        </div>
                      </div>

                      <div className="relative flex items-start gap-3">
                        <span className="absolute -left-[20px] top-0.5 w-[11px] h-[11px] rounded-full bg-slate-300 border-2 border-white"></span>
                        <div className="pl-2">
                          <h5 className="text-[11px] font-bold text-slate-500">Đối chiếu hồ sơ gốc trực tiếp</h5>
                          <p className="text-[10px] text-slate-400 font-sans">Cầm giấy tờ gốc đến văn phòng đối soát khi nhập học.</p>
                        </div>
                      </div>

                      <div className="relative flex items-start gap-3">
                        <span className="absolute -left-[20px] top-0.5 w-[11px] h-[11px] rounded-full bg-slate-300 border-2 border-white"></span>
                        <div className="pl-2">
                          <h5 className="text-[11px] font-bold text-slate-500">Thông báo nhập học Lớp 1 đạt!</h5>
                          <p className="text-[10px] text-slate-400 font-sans">Hệ thống chuyển trạng thái "Đã tiếp nhận" trúng tuyển chính thức.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "register" && (
              <div className="max-w-3xl mx-auto space-y-4 animate-fade-in" id="register-tab-panel">
                {!isRegistrationOpen ? (
                  <div className="bg-white border border-rose-100 rounded-2xl p-8 py-12 text-center space-y-4 shadow-3xs">
                    <div className="w-14 h-14 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto ring-4 ring-rose-50">
                      <AlertCircle className="w-7 h-7" />
                    </div>
                    <h3 className="font-bold text-sm text-slate-800 uppercase tracking-wide">Cổng đăng ký đang tạm khóa</h3>
                    <p className="text-xs text-slate-500 font-sans leading-relaxed max-w-md mx-auto">
                      Hội đồng tuyển sinh trường Tiểu học Rạch Chèo hiện tại đang **TẠM KHÓA** cổng tiếp nhận tờ khai trực tuyến mới. Quý phụ huynh vui lòng theo dõi bảng tin hoặc liên hệ hotline văn phòng trường để được hỗ trợ giải đáp trực tiếp.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="bg-amber-50 border-l-4 border-amber-600 text-amber-950 rounded-r-xl rounded-l-md p-4 shadow-sm flex items-start gap-3 animate-pulse-slow">
                      <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <span className="font-bold text-amber-900 text-xs uppercase tracking-wider block">Cam kết trách nhiệm pháp lý quan trọng:</span>
                        <p className="font-bold text-xs leading-relaxed text-amber-950 font-sans">
                          Bằng việc nhấn nộp hồ sơ, quý phụ huynh xin hoàn toàn chịu trách nhiệm trước pháp luật về tính chính xác của các thông tin đã khai báo trên đây.
                        </p>
                      </div>
                    </div>
                    <div className="bg-teal-50 border border-teal-100 text-teal-800 rounded-xl p-4 text-xs font-sans leading-relaxed">
                      Quý phụ huynh vui lòng điền thông tin chính xác theo giấy khai sinh hợp pháp của học sinh. Các tài liệu đính kèm bên dưới sẽ làm cơ sở đối chiếu hành chính số hóa đối soát trực tuyến sớm nhất.
                    </div>
                    <ApplicationForm
                      userId={user?.uid || "demo_parent_user"}
                      onSuccess={handleAddNewApplication}
                      userEmail={user?.email || ""}
                      reqAvatar={reqAvatar}
                      reqBirthCert={reqBirthCert}
                      reqResidenceCert={reqResidenceCert}
                    />
                  </>
                )}
              </div>
            )}

            {activeTab === "track" && (
              <div className="space-y-4 animate-fade-in" id="track-tab-panel">
                <div className="bg-slate-100 border border-slate-200 text-slate-705 p-3 rounded-xl text-center text-xs font-sans font-medium">
                  Hệ thống cập nhật tiến độ từ hội đồng tuyển sinh thời gian thực 24/7. Mọi thay đổi trạng thái sẽ hiện lên ngay lập tức.
                </div>
                <ApplicationTracker
                  parentApplications={parentApps}
                  onUpdateApplication={handleUpdateApplication}
                  userId={user?.uid || "demo_parent_user"}
                />
              </div>
            )}
          </>
        )}

        {activeTab === "ai" && (
          <div className="max-w-2xl mx-auto space-y-4 animate-fade-in" id="ai-tab-panel">
            <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-xl p-4 text-xs font-sans leading-relaxed">
              Trợ lý AI tuyển sinh tự động lấy dữ liệu từ quy định của Bộ giáo dục và Sở giáo dục xã Rạch Chèo để trả lời nhanh cho cha mẹ học sinh một cách chính xác nhất.
            </div>
            <AIAssistant />
          </div>
        )}
      </main>

      {/* FOOTER GENERAL DECLARATION */}
      <footer className="bg-slate-900 border-t border-slate-800 py-8 px-4 sm:px-6 shrink-0 text-slate-400 font-sans text-xs text-center leading-relaxed">
        <div className="max-w-7xl mx-auto space-y-3">
          <div className="flex items-center justify-center gap-2 text-slate-100 font-bold">
            <School className="w-5 h-5 text-teal-500" />
            <span>TRƯỜNG TIỂU HỌC RẠCH CHÈO • CÀ MAU</span>
          </div>
          <p className="max-w-md mx-auto">
            Địa chỉ: {contactAddress}.
            <br />
            Phục vụ công tác ứng dụng chuyển đổi số giáo dục hành chính công của Trường Tiểu học.
          </p>
          <div className="text-[10px] text-slate-500 pt-3 border-t border-slate-800/80">
            © 2026 Trường Tiểu học Rạch Chèo. Bảo lưu mọi quyền dữ liệu số của học sinh theo hiến pháp.
          </div>
        </div>
      </footer>

      {/* PASSWORD GATEWAY MODAL */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[9999] p-4 animate-fade-in" id="admin-pwd-gate">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-sm w-full overflow-hidden animate-scale-up">
            <div className="bg-gradient-to-r from-amber-600 to-amber-700 p-5 text-white flex items-center gap-3">
              <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center shrink-0">
                <Lock className="w-4 h-4 text-amber-100 animate-pulse" />
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider">Xác thực ban quản trị</h3>
                <p className="text-[9px] text-amber-100/80 font-sans">Trường Tiểu học Rạch Chèo</p>
              </div>
            </div>

            {/* TAB SELECTOR FOR MODAL CONTENT */}
            <div className="flex border-b border-slate-100 bg-slate-50/80">
              <button
                type="button"
                onClick={() => {
                  setPasswordModalTab("unlock");
                  setPasswordError("");
                  setPasswordSuccessMsg("");
                }}
                className={`flex-1 py-3 text-center text-xs font-bold border-b-2 transition-all cursor-pointer ${
                  passwordModalTab === "unlock"
                    ? "border-amber-600 text-amber-700 bg-white"
                    : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/55"
                }`}
              >
                🔓 Nhập mật khẩu
              </button>
              <button
                type="button"
                onClick={() => {
                  setPasswordModalTab("change");
                  setPasswordError("");
                  setPasswordSuccessMsg("");
                }}
                className={`flex-1 py-3 text-center text-xs font-bold border-b-2 transition-all cursor-pointer ${
                  passwordModalTab === "change"
                    ? "border-amber-600 text-amber-700 bg-white"
                    : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/55"
                }`}
              >
                ⚙️ Thay đổi mật khẩu
              </button>
            </div>

            <div className="p-5 space-y-4">
              {passwordModalTab === "unlock" ? (
                <>
                  <p className="text-[11px] text-slate-500 font-sans leading-relaxed">
                    Thầy cô vui lòng điền mật khẩu quản trị nội bộ của trường để truy cập các tính năng duyệt hồ sơ, thiết lập chỉ tiêu và thời gian đăng ký.
                  </p>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-sans">Mật khẩu bảo mật</label>
                    <div className="relative">
                      <input
                        type={showTypedPassword ? "text" : "password"}
                        placeholder="Nhập mật khẩu truy cập..."
                        value={passwordInput}
                        onChange={(e) => {
                          setPasswordInput(e.target.value);
                          setPasswordError("");
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            const val = passwordInput.trim();
                            if (val === adminPassword) {
                              setIsAdminUnlocked(true);
                              try {
                                localStorage.setItem("RachCheo_IsAdminUnlocked", "true");
                              } catch (err) {
                                console.warn(err);
                              }
                              setRoleMode("admin");
                              setActiveTab("news");
                              setShowPasswordModal(false);
                              setPasswordInput("");
                              setPasswordError("");
                            } else {
                              setPasswordError("Mật khẩu không chính xác. Vui lòng kiểm tra lại!");
                            }
                          }
                        }}
                        className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 focus:border-amber-500 rounded-xl p-2.5 pr-10 outline-none transition-colors text-slate-700"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => setShowTypedPassword(!showTypedPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                      >
                        {showTypedPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    {passwordError && (
                      <p className="text-[10px] font-bold text-rose-600 font-sans mt-1 bg-rose-50 border border-rose-100 p-2 rounded-lg leading-tight animate-fade-in">{passwordError}</p>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <p className="text-[11px] text-slate-500 font-sans leading-relaxed">
                    Hệ thống cho phép đổi mật khẩu hành chính quản trị lập tức. Vui lòng cung cấp mật khẩu đang dùng để xác thực an toàn.
                  </p>

                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-sans">Mật khẩu hiện tại</label>
                      <input
                        type="password"
                        placeholder="Nhập mật khẩu đang dùng..."
                        value={currentPasswordInput}
                        onChange={(e) => {
                          setCurrentPasswordInput(e.target.value);
                          setPasswordError("");
                        }}
                        className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 focus:border-amber-500 rounded-xl p-2.5 outline-none transition-colors text-slate-700"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-sans">Mật khẩu mới mong muốn</label>
                      <input
                        type="text"
                        placeholder="Nhập mật khẩu mới..."
                        value={newPasswordInputGate}
                        onChange={(e) => {
                          setNewPasswordInputGate(e.target.value);
                          setPasswordError("");
                        }}
                        className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 focus:border-amber-500 rounded-xl p-2.5 outline-none transition-colors text-slate-700"
                      />
                    </div>

                    {passwordError && (
                      <p className="text-[10px] font-bold text-rose-600 font-sans bg-rose-50 border border-rose-100 p-2 rounded-lg leading-tight animate-fade-in">{passwordError}</p>
                    )}

                    {passwordSuccessMsg && (
                      <p className="text-[10px] font-bold text-emerald-800 font-sans bg-emerald-50 border border-emerald-100 p-2 rounded-lg leading-tight animate-fade-in">{passwordSuccessMsg}</p>
                    )}
                  </div>
                </>
              )}

              <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl p-3 text-center">
                <span className="text-[9px] text-amber-800 font-bold block uppercase tracking-wide">💡 Trạng thái hiện tại</span>
                <p className="text-[10px] text-slate-500 mt-0.5 font-sans leading-relaxed">
                  Mật khẩu áp dụng lúc này:<br />
                  <span className="font-bold text-amber-900 font-mono select-all bg-amber-50/50 p-0.5 px-1.5 rounded border border-amber-100 inline-block mt-1 font-sans text-xs">{adminPassword}</span>
                </p>
              </div>
            </div>

            <div className="bg-slate-50 p-3.5 border-t border-slate-100 flex items-center justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  setShowPasswordModal(false);
                  setPasswordInput("");
                  setCurrentPasswordInput("");
                  setNewPasswordInputGate("");
                  setPasswordError("");
                  setPasswordSuccessMsg("");
                  setPasswordModalTab("unlock");
                }}
                className="bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold py-1.5 px-3 rounded-xl cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => {
                  if (passwordModalTab === "unlock") {
                    const val = passwordInput.trim();
                    if (val === adminPassword) {
                      setIsAdminUnlocked(true);
                      try {
                        localStorage.setItem("RachCheo_IsAdminUnlocked", "true");
                      } catch (err) {
                        console.warn(err);
                      }
                      setRoleMode("admin");
                      setActiveTab("news");
                      setShowPasswordModal(false);
                      setPasswordInput("");
                      setPasswordError("");
                    } else {
                      setPasswordError("Mật khẩu không chính xác. Vui lòng kiểm tra lại!");
                    }
                  } else {
                    // Change password tab logic
                    const currentVal = currentPasswordInput.trim();
                    const newVal = newPasswordInputGate.trim();

                    if (!currentVal) {
                      setPasswordError("Vui lòng nhập mật khẩu cũ/hiên tại để xác minh.");
                      return;
                    }
                    if (currentVal !== adminPassword) {
                      setPasswordError("Mật khẩu hiện tại nhập vào không chính xác.");
                      return;
                    }
                    if (!newVal) {
                      setPasswordError("Vui lòng nhập mật khẩu mới hợp lệ.");
                      return;
                    }
                    if (newVal.length < 4) {
                      setPasswordError("Mật khẩu mới phải ngắn nhất là 4 chữ số/ký tự.");
                      return;
                    }

                    // Save new password
                    setAdminPassword(newVal);
                    try {
                      localStorage.setItem("RachCheo_AdminPassword", newVal);
                    } catch (e) {
                      console.warn("Storage update failed", e);
                    }

                    setPasswordSuccessMsg("🎉 Đã đổi mật khẩu hành chính mới thành công!");
                    setTimeout(() => {
                      // Automatically unlock after changing password
                      setIsAdminUnlocked(true);
                      try {
                        localStorage.setItem("RachCheo_IsAdminUnlocked", "true");
                      } catch (err) {
                        console.warn(err);
                      }
                      setRoleMode("admin");
                      setActiveTab("news");
                      setShowPasswordModal(false);
                      // Reset inputs
                      setCurrentPasswordInput("");
                      setNewPasswordInputGate("");
                      setPasswordError("");
                      setPasswordSuccessMsg("");
                      setPasswordModalTab("unlock");
                    }, 1000);
                  }
                }}
                className="bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-bold py-1.5 px-4 rounded-xl cursor-pointer shadow-xs transition-colors"
              >
                {passwordModalTab === "unlock" ? "Xác nhận" : "Cập nhật & Vào Admin"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
