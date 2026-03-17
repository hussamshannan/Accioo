const activeCalls = new Map(); // roomId → { callId, callType, callerSocketId, callerUserId, receiverUserId, timeout }

const callHandlers = (io, socket, rooms) => {
  // Initiate a call
  socket.on("call:initiate", (data) => {
    const { roomId, callType, callId, callerInfo, receiverUserId } = data;

    // Prevent duplicate calls in same room
    if (activeCalls.has(roomId)) {
      socket.emit("call:error", { message: "A call is already in progress in this room" });
      return;
    }

    const callerUserId = socket._mongoUserId?.toString();

    // 45-second no-answer timeout
    const timeout = setTimeout(() => {
      if (activeCalls.has(roomId)) {
        activeCalls.delete(roomId);
        const payload = { callId, reason: "no-answer", endedBy: null };
        // Notify caller
        socket.emit("call:ended", payload);
        // Notify receiver
        if (receiverUserId) {
          io.to(`user:${receiverUserId}`).emit("call:ended", payload);
        }
      }
    }, 45000);

    activeCalls.set(roomId, {
      callId,
      callType,
      callerSocketId: socket.id,
      callerUserId,
      receiverUserId,
      roomId,
      timeout,
    });

    // Deliver to receiver's personal room (works regardless of which page they have open)
    const incoming = { callId, callType, roomId, callerInfo };
    const targetRoom = receiverUserId ? `user:${receiverUserId}` : null;

    // Debug: list all sockets in the target room
    if (targetRoom) {
      const socketsInRoom = io.sockets.adapter.rooms.get(targetRoom);
      console.log(`[CALL] Sending call:incoming to room "${targetRoom}", sockets in room:`, socketsInRoom ? [...socketsInRoom] : "NONE");
      console.log(`[CALL] All rooms:`, [...io.sockets.adapter.rooms.keys()].filter(r => r.startsWith("user:")));
      io.to(targetRoom).emit("call:incoming", incoming);
    } else {
      console.log(`[CALL] No receiverUserId, falling back to roomId: ${roomId}`);
      socket.to(roomId).emit("call:incoming", incoming);
    }
  });

  // Accept a call — receiver notifies caller
  socket.on("call:accept", (data) => {
    const { roomId, callId } = data;
    const call = activeCalls.get(roomId);

    if (call && call.timeout) {
      clearTimeout(call.timeout);
      call.timeout = null;
    }

    const payload = { callId, roomId };
    // Send directly to caller's socket for reliability
    if (call?.callerSocketId) {
      io.to(call.callerSocketId).emit("call:accepted", payload);
    } else {
      socket.to(roomId).emit("call:accepted", payload);
    }
  });

  // Reject a call — receiver notifies caller
  socket.on("call:reject", (data) => {
    const { roomId, callId } = data;
    const call = activeCalls.get(roomId);

    if (call && call.timeout) {
      clearTimeout(call.timeout);
    }
    activeCalls.delete(roomId);

    const payload = { callId, roomId };
    if (call?.callerSocketId) {
      io.to(call.callerSocketId).emit("call:rejected", payload);
    } else {
      socket.to(roomId).emit("call:rejected", payload);
    }
  });

  // End a call — notify the other side
  socket.on("call:end", (data) => {
    const { roomId, callId } = data;
    const call = activeCalls.get(roomId);

    if (call && call.timeout) {
      clearTimeout(call.timeout);
    }
    activeCalls.delete(roomId);

    const payload = { callId, roomId, reason: "ended", endedBy: socket.id };

    // Determine who the "other side" is and notify them
    if (call) {
      const isCallerEnding = call.callerSocketId === socket.id;
      if (isCallerEnding && call.receiverUserId) {
        // Caller ended: notify receiver via personal room
        io.to(`user:${call.receiverUserId}`).emit("call:ended", payload);
      } else if (!isCallerEnding && call.callerSocketId) {
        // Receiver ended: notify caller via socket id
        io.to(call.callerSocketId).emit("call:ended", payload);
      } else {
        socket.to(roomId).emit("call:ended", payload);
      }
    } else {
      socket.to(roomId).emit("call:ended", payload);
    }
  });

  // WebRTC signaling — relay via roomId (both peers are in the chat room at this point)
  socket.on("call:webrtc-offer", (data) => {
    socket.to(data.roomId).emit("call:webrtc-offer", {
      offer: data.offer,
      from: socket.id,
    });
  });

  socket.on("call:webrtc-answer", (data) => {
    socket.to(data.roomId).emit("call:webrtc-answer", {
      answer: data.answer,
      from: socket.id,
    });
  });

  socket.on("call:ice-candidate", (data) => {
    socket.to(data.roomId).emit("call:ice-candidate", {
      candidate: data.candidate,
      from: socket.id,
    });
  });

  // Media toggle
  socket.on("call:media-toggle", (data) => {
    socket.to(data.roomId).emit("call:media-toggle", {
      kind: data.kind,
      enabled: data.enabled,
    });
  });

  // Cleanup on disconnect
  socket.on("disconnect", () => {
    for (const [roomId, call] of activeCalls.entries()) {
      if (call.callerSocketId === socket.id) {
        if (call.timeout) clearTimeout(call.timeout);
        activeCalls.delete(roomId);
        const payload = { callId: call.callId, roomId, reason: "disconnected", endedBy: socket.id };
        if (call.receiverUserId) {
          io.to(`user:${call.receiverUserId}`).emit("call:ended", payload);
        } else {
          io.to(roomId).emit("call:ended", payload);
        }
      }
    }
  });
};

module.exports = callHandlers;
