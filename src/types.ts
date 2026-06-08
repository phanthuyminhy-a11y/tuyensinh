export enum ApplicationStatus {
  PENDING = "Chờ duyệt",
  PROCESSING = "Đang xử lý",
  ACTION_REQUIRED = "Yêu cầu bổ sung",
  ACCEPTED = "Đã tiếp nhận",
  REJECTED = "Từ chối",
}

export interface DocumentUploads {
  avatarUrl?: string; // Ảnh thẻ học sinh
  birthCertUrl?: string; // Giấy khai sinh
  residenceCertUrl?: string; // Xác nhận cư trú / VNeID
}

export interface AdmissionApplication {
  id: string; // Document ID (usually equals applicationCode or random doc ID)
  applicationCode: string; // RC-2026-XXXXX
  studentName: string;
  gender: "Nam" | "Nữ";
  birthDate: string; // YYYY-MM-DD
  birthPlace: string;
  address: string;
  parentName: string;
  parentPhone: string;
  parentEmail?: string;
  avatarUrl: string; // Base64 image
  birthCertUrl: string; // Base64 image
  residenceCertUrl: string; // Base64 image
  status: ApplicationStatus;
  statusNotes: string; // Ghi chú từ hội đồng tuyển sinh
  createdBy: string; // Auth User ID
  createdAt: any; // Firestore Timestamp or ISO String
  updatedAt: any; // Firestore Timestamp or ISO String
}

export interface SchoolAnnouncement {
  id: string;
  title: string;
  content: string;
  category: "Thông báo" | "Hướng dẫn" | "Lịch tuyển sinh";
  publishedAt: string;
  important: boolean;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}
