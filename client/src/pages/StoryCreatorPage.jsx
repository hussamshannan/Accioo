import { useState, useRef, useLayoutEffect } from "react";
import { useNavigate } from "react-router-dom";
import gsap from "gsap";
import { slideFromTop, fadeUp, slideFromBottom } from "@/utils/animations";
import { createStory, createTextStory } from "../services/storyService";
import { ArrowLeft, Image, Type, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const BG_GRADIENTS = [
  { label: "Night", value: "linear-gradient(135deg,#0f0c29,#302b63,#24243e)" },
  { label: "Ocean", value: "linear-gradient(135deg,#005c97,#363795)" },
  { label: "Forest", value: "linear-gradient(135deg,#11998e,#38ef7d)" },
  { label: "Sunset", value: "linear-gradient(135deg,#f7971e,#ffd200)" },
  { label: "Rose",   value: "linear-gradient(135deg,#f953c6,#b91d73)" },
  { label: "Coral",  value: "linear-gradient(135deg,#ff416c,#ff4b2b)" },
  { label: "Violet", value: "linear-gradient(135deg,#7f00ff,#e100ff)" },
  { label: "Mint",   value: "linear-gradient(135deg,#00b09b,#96c93d)" },
  { label: "Ash",    value: "linear-gradient(135deg,#636363,#a2ab58)" },
  { label: "Dark",   value: "linear-gradient(135deg,#1a1a2e,#16213e)" },
  { label: "Teal",   value: "linear-gradient(135deg,#2193b0,#6dd5ed)" },
];

const FONT_SIZES = ["text-xl", "text-2xl", "text-3xl", "text-4xl"];
const FONT_SIZE_LABELS = ["S", "M", "L", "XL"];

export default function StoryCreatorPage() {
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const textRef = useRef(null);
  const topControlsRef = useRef(null);
  const canvasRef = useRef(null);
  const bottomBarRef = useRef(null);

  const [mode, setMode] = useState("image"); // "image" | "text"
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [text, setText] = useState("");
  const [bgGradient, setBgGradient] = useState(BG_GRADIENTS[0].value);
  const [fontSize, setFontSize] = useState(2); // index into FONT_SIZES
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      slideFromTop(topControlsRef.current);
      fadeUp(canvasRef.current, { delay: 0.08 });
      slideFromBottom(bottomBarRef.current, { delay: 0.1 });
    });
    return () => ctx.revert();
  }, []);

  useLayoutEffect(() => {
    if (!canvasRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(canvasRef.current, { opacity: 0, scale: 0.97 }, { opacity: 1, scale: 1, duration: 0.25 });
    });
    return () => ctx.revert();
  }, [mode]);

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setError(null);
    setPreview(URL.createObjectURL(f));
  };

  const clearMedia = () => {
    setFile(null);
    setPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setError(null);
    if (mode === "text" && !text.trim()) { setError("Write something first."); return; }
    if (mode === "image" && !file) { setError("Select a photo or video first."); return; }
    setIsSubmitting(true);
    try {
      if (mode === "text") {
        await createTextStory({ type: "text", text: text.trim(), backgroundColor: bgGradient });
      } else {
        const fd = new FormData();
        fd.append("media", file);
        fd.append("type", file.type.startsWith("video") ? "video" : "image");
        if (text.trim()) fd.append("text", text.trim());
        await createStory(fd);
      }
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || "Failed to post story.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative w-full h-full bg-black overflow-hidden flex flex-col">

      {/* ══ CANVAS ══════════════════════════════════════════════════════════ */}
      <div ref={canvasRef} className="relative flex-1 overflow-hidden">

        {/* Background */}
        {mode === "text" ? (
          <div
            className="absolute inset-0 transition-all duration-500"
            style={{ background: bgGradient }}
          />
        ) : (
          <div className="absolute inset-0 bg-black" />
        )}

        {/* Media preview (image mode) */}
        {mode === "image" && preview && (
          <div className="absolute inset-0 flex items-center justify-center">
            {file?.type.startsWith("video") ? (
              <video
                src={preview}
                className="w-full h-full object-contain"
                autoPlay muted loop playsInline
              />
            ) : (
              <img
                src={preview}
                alt=""
                className="w-full h-full object-contain"
                draggable={false}
              />
            )}
          </div>
        )}

        {/* Empty image state */}
        {mode === "image" && !preview && (
          <button
            className="absolute inset-0 flex flex-col items-center justify-center gap-4"
            onClick={() => fileRef.current?.click()}
          >
            <div className="w-20 h-20 rounded-full bg-white/10 border border-white/20 flex items-center justify-center">
              <Image className="w-9 h-9 text-white/60" />
            </div>
            <span className="text-white/60 text-sm">Tap to select a photo or video</span>
          </button>
        )}

        {/* Text overlay / editor (text mode) */}
        {mode === "text" && (
          <div className="absolute inset-0 flex items-center justify-center p-8">
            <textarea
              ref={textRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="What's on your mind?"
              maxLength={200}
              rows={4}
              className={cn(
                "w-full bg-transparent text-white font-bold text-center placeholder:text-white/40 resize-none outline-none leading-tight",
                FONT_SIZES[fontSize]
              )}
              style={{ textShadow: "0 2px 8px rgba(0,0,0,0.4)", caretColor: "white" }}
            />
          </div>
        )}

        {/* Caption on image (when media selected) */}
        {mode === "image" && preview && (
          <div className="absolute bottom-0 inset-x-0 px-4 pb-4">
            <div className="flex items-end gap-2 bg-black/40 backdrop-blur-sm border border-white/20 rounded-2xl px-4 py-2">
              <textarea
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                }}
                placeholder="Add a caption…"
                maxLength={500}
                rows={1}
                className="flex-1 bg-transparent text-white text-sm placeholder:text-white/50 resize-none outline-none leading-snug max-h-[120px] overflow-y-auto"
              />
            </div>
          </div>
        )}

        {/* ── Top controls overlay ── */}
        <div ref={topControlsRef} className="absolute top-0 inset-x-0 flex items-center justify-between px-3 pt-12 pb-4 z-10"
          style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.5), transparent)" }}>

          <button
            className="w-9 h-9 flex items-center justify-center rounded-full bg-black/30 text-white active:bg-black/50"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {/* Mode toggle pills */}
          <div className="flex bg-black/30 backdrop-blur-sm rounded-full p-0.5 border border-white/10">
            {[
              { id: "image", icon: <Image className="w-4 h-4" />, label: "Photo" },
              { id: "text",  icon: <Type  className="w-4 h-4" />, label: "Text"  },
            ].map(({ id, icon, label }) => (
              <button
                key={id}
                onClick={() => setMode(id)}
                className={cn(
                  "flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-200",
                  mode === id
                    ? "bg-white text-black shadow"
                    : "text-white/70"
                )}
              >
                {icon}
                {label}
              </button>
            ))}
          </div>

          {/* Remove media / font size */}
          <div className="flex items-center gap-1">
            {mode === "image" && preview && (
              <button
                className="w-9 h-9 flex items-center justify-center rounded-full bg-black/30 text-white active:bg-black/50"
                onClick={clearMedia}
              >
                <X className="w-4 h-4" />
              </button>
            )}
            {mode === "text" && (
              <button
                className="w-9 h-9 flex items-center justify-center rounded-full bg-black/30 text-white text-xs font-bold active:bg-black/50"
                onClick={() => setFontSize((f) => (f + 1) % FONT_SIZES.length)}
              >
                {FONT_SIZE_LABELS[fontSize]}
              </button>
            )}
            {mode === "image" && !preview && <div className="w-9 h-9" />}
          </div>
        </div>

        {/* ── Change media button (when preview shown) ── */}
        {mode === "image" && preview && (
          <button
            className="absolute top-14 right-3 z-10 bg-black/30 border border-white/20 text-white text-xs rounded-full px-3 py-1.5 active:bg-black/50"
            onClick={() => fileRef.current?.click()}
          >
            Change
          </button>
        )}
      </div>

      {/* ══ BOTTOM TOOLBAR ═══════════════════════════════════════════════════ */}
      <div
        ref={bottomBarRef}
        className="flex-shrink-0 pb-8 pt-3 z-10"
        style={{ background: "linear-gradient(to top, rgba(0,0,0,0.8), transparent)" }}
      >
        {/* Gradient palette (text mode only) */}
        {mode === "text" && (
          <div className="flex justify-center gap-2.5 mb-4 px-4">
            {BG_GRADIENTS.map((g) => (
              <button
                key={g.value}
                onClick={() => setBgGradient(g.value)}
                className={cn(
                  "w-8 h-8 rounded-full flex-shrink-0 transition-transform duration-150",
                  bgGradient === g.value ? "scale-125 ring-2 ring-white ring-offset-1 ring-offset-transparent" : "scale-100"
                )}
                style={{ background: g.value }}
                title={g.label}
              />
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <p className="text-center text-red-400 text-xs mb-3 px-6">{error}</p>
        )}

        {/* Share button */}
        <div className="px-4">
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className={cn(
              "w-full h-12 rounded-full font-semibold text-sm flex items-center justify-center gap-2 transition-all",
              isSubmitting
                ? "bg-white/20 text-white/50 cursor-not-allowed"
                : "bg-white text-black active:scale-95"
            )}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Sharing…
              </>
            ) : (
              "Share to Story"
            )}
          </button>
        </div>

        {/* Select media button (image mode, no preview) */}
        {mode === "image" && !preview && (
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full mt-3 text-center text-white/50 text-xs pb-1"
          >
            or tap the canvas to browse
          </button>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={handleFileChange}
      />

    </div>
  );
}
