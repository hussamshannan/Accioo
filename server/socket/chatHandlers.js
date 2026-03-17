const Message = require("../models/Message");
const Conversation = require("../models/Conversation");
const User = require("../models/User");
const { emitToUser } = require("./socketEmitter");
const { deleteCloudinaryUrl } = require("../services/cloudinaryService");

// Helper: get MongoDB User._id from socket.clerkId (cached per socket)
const getUserId = async (socket) => {
  if (socket._mongoUserId) return socket._mongoUserId;
  if (!socket.clerkId) return null;
  try {
    const user = await User.findOne({ clerkId: socket.clerkId }).select("_id");
    if (user) {
      socket._mongoUserId = user._id;
      return user._id;
    }
  } catch { /* DB unavailable */ }
  return null;
};

// Helper: persist message to MongoDB and deliver to participants not in the room
// realtimeEvent: { name, payload } — emitted via emitToUser as a fallback delivery
const persistMessage = async (socket, conversationId, data, realtimeEvent) => {
  try {
    const senderId = await getUserId(socket);
    if (!senderId || !conversationId) return;

    // Validate it's a valid ObjectId (not a UUID room)
    if (!/^[0-9a-fA-F]{24}$/.test(conversationId)) return;

    const type = data.audioUrl ? "audio" : data.imageUrl ? "image" : data.isSystem ? "system" : "text";
    const msg = await Message.create({
      conversationId,
      sender: senderId,
      type,
      text: data.text || "",
      imageUrl: data.imageUrl || "",
      audioUrl: data.audioUrl || "",
      audioDuration: data.audioDuration || 0,
      replyTo: data.replyTo && /^[0-9a-fA-F]{24}$/.test(data.replyTo) ? data.replyTo : null,
    });

    const lastText = data.audioUrl ? "🎵 Voice message" : data.imageUrl ? "📷 Image" : data.text;
    const now = new Date();
    const conv = await Conversation.findByIdAndUpdate(
      conversationId,
      { lastMessage: { text: lastText, sender: senderId, timestamp: now }, updatedAt: now },
      { returnDocument: "before" }
    ).populate("participants", "clerkId _id");

    if (conv) {
      const nonSenders = conv.participants.filter(
        (p) => p._id.toString() !== senderId.toString()
      );

      // Increment unread counts
      if (nonSenders.length > 0) {
        const incUpdate = {};
        nonSenders.forEach((p) => { incUpdate[`unreadCounts.${p._id}`] = 1; });
        await Conversation.findByIdAndUpdate(conversationId, { $inc: incUpdate }).catch(() => {});
      }

      const conversationUpdatedPayload = {
        conversationId,
        lastMessage: { text: lastText, timestamp: now.toISOString() },
        senderId: senderId.toString(),
      };

      conv.participants.forEach((p) => {
        // Always update conversation list for everyone
        emitToUser(p.clerkId, "conversation-updated", conversationUpdatedPayload);

        // Deliver the actual message to non-senders not already in the room
        if (realtimeEvent && p._id.toString() !== senderId.toString()) {
          emitToUser(p.clerkId, realtimeEvent.name, {
            ...realtimeEvent.payload,
            conversationId,
          });
        }
      });
    }

    return msg._id.toString();
  } catch (err) {
    // DB unavailable — silent fail, message already sent via socket
  }
};

