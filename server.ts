import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

// Ensure Gemini Client is initialized lazy and securely on the server-side
let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is required inside your configuration.");
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route: AI Admission Assistant for parents
  app.post("/api/gemini/chat", async (req, res) => {
    try {
      const { messages, prompt } = req.body;
      const ai = getGeminiClient();

      // Formulate detailed background system instructions for the school admissions assistant
      const systemInstruction = `
Bạn là "Trợ lý Tuyển sinh AI" đại diện cho "TRƯỜNG TIỂU HỌC RẠCH CHÈO" (ấp Rạch Chèo, xã Nguyễn Việt Khái, tỉnh Cà Mau).
Nhiệm vụ của bạn là giải đáp các thắc mắc của phụ huynh học sinh về hồ sơ tuyển sinh lớp 1, quy trình đăng ký trực tiếp và trực tuyến, lịch trình và độ tuổi.

THÔNG TIN TRƯỜNG TIỂU HỌC RẠCH CHÈO:
- Địa chỉ: Ấp Rạch Chèo, Xã Nguyễn Việt Khái, Tỉnh Cà Mau.
- Cấp học: Tiểu học (Lớp 1 đến Lớp 5).
- Chỉ tiêu tuyển sinh Lớp 1 (Năm học 2026 - 2027): Được Hội đồng điều chỉnh linh hoạt hàng năm dựa trên số lượng tờ khai của phụ huynh nộp vào.
- Độ tuổi tuyển sinh vào Lớp 1: Nhà trường và ban tuyển sinh xã Nguyễn Việt Khái hỗ trợ tiếp nhận hồ sơ tự do và không giới hạn độ tuổi tuyển sinh cho tất cả học sinh có nhu cầu học tập, nhằm tạo cơ hội bình đẳng hành chính tuyệt đối. Phụ huynh có thể nộp hồ sơ tuyển sinh cho con bất kỳ năm sinh nào.

HỒ SƠ TUYỂN SINH GỒM:
1. Đơn đăng ký xét tuyển trực tuyến (điền trực tiếp qua hệ thống app này!).
2. Bản sao Giấy khai sinh hợp lệ (có thể đính kèm ảnh chụp trực tuyến).
3. Bản chụp giấy xác nhận thông tin cư trú (hoặc tài khoản định danh cấp độ 2 VNeID chứng minh đúng tuyến tuyển sinh xã Nguyễn Việt Khái).
4. Bản photo sổ tiêm chủng của trẻ.

LỊCH TRÌNH TUYỂN SINH 2026 - 2027:
- Đợt 1 (Đăng ký trực tuyến): Từ ngày 01/06/2026 đến hết ngày 15/07/2026.
- Đợt 2 (Đối chiếu và xác minh hồ sơ giấy tại trường): Từ 16/07/2026 đến 25/07/2026.
- Đợt 3 (Công bố kết quả trúng tuyển chính thức): Ngày 01/08/2026 trên bảng tin của trường và cổng tuyển sinh này.

LƯU Ý QUAN TRỌNG:
- Nhà trường tạo điều kiện tối đa để phụ huynh nộp hồ sơ trực tuyến thuận tiện nhất nhằm tiết kiệm chi phí đi lại. Phụ huynh có thể nộp file scan hoặc ảnh chụp các chứng từ. Sau khi xét duyệt sơ bộ trực tuyến, phụ huynh chỉ mang hồ sơ gốc đến trường đối chiếu khi nhập học chính thức.
- Hãy trả lời lịch sự, thân thiện, súc tích, thể hiện sự chu đáo và ấm áp của thầy cô giáo trường miền Tây Cà Mau sông nước. Trả lời bằng tiếng Việt.
- Sử dụng định dạng Markdown đẹp, dễ đọc để hướng dẫn phụ huynh.
      `;

      // Use check and map message sequences from request to structured chat history
      const formattedContents = messages && messages.length > 0
        ? messages.map((m: { role: string; content: string }) => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }],
          }))
        : prompt;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: formattedContents,
        config: {
          systemInstruction,
          temperature: 0.7,
        },
      });

      res.json({ text: response.text });
    } catch (error) {
      console.error("Gemini API server proxy error:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Internal Server Error" });
    }
  });

  // Healthcheck
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date() });
  });

  // Vite integration
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in development mode with Vite HMR disabled proxy layers...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting server in production mode package static build files.");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Rach Cheo School Portal] Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
