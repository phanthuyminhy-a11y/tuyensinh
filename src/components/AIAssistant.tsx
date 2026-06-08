import React, { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Loader2, Sparkles, HelpCircle } from "lucide-react";
import { ChatMessage } from "../types";

export default function AIAssistant() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Xin chào quý phụ huynh! Tôi là **Trợ lý Tuyển sinh AI** của trường Tiểu học Rạch Chèo. Quý phụ huynh cần tôi hỗ trợ tư vấn thông tin gì về tuyển sinh lớp 1, hồ sơ đăng ký, độ tuổi hay lịch xét tuyển năm nay ạ?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const samplePrompts = [
    "Hồ sơ tuyển sinh cần scan những gì?",
    "Trẻ sinh năm 2020 hay 2021 được học lớp 1 năm 2026?",
    "Nhà ở ấp Rạch Chèo có đúng tuyến xã không?",
    "Thời gian xét duyệt hồ sơ bao lâu?",
  ];

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: textToSend,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      // Gather dialogue context to preserve query depth
      const contextMessages = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch("/api/gemini/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: contextMessages }),
      });

      if (!res.ok) {
        throw new Error("Lỗi kết nối máy chủ AI");
      }

      const data = await res.json();
      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.text || "Xin lỗi, tôi chưa giải đáp được câu hỏi này. Phụ huynh vui lòng liên hệ văn phòng nhà trường để biết thêm chi tiết.",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "⚠️ Đang xảy ra sự cố kết nối tới máy chủ AI của trường. Phụ huynh vui lòng thử lại sau giây lát hoặc xem phần **Hướng dẫn bổ sung**.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white border border-slate-100 rounded-2xl shadow-xs overflow-hidden flex flex-col h-[520px]" id="ai-assistant-panel">
      {/* Head */}
      <div className="bg-gradient-to-r from-teal-600 to-emerald-600 px-5 py-4 text-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-white/15 p-2 rounded-xl backdrop-blur-md">
            <Bot className="w-5 h-5 text-emerald-100 animate-pulse" />
          </div>
          <div>
            <h3 className="font-semibold text-sm leading-tight flex items-center gap-1.5">
              Hỗ trợ Tuyển sinh AI
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
              </span>
            </h3>
            <p className="text-[11px] text-teal-100 font-sans">Trường Tiểu học Rạch Chèo • Trực tuyến 24/7</p>
          </div>
        </div>
        <div className="flex items-center gap-1 bg-teal-700/40 px-2 py-1 rounded-lg text-[10px] font-medium border border-teal-500/20">
          <Sparkles className="w-3" />
          Gemini 3.5
        </div>
      </div>

      {/* Bubble Chat Logs */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
        {messages.map((m) => (
          <div key={m.id} className={`flex gap-3 max-w-[85%] ${m.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-xs border ${m.role === "user" ? "bg-teal-50 border-teal-200 text-teal-700" : "bg-emerald-50 border-emerald-200 text-emerald-700"}`}>
              {m.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>
            <div>
              <div className={`p-3 rounded-2xl text-xs leading-relaxed ${m.role === "user" ? "bg-teal-600 text-white rounded-tr-none" : "bg-white text-slate-800 border border-slate-100 rounded-tl-none pr-4"}`}>
                <div className="prose prose-sm prose-teal max-w-none text-[12px] whitespace-pre-line">
                  {m.content}
                </div>
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block px-1 font-sans">
                {m.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-3 max-w-[80%] mr-auto">
            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-emerald-50 border border-emerald-200 text-emerald-700">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-white border border-slate-100 p-3 rounded-2xl rounded-tl-none flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-teal-600" />
              <span className="text-xs text-slate-500">Thầy cô AI tuyển sinh đang soạn câu trả lời...</span>
            </div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      {/* Prompts list */}
      <div className="p-3 bg-white border-t border-slate-100">
        <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-2 flex items-center gap-1 px-1">
          <HelpCircle className="w-3 text-slate-400" /> Gợi ý câu hỏi nhanh:
        </p>
        <div className="flex flex-wrap gap-1.5">
          {samplePrompts.map((p, i) => (
            <button
              key={i}
              onClick={() => handleSend(p)}
              disabled={loading}
              className="text-[11px] text-slate-600 bg-slate-50 hover:bg-teal-50 hover:text-teal-700 border border-slate-100 hover:border-teal-200 transition-colors px-2.5 py-1.5 rounded-xl cursor-pointer text-left font-sans disabled:opacity-55"
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Inputs bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend(input);
        }}
        className="p-3 bg-slate-50 border-t border-slate-100 flex gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Nhập chất vấn của quý phụ huynh..."
          disabled={loading}
          className="flex-1 text-xs border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl px-3.5 py-2.5 bg-white shadow-inner outline-none transition-all"
        />
        <button
          type="submit"
          disabled={!input.trim() || loading}
          className="bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white p-2.5 rounded-xl flex items-center justify-center cursor-pointer transition-all focus:ring-2 focus:ring-teal-400 shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
