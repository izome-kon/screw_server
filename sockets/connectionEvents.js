module.exports = (io, socket) => {
  socket.on("disconnect", () => {
    if (global.onlineUsers > 0) global.onlineUsers--;
    io.emit("onlineUsers", global.onlineUsers);
    console.log("user disconnected");
  });
};
