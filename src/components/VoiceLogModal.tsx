import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { Clock3, Mic, Sparkles, Square, Trash2, Waves } from "lucide-react";
import type { VoiceEngineAvailability, VoiceExtractCandidate, VoiceInputMode } from "../types";
import { commitVoiceLogCandidates, extractVoiceLogCandidates } from "../services/aiClient";
import { getVoiceEngineAvailability } from "../utils/runtimeUrls";

type VoiceStage = "idle" | "listening" | "extracting" | "review";

interface VoiceLogModalProps {
  selectedDate: string;
  onClose: () => void;
  onCommitted: (inserted: number) => Promise<void> | void;
}

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
  length: number;
}

interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: Event & { error?: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  }
}

const STATUS_LABELS: Record<VoiceStage, string> = {
  idle: "点击按钮开始语音输入",
  listening: "正在收听并实时转写...",
  extracting: "正在提取饮食和运动条目...",
  review: "检查候选结果后确认写入",
};

const MODE_LABELS: Record<VoiceInputMode, string> = {
  browser: "浏览器语音",
  server: "服务端语音（预留）",
};

const EXAMPLES = [
  "我今天上午吃了一个鸡蛋，然后爬坡爬了50分钟",
  "吃了两个苹果",
  "跑步30分钟",
];

const formatParsedTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { hour12: false });
};