const chatHandlers = (io, socket, rooms) => {
  // Send message
  socket.on("send-message", (data) => {
    if (!socket.roomId) {
      socket.emit("error", "You are not in a room. Please join a room first.");
      return;
    }

    const msgPayload = {
      id: data.id,
      text: data.text,
      timestamp: data.timestamp,
      sender: socket.id,
      replyTo: data.replyTo || null,
      conversationId: socket.roomId,
    };

    socket.to(socket.roomId).emit("chat-message", msgPayload);

    persistMessage(
      socket,
      socket.roomId,
      { text: data.text, replyTo: data.replyTo || null },
      { name: "chat-message", payload: msgPayload }
    );
  });

  // Image message via socket (legacy fallback — primary path is now POST /api/messages/send)
  socket.on("image", (data) => {
    if (!socket.roomId) return;

    if (data.imageUrl) {
      const imgPayload = {
        id: data.id,
        imageUrl: data.imageUrl,
        isMe: false,
        timestamp: data.timestamp,
        sender: socket.id,
        conversationId: socket.roomId,
      };
      socket.to(socket.roomId).emit("receive-image", imgPayload);
      persistMessage(
        socket,
        socket.roomId,
        { imageUrl: data.imageUrl },
        { name: "receive-image", payload: imgPayload }
      );
    }
  });

  // Read receipts
  socket.on("message-read", (data) => {
    if (!socket.roomId || !rooms.has(socket.roomId)) return;

    const room = rooms.get(socket.roomId);
    const otherUsers = Array.from(room.users).filter((id) => id !== socket.id);

    otherUsers.forEach((userId) => {
      const userSocket = io.sockets.sockets.get(userId);
      if (userSocket) {
        userSocket.emit("message-read", {
          messageId: data.messageId,
          timestamp: data.timestamp,
          readerId: socket.id,
        });
      } else {
        if (!room.pendingReadReceipts) room.pendingReadReceipts = {};
        if (!room.pendingReadReceipts[userId]) room.pendingReadReceipts[userId] = [];
        room.pendingReadReceipts[userId].push(data);
      }
    });
  });

  // Edit message
  socket.on("edit-message", (data) => {
    socket.to(data.roomId).emit("message-edited", {
      messageId: data.messageId,
      newText: data.newText,
      timestamp: new Date().toISOString(),
    });

    // Persist edit if we have a DB message ID
    if (data.dbMessageId && /^[0-9a-fA-F]{24}$/.test(data.dbMessageId)) {
      Message.findByIdAndUpdate(data.dbMessageId, {
        text: data.newText,
        edited: true,
        editedAt: new Date(),
      }).catch(() => {});
    }
  });

  // Reactions
  socket.on("message-reaction", (data) => {
    socket.to(data.roomId).emit("message-reaction", {
      messageId: data.messageId,
      emoji: data.emoji,
    });
  });

  socket.on("remove-reaction", (data) => {
    socket.to(data.roomId).emit("remove-reaction", {
      messageId: data.messageId,
      emoji: data.emoji,
    });
  });

  socket.on("update-reactions", (data) => {
    socket.to(data.roomId).emit("reactions-updated", {
      messageId: data.messageId,
      reactions: data.reactions,
    });

    // Persist reactions if we have a DB message ID
    if (data.dbMessageId && /^[0-9a-fA-F]{24}$/.test(data.dbMessageId)) {
      Message.findByIdAndUpdate(data.dbMessageId, {
        reactions: data.reactions,
      }).catch(() => {});
    }
  });

  // Audio message via socket (legacy fallback — primary path is now POST /api/messages/send)
  socket.on("audio-message", (data) => {
    if (!socket.roomId) return;
    const audioPayload = {
      id: data.id,
      audioUrl: data.audioUrl,
      audioDuration: data.audioDuration || 0,
      isMe: false,
      timestamp: data.timestamp,
      sender: socket.id,
      conversationId: socket.roomId,
    };
    socket.to(socket.roomId).emit("receive-audio", audioPayload);
    persistMessage(
      socket,
      socket.roomId,
      { audioUrl: data.audioUrl, audioDuration: data.audioDuration || 0 },
      { name: "receive-audio", payload: audioPayload }
    );
  });

  // Delete message
  socket.on("delete-message", (data) => {
    const { messageId, dbMessageId, forEveryone, roomId } = data;
    if (forEveryone) {
      socket.to(roomId).emit("message-deleted", { messageId, forEveryone: true });
      if (dbMessageId && /^[0-9a-fA-F]{24}$/.test(dbMessageId)) {
        Message.findByIdAndUpdate(dbMessageId, {
          deletedForEveryone: true,
          text: "",
          imageUrl: "",
          audioUrl: "",
        }, { returnDocument: "before" })
          .then(async (deletedMsg) => {
            // Delete media assets from Cloudinary
            if (deletedMsg?.imageUrl) deleteCloudinaryUrl(deletedMsg.imageUrl).catch(() => {});
            if (deletedMsg?.audioUrl) deleteCloudinaryUrl(deletedMsg.audioUrl).catch(() => {});
            if (!deletedMsg?.conversationId) return;
            const convId = deletedMsg.conversationId;

            // Find the new last visible message
            const lastVisible = await Message.findOne({
              conversationId: convId,
              deletedForEveryone: { $ne: true },
            }).sort({ createdAt: -1 });

            const newText = lastVisible
              ? lastVisible.audioUrl
                ? "🎵 Voice message"
                : lastVisible.imageUrl
                  ? "📷 Image"
                  : lastVisible.text || ""
              : "";
            const newTimestamp = lastVisible?.createdAt ?? deletedMsg.createdAt;

            await Conversation.findByIdAndUpdate(convId, {
              "lastMessage.text": newText,
              "lastMessage.timestamp": newTimestamp,
            });

            const conv = await Conversation.findById(convId).populate("participants", "clerkId");
            if (!conv) return;
            const payload = {
              conversationId: convId.toString(),
              lastMessage: { text: newText, timestamp: newTimestamp.toISOString() },
            };
            conv.participants.forEach((p) => emitToUser(p.clerkId, "conversation-updated", payload));
          })
          .catch(() => {});
      }
    }
    // "delete for me" is client-only — sender removes locally, no broadcast
  });

  // Typing indicators
  socket.on("typing-start", (data) => {
    socket.to(data.roomId).emit("user-typing-start", {
      userId: socket.id,
      userName: "User",
    });
  });

  socket.on("typing-stop", (data) => {
    socket.to(data.roomId).emit("user-typing-stop", { userId: socket.id });
  });

  // Background
  socket.on("set-background", (data) => {
    socket.to(data.roomId).emit("set-background", {
      imageUrl: data.imageUrl,
      imageName: data.imageName,
      setBy: socket.id,
    });
  });

  socket.on("send-image-binary", (data) => {
    socket.broadcast.emit("receive-image-binary", data);
  });
};

module.exports = chatHandlers;
