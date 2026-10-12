"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Sparkles,
  Send,
  Bot,
  User as UserIcon,
  HelpCircle,
  ShieldCheck,
  Building2,
  Star,
  RefreshCw,
  AlertTriangle,
  Lightbulb,
  CheckCircle2
} from "lucide-react";
import { GoogleReview, User, api } from "@/lib/api";

interface Message {
  id: string;
  sender: "user" | "copilot";
  content: string;
  time: string;
  groundedReviewId?: number | null;
  suggestedAction?: string | null;
}

interface ReviewCopilotTabProps {
  currentUser: User | null;
  reviews: GoogleReview[];
  initialReviewId?: number | null;
  onOpenReviewDetail: (reviewId: number) => void;
  onCreateCAPFromReview: (review: GoogleReview) => void;
}

export function ReviewCopilotTab({
  currentUser,
  reviews,
  initialReviewId,
  onOpenReviewDetail,
  onCreateCAPFromReview,
}: ReviewCopilotTabProps) {
  const [selectedReviewId, setSelectedReviewId] = useState<number | null>(initialReviewId || null);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string>(() => `conv_${Date.now()}`);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      sender: "copilot",
      content:
        "Hello! I am your Patient Experience Copilot. I can help investigate patient feedback, identify root causes, draft HIPAA-compliant public replies, and design hospital corrective action plans (CAP). Select a review or ask an operational question below.",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const currentSelectedReview = reviews.find((r) => r.id === selectedReviewId);

  const quickPrompts = [
    "What is the main issue in this review?",
    "What are the possible root causes?",
    "What should management investigate first?",
    "Which department should own this action?",
    "Suggest a corrective-action plan.",
    "Draft a professional public response.",
    "What information is missing?",
    "What preventive measures could reduce recurrence?",
  ];

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || inputMessage;
    if (!text.trim() || isLoading) return;

    const userMsg: Message = {
      id: `usr_${Date.now()}`,
      sender: "user",
      content: text,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      groundedReviewId: selectedReviewId,
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputMessage("");
    setIsLoading(true);

    try {
      const res: any = await api.sendReviewChatMessage({
        message: text,
        review_id: selectedReviewId,
        conversation_id: conversationId,
      });

      const botMsg: Message = {
        id: `bot_${Date.now()}`,
        sender: "copilot",
        content: res.reply || "I have analyzed your request based on current patient experience records.",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        groundedReviewId: selectedReviewId,
        suggestedAction: res.suggested_action,
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      const errorMsg: Message = {
        id: `err_${Date.now()}`,
        sender: "copilot",
        content: `Error retrieving response: ${err.message || "Failed to reach copilot backend"}. Please verify your access permissions.`,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-[780px] bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
      {/* Sidebar: Context Selector */}
      <div className="w-full lg:w-80 bg-slate-50 border-r border-slate-200 flex flex-col shrink-0">
        <div className="p-4 border-b border-slate-200">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-4 w-4 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-900">Grounded Review Context</h3>
          </div>
          <p className="text-[11px] text-slate-500">
            Select a review to provide verified ground-truth context to the Copilot.
          </p>
        </div>

        <div className="p-3 border-b border-slate-200">
          <button
            onClick={() => setSelectedReviewId(null)}
            className={`w-full p-2.5 rounded-xl text-xs font-semibold text-left transition-colors flex items-center justify-between cursor-pointer ${
              selectedReviewId === null
                ? "bg-indigo-600 text-white shadow-xs"
                : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            <span>General Hospital QA (No single review)</span>
            {selectedReviewId === null && <CheckCircle2 className="h-4 w-4 text-white" />}
          </button>
        </div>

        <div className="p-3 overflow-y-auto space-y-2 flex-1">
          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider px-1">
            Available Reviews ({reviews.length})
          </span>
          {reviews.map((r) => {
            const isSelected = selectedReviewId === r.id;
            return (
              <div
                key={r.id}
                onClick={() => setSelectedReviewId(r.id)}
                className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                  isSelected
                    ? "bg-indigo-50/70 border-indigo-300 shadow-xs"
                    : "bg-white border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-slate-900 truncate max-w-[130px]">
                    {r.reviewer_name}
                  </span>
                  <div className="flex items-center gap-1 text-[11px] font-bold text-amber-500">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    <span>{r.star_rating}★</span>
                  </div>
                </div>
                <p className="text-slate-500 text-[11px] line-clamp-2 italic">
                  &ldquo;{r.review_text || "No text"}&rdquo;
                </p>
                <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
                  <span>ID: #{r.id}</span>
                  {r.ai_analysis?.suggested_department && (
                    <span className="text-indigo-600 font-semibold">
                      {r.ai_analysis.suggested_department}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected Context Summary Footnote */}
        {currentSelectedReview && (
          <div className="p-3 bg-white border-t border-slate-200 text-xs flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-400 block">Active Grounding:</span>
              <strong className="text-slate-800 text-[11px] truncate block max-w-[150px]">
                #{currentSelectedReview.id} - {currentSelectedReview.reviewer_name}
              </strong>
            </div>
            <button
              onClick={() => onOpenReviewDetail(currentSelectedReview.id)}
              className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer underline"
            >
              View Full
            </button>
          </div>
        )}
      </div>

      {/* Main Chat Interface */}
      <div className="flex-1 flex flex-col bg-white overflow-hidden">
        {/* Chat Header */}
        <div className="px-6 py-3.5 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>Patient Experience Copilot</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase border border-emerald-200">
                  Ready
                </span>
              </h2>
              <p className="text-[11px] text-slate-500">
                Grounded in CareOps Hospital SOPs &bull; Prompt-Injection Defended &bull; Role-Enforced
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={() => {
                setConversationId(`conv_${Date.now()}`);
                setMessages([
                  {
                    id: "reset",
                    sender: "copilot",
                    content: "Conversation history cleared. Ready for your next investigation query.",
                    time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                  },
                ]);
              }}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className="h-3 w-3" />
              <span>Reset Thread</span>
            </button>
          </div>
        </div>

        {/* Message Thread */}
        <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-slate-50/50">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex gap-3 max-w-3xl ${
                m.sender === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
              }`}
            >
              <div
                className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                  m.sender === "user"
                    ? "bg-slate-800 text-white"
                    : "bg-indigo-600 text-white"
                }`}
              >
                {m.sender === "user" ? <UserIcon className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
              </div>

              <div className={`space-y-1.5 ${m.sender === "user" ? "items-end" : "items-start"}`}>
                <div
                  className={`p-4 rounded-2xl text-xs leading-relaxed ${
                    m.sender === "user"
                      ? "bg-slate-900 text-white rounded-tr-xs"
                      : "bg-white border border-slate-200 text-slate-800 shadow-xs rounded-tl-xs"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.content}</p>

                  {/* Suggestion action chip */}
                  {m.suggestedAction === "create_corrective_action" && currentSelectedReview && (
                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[11px] text-slate-500 font-medium">
                        Action item detected:
                      </span>
                      <button
                        onClick={() => onCreateCAPFromReview(currentSelectedReview)}
                        className="px-3 py-1 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Launch CAP Task</span>
                      </button>
                    </div>
                  )}
                </div>

                <div
                  className={`flex items-center gap-2 text-[10px] text-slate-400 px-1 ${
                    m.sender === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <span>{m.time}</span>
                  {m.groundedReviewId && (
                    <span>&bull; Grounded in Review #{m.groundedReviewId}</span>
                  )}
                </div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-3 max-w-2xl mr-auto">
              <div className="h-8 w-8 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0">
                <Bot className="h-4 w-4" />
              </div>
              <div className="p-4 rounded-2xl bg-white border border-slate-200 text-xs text-slate-500 shadow-xs rounded-tl-xs flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-indigo-600 animate-pulse" />
                <div className="h-2 w-2 rounded-full bg-indigo-600 animate-pulse delay-75" />
                <div className="h-2 w-2 rounded-full bg-indigo-600 animate-pulse delay-150" />
                <span>Analyzing review evidence & hospital protocols...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Prompts Bar */}
        <div className="px-6 py-2 bg-white border-t border-slate-100 overflow-x-auto whitespace-nowrap scrollbar-none flex items-center gap-2 shrink-0">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Lightbulb className="h-3 w-3 text-amber-500" />
            Suggestions:
          </span>
          {quickPrompts.map((prompt, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(prompt)}
              className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium transition-colors cursor-pointer shrink-0"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Input Composer */}
        <div className="p-4 bg-white border-t border-slate-200 shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder={
                currentSelectedReview
                  ? `Ask Copilot about Review #${currentSelectedReview.id} (${currentSelectedReview.reviewer_name})...`
                  : "Ask about hospital review trends, root-cause investigations, or policy guidelines..."
              }
              className="flex-1 p-3 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-indigo-500 text-slate-800"
            />
            <button
              type="submit"
              disabled={isLoading || !inputMessage.trim()}
              className="px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-2 shadow-xs cursor-pointer transition-colors disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              <span>Send</span>
            </button>
          </form>
          <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-400">
            <span>
              Copilot uses grounded retrieval and clinical SOP heuristics. Output is subject to hospital supervisor confirmation.
            </span>
            <span className="font-semibold text-slate-500">Security: Prompt Sanitized</span>
          </div>
        </div>
      </div>
    </div>
  );
}
