import React, { useEffect, useRef, useState, useCallback, useLayoutEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import icons from "../assets/icons/icons";
import { useTheme } from "../contexts/ThemeContext";
import { useSocket } from "../contexts/SocketContext";
import { useChat } from "../contexts/ChatContext";
import { useCall } from "../contexts/CallContext";
import { useAuth } from "../contexts/AuthContext";
import { getConversation } from "../services/chatService";
import VoiceVisualizer from "../components/VoiceVisualizer";
import VoiceMessage from "../components/VoiceMessage";
import { allImages } from "../hooks/imageImporter";
import gsap from "gsap";
import { slideFromTop } from "@/utils/animations";
import GradualBlur from "../components/GradualBlur/GradualBlur";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "swiper/css/free-mode";
import "swiper/css/pagination";
import { FreeMode, Pagination } from "swiper/modules";
import { DotPulse } from "ldrs/react";
import "ldrs/react/DotPulse.css";
import { formatTime } from "../utils/formatTime";
import { EMOJIS } from "../utils/constants";
import ImageLightbox from "../components/ui/ImageLightbox";
import ForwardDialog from "../components/ui/ForwardDialog";
import LinkPreview from "../components/ui/LinkPreview";
import { compressImage, compressVideo, MAX_SIZE } from "../utils/mediaCompression";

const MAX_FILE_SIZE = MAX_SIZE; // from mediaCompression (15MB after compression)
const URL_RE = /https?:\/\/[^\s]+/;

const highlightMatch = (text, query) => {
  if (!query || !text) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="search-highlight">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
};

/* ─── helpers ─────────────────────────────────────────────────────────────── */
const getDateLabel = (dateStr) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
};

const formatAudioDuration = (secs = 0) => {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
};

