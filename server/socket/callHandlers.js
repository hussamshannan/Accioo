const callHandlers = (io, socket, rooms) => {
  // Audio call start
  socket.on("audio-call-start", (data) => {
    socket.to(data.roomId).emit("audio-call-started", {
      userId: socket.id,
      startedBy: "them",
      timestamp: new Date().toISOString(),
    });
    socket.emit("audio-call-started", {
      userId: socket.id,
      startedBy: "me",
      timestamp: new Date().toISOString(),
    });
  });

  // Audio call end
  socket.on("audio-call-end", (data) => {
    socket.to(data.roomId).emit("audio-call-ended", {
      userId: socket.id,
      endedBy: "them",
      timestamp: new Date().toISOString(),
    });
    socket.emit("audio-call-ended", {
      userId: socket.id,
      endedBy: "me",
      timestamp: new Date().toISOString(),
    });
  });

  // Call answered
  socket.on("answered", (data) => {
    socket.to(data.roomId).emit("answered", {
      isAnswer: data.isAnswer,
      to: data.to,
    });
    socket.emit("answered", {
      isAnswer: data.isAnswer,
      to: data.to,
    });
  });

  // WebRTC signaling
  socket.on("audio-offer", (data) => {
    socket.to(data.roomId).emit("audio-offer", {
      offer: data.offer,
      from: socket.id,
    });
  });

  socket.on("audio-answer", (data) => {
    socket.to(data.roomId).emit("audio-answer", {
      answer: data.answer,
      from: socket.id,
    });
  });

  socket.on("ice-candidate", (data) => {
    socket.to(data.roomId).emit("ice-candidate", {
      candidate: data.candidate,
      from: socket.id,
    });
  });

  // Mute toggle
  socket.on("audio-mute-toggle", (data) => {
    socket.to(data.roomId).emit("audio-mute-toggle", {
      userId: socket.id,
      isMuted: data.isMuted,
    });
  });
};

module.exports = callHandlers;
