import { createContext, useContext, useState, useRef, useEffect, useCallback } from "react";
import { useSocket } from "./SocketContext";
import { useAuth } from "./AuthContext";
import { getMessages, forwardMessageToConversation } from "../services/chatService";
import { sendMediaMessage } from "../services/uploadService";
import { v4 as uuidv4 } from "uuid";

const ChatContext = createContext(null);

export function ChatProvider({ children }) {
  const { socket } = useSocket();
  const { dbUser } = useAuth();
  const [messages, setMessages] = useState([]);
  const [readReceipts, setReadReceipts] = useState({});
  const [remoteTyping, setRemoteTyping] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editMessageText, setEditMessageText] = useState("");
  const [replyTo, setReplyTo] = useState(null); // { id, text, imageUrl, audioUrl, isMe }
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const typingTimeoutRef = useRef(null);
  const lastTypingEmitRef = useRef(0);

  // Load initial messages from DB when conversation changes
  const loadMessages = useCallback(async (conversationId) => {
    // Only load from DB if it's a valid MongoDB ObjectId
    if (!conversationId || !/^[0-9a-fA-F]{24}$/.test(conversationId)) return;

    setIsLoadingMessages(true);
    setMessages([]);
    setCurrentPage(1);

    try {
      const res = await getMessages(conversationId, 1);
      const { messages: dbMessages, pagination } = res.data;

      const myId = dbUser?._id?.toString();
      const mapMsg = (m) => ({
        id: m._id,
        text: m.deletedForEveryone ? "" : (m.text || ""),
        url: m.imageUrl || null,
        imageUrl: m.imageUrl || null,
        audioUrl: m.audioUrl || null,
        audioDuration: m.audioDuration || 0,
        isMe: myId ? m.sender?._id?.toString() === myId : false,
        isSystem: m.type === "system",
        deleted: m.deletedForEveryone || false,
        timestamp: m.createdAt,
        read: m.readBy?.length > 0,
        reactions: m.reactions || {},
        edited: m.edited,
        sender: m.sender,
        dbId: m._id,
        sharedPost: m.sharedPost ? {
          _id: m.sharedPost._id?.toString(),
          imageUrl: m.sharedPost.imageUrl,
          caption: m.sharedPost.caption || "",
          author: m.sharedPost.author,
          likesCount: m.sharedPost.likes?.length || 0,
          commentsCount: m.sharedPost.comments?.length || 0,
        } : null,
        replyTo: m.replyTo ? {
          id: m.replyTo._id || m.replyTo,
          text: m.replyTo.text || "",
          imageUrl: m.replyTo.imageUrl || null,
          audioUrl: m.replyTo.audioUrl || null,
          // sender may be a raw ObjectId (not nested-populated) — handle both cases
          isMe: myId ? (m.replyTo.sender?._id?.toString() ?? m.replyTo.sender?.toString()) === myId : false,
        } : null,
      });

      setMessages(dbMessages.map(mapMsg)
      );

      setHasMoreMessages(pagination.hasMore);
    } catch (err) {
      // DB unavailable — start with empty messages (socket-only mode)
      console.warn("Could not load messages from DB:", err.message);
    } finally {
      setIsLoadingMessages(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbUser?._id]);

  // Load older messages (pagination)
  const loadMoreMessages = useCallback(async (conversationId, scrollContainer) => {
    if (!conversationId || !hasMoreMessages || isLoadingMessages) return;
    if (!/^[0-9a-fA-F]{24}$/.test(conversationId)) return;

    const prevScrollHeight = scrollContainer?.scrollHeight || 0;
    setIsLoadingMessages(true);

    try {
      const nextPage = currentPage + 1;
      const res = await getMessages(conversationId, nextPage);
      const { messages: older, pagination } = res.data;

      const myId = dbUser?._id?.toString();
      const mapMsg = (m) => ({
        id: m._id,
        text: m.deletedForEveryone ? "" : (m.text || ""),
        url: m.imageUrl || null,
        imageUrl: m.imageUrl || null,
        audioUrl: m.audioUrl || null,
        audioDuration: m.audioDuration || 0,
        isMe: myId ? m.sender?._id?.toString() === myId : false,
        isSystem: m.type === "system",
        deleted: m.deletedForEveryone || false,
        timestamp: m.createdAt,
        read: m.readBy?.length > 0,
        reactions: m.reactions || {},
        edited: m.edited,
        sender: m.sender,
        dbId: m._id,
        sharedPost: m.sharedPost ? {
          _id: m.sharedPost._id?.toString(),
          imageUrl: m.sharedPost.imageUrl,
          caption: m.sharedPost.caption || "",
          author: m.sharedPost.author,
          likesCount: m.sharedPost.likes?.length || 0,
          commentsCount: m.sharedPost.comments?.length || 0,
        } : null,
        replyTo: m.replyTo ? {
          id: m.replyTo._id || m.replyTo,
          text: m.replyTo.text || "",
          imageUrl: m.replyTo.imageUrl || null,
          audioUrl: m.replyTo.audioUrl || null,
          isMe: myId ? (m.replyTo.sender?._id?.toString() ?? m.replyTo.sender?.toString()) === myId : false,
        } : null,
      });

      setMessages((prev) => [...older.map(mapMsg), ...prev]);

      setCurrentPage(nextPage);
      setHasMoreMessages(pagination.hasMore);

      // Restore scroll position
      requestAnimationFrame(() => {
        if (scrollContainer) {
          scrollContainer.scrollTop += scrollContainer.scrollHeight - prevScrollHeight;
        }
      });
    } catch (err) {
      console.warn("Could not load more messages:", err.message);
    } finally {
      setIsLoadingMessages(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, hasMoreMessages, isLoadingMessages, dbUser?._id]);

  // Listen for incoming socket messages
  useEffect(() => {
    if (!socket) return;

    const handleChatMessage = (data) => {
      if (data.conversationId && data.conversationId !== activeConversationId) return;
      setMessages((prev) => {
        if (prev.some((m) => m.id === data.id)) return prev;
        let replyTo = null;
        if (data.replyTo) {
          const quoted = prev.find((m) => m.id === data.replyTo || m.dbId === data.replyTo);
          if (quoted) {
            replyTo = {
              id: quoted.id,
              text: quoted.text,
              imageUrl: quoted.imageUrl || null,
              audioUrl: quoted.audioUrl || null,
              isMe: quoted.isMe,
            };
          }
        }
        return [...prev, { ...data, isMe: false, read: false, replyTo }];
      });
    };

    // Phase 2: receive Cloudinary URL instead of binary
    const handleReceiveImage = (data) => {
      if (data.conversationId && data.conversationId !== activeConversationId) return;
      if (data.imageUrl) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.id)) return prev;
          return [
            ...prev,
            {
              id: data.id,
              imageUrl: data.imageUrl,
              url: data.imageUrl,
              text: data.text || "",
              isMe: false,
              read: false,
              timestamp: data.timestamp,
              sender: data.sender,
              sharedPost: data.sharedPost || null,
            },
          ];
        });
      } else if (data.imgData) {
        const blob = new Blob([data.imgData.buffer]);
        const url = URL.createObjectURL(blob);
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.id)) return prev;
          return [...prev, { ...data, url, isMe: false, read: false }];
        });
      }
    };

    const handleMessageEdited = (data) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === data.messageId
            ? { ...msg, text: data.newText, edited: true, editTimestamp: data.timestamp }
            : msg
        )
      );
    };

    const handleMessageRead = (data) => {
      setReadReceipts((prev) => ({ ...prev, [data.messageId]: true }));
    };

    const handleReactionsUpdated = (data) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === data.messageId ? { ...msg, reactions: data.reactions } : msg
        )
      );
    };

    const handleTypingStart = () => setRemoteTyping(true);
    const handleTypingStop = () => setRemoteTyping(false);

    const handleMessageDeleted = (data) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === data.messageId
            ? { ...msg, deleted: true, text: "", imageUrl: null, url: null, audioUrl: null }
            : msg
        )
      );
    };

    const handleReceiveAudio = (data) => {
      if (data.conversationId && data.conversationId !== activeConversationId) return;
      setMessages((prev) => {
        if (prev.some((m) => m.id === data.id)) return prev;
        return [
          ...prev,
          {
            id: data.id,
            audioUrl: data.audioUrl,
            audioDuration: data.audioDuration || 0,
            isMe: false,
            read: false,
            timestamp: data.timestamp,
            sender: data.sender,
          },
        ];
      });
    };

    socket.on("chat-message", handleChatMessage);
    socket.on("receive-image", handleReceiveImage);
    socket.on("receive-audio", handleReceiveAudio);
    socket.on("message-edited", handleMessageEdited);
    socket.on("message-deleted", handleMessageDeleted);
    socket.on("message-read", handleMessageRead);
    socket.on("reactions-updated", handleReactionsUpdated);
    socket.on("user-typing-start", handleTypingStart);
    socket.on("user-typing-stop", handleTypingStop);

    return () => {
      socket.off("chat-message", handleChatMessage);
      socket.off("receive-image", handleReceiveImage);
      socket.off("receive-audio", handleReceiveAudio);
      socket.off("message-edited", handleMessageEdited);
      socket.off("message-deleted", handleMessageDeleted);
      socket.off("message-read", handleMessageRead);
      socket.off("reactions-updated", handleReactionsUpdated);
      socket.off("user-typing-start", handleTypingStart);
      socket.off("user-typing-stop", handleTypingStop);
    };
  }, [socket, activeConversationId]);

  // Update read status when receipts arrive
  useEffect(() => {
    setMessages((prev) =>
      prev.map((msg) =>
        readReceipts[msg.id] && msg.isMe ? { ...msg, read: true } : msg
      )
    );
  }, [readReceipts]);

  const sendMessage = (text, roomId, replyToMsg = null) => {
    if (!text.trim() || !socket?.connected) return false;

    const messageId = uuidv4();
    const messageData = {
      id: messageId,
      text,
      timestamp: new Date().toISOString(),
      replyTo: replyToMsg?.dbId || null,
    };

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    setIsTyping(false);
    socket.emit("typing-stop", { roomId });
    socket.emit("send-message", messageData);

    setMessages((prev) => [
      ...prev,
      {
        ...messageData,
        isMe: true,
        read: false,
        replyTo: replyToMsg
          ? { id: replyToMsg.id, text: replyToMsg.text, imageUrl: replyToMsg.imageUrl, audioUrl: replyToMsg.audioUrl, isMe: replyToMsg.isMe }
          : null,
      },
    ]);
    return true;
  };

  // Send image/video via HTTP — upload + persist + broadcast in one request
  const sendImage = async (file, conversationId, onProgress) => {
    const messageId = uuidv4();
    const placeholderUrl = URL.createObjectURL(file);

    setMessages((prev) => [
      ...prev,
      {
        id: messageId,
        url: placeholderUrl,
        imageUrl: placeholderUrl,
        isMe: true,
        read: false,
        timestamp: new Date().toISOString(),
        isUploading: true,
      },
    ]);

    try {
      const result = await sendMediaMessage(
        file,
        { conversationId, clientMessageId: messageId },
        onProgress
      );

      // Server confirmed — update placeholder with real URL
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, url: result.url, imageUrl: result.url, isUploading: false, dbId: result.messageId }
            : m
        )
      );
      URL.revokeObjectURL(placeholderUrl);
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      URL.revokeObjectURL(placeholderUrl);
      throw err;
    }
  };

  const editMessage = (roomId) => {
    if (!editingMessageId || !editMessageText.trim()) return;

    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === editingMessageId
          ? { ...msg, text: editMessageText, edited: true, editTimestamp: new Date().toISOString() }
          : msg
      )
    );

    if (socket) {
      const msg = messages.find((m) => m.id === editingMessageId);
      socket.emit("edit-message", {
        messageId: editingMessageId,
        dbMessageId: msg?.dbId || null,
        newText: editMessageText,
        roomId,
      });
    }

    setEditingMessageId(null);
    setEditMessageText("");
  };

  const cancelEdit = () => {
    setEditingMessageId(null);
    setEditMessageText("");
  };

  const handleInputChange = (roomId) => {
    if (!isTyping) {
      setIsTyping(true);
      if (socket) {
        socket.emit("typing-start", { roomId });
        lastTypingEmitRef.current = Date.now();
      }
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      if (socket) socket.emit("typing-stop", { roomId });
    }, 1000);
  };

  const toggleEmojiReaction = (emoji, messageId, roomId) => {
    if (!socket) return;

    const msg = messages.find((m) => m.id === messageId);
    if (!msg) return;

    const currentUserId = socket.id;
    const currentReactions = msg.reactions || {};
    const newReactions = { ...currentReactions };

    for (const [key, users] of Object.entries(newReactions)) {
      if (Array.isArray(users) && users.includes(currentUserId)) {
        newReactions[key] = users.filter((id) => id !== currentUserId);
        if (newReactions[key].length === 0) delete newReactions[key];
      }
    }

    const alreadyReacted = Array.isArray(currentReactions[emoji]) &&
      currentReactions[emoji].includes(currentUserId);

    if (!alreadyReacted) {
      newReactions[emoji] = [...(newReactions[emoji] || []), currentUserId];
    }

    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, reactions: newReactions } : m))
    );

    socket.emit("update-reactions", {
      messageId,
      dbMessageId: msg.dbId || null,
      reactions: newReactions,
      roomId,
    });
  };

  const deleteMessage = (messageId, roomId, forEveryone = false) => {
    if (!socket) return;
    const msg = messages.find((m) => m.id === messageId);

    // Always remove locally
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? { ...m, deleted: true, text: "", imageUrl: null, url: null, audioUrl: null }
          : m
      )
    );

    if (forEveryone) {
      socket.emit("delete-message", {
        messageId,
        dbMessageId: msg?.dbId || null,
        forEveryone: true,
        roomId,
      });
    }
  };

  // Send voice message via HTTP — upload + persist + broadcast in one request
  const sendAudio = async (blob, duration, conversationId) => {
    const messageId = uuidv4();
    const localUrl = URL.createObjectURL(blob);

    // Give the blob a proper filename for the server's MIME detection
    const ext = blob.type?.includes("mp4") ? "mp4" : blob.type?.includes("ogg") ? "ogg" : "webm";
    const audioFile = new File([blob], `voice-message.${ext}`, { type: blob.type || "audio/webm" });

    setMessages((prev) => [
      ...prev,
      {
        id: messageId,
        audioUrl: localUrl,
        audioDuration: duration,
        isMe: true,
        read: false,
        timestamp: new Date().toISOString(),
        isUploading: true,
      },
    ]);

    try {
      const result = await sendMediaMessage(
        audioFile,
        { conversationId, clientMessageId: messageId, audioDuration: duration },
      );

      URL.revokeObjectURL(localUrl);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, audioUrl: result.url, isUploading: false, dbId: result.messageId }
            : m
        )
      );
    } catch (err) {
      URL.revokeObjectURL(localUrl);
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      throw err;
    }
  };

  const forwardMessage = async (dbMessageId, targetConversationId) => {
    await forwardMessageToConversation(targetConversationId, dbMessageId);
  };

  const addSystemMessage = (text) => {
    setMessages((prev) => [
      ...prev,
      { id: uuidv4(), text, isSystem: true, timestamp: new Date().toISOString() },
    ]);
  };

  return (
    <ChatContext.Provider
      value={{
        messages,
        setMessages,
        readReceipts,
        remoteTyping,
        isTyping,
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
        sendMessage,
        sendImage,
        sendAudio,
        editMessage,
        cancelEdit,
        deleteMessage,
        handleInputChange,
        toggleEmojiReaction,
        addSystemMessage,
        forwardMessage,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) throw new Error("useChat must be used within a ChatProvider");
  return context;
}