/* ─── component ─────────────────────────────────────────────────────────────*/
export default function ChatPage() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const roomId = conversationId;

  const { dbUser } = useAuth();
  const {
    isBright,
    bgimage,
    handleSetBgImage,
    videoOn,
    setVideoOn,
    videoRef,
    bgimageRef,
  } = useTheme();
  const { socket, isConnected: socketConnected } = useSocket();
  const {
    messages,
    setMessages,
    remoteTyping,
    editingMessageId,
    setEditingMessageId,
    editMessageText,
    setEditMessageText,
    replyTo,
    setReplyTo,
    activeConversationId,
    setActiveConversationId,
    isLoadingMessages,
    hasMoreMessages,
    loadMessages,
    loadMoreMessages,
    sendMessage: ctxSendMessage,
    sendImage,
    sendAudio,
    editMessage,
    cancelEdit,
    deleteMessage,
    handleInputChange: ctxHandleInputChange,
    toggleEmojiReaction,
    addSystemMessage,
    forwardMessage,
  } = useChat();
  const {
    isAudioActive,
    remoteStream,
    isMuted,
    isAnswer,
    callDuration,
    audioRef,
    callIndicatorRef,
    toggleAudio,
    toggleMute,
  } = useCall();

  /* ── basic state ── */
  const [inputMessage, setInputMessage] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [dockHeight, setDockHeight] = useState(0);
  const [isChatVisible, setIsChatVisible] = useState(true);
  const [emojiReactionMessage, setEmojiReactionMessage] = useState(null);
  const [emojiPickerPosition, setEmojiPickerPosition] = useState({
    x: 0,
    y: 0,
  });
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState(null);

  /* ── lightbox ── */
  const [lightboxSrc, setLightboxSrc] = useState(null);

  /* ── wallpaper picker ── */
  const [wallpaperOpen, setWallpaperOpen] = useState(false);
  const [wallpaperTab, setWallpaperTab] = useState("photos"); // "photos" | "colors"
  const wallpaperFileRef = useRef(null);
  const wallpaperSheetRef = useRef(null);
  const wallpaperOverlayRef = useRef(null);

  /* ── nav dropdown ── */
  const [navAvatarFailed, setNavAvatarFailed] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  /* ── message search ── */
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  /* ── forward dialog ── */
  const [forwardMsg, setForwardMsg] = useState(null);


  /* ── context menu ── */
  const [contextMenu, setContextMenu] = useState(null); // msg object
  const contextMenuRef = useRef(null);
  const contextMenuOverlayRef = useRef(null);

  /* ── scroll-to-bottom ── */
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [unreadWhileAway, setUnreadWhileAway] = useState(0);
  const isAtBottomRef = useRef(true);

  /* ── voice recording ── */
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingDurationRef = useRef(0); // ref copy avoids stale closure in stopRecording
  const recordingMimeTypeRef = useRef("audio/webm"); // actual mimeType used by MediaRecorder
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);


  /* ── gallery long press ── */
  const [longPressTimeout, setLongPressTimeout] = useState(null);

  /* ── conversation header ── */
  const [otherUser, setOtherUser] = useState(null);

  /* ── refs ── */
  const dockRef = useRef(null);
  const containerRef = useRef(null);
  const navRef = useRef(null);
  const messagesEndRef = useRef(null);
  const sendButtonRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const chatContainerRef = useRef(null);
  const gelaryRef = useRef(null);
  const longPressTimeoutRef = useRef(null);
  const editButtonRef = useRef(null);
  const plusButtonRef = useRef(null);
  const inputRef = useRef(null);
  const lastMessageIdRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const fileInputRef = useRef(null);
  const prevContentState = useRef(false);

  /* ── nav entrance ── */
  useLayoutEffect(() => {
    if (!navRef.current) return;
    const ctx = gsap.context(() => {
      slideFromTop(navRef.current);
    }, navRef);
    return () => ctx.revert();
  }, []);

  /* ─────────────────────────────────────────────────────────────────────────
   * Load messages on mount
   * ─────────────────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (roomId) loadMessages(roomId);
  }, [roomId, loadMessages]);

  // Sync activeConversationId so ChatContext handlers accept incoming messages
  useEffect(() => {
    setActiveConversationId(roomId || null);
    return () => setActiveConversationId(null);
  }, [roomId, setActiveConversationId]);

  /* ── Fetch other participant info ── */
  useEffect(() => {
    if (!conversationId || !/^[0-9a-fA-F]{24}$/.test(conversationId)) return;
    getConversation(conversationId)
      .then((res) => {
        const conv = res.data.conversation;
        const other = conv.participants?.find((p) => p._id !== dbUser?._id);
        setOtherUser(other || null);
        setNavAvatarFailed(false);
      })
      .catch(() => {});
  }, [conversationId, dbUser?._id]);

  /* ─────────────────────────────────────────────────────────────────────────
   * Pagination scroll
   * ─────────────────────────────────────────────────────────────────────── */
  const handleMessagesScroll = useCallback(
    (e) => {
      const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
      if (scrollTop < 80 && hasMoreMessages && !isLoadingMessages) {
        loadMoreMessages(roomId, e.currentTarget);
      }
      const distFromBottom = scrollHeight - scrollTop - clientHeight;
      const atBottom = distFromBottom < 120;
      isAtBottomRef.current = atBottom;
      setIsAtBottom(atBottom);
      if (atBottom) setUnreadWhileAway(0);
    },
    [roomId, hasMoreMessages, isLoadingMessages, loadMoreMessages],
  );

  /* ─────────────────────────────────────────────────────────────────────────
   * Track unread count while scrolled up
   * ─────────────────────────────────────────────────────────────────────── */
  const prevMsgCountRef = useRef(0);
  useEffect(() => {
    if (messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (
      !last.isMe &&
      !isAtBottomRef.current &&
      messages.length > prevMsgCountRef.current
    ) {
      setUnreadWhileAway((n) => n + 1);
    }
    prevMsgCountRef.current = messages.length;
  }, [messages.length]);

  /* ── Auto-dismiss upload error after 6 s ── */
  useEffect(() => {
    if (!uploadError) return;
    const t = setTimeout(() => setUploadError(null), 6000);
    return () => clearTimeout(t);
  }, [uploadError]);

  /* ─────────────────────────────────────────────────────────────────────────
   * Socket room events
   * ─────────────────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!socket || !roomId) return;
    socket.roomId = roomId;
    socket.emit("join-room", roomId);

    // Re-join room after socket reconnects (socket.io reuses the same object,
    // so the [socket, roomId] deps don't change — we must listen for "connect")
    const handleReconnect = () => {
      socket.roomId = roomId;
      socket.emit("join-room", roomId);
    };

    const handleRoomJoined = (data) => {
      setIsConnected(data.userCount > 1);
    };
    const handleUserConnected = () => {
      setIsConnected(true);
    };
    const handleUserDisconnected = () => {
      setIsConnected(false);
    };
    const handleSetBackground = (data) => {
      handleSetBgImage(data.imageUrl);
    };

    socket.on("connect", handleReconnect);
    socket.on("room-joined", handleRoomJoined);
    socket.on("user-connected", handleUserConnected);
    socket.on("user-disconnected", handleUserDisconnected);
    socket.on("set-background", handleSetBackground);

    return () => {
      socket.off("connect", handleReconnect);
      socket.off("room-joined", handleRoomJoined);
      socket.off("user-connected", handleUserConnected);
      socket.off("user-disconnected", handleUserDisconnected);
      socket.off("set-background", handleSetBackground);
    };
  }, [socket, roomId]);

  /* ─────────────────────────────────────────────────────────────────────────
   * Read receipts via Intersection Observer
   * ─────────────────────────────────────────────────────────────────────── */
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container || !socket?.connected) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const messageId = entry.target.dataset.messageId;
            const isMe = entry.target.dataset.isMe === "true";
            if (messageId && !isMe) {
              socket.emit("message-read", {
                messageId,
                timestamp: new Date().toISOString(),
              });
            }
          }
        });
      },
      { root: container, threshold: [0.1, 0.5] },
    );
    const els = container.querySelectorAll(".message[data-message-id]");
    els.forEach((el) => observer.observe(el));
    return () => {
      els.forEach((el) => observer.unobserve(el));
      observer.disconnect();
    };
  }, [messages, socket]);

  /* ─────────────────────────────────────────────────────────────────────────
   * Auto-scroll to bottom on new messages
   * ─────────────────────────────────────────────────────────────────────── */
  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container || messages.length === 0) return;
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.id !== lastMessageIdRef.current) {
      lastMessageIdRef.current = lastMessage.id;
      if (lastMessage.isMe || isAtBottomRef.current) {
        requestAnimationFrame(() => {
          setTimeout(
            () =>
              messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }),
            100,
          );
        });
      }
    }
  }, [messages]);

  /* ─────────────────────────────────────────────────────────────────────────
   * Dock height observer
   * ─────────────────────────────────────────────────────────────────────── */
  useEffect(() => {
    const dock = dockRef.current;
    if (!dock) return;
    const update = () => setDockHeight(dock.getBoundingClientRect().height);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(dock);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  /* ─────────────────────────────────────────────────────────────────────────
   * Send/Plus button GSAP toggle
   * ─────────────────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!sendButtonRef.current) return;
    const hasContent =
      (editMessageText && editMessageText.trim().length > 0) ||
      (inputMessage && inputMessage.trim().length > 0);
    if (hasContent === prevContentState.current) return;
    prevContentState.current = hasContent;
    const tl = gsap.timeline({ defaults: { duration: 0.2 } });
    if (hasContent) {
      tl.to(sendButtonRef.current, { display: "grid" }).to(
        sendButtonRef.current,
        {
          opacity: 1,
          pointerEvents: "all",
          width: "var(--svg-size)",
          marginInline: "var(--space-1)",
        },
      );
      gsap
        .timeline({ defaults: { duration: 0.2 } })
        .to(plusButtonRef.current, {
          opacity: 0,
          marginInline: "0px",
          width: "0",
          pointerEvents: "none",
        })
        .to(plusButtonRef.current, { display: "none" });
    } else {
      tl.to(sendButtonRef.current, {
        opacity: 0,
        marginInline: "0px",
        width: "0",
        pointerEvents: "none",
      }).to(sendButtonRef.current, { display: "none" });
      if (editingMessageId == null && editButtonRef.current) {
        gsap
          .timeline({ defaults: { duration: 0.2 } })
          .to(editButtonRef.current, {
            opacity: 0,
            marginInline: "0px",
            width: "0",
            pointerEvents: "none",
          })
          .to(editButtonRef.current, { display: "none" });
      }
      gsap
        .timeline({ defaults: { duration: 0.2 } })
        .to(plusButtonRef.current, { display: "grid" })
        .to(plusButtonRef.current, {
          opacity: 1,
          pointerEvents: "all",
          width: "var(--svg-size)",
          marginInline: "var(--space-1)",
        });
    }
  }, [editMessageText, inputMessage]);

  useEffect(() => {
    if (editingMessageId == null && editButtonRef.current) {
      gsap
        .timeline({ defaults: { duration: 0.2 } })
        .to(editButtonRef.current, {
          opacity: 0,
          marginInline: "0px",
          width: "0",
          pointerEvents: "none",
        })
        .to(editButtonRef.current, { display: "none" });
    }
  }, [editingMessageId]);

  /* ─────────────────────────────────────────────────────────────────────────
   * Click-outside closes emoji picker
   * ─────────────────────────────────────────────────────────────────────── */
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(event.target)
      ) {
        if (!event.target.closest(".message")) {
          closePicker();
          setEmojiReactionMessage(null);
        }
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  /* ═══════════════════════════════════════════════════════════════════════════
   * HANDLERS
   * ═══════════════════════════════════════════════════════════════════════ */

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (editingMessageId) {
      editMessage(roomId);
    } else {
      ctxSendMessage(inputMessage, roomId, replyTo);
      setInputMessage("");
      setReplyTo(null);
    }
    inputRef.current?.focus();
  };

  /* ── dock toggle ── */
  const toggleDock = () => {
    if (!dockRef.current) return;
    const isShowing = dockRef.current.classList.contains("show");
    const spans = dockRef.current.querySelectorAll("span");
    if (!isShowing) {
      dockRef.current.classList.add("show");
      gsap
        .timeline()
        .to(spans, {
          height: "var(--size)",
          marginTop: "var(--space-2)",
          duration: 0.2,
          ease: "power1.out",
        })
        .to(spans, { opacity: 1, stagger: 0.1, ease: "power1.out" });
    } else {
      gsap
        .timeline()
        .to(spans, {
          opacity: 0,
          stagger: 0.1,
          duration: 0.1,
          ease: "power1.out",
        })
        .to(spans, {
          height: 0,
          marginTop: 0,
          duration: 0.2,
          delay: 0.15,
          ease: "power1.out",
          onComplete: () => dockRef.current?.classList.remove("show"),
        });
    }
  };

  const copyRoomLink = () => {
    const link = `${window.location.origin}/chat/${roomId}`;
    navigator.clipboard.writeText(link).catch(() => {});
  };

  const startCamera = async () => {
    if (!videoOn) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
        if (!videoRef.current) return;
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        videoRef.current.playsInline = true;
        videoRef.current.autoplay = true;
        videoRef.current.style.transform = "scaleX(-1)";
        videoRef.current.onloadedmetadata = async () => {
          try {
            await videoRef.current.play();
            setVideoOn(true);
          } catch (err) {
            console.warn("Camera play error:", err);
          }
        };
      } catch (err) {
        console.warn("Camera access denied:", err);
      }
    } else {
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
        videoRef.current.srcObject = null;
      }
      setVideoOn(false);
    }
  };

  /* ── nav dropdown GSAP ── */
  const openDropdown = () => {
    setDropdownOpen(true);
    requestAnimationFrame(() => {
      if (!dropdownRef.current) return;
      const items = dropdownRef.current.querySelectorAll(".dropdown-item");
      gsap.fromTo(
        dropdownRef.current,
        { opacity: 0, scale: 0.86, y: -10, transformOrigin: "top right" },
        { opacity: 1, scale: 1, y: 0, duration: 0.32, ease: "back.out(1.8)" }
      );
      gsap.fromTo(
        items,
        { opacity: 0, x: 14 },
        { opacity: 1, x: 0, stagger: 0.055, duration: 0.22, delay: 0.1, ease: "power2.out" }
      );
    });
  };

  const closeDropdown = (cb) => {
    if (!dropdownRef.current) { setDropdownOpen(false); cb?.(); return; }
    gsap.to(dropdownRef.current, {
      opacity: 0, scale: 0.86, y: -10,
      duration: 0.2, ease: "back.in(1.8)",
      onComplete: () => { setDropdownOpen(false); cb?.(); },
    });
  };

  const toggleDropdown = () => (dropdownOpen ? closeDropdown() : openDropdown());

  /* click-outside to close dropdown */
  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e) => {
      if (!dropdownRef.current?.closest(".nav-avatar-wrap")?.contains(e.target)) {
        closeDropdown();
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dropdownOpen]);

  /* ── solid color presets ── */
  const solidColors = [
    { name: "Midnight", value: "#0a0a0a" },
    { name: "Charcoal", value: "#1a1a2e" },
    { name: "Navy", value: "#0f1b2d" },
    { name: "Deep Teal", value: "#0d2b2b" },
    { name: "Forest", value: "#1a2e1a" },
    { name: "Wine", value: "#2e1a1a" },
    { name: "Indigo", value: "#1a1a3e" },
    { name: "Slate", value: "#2d3748" },
    { name: "Storm", value: "#374151" },
    { name: "Graphite", value: "#4a5568" },
    { name: "Fog", value: "#94a3b8" },
    { name: "Cloud", value: "#cbd5e1" },
    { name: "Pearl", value: "#e2e8f0" },
    { name: "Snow", value: "#f1f5f9" },
    { name: "Blush", value: "#fce4ec" },
    { name: "Lavender", value: "#ede9fe" },
    { name: "Mint", value: "#d1fae5" },
    { name: "Sky", value: "#dbeafe" },
  ];

  /* ── wallpaper sheet animation ── */
  const openWallpaperSheet = useCallback(() => {
    setWallpaperOpen(true);
    requestAnimationFrame(() => {
      if (wallpaperOverlayRef.current) {
        gsap.fromTo(wallpaperOverlayRef.current, { opacity: 0 }, { opacity: 1, duration: 0.25, ease: "power2.out" });
      }
      if (wallpaperSheetRef.current) {
        gsap.fromTo(wallpaperSheetRef.current, { y: "100%" }, { y: "0%", duration: 0.35, ease: "power3.out" });
      }
    });
  }, []);

  const closeWallpaperSheet = useCallback(() => {
    const tl = gsap.timeline({
      onComplete: () => setWallpaperOpen(false),
    });
    if (wallpaperSheetRef.current) {
      tl.to(wallpaperSheetRef.current, { y: "100%", duration: 0.25, ease: "power2.in" }, 0);
    }
    if (wallpaperOverlayRef.current) {
      tl.to(wallpaperOverlayRef.current, { opacity: 0, duration: 0.2 }, 0.05);
    }
  }, []);

  /* ── custom wallpaper upload ── */
  const handleWallpaperUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = "";
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      handleSetBgImageForBoth(dataUrl, "custom");
      closeWallpaperSheet();
    };
    reader.readAsDataURL(file);
  };

  /* ── gallery bg ── */
  const handleSetBgImageForBoth = (src, name) => {
    handleSetBgImage(src);
    if (socket)
      socket.emit("set-background", { imageUrl: src, imageName: name, roomId });
  };
  const handleLongPressStart = (src, name) => {
    const t = setTimeout(() => handleSetBgImageForBoth(src, name), 1200);
    setLongPressTimeout(t);
  };
  const handleLongPressEnd = () => {
    if (longPressTimeout) {
      clearTimeout(longPressTimeout);
      setLongPressTimeout(null);
    }
  };

  /* ─────────────────────────────────────────────────────────────────────────
   * CONTEXT MENU
   * ─────────────────────────────────────────────────────────────────────── */
  const showContextMenu = (msg) => {
    if (msg.isSystem || msg.deleted) return;
    setContextMenu(msg);
    requestAnimationFrame(() => {
      if (contextMenuRef.current) {
        gsap.fromTo(
          contextMenuRef.current,
          { y: 300, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.35, ease: "power3.out" },
        );
      }
    });
  };

  const hideContextMenu = () => {
    if (!contextMenuRef.current) {
      setContextMenu(null);
      return;
    }
    gsap.to(contextMenuRef.current, {
      y: 300,
      opacity: 0,
      duration: 0.25,
      ease: "power2.in",
      onComplete: () => setContextMenu(null),
    });
  };

  const handleContextReply = () => {
    // Capture only the fields needed for replyTo shape
    const { id, text, imageUrl, audioUrl, isMe, dbId } = contextMenu;
    setReplyTo({ id, text, imageUrl, audioUrl, isMe, dbId });
    hideContextMenu();
    setTimeout(() => inputRef.current?.focus(), 300);
  };

  const handleContextCopy = () => {
    const text = contextMenu?.text;
    hideContextMenu();
    if (text) navigator.clipboard.writeText(text).catch(() => {});
  };

  const handleContextEdit = () => {
    const { id, text } = contextMenu;
    setEditingMessageId(id);
    setEditMessageText(text || "");
    if (editButtonRef.current) {
      gsap
        .timeline({ defaults: { duration: 0.2 } })
        .to(editButtonRef.current, { display: "grid" })
        .to(editButtonRef.current, {
          opacity: 1,
          pointerEvents: "all",
          width: "var(--svg-size)",
          marginInline: "var(--space-1)",
        });
    }
    hideContextMenu();
    setTimeout(() => inputRef.current?.focus(), 300);
  };

  const handleContextDelete = (forEveryone) => {
    const { id } = contextMenu;
    deleteMessage(id, roomId, forEveryone);
    hideContextMenu();
  };

  const handleContextForward = () => {
    const msg = contextMenu;
    hideContextMenu();
    setTimeout(() => setForwardMsg(msg), 300);
  };

  const handleContextReact = () => {
    // Capture before hiding (hideContextMenu sets contextMenu to null async)
    const msg = contextMenu;
    hideContextMenu();
    setTimeout(() => {
      const el = document.querySelector(`[data-message-id="${msg.id}"]`);
      if (el) {
        const rect = el.getBoundingClientRect();
        showEmojiPickerAt(msg, rect);
      }
    }, 300);
  };

  /* ── long-press detection ── */
  const handleMessageLongPress = (msg) => {
    if (msg.isSystem || msg.deleted) return;
    longPressTimeoutRef.current = setTimeout(() => showContextMenu(msg), 500);
  };

  const cancelLongPress = () => {
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
  };

  /* ─────────────────────────────────────────────────────────────────────────
   * EMOJI PICKER
   * ─────────────────────────────────────────────────────────────────────── */
  const showEmojiPickerAt = (msg, messageRect) => {
    const pickerWidth = 270;
    const pickerHeight = 60;
    let desiredX = messageRect.left + messageRect.width / 2;
    const vw = window.innerWidth;
    const vh = window.innerHeight - 50;
    if (desiredX - pickerWidth / 2 < 10) desiredX = pickerWidth / 2 + 10;
    else if (desiredX + pickerWidth / 2 > vw - 10)
      desiredX = vw - pickerWidth / 2 - 10;
    const desiredYAbove = messageRect.top - pickerHeight - 10;
    const desiredYBelow = messageRect.bottom + 10;
    let finalY;
    const emojies = emojiPickerRef.current?.querySelectorAll("button");
    const tl = gsap.timeline();
    const showAt = (y, yDir) => {
      finalY = y;
      tl.to(emojiPickerRef.current, {
        opacity: 1,
        pointerEvents: "all",
        display: "flex",
        y: yDir,
        duration: 0.3,
      }).to(emojies, {
        scale: 1,
        opacity: 1,
        ease: "elastic.out(1,0.3)",
        duration: 1,
        delay: -0.45,
        stagger: 0.1,
      });
    };
    if (desiredYAbove >= 10) showAt(desiredYAbove + 15, 10);
    else if (desiredYBelow + pickerHeight <= vh - 10)
      showAt(desiredYBelow + 5, -10);
    else showAt((vh - pickerHeight) / 2, -10);
    setEmojiReactionMessage(msg);
    setEmojiPickerPosition({ x: desiredX, y: finalY });
  };

  const handleDoubleClick = (msg, e) => {
    if (msg.isSystem || msg.deleted) return;
    showEmojiPickerAt(msg, e.currentTarget.getBoundingClientRect());
  };

  const handleEmojiReaction = (emoji) => {
    if (!emojiReactionMessage) return;
    toggleEmojiReaction(emoji, emojiReactionMessage.id, roomId);
    setEmojiReactionMessage(null);
    closePicker();
  };

  function closePicker() {
    if (!emojiPickerRef.current) return;
    const emojies = emojiPickerRef.current.querySelectorAll("button");
    gsap
      .timeline()
      .to(emojiPickerRef.current, {
        opacity: 0,
        pointerEvents: "none",
        display: "none",
        y: 0,
        duration: 0.3,
      })
      .to(emojies, { scale: 0.3, opacity: 0, duration: 0 }, ">-2");
  }

  /* ─────────────────────────────────────────────────────────────────────────
   * IMAGE UPLOAD
   * ─────────────────────────────────────────────────────────────────────── */
  async function handleImageSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = "";

    setIsUploading(true);
    setUploadProgress(0);
    setUploadError(null);
    try {
      let compressed;
      if (file.type.startsWith("video/")) {
        compressed = await compressVideo(file);
      } else {
        compressed = await compressImage(file);
      }

      if (compressed.size > MAX_FILE_SIZE) {
        setUploadError(`File is too large (${(compressed.size / (1024 * 1024)).toFixed(1)}MB). Maximum is ${(MAX_FILE_SIZE / (1024 * 1024)).toFixed(0)}MB.`);
        return;
      }

      await sendImage(compressed, roomId, (p) => setUploadProgress(p));
    } catch (err) {
      setUploadError(err.message || "Failed to send media. Please try again.");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  }

  const handleDownload = async (msg) => {
    try {
      const url = msg.imageUrl || msg.url || msg.imgData?.url;
      if (!url) return;
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = msg.fileName || `image-${Date.now()}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 100);
    } catch {
      /* silent */
    }
  };

  /* ─────────────────────────────────────────────────────────────────────────
   * VOICE RECORDING
   * ─────────────────────────────────────────────────────────────────────── */
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : MediaRecorder.isTypeSupported("audio/mp4")
            ? "audio/mp4"
            : "";

      recordingMimeTypeRef.current = mimeType || "audio/webm";
      recordingDurationRef.current = 0;

      const mediaRecorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : {},
      );
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.start(100); // collect data every 100ms so chunks arrive reliably
      setIsRecording(true);
      setRecordingDuration(0);

      recordingTimerRef.current = setInterval(() => {
        recordingDurationRef.current += 1;
        setRecordingDuration(recordingDurationRef.current);
      }, 1000);
    } catch (err) {
      console.error("startRecording error:", err);
      setUploadError("Microphone access denied. Please check permissions.");
    }
  };

  const stopRecording = () => {
    if (
      !mediaRecorderRef.current ||
      mediaRecorderRef.current.state === "inactive"
    )
      return;
    clearInterval(recordingTimerRef.current);

    // Use ref — never stale regardless of re-render cycle
    const duration = recordingDurationRef.current;
    const mimeType = recordingMimeTypeRef.current;

    mediaRecorderRef.current.onstop = async () => {
      const blob = new Blob(audioChunksRef.current, { type: mimeType });
      // Stop all mic tracks
      mediaRecorderRef.current?.stream?.getTracks().forEach((t) => t.stop());

      if (duration >= 1) {
        if (blob.size > MAX_FILE_SIZE) {
          setUploadError(`Voice message is too large (${(blob.size / (1024 * 1024)).toFixed(1)}MB). Try a shorter recording.`);
        } else {
          try {
            await sendAudio(blob, duration, roomId);
          } catch (err) {
            setUploadError(err.message || "Failed to send voice message. Please try again.");
          }
        }
      }
      setIsRecording(false);
      setRecordingDuration(0);
      recordingDurationRef.current = 0;
    };

    mediaRecorderRef.current.stop();
  };

  const cancelRecording = () => {
    clearInterval(recordingTimerRef.current);
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      // Clear onstop so no data is sent on cancel
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stream?.getTracks().forEach((t) => t.stop());
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setRecordingDuration(0);
    recordingDurationRef.current = 0;
  };


  /* ─────────────────────────────────────────────────────────────────────────
   * RENDER
   * ─────────────────────────────────────────────────────────────────────── */
  const iconFill = isBright ? "black" : "white";

  return (
    <div className="container" ref={containerRef}>
      {/* ── Chat Header (Telegram-style floating pills) ── */}
      <nav ref={navRef}>
        {/* Back pill with unread badge */}
        <button className="nav-back-pill" onClick={() => navigate(-1)}>
          <svg viewBox="0 0 24 24" fill="none" stroke={iconFill} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15,18 9,12 15,6" />
          </svg>
          {unreadWhileAway > 0 && (
            <span className="nav-back-badge">{unreadWhileAway > 99 ? "99+" : unreadWhileAway}</span>
          )}
        </button>

        {/* Center pill — name + status */}
        <div
          className="nav-center-pill"
          onClick={() => otherUser && navigate(`/profile/${otherUser._id}`)}
        >
          <span className="nav-name">
            {otherUser?.displayName || otherUser?.username || "Chat"}
          </span>
          {otherUser?.isOnline ? (
            <span className="nav-status online">Online</span>
          ) : otherUser?.lastSeen ? (
            <span className="nav-status">Last seen {formatTime(otherUser.lastSeen)}</span>
          ) : (
            <span className="nav-status">tap for more info</span>
          )}
        </div>

        {/* Avatar button + dropdown */}
        <div className="nav-avatar-wrap">
          <button className="nav-avatar-btn" onClick={toggleDropdown}>
            {otherUser?.avatarUrl && !navAvatarFailed ? (
              <img src={otherUser.avatarUrl} alt="" onError={() => setNavAvatarFailed(true)} />
            ) : (
              <span className="nav-avatar-initial">
                {(otherUser?.displayName || otherUser?.username || "?")[0]?.toUpperCase()}
              </span>
            )}
          </button>

          {/* GSAP Dropdown */}
          {dropdownOpen && (
            <div className="nav-dropdown" ref={dropdownRef}>
              {/* Profile */}
              <button className="dropdown-item" onClick={() => closeDropdown(() => otherUser && navigate(`/profile/${otherUser._id}`))}>
                <div className="dropdown-icon" style={{ background: "#00A884" }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
                <span className="dropdown-label">Profile</span>
              </button>

              <div className="dropdown-divider" />

              {/* Voice Call */}
              <button className="dropdown-item" onClick={() => closeDropdown(() => toggleAudio(roomId))} disabled={!isConnected} style={{ opacity: isConnected ? 1 : 0.45 }}>
                <div className="dropdown-icon" style={{ background: "#2196F3" }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 013.07 3.18 2 2 0 015.08 1h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L9.09 8.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
                  </svg>
                </div>
                <span className="dropdown-label">Voice Call</span>
              </button>

              {/* Video Call */}
              <button className="dropdown-item" style={{ opacity: 0.45 }}>
                <div className="dropdown-icon" style={{ background: "#9C27B0" }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="23,7 16,12 23,17" />
                    <rect x="1" y="5" width="15" height="14" rx="2" />
                  </svg>
                </div>
                <span className="dropdown-label">Video Call</span>
              </button>

              <div className="dropdown-divider" />

              {/* Change Background */}
              <button className="dropdown-item" onClick={() => closeDropdown(() => openWallpaperSheet())}>
                <div className="dropdown-icon" style={{ background: "#FF9800" }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21,15 16,10 5,21" />
                  </svg>
                </div>
                <span className="dropdown-label">Change Background</span>
              </button>

              {/* Search */}
              <button className="dropdown-item" onClick={() => closeDropdown(() => { setSearchOpen((o) => !o); setSearchQuery(""); })}>
                <div className="dropdown-icon" style={{ background: "#607D8B" }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </div>
                <span className="dropdown-label">Search</span>
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* ── Message search bar ── */}
      <div className={`chat-search-bar ${searchOpen ? "open" : ""}`}>
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search messages…"
          autoFocus={searchOpen}
        />
        {searchQuery && (
          <span className="search-count">
            {messages.filter((m) => m.text?.toLowerCase().includes(searchQuery.toLowerCase())).length} results
          </span>
        )}
      </div>

      {/* ── Call Indicator ── */}
      <div className="call-indecator" ref={callIndicatorRef}>
        <div
          className="timer"
          style={{
            color: isBright ? "var(--txt-clr)" : "var(--txt-clr-light)",
          }}
        >
          {callDuration}
        </div>
        <div className="audio-visualizer-container">
          <VoiceVisualizer audioStream={remoteStream} isBright={isBright} />
        </div>
        <button onClick={() => toggleAudio(roomId)}>
          {React.cloneElement(icons.call, { fill: iconFill })}
        </button>
      </div>

      {/* ── Messages area ── */}
      <div className="chat" ref={messagesContainerRef}>
        <div
          className="messages show"
          style={{ paddingBottom: `${dockHeight + 16}px`, paddingTop: searchOpen ? "6.5rem" : "5rem" }}
          ref={chatContainerRef}
          onScroll={handleMessagesScroll}
        >
          {isLoadingMessages && messages.length > 0 && (
            <div style={{ alignSelf: "center", padding: "var(--space-2)" }}>
              <DotPulse
                size="20"
                speed="1.3"
                color={isBright ? "var(--svg-fill)" : "var(--svg-fill-light)"}
              />
            </div>
          )}


          {/* ── Emoji picker ── */}
          <div
            ref={emojiPickerRef}
            className="emoji-picker-container"
            style={{
              position: "fixed",
              left: emojiPickerPosition.x,
              top: emojiPickerPosition.y,
              transform: "translateX(-50%)",
              zIndex: 1000,
            }}
          >
            <div className="emoji-picker">
              {EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  className="emoji-option"
                  onClick={() => handleEmojiReaction(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* ── Message list with date separators ── */}
          {(() => {
            const displayedMessages = searchQuery
              ? messages.filter((m) => m.text?.toLowerCase().includes(searchQuery.toLowerCase()))
              : messages;
            return displayedMessages.map((msg, index) => {
            const prevMsg = displayedMessages[index - 1];
            const showDateSep =
              msg.timestamp &&
              (index === 0 ||
                (prevMsg?.timestamp &&
                  new Date(msg.timestamp).toDateString() !==
                    new Date(prevMsg.timestamp).toDateString()));

            return (
              <React.Fragment key={msg.id || index}>
                {showDateSep && (
                  <div className="date-separator">
                    <span>{getDateLabel(msg.timestamp)}</span>
                  </div>
                )}

                <div
                  className={`message ${msg.isMe ? "from-me" : "from-them"} ${msg.isSystem ? "system-message" : ""} ${msg.deleted ? "deleted-message" : ""} ${editingMessageId === msg.id ? "editing" : ""}`}
                  dir="auto"
                  data-message-id={msg.id}
                  data-is-me={msg.isMe}
                  onMouseDown={() => handleMessageLongPress(msg)}
                  onMouseUp={cancelLongPress}
                  onMouseLeave={cancelLongPress}
                  onTouchStart={() => handleMessageLongPress(msg)}
                  onTouchEnd={cancelLongPress}
                  onDoubleClick={(e) => handleDoubleClick(msg, e)}
                >
                  {/* Hover actions (desktop) */}
                  {!msg.isSystem && !msg.deleted && (
                    <div className="hover-actions">
                      <button title="Reply" onClick={(e) => { e.stopPropagation(); const { id, text, imageUrl, audioUrl, isMe, dbId } = msg; setReplyTo({ id, text, imageUrl, audioUrl, isMe, dbId }); setTimeout(() => inputRef.current?.focus(), 50); }}>↩</button>
                      <button title="React" onClick={(e) => { e.stopPropagation(); showEmojiPickerAt(msg, e.currentTarget.closest(".message").getBoundingClientRect()); }}>😊</button>
                      <button title="More" onClick={(e) => { e.stopPropagation(); showContextMenu(msg); }}>⋯</button>
                    </div>
                  )}

                  {/* Deleted tombstone */}
                  {msg.deleted ? (
                    <p className="deleted-text" dir="auto">
                      <span style={{ marginInlineEnd: "4px" }}>🚫</span>
                      {msg.isMe
                        ? "You deleted this message"
                        : "This message was deleted"}
                    </p>
                  ) : (
                    <>
                      {/* Reply-to snippet */}
                      {msg.replyTo && (
                        <div className="reply-snippet">
                          <div className="reply-bar" />
                          <div className="reply-content">
                            <span className="reply-author">
                              {msg.replyTo.isMe
                                ? "You"
                                : otherUser?.displayName ||
                                  otherUser?.username ||
                                  "Them"}
                            </span>
                            <p className="reply-text">
                              {msg.replyTo.imageUrl
                                ? "📷 Photo"
                                : msg.replyTo.audioUrl
                                  ? "🎵 Voice message"
                                  : msg.replyTo.text || ""}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Shared post card */}
                      {msg.sharedPost ? (
                        <div
                          className="shared-post-card"
                          onClick={() =>
                            navigate(`/post/${msg.sharedPost._id}`)
                          }
                          style={{ cursor: "pointer" }}
                        >
                          <img
                            src={msg.sharedPost.imageUrl}
                            alt="post"
                            className="shared-post-thumb"
                          />
                          <div className="shared-post-body">
                            <div className="shared-post-author">
                              {msg.sharedPost.author?.avatarUrl ? (
                                <img
                                  src={msg.sharedPost.author.avatarUrl}
                                  alt=""
                                  className="shared-post-avatar"
                                  onError={(e) => {
                                    const name = msg.sharedPost.author?.displayName || msg.sharedPost.author?.username || "?";
                                    const el = e.currentTarget;
                                    const placeholder = document.createElement("div");
                                    placeholder.className = "shared-post-avatar-placeholder";
                                    placeholder.textContent = name[0].toUpperCase();
                                    el.replaceWith(placeholder);
                                  }}
                                />
                              ) : (
                                <div className="shared-post-avatar-placeholder">
                                  {(msg.sharedPost.author?.displayName ||
                                    msg.sharedPost.author?.username ||
                                    "?")[0].toUpperCase()}
                                </div>
                              )}
                              <span className="shared-post-username">
                                @
                                {msg.sharedPost.author?.username ||
                                  msg.sharedPost.author?.displayName}
                              </span>
                            </div>
                            {msg.sharedPost.caption && (
                              <p className="shared-post-caption">
                                {msg.sharedPost.caption}
                              </p>
                            )}
                            <div className="shared-post-stats">
                              <span>❤ {msg.sharedPost.likesCount}</span>
                              <span>💬 {msg.sharedPost.commentsCount}</span>
                            </div>
                            <p className="shared-post-cta">View post →</p>
                          </div>
                          {msg.text && (
                            <p className="shared-post-message">{msg.text}</p>
                          )}
                        </div>
                      ) : msg.url || msg.imageUrl ? (
                        (() => {
                          const mediaUrl = msg.url || msg.imageUrl;
                          const isVideoFile = /\.(mp4|webm|mov|avi|mkv)(\?|$)/i.test(mediaUrl);
                          return (
                            <div className="img-container" style={{ position: "relative" }}>
                              {!msg.isUploading && (
                                <button onClick={() => handleDownload(msg)}>
                                  {React.cloneElement(icons.download, { fill: iconFill })}
                                </button>
                              )}
                              {isVideoFile ? (
                                <video
                                  src={mediaUrl}
                                  controls
                                  playsInline
                                  style={{ maxWidth: "100%", borderRadius: 8, opacity: msg.isUploading ? 0.4 : 1 }}
                                  onClick={(e) => e.stopPropagation()}
                                />
                              ) : (
                                <img
                                  src={mediaUrl}
                                  alt=""
                                  onClick={(e) => { if (!msg.isUploading) { e.stopPropagation(); setLightboxSrc(mediaUrl); } }}
                                  style={{ cursor: msg.isUploading ? "default" : "zoom-in", opacity: msg.isUploading ? 0.4 : 1 }}
                                />
                              )}
                              {msg.isUploading && (
                                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, pointerEvents: "none" }}>
                                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
                                    <circle cx="12" cy="12" r="10" strokeOpacity="0.3" />
                                    <path d="M12 2a10 10 0 0 1 10 10">
                                      <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite" />
                                    </path>
                                  </svg>
                                  <span style={{ fontSize: 11, color: "#fff", fontWeight: 600, textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}>Uploading…</span>
                                </div>
                              )}
                            </div>
                          );
                        })()
                      ) : msg.audioUrl ? (
                        <VoiceMessage
                          msgId={msg.id}
                          audioUrl={msg.audioUrl}
                          duration={msg.audioDuration}
                          isUploading={msg.isUploading}
                          isMe={msg.isMe}
                          isBright={isBright}
                        />
                      ) : (
                        /* Text + optional link preview */
                        <>
                          <p dir="auto">{searchQuery ? highlightMatch(msg.text, searchQuery) : msg.text}</p>
                          {(() => {
                            const firstUrl = msg.text?.match(URL_RE)?.[0];
                            return firstUrl ? <LinkPreview url={firstUrl} /> : null;
                          })()}
                        </>
                      )}

                      {/* Message meta */}
                      <div
                        className={`message-meta ${(msg.url || msg.imageUrl) && !msg.sharedPost ? "image-meta" : ""}`}
                      >
                        {msg.timestamp && (
                          <span className="message-time">
                            {msg.reactions &&
                              Object.keys(msg.reactions).length > 0 && (
                                <div className="message-reactions">
                                  {Object.entries(msg.reactions)
                                    .filter(([, users]) => users.length > 0)
                                    .map(([emoji, users]) => {
                                      const reacted = users.includes(socket?.id) || users.includes(dbUser?._id);
                                      return (
                                        <button
                                          key={emoji}
                                          className={`reaction ${reacted ? "active" : ""}`}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleEmojiReaction(emoji);
                                          }}
                                        >
                                          {emoji}
                                          {users.length > 1 && (
                                            <span className="reaction-count">{users.length}</span>
                                          )}
                                        </button>
                                      );
                                    })}
                                </div>
                              )}
                            {formatTime(msg.timestamp)}
                            {msg.edited && (
                              <span className="edited-indicator">Edited</span>
                            )}
                          </span>
                        )}
                        {msg.isMe && !msg.isSystem && (
                          <span className={`read-indicator ${msg.read ? "read" : ""}`}>
                            {msg.read ? (
                              /* Double check teal */
                              <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
                                <path d="M1.5 12.5l5 5L17 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M7 12.5l5 5L22 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            ) : (
                              /* Single check gray */
                              <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
                                <path d="M4 12.5l5 5L20 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            )}
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </React.Fragment>
            );
          });
          })()}

          {remoteTyping && (
            <div className="message from-them typing-indicator" dir="auto">
              <DotPulse
                size="25"
                speed="1.3"
                color={isBright ? "var(--svg-fill)" : "var(--svg-fill-light)"}
              />
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <GradualBlur
          target="parent"
          position="top"
          height="6rem"
          strength={1.5}
          divCount={5}
          curve="bezier"
          exponential={true}
          opacity={1}
        />
      </div>

      {/* ── Scroll-to-bottom button ── */}
      {!isAtBottom && (
        <button
          className="scroll-to-bottom-btn"
          style={{ bottom: `${dockHeight + 24}px` }}
          onClick={() => {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
            setUnreadWhileAway(0);
            isAtBottomRef.current = true;
            setIsAtBottom(true);
          }}
        >
          {unreadWhileAway > 0 && (
            <span className="scroll-unread-badge">{unreadWhileAway}</span>
          )}
          <svg viewBox="0 0 24 24" fill={iconFill} width="20" height="20">
            <polyline
              points="6,9 12,15 18,9"
              fill="none"
              stroke={iconFill}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      )}

      {/* ── Audio / Video refs ── */}
      <audio ref={audioRef} autoPlay playsInline style={{ display: "none" }} />
      {videoOn && <video ref={videoRef} autoPlay muted playsInline />}
      {bgimage && bgimage.startsWith("#") ? (
        <div className="img-bg" ref={bgimageRef} style={{ backgroundColor: bgimage }} />
      ) : (
        <img src={bgimage} className="img-bg" alt="" ref={bgimageRef} />
      )}

      {/* ── Gallery ── */}
      <div
        className="gelary"
        ref={gelaryRef}
        style={{ bottom: `${dockHeight + 16}px` }}
      >
        <Swiper
          slidesPerView={4}
          spaceBetween={10}
          freeMode={true}
          breakpoints={{
            640: { slidesPerView: 3, spaceBetween: 20 },
            768: { slidesPerView: 3, spaceBetween: 40 },
            1024: { slidesPerView: 4, spaceBetween: 20 },
          }}
          modules={[FreeMode, Pagination]}
          className="mySwiper"
        >
          <SwiperSlide></SwiperSlide>
          {Object.entries(allImages).map(([name, { full, small }], index) => (
            <SwiperSlide
              key={index}
              onClick={() => handleSetBgImage(full)}
              onMouseDown={() => handleLongPressStart(full, name)}
              onMouseUp={handleLongPressEnd}
              onMouseLeave={handleLongPressEnd}
              onTouchStart={() => handleLongPressStart(full, name)}
              onTouchEnd={handleLongPressEnd}
              className={bgimage === full ? "selected" : ""}
            >
              <div className="img">
                <img src={small || full} alt={name} draggable="false" />
              </div>
            </SwiperSlide>
          ))}
          <SwiperSlide></SwiperSlide>
        </Swiper>
      </div>

      {/* ── Dock ── */}
      <div ref={dockRef} className="dock">
        {/* Reply preview bar */}
        {replyTo && !editingMessageId && (
          <div className="reply-preview-bar">
            <div className="reply-preview-accent" />
            <div className="reply-preview-content">
              <span className="reply-preview-author">
                {replyTo.isMe
                  ? "You"
                  : otherUser?.displayName || otherUser?.username || "Them"}
              </span>
              <p className="reply-preview-text">
                {replyTo.imageUrl
                  ? "📷 Photo"
                  : replyTo.audioUrl
                    ? "🎵 Voice message"
                    : replyTo.text}
              </p>
            </div>
            <button
              className="reply-preview-close"
              onClick={() => setReplyTo(null)}
            >
              <svg viewBox="0 0 24 24" fill={iconFill} width="16" height="16">
                <line
                  x1="18"
                  y1="6"
                  x2="6"
                  y2="18"
                  stroke={iconFill}
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <line
                  x1="6"
                  y1="6"
                  x2="18"
                  y2="18"
                  stroke={iconFill}
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        )}

        {/* Recording indicator */}
        {isRecording && (
          <div className="recording-indicator">
            <span className="recording-dot" />
            <span className="recording-time">
              {formatAudioDuration(recordingDuration)}
            </span>
            <span className="recording-label">Recording…</span>
            <button className="recording-cancel" onClick={cancelRecording}>
              Cancel
            </button>
          </div>
        )}

        <form onSubmit={handleSendMessage} className="message-input-form">
          {/* Cancel edit button */}
          <button
            type="button"
            onClick={cancelEdit}
            ref={editButtonRef}
            className="editButton"
          >
            {React.cloneElement(icons.cancel, { fill: iconFill })}
          </button>

          {/* Attach button (always left of input) */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            title="Attach image"
            style={{ position: "relative", overflow: "hidden", flexShrink: 0 }}
          >
            {isUploading ? (
              <div style={{ position: "relative", display: "grid", placeContent: "center" }}>
                <div
                  style={{
                    width: `${uploadProgress}%`,
                    height: "100%",
                    background: "rgba(0,0,0,0.15)",
                    position: "absolute",
                    top: 0,
                    left: 0,
                    transition: "width 0.3s ease",
                  }}
                />
                {React.cloneElement(icons.img, { fill: iconFill })}
              </div>
            ) : (
              /* Paperclip icon */
              <svg viewBox="0 0 24 24" fill="none" stroke={iconFill} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="var(--svg-size)" height="var(--svg-size)">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
              </svg>
            )}
          </button>
          <input
            type="file"
            ref={fileInputRef}
            accept="image/jpeg,image/png,image/gif,image/webp,image/jpg,video/mp4,video/webm,video/quicktime"
            onChange={handleImageSelect}
            style={{ display: "none" }}
          />

          <textarea
            ref={inputRef}
            type="text"
            value={editingMessageId ? editMessageText : inputMessage}
            onChange={(e) => {
              if (editingMessageId) {
                setEditMessageText(e.target.value);
              } else {
                setInputMessage(e.target.value);
              }
              ctxHandleInputChange(roomId);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage(e);
              }
            }}
            dir="auto"
            placeholder={
              editingMessageId
                ? "Edit your message…"
                : isRecording
                  ? ""
                  : isConnected
                    ? "Type a message…"
                    : "Waiting for another user to join…"
            }
            className={isBright ? "bright-placeholder" : "dark-placeholder"}
          />

          {/* Voice button (right, shown when input is empty) */}
          <button
            type="button"
            ref={plusButtonRef}
            className="plusButton"
            title="Hold to record voice message"
            disabled={!socketConnected}
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            onMouseLeave={() => { if (isRecording) stopRecording(); }}
            onTouchStart={startRecording}
            onTouchEnd={stopRecording}
            style={{ touchAction: "none" }}
          >
            <svg
              viewBox="0 0 24 24"
              fill={isRecording ? "var(--txt-clr-error)" : iconFill}
              width="var(--svg-size)"
              height="var(--svg-size)"
            >
              <rect x="9" y="2" width="6" height="13" rx="3" />
              <path d="M5 10a7 7 0 0014 0" fill="none" stroke={isRecording ? "var(--txt-clr-error)" : iconFill} strokeWidth="1.5" strokeLinecap="round" />
              <line x1="12" y1="19" x2="12" y2="22" stroke={isRecording ? "var(--txt-clr-error)" : iconFill} strokeWidth="1.5" strokeLinecap="round" />
              <line x1="9" y1="22" x2="15" y2="22" stroke={isRecording ? "var(--txt-clr-error)" : iconFill} strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>

          {/* Send button (right, shown when input has content) */}
          <button
            type="submit"
            ref={sendButtonRef}
            className="sendButton"
            disabled={
              editingMessageId ? !editMessageText.trim() : !inputMessage.trim()
            }
          >
            {React.cloneElement(icons.send, { fill: iconFill })}
          </button>
        </form>
      </div>

      {/* ── Context menu overlay ── */}
      {contextMenu && (
        <>
          <div
            className="context-menu-overlay"
            ref={contextMenuOverlayRef}
            onClick={hideContextMenu}
          />
          <div className="context-menu-sheet" ref={contextMenuRef}>
            {/* Message preview */}
            <div className="context-menu-preview">
              {contextMenu.imageUrl ? (
                <img
                  src={contextMenu.imageUrl}
                  alt=""
                  className="context-preview-img"
                />
              ) : contextMenu.audioUrl ? (
                <span className="context-preview-audio">🎵 Voice message</span>
              ) : (
                <p className="context-preview-text">{contextMenu.text}</p>
              )}
            </div>

            <div className="context-menu-actions">
              <button className="context-action" onClick={handleContextReply}>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  width="20"
                  height="20"
                >
                  <polyline points="9,17 4,12 9,7" />
                  <path d="M20 18v-2a4 4 0 00-4-4H4" />
                </svg>
                <span>Reply</span>
              </button>

              {!contextMenu.imageUrl && !contextMenu.audioUrl && (
                <button className="context-action" onClick={handleContextCopy}>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    width="20"
                    height="20"
                  >
                    <rect x="9" y="9" width="13" height="13" rx="2" />
                    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                  </svg>
                  <span>Copy</span>
                </button>
              )}

              <button className="context-action" onClick={handleContextForward}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
                  <polyline points="15,17 20,12 15,7" />
                  <path d="M4 18v-2a4 4 0 014-4h12" />
                </svg>
                <span>Forward</span>
              </button>

              <button className="context-action" onClick={handleContextReact}>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  width="20"
                  height="20"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                  <line x1="9" y1="9" x2="9.01" y2="9" />
                  <line x1="15" y1="9" x2="15.01" y2="9" />
                </svg>
                <span>React</span>
              </button>

              {contextMenu.isMe &&
                !contextMenu.imageUrl &&
                !contextMenu.audioUrl && (
                  <button
                    className="context-action"
                    onClick={handleContextEdit}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      width="20"
                      height="20"
                    >
                      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                    <span>Edit</span>
                  </button>
                )}

              {contextMenu.isMe && (
                <>
                  <button
                    className="context-action context-delete"
                    onClick={() => handleContextDelete(false)}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      width="20"
                      height="20"
                    >
                      <polyline points="3,6 5,6 21,6" />
                      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                      <path d="M10 11v6" />
                      <path d="M14 11v6" />
                      <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                    </svg>
                    <span>Delete for me</span>
                  </button>
                  <button
                    className="context-action context-delete"
                    onClick={() => handleContextDelete(true)}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      width="20"
                      height="20"
                    >
                      <polyline points="3,6 5,6 21,6" />
                      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                      <path d="M10 11v6" />
                      <path d="M14 11v6" />
                      <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                    </svg>
                    <span>Delete for everyone</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Image lightbox ── */}
      {lightboxSrc && (
        <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
      )}

      {/* ── Forward dialog ── */}
      <ForwardDialog
        message={forwardMsg}
        open={!!forwardMsg}
        onClose={() => setForwardMsg(null)}
        onForward={forwardMessage}
      />

      {/* ── Wallpaper picker ── */}
      {wallpaperOpen && (
        <>
          <div
            ref={wallpaperOverlayRef}
            className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-[2px]"
            onClick={closeWallpaperSheet}
          />
          <div
            ref={wallpaperSheetRef}
            className="fixed bottom-0 left-1/2 -translate-x-1/2 z-[61] w-full max-w-[600px]
                       bg-[var(--body-bg-clr)] rounded-t-[20px] flex flex-col"
            style={{ maxHeight: "85vh" }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-9 h-1 rounded-full bg-[var(--accent-clr)]" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pb-3">
              <h3 className="text-[15px] font-bold text-[var(--txt-clr)]">Chat Wallpaper</h3>
              <button
                onClick={closeWallpaperSheet}
                className="w-8 h-8 rounded-full flex items-center justify-center
                           bg-[var(--body-bg-clr-gray)] text-[var(--txt-clr-dark)]
                           hover:bg-[var(--accent-clr)] transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mx-5 mb-3 p-1 rounded-xl bg-[var(--body-bg-clr-gray)]">
              <button
                onClick={() => setWallpaperTab("photos")}
                className={`flex-1 py-2 rounded-lg text-[13px] font-semibold transition-all duration-200
                  ${wallpaperTab === "photos"
                    ? "bg-[var(--body-bg-clr)] text-[var(--txt-clr)] shadow-sm"
                    : "text-[var(--txt-clr-dark)] hover:text-[var(--txt-clr)]"
                  }`}
              >
                Photos
              </button>
              <button
                onClick={() => setWallpaperTab("colors")}
                className={`flex-1 py-2 rounded-lg text-[13px] font-semibold transition-all duration-200
                  ${wallpaperTab === "colors"
                    ? "bg-[var(--body-bg-clr)] text-[var(--txt-clr)] shadow-sm"
                    : "text-[var(--txt-clr-dark)] hover:text-[var(--txt-clr)]"
                  }`}
              >
                Solid Colors
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-5 pb-[calc(env(safe-area-inset-bottom)+20px)]">

              {wallpaperTab === "photos" && (
                <>
                  {/* Upload button */}
                  <button
                    onClick={() => wallpaperFileRef.current?.click()}
                    className="w-full mb-3 py-3 rounded-xl border-2 border-dashed border-[var(--accent-clr)]
                               bg-[var(--body-bg-clr-gray)] flex items-center justify-center gap-2.5
                               text-[13px] font-semibold text-[var(--txt-clr-dark)]
                               hover:border-[var(--primary-clr)] hover:text-[var(--txt-clr)] transition-colors"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    Upload from camera roll
                  </button>
                  <input
                    ref={wallpaperFileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp,image/jpg"
                    onChange={handleWallpaperUpload}
                    className="hidden"
                  />

                  {bgimage && bgimage.startsWith("data:") && (
                    <div className="mb-3 py-2 px-3 rounded-lg bg-emerald-500/10 text-emerald-600 text-[12px] font-medium flex items-center gap-2">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      Custom image active
                    </div>
                  )}

                  {/* Photo grid */}
                  <div className="grid grid-cols-3 gap-2">
                    {Object.entries(allImages).map(([name, { full, small }]) => (
                      <button
                        key={name}
                        onClick={() => {
                          handleSetBgImageForBoth(full, name);
                          closeWallpaperSheet();
                        }}
                        className={`relative aspect-[9/16] rounded-xl overflow-hidden group transition-all duration-200
                          ${bgimage === full
                            ? "ring-2 ring-[var(--primary-clr)] ring-offset-2 ring-offset-[var(--body-bg-clr)] scale-[0.97]"
                            : "hover:scale-[0.97]"
                          }`}
                      >
                        <img
                          src={small || full}
                          alt={name}
                          draggable="false"
                          className="w-full h-full object-cover pointer-events-none select-none"
                        />
                        {bgimage === full && (
                          <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                            <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0a0a0a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            </div>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                      </button>
                    ))}
                  </div>
                </>
              )}

              {wallpaperTab === "colors" && (
                <div className="grid grid-cols-4 gap-2.5">
                  {solidColors.map((color) => (
                    <button
                      key={color.value}
                      onClick={() => {
                        handleSetBgImageForBoth(color.value, color.name);
                        closeWallpaperSheet();
                      }}
                      className={`flex flex-col items-center gap-1.5 group`}
                    >
                      <div
                        className={`w-full aspect-square rounded-2xl transition-all duration-200
                          ${bgimage === color.value
                            ? "ring-2 ring-[var(--primary-clr)] ring-offset-2 ring-offset-[var(--body-bg-clr)] scale-[0.93]"
                            : "hover:scale-[0.93]"
                          }`}
                        style={{ backgroundColor: color.value }}
                      >
                        {bgimage === color.value && (
                          <div className="w-full h-full rounded-2xl flex items-center justify-center bg-black/20">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] text-[var(--txt-clr-dark)] font-medium leading-tight">
                        {color.name}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Upload error banner ── */}
      {uploadError && (
        <div className="upload-error-banner">
          <span>{uploadError}</span>
          <button onClick={() => setUploadError(null)}>✕</button>
        </div>
      )}
    </div>
  );
}
