import React, { useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AudioLines, LoaderCircle, Mic, PencilLine, RotateCcw, Square, Trash2 } from "lucide-react";
import type { VoiceExtractCandidate } from "../types";
import { commitVoiceLogCandidates, extractVoiceLogCandidates, transcribeVoiceAudio } from "../services/aiClient";

type VoiceModalStage = "idle" | "recording" | "uploading" | "transcribing" | "extracting" | "review" | "error";

interface VoiceLogModalProps {
  open: boolean;
  selectedDate: string;
  onClose: () => void;
  onCommitted: (insertedCount: number) => Promise<void> | void;
  onToast: (message: string, type: "success" | "error") => void;
}

const EXAMPLES = [
  "我今天上午吃了一个鸡蛋，然后爬坡爬了50分钟",
  "吃了两个苹果",
  "跑步30分钟",
];

const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result || "");
      resolve(result.includes(",") ? result.split(",")[1] : result);
    };
    reader.onerror = () => reject(reader.error || new Error("Failed to read audio blob"));
    reader.readAsDataURL(blob);
  });

export function VoiceLogModal({ open, selectedDate, onClose, onCommitted, onToast }: VoiceLogModalProps) {
  const [stage, setStage] = useState<VoiceModalStage>("idle");
  const [transcript, setTranscript] = useState("");
  const [candidates, setCandidates] = useState<VoiceExtractCandidate[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeTypeRef = useRef<string>("audio/webm");

  const canExtract = transcript.trim().length > 0 && stage !== "transcribing" && stage !== "extracting" && stage !== "uploading";
  const canCommit = candidates.length > 0 && stage === "review";

  const resetState = () => {
    setStage("idle");
    setTranscript("");
    setCandidates([]);
    setErrorMessage(null);
  };

  const cleanupRecorder = () => {
    mediaRecorderRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    chunksRef.current = [];
  };

  const runExtract = async (nextTranscript?: string) => {
    const raw = (nextTranscript ?? transcript).trim();
    if (!raw) return;
    setStage("extracting");
    setErrorMessage(null);
    try {
      const result = await extractVoiceLogCandidates({ transcript: raw, date: selectedDate });
      setTranscript(result.transcript);
      setCandidates(result.candidates);
      setStage("review");
      if (!result.candidates.length) {
        setErrorMessage("未提取到可写入条目，请手动修改文本后重试。");
      }
    } catch (error) {
      setStage("error");
      setErrorMessage(error instanceof Error ? error.message : "提取语音条目失败");
    }
  };

  const startRecording = async () => {
    try {
      setErrorMessage(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/mp4";
      const recorder = new MediaRecorder(stream, { mimeType });
      mimeTypeRef.current = mimeType;
      streamRef.current = stream;
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      recorder.onstop = async () => {
        try {
          setStage("uploading");
          const blob = new Blob(chunksRef.current, { type: mimeType });
          const audioBase64 = await blobToBase64(blob);
          setStage("transcribing");
          const result = await transcribeVoiceAudio({ audioBase64, mimeType });
          setTranscript(result.transcript);
          await runExtract(result.transcript);
        } catch (error) {
          setStage("error");
          setErrorMessage(error instanceof Error ? error.message : "语音转写失败");
        } finally {
          cleanupRecorder();
        }
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setStage("recording");
    } catch (error) {
      cleanupRecorder();
      setStage("error");
      setErrorMessage(error instanceof Error ? error.message : "无法启动录音，请检查麦克风权限");
    }
  };

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
  };

  const handleCommit = async () => {
    if (!candidates.length) return;
    try {
      const result = await commitVoiceLogCandidates({ candidates });
      await onCommitted(result.insertedCount);
      onToast(`已写入 ${result.insertedCount} 条语音记录`, "success");
      cleanupRecorder();
      resetState();
      onClose();
    } catch (error) {
      setStage("error");
      setErrorMessage(error instanceof Error ? error.message : "写入日志失败");
    }
  };

  const modeLabel = useMemo(() => "服务端语音", []);

  if (!open) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[70] flex items-end justify-center p-4 sm:items-center">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { cleanupRecorder(); resetState(); onClose(); }} className="absolute inset-0 bg-black/60 backdrop-blur-md" />
        <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="relative max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-[40px] bg-white p-8 shadow-2xl sm:rounded-[40px]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.26em] text-violet-500/70">Voice Mode</p>
              <h3 className="mt-2 text-3xl font-black tracking-tight text-slate-950">语音输入</h3>
              <p className="mt-2 text-sm font-bold text-slate-500">说一句自然语言，系统会自动提取饮食和运动条目，确认后批量写入。</p>
            </div>
            <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-black text-violet-700">{modeLabel}</span>
          </div>

          <div className="mt-6 rounded-[28px] border border-violet-100 bg-[linear-gradient(135deg,#faf5ff_0%,#f5f3ff_46%,#eef2ff_100%)] p-6">
            <div className="flex flex-wrap items-center gap-3 text-xs font-black text-violet-700">
              <span className="rounded-full bg-white/80 px-3 py-1">先录音</span>
              <span className="rounded-full bg-white/80 px-3 py-1">再转写</span>
              <span className="rounded-full bg-white/80 px-3 py-1">后确认写入</span>
            </div>
            <p className="mt-4 text-sm font-bold text-slate-600">语音转写结果会先进入确认页，不会直接写入日志。</p>
          </div>

          {stage === "idle" && (
            <div className="mt-8 space-y-6">
              <button type="button" onClick={() => void startRecording()} className="mx-auto flex h-28 w-28 items-center justify-center rounded-full bg-[linear-gradient(135deg,#7c3aed_0%,#9333ea_44%,#7c3aed_100%)] text-white shadow-[0_24px_50px_-18px_rgba(124,58,237,0.55)] transition-transform hover:scale-105">
                <Mic size={34} />
              </button>
              <div className="space-y-3 rounded-[28px] bg-[#F8F9FA] p-5">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-black/35">示例</p>
                {EXAMPLES.map((example) => (
                  <button key={example} type="button" onClick={() => setTranscript(example)} className="block w-full rounded-2xl bg-white px-4 py-3 text-left text-sm font-bold text-slate-700 shadow-sm">
                    {example}
                  </button>
                ))}
              </div>
            </div>
          )}

          {stage === "recording" && (
            <div className="mt-10 flex flex-col items-center gap-5 text-center">
              <div className="relative flex h-28 w-28 items-center justify-center rounded-full bg-rose-50 text-rose-600">
                <div className="absolute h-full w-full animate-ping rounded-full bg-rose-100" />
                <AudioLines className="relative" size={34} />
              </div>
              <div>
                <p className="text-2xl font-black">正在录音...</p>
                <p className="mt-2 text-sm font-bold text-black/45">说完后点击“停止录音”，系统会调用服务端语音转写。</p>
              </div>
              <button type="button" onClick={stopRecording} className="inline-flex items-center gap-2 rounded-full bg-black px-5 py-3 text-sm font-black text-white">
                <Square size={14} /> 停止录音
              </button>
            </div>
          )}

          {(stage === "uploading" || stage === "transcribing" || stage === "extracting") && (
            <div className="mt-10 flex flex-col items-center gap-4 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-violet-50 text-violet-600">
                <LoaderCircle className="animate-spin" size={30} />
              </div>
              <div>
                <p className="text-2xl font-black">
                  {stage === "uploading" ? "正在上传音频..." : stage === "transcribing" ? "正在转写语音..." : "正在提取条目..."}
                </p>
                <p className="mt-2 text-sm font-bold text-black/45">请稍候，系统会先得到转写文本，再抽取饮食和运动候选项。</p>
              </div>
            </div>
          )}

          {(stage === "review" || stage === "error") && (
            <div className="mt-8 space-y-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black uppercase tracking-[0.18em] text-black/35">转写文本</label>
                  <button type="button" onClick={() => void runExtract()} disabled={!canExtract} className="inline-flex items-center gap-1 rounded-full bg-black px-3 py-1 text-xs font-black text-white disabled:opacity-40">
                    <RotateCcw size={12} /> 重新提取
                  </button>
                </div>
                <textarea value={transcript} onChange={(event) => setTranscript(event.target.value)} rows={4} className="w-full rounded-[24px] border border-black/5 bg-[#F8F9FA] px-4 py-4 text-sm font-bold text-slate-700 outline-none" placeholder="例如：我今天上午吃了一个鸡蛋，然后爬坡爬了50分钟" />
              </div>

              {errorMessage && <div className="rounded-[24px] border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{errorMessage}</div>}

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-black/35">候选条目</p>
                  <span className="text-xs font-black text-black/35">{candidates.length} 项</span>
                </div>
                {candidates.map((candidate, index) => (
                  <div key={candidate.id} className="rounded-[28px] border border-black/5 bg-white p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full px-2 py-1 text-[10px] font-black ${candidate.type === "food" ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-700"}`}>{candidate.type === "food" ? "饮食" : "运动"}</span>
                          <p className="text-lg font-black text-slate-900">{candidate.name}</p>
                        </div>
                        <p className="mt-2 text-xs font-bold text-black/45">解析时间：{candidate.parsed_time.replace("T", " ")}</p>
                        {candidate.explanation && <p className="mt-2 text-xs font-bold text-black/45">{candidate.explanation}</p>}
                      </div>
                      <button type="button" onClick={() => setCandidates((current) => current.filter((item) => item.id !== candidate.id))} className="rounded-full bg-black/5 p-2 text-black/35 hover:text-black">
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-[0.18em] text-black/35">数量 / 时长</label>
                        <input
                          type="number"
                          value={candidate.amount}
                          onChange={(event) =>
                            setCandidates((current) =>
                              current.map((item, itemIndex) => {
                                if (itemIndex !== index) return item;
                                const nextAmount = Number(event.target.value || 0);
                                const ratio = item.amount > 0 ? nextAmount / item.amount : 1;
                                return {
                                  ...item,
                                  amount: nextAmount,
                                  calories: nextAmount > 0 ? Math.max(0, Number((item.calories * ratio).toFixed(1))) : 0,
                                  protein: typeof item.protein === "number" ? Number((item.protein * ratio).toFixed(1)) : item.protein,
                                  carbs: typeof item.carbs === "number" ? Number((item.carbs * ratio).toFixed(1)) : item.carbs,
                                  fats: typeof item.fats === "number" ? Number((item.fats * ratio).toFixed(1)) : item.fats,
                                };
                              })
                            )
                          }
                          className="mt-2 w-full rounded-2xl bg-[#F8F9FA] px-4 py-3 text-sm font-black outline-none"
                        />
                      </div>
                      <div className="rounded-2xl bg-[#F8F9FA] px-4 py-3 text-sm font-black text-black/70">{candidate.unit || (candidate.type === "exercise" ? "分钟" : "份")}</div>
                      <div className="rounded-2xl bg-[#F5F7F4] px-4 py-3 text-sm font-black text-emerald-700">约 {Math.round(candidate.calories)} kcal</div>
                    </div>
                  </div>
                ))}
                {stage === "review" && candidates.length === 0 && (
                  <div className="rounded-[28px] border border-dashed border-black/10 bg-[#F8F9FA] px-6 py-8 text-center text-sm font-bold text-black/35">未提取到可写入条目，请修改转写文本后重新提取。</div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <button type="button" onClick={() => { cleanupRecorder(); resetState(); }} className="inline-flex items-center gap-2 rounded-full bg-black/5 px-4 py-3 text-sm font-black text-black/60">
                  <PencilLine size={14} /> 重新录音
                </button>
                <button type="button" onClick={() => void handleCommit()} disabled={!canCommit} className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,#7c3aed_0%,#8b5cf6_44%,#7c3aed_100%)] px-6 py-3 text-sm font-black text-white disabled:opacity-40">
                  确认写入
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