export function VoiceLogModal({ selectedDate, onClose, onCommitted }: VoiceLogModalProps) {
  const [stage, setStage] = useState<VoiceStage>("idle");
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [candidates, setCandidates] = useState<VoiceExtractCandidate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availability, setAvailability] = useState<VoiceEngineAvailability>({
    browserSupported: false,
    serverSupported: false,
    activeMode: "browser",
  });
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const finalTranscriptRef = useRef("");

  useEffect(() => {
    const nextAvailability = getVoiceEngineAvailability();
    setAvailability(nextAvailability);

    const RecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!RecognitionCtor) return;

    const recognition = new RecognitionCtor();
    recognition.lang = "zh-CN";
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      let finalText = finalTranscriptRef.current;
      let interimText = "";

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const nextText = result[0]?.transcript || "";
        if (result.isFinal) {
          finalText += nextText;
        } else {
          interimText += nextText;
        }
      }

      finalTranscriptRef.current = finalText;
      setTranscript(finalText.trim());
      setInterimTranscript(interimText.trim());
    };

    recognition.onerror = (event) => {
      const errorCode = event.error || "unknown";
      if (errorCode === "not-allowed" || errorCode === "service-not-allowed") {
        setError("麦克风权限被拒绝。请允许浏览器使用麦克风，或直接手动输入文本。");
      } else if (errorCode === "no-speech") {
        setError("没有识别到语音内容，请重试。");
      } else {
        setError(`语音识别失败：${errorCode}`);
      }
      setStage("idle");
      setInterimTranscript("");
    };

    recognition.onend = () => {
      if (stage !== "listening") return;
      setInterimTranscript("");
      if (finalTranscriptRef.current.trim()) {
        void handleExtract(finalTranscriptRef.current.trim());
      } else {
        setStage("idle");
      }
    };

    recognitionRef.current = recognition;
    return () => {
      recognition.stop();
      recognitionRef.current = null;
    };
  }, [stage]);

  const totalCalories = useMemo(
    () => candidates.reduce((sum, item) => sum + Math.max(0, Number(item.calories || 0)), 0),
    [candidates]
  );

  const isBusy = stage === "listening" || stage === "extracting";

  const handleExtract = async (nextTranscript?: string) => {
    const normalizedTranscript = (nextTranscript ?? transcript).trim();
    if (!normalizedTranscript) {
      setError("请先提供一段要识别的文本。");
      return;
    }

    setError(null);
    setStage("extracting");
    try {
      const extracted = await extractVoiceLogCandidates(normalizedTranscript, selectedDate);
      setTranscript(extracted.transcript);
      setCandidates(extracted.candidates);
      setStage("review");
      if (!extracted.candidates.length) {
        setError("未提取到可写入条目，请补充“吃了什么 / 运动多久”等关键信息后重试。");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "提取失败");
      setStage("review");
    }
  };

  const startListening = () => {
    if (!availability.browserSupported || !recognitionRef.current) {
      setError("当前环境不支持浏览器语音识别。你仍可以手动输入一句自然语言，再点击“重新提取”。");
      return;
    }

    setError(null);
    setCandidates([]);
    finalTranscriptRef.current = "";
    setTranscript("");
    setInterimTranscript("");
    setStage("listening");
    recognitionRef.current.start();
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
  };

  const handleCommit = async () => {
    if (!candidates.length) {
      setError("没有可写入的条目。");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const result = await commitVoiceLogCandidates({ date: selectedDate, candidates });
      await onCommitted(result.inserted);
    } catch (err) {
      setError(err instanceof Error ? err.message : "写入日志失败");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center p-4 sm:items-center">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-md"
      />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        className="relative max-h-[92vh] w-full max-w-[52rem] overflow-y-auto rounded-t-[48px] bg-white p-8 shadow-2xl sm:rounded-[48px]"
      >
        <div className="mb-8 flex items-start justify-between gap-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-purple-500/70">Voice Log Input</p>
            <h3 className="mt-2 text-3xl font-black tracking-tight text-slate-950">语音输入</h3>
            <p className="mt-3 max-w-2xl text-sm font-bold leading-6 text-slate-500">
              说一句自然语言。系统会先转写，再提取饮食与运动候选项，最后由你确认后批量写入。
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-black/5 px-4 py-2 text-xs font-black text-black/50 transition-all hover:bg-black/10 hover:text-black"
          >
            关闭
          </button>
        </div>

        <div className="rounded-[36px] border border-purple-100 bg-[linear-gradient(135deg,#f5f3ff_0%,#ffffff_48%,#faf5ff_100%)] p-6 shadow-[0_28px_60px_-40px_rgba(107,70,255,0.45)]">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-white/80 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-purple-700/75">
                  {MODE_LABELS[availability.activeMode]}
                </span>
                {!availability.serverSupported && (
                  <span className="rounded-full bg-white/70 px-3 py-1 text-[10px] font-black text-slate-500">
                    服务端语音转写预留给 Android/App 版本
                  </span>
                )}
              </div>
              <h4 className="mt-3 text-2xl font-black tracking-tight text-slate-950">{STATUS_LABELS[stage]}</h4>
              <div className="mt-4 flex flex-wrap gap-2">
                {EXAMPLES.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => {
                      setTranscript(example);
                      setInterimTranscript("");
                      finalTranscriptRef.current = example;
                    }}
                    disabled={isBusy}
                    className="rounded-full bg-white/90 px-3 py-2 text-xs font-bold text-black/55 shadow-sm transition-all hover:text-black disabled:opacity-50"
                  >
                    {example}
                  </button>
                ))}
              </div>
              <p className="mt-4 text-xs font-bold text-purple-700/70">
                语音转写结果会先进入确认页，不会直接写入日志。推荐在 Chrome / Edge 中使用。
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-4">
              <div
                className={`relative flex h-28 w-28 items-center justify-center rounded-full ${
                  stage === "listening" ? "bg-rose-500" : "bg-slate-950"
                } text-white shadow-[0_18px_45px_-20px_rgba(15,23,42,0.45)]`}
              >
                {stage === "listening" && (
                  <>
                    <span className="absolute inset-0 animate-ping rounded-full bg-rose-400/40" />
                    <span className="absolute inset-3 animate-pulse rounded-full border border-white/25" />
                  </>
                )}
                <div className="relative z-10">{stage === "listening" ? <Square size={28} /> : <Mic size={34} />}</div>
              </div>
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={stage === "listening" ? stopListening : startListening}
                  disabled={!availability.browserSupported && stage !== "listening"}
                  className="flex min-w-[10rem] items-center justify-center gap-2 rounded-[20px] bg-slate-950 px-5 py-4 text-sm font-black text-white transition-all hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {stage === "listening" ? <Square size={16} /> : <Mic size={16} />}
                  {stage === "listening" ? "停止识别" : "开始语音输入"}
                </button>
                <p className="text-xs font-bold text-slate-400">
                  {availability.browserSupported
                    ? "支持一句话混合输入，例如“吃了两个苹果，跑步30分钟”。"
                    : "当前环境不支持浏览器语音识别，你仍可以手动输入文本并继续提取。"}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4 rounded-[32px] border border-black/5 bg-[#F8FAFC] p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.26em] text-black/35">Transcript</p>
                <h4 className="mt-2 text-lg font-black text-slate-950">转写文本</h4>
              </div>
              <button
                type="button"
                onClick={() => void handleExtract()}
                disabled={!transcript.trim() || isBusy}
                className="rounded-full bg-white px-4 py-2 text-xs font-black text-black/55 shadow-sm transition-all hover:text-black disabled:cursor-not-allowed disabled:opacity-40"
              >
                重新提取
              </button>
            </div>
            <textarea
              value={transcript}
              onChange={(e) => {
                setTranscript(e.target.value);
                finalTranscriptRef.current = e.target.value;
              }}
              placeholder="语音转写结果会显示在这里。你也可以直接手动输入一句话，再点击“重新提取”。"
              className="min-h-[12rem] w-full rounded-[24px] border border-black/5 bg-white px-4 py-4 text-sm font-bold leading-7 text-slate-700 outline-none transition-all focus:ring-2 focus:ring-purple-400"
            />
            {interimTranscript && (
              <p className="rounded-2xl bg-purple-50 px-4 py-3 text-sm font-bold text-purple-700">
                实时转写：{interimTranscript}
              </p>
            )}
            {error && <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-600">{error}</p>}
          </div>

          <div className="space-y-4 rounded-[32px] border border-black/5 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.26em] text-black/35">Review</p>
                <h4 className="mt-2 text-lg font-black text-slate-950">候选条目</h4>
              </div>
              <div className="rounded-full bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700">
                约 {totalCalories} kcal
              </div>
            </div>

            <div className="space-y-3">
              {candidates.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-black/10 bg-[#F8FAFC] px-5 py-10 text-center">
                  <Waves className="mx-auto text-black/15" size={24} />
                  <p className="mt-3 text-sm font-bold text-black/35">识别后的饮食和运动条目会出现在这里。</p>
                </div>
              ) : (
                candidates.map((candidate) => (
                  <div key={candidate.id} className="rounded-[24px] border border-black/5 bg-[#F8FAFC] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.2em] ${
                              candidate.type === "food" ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-700"
                            }`}
                          >
                            {candidate.type === "food" ? "饮食" : "运动"}
                          </span>
                          {typeof candidate.confidence === "number" && (
                            <span className="text-[11px] font-bold text-black/35">可信度 {Math.round(candidate.confidence)}%</span>
                          )}
                        </div>
                        <p className="mt-3 text-lg font-black text-slate-950">{candidate.name}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCandidates((current) => current.filter((item) => item.id !== candidate.id))}
                        className="rounded-full bg-white p-2 text-black/35 transition-all hover:text-rose-600"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-2xl bg-white px-3 py-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-black/30">
                          {candidate.type === "food" ? "数量" : "时长"}
                        </p>
                        <div className="mt-2 flex items-center gap-2">
                          <input
                            type="number"
                            value={candidate.amount}
                            min={0}
                            step={candidate.type === "food" ? 0.5 : 1}
                            onChange={(e) =>
                              setCandidates((current) =>
                                current.map((item) =>
                                  item.id === candidate.id ? { ...item, amount: Number(e.target.value || 0) } : item
                                )
                              )
                            }
                            className="w-full rounded-xl bg-[#F8FAFC] px-3 py-2 text-sm font-black outline-none focus:ring-2 focus:ring-purple-400"
                          />
                          <span className="shrink-0 text-xs font-black text-black/40">
                            {candidate.unit || (candidate.type === "food" ? "份" : "分钟")}
                          </span>
                        </div>
                      </div>

                      <div className="rounded-2xl bg-white px-3 py-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-black/30">时间</p>
                        <div className="mt-2 flex items-center gap-2 text-sm font-black text-slate-700">
                          <Clock3 size={14} className="text-black/30" />
                          <span>{formatParsedTime(candidate.parsed_time)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between rounded-2xl bg-white px-3 py-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-black/30">估算热量</p>
                      <p className="font-mono text-lg font-black text-slate-950">{candidate.calories} kcal</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 border-t border-black/5 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm font-bold text-black/45">
            <Sparkles size={16} className="text-purple-500" />
            语音转写结果会先进入确认页，不会直接写入日志。
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-[20px] bg-black/5 px-5 py-3 text-sm font-black text-black/60 transition-all hover:bg-black/10 hover:text-black"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleCommit}
              disabled={!candidates.length || isSubmitting || isBusy}
              className="rounded-[20px] bg-[linear-gradient(135deg,#6B46FF_0%,#8056FF_48%,#A05BFF_100%)] px-6 py-3 text-sm font-black text-white shadow-[0_18px_38px_-24px_rgba(107,70,255,0.6)] transition-all disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isSubmitting ? "写入中..." : `确认写入 ${candidates.length} 条`}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
