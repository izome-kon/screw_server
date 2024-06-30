const app = require("./app");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const http = require('http')
const roomModel = require("./models/room.model");
const UserModel = require("./models/user.model");
dotenv.config({ path: "./config.env" });

const DB = process.env.MONGODB_URI;
const PORT = 5000;
let onlineUsers = 0;

mongoose.set("strictQuery", true);
mongoose.connect(DB).then(() => console.log("DB connect successfully"));

var server = http.createServer(app)

var io = require("socket.io")(server)

io.on('connection', (socket) => {
  console.log('a user connected');
  onlineUsers++;

  io.emit('onlineUsers', onlineUsers)

  //create a new room
  socket.on('createRoom', async (data) => {
    // console.log("🚀 ~ socket.on ~ createRoom:", data)
    const room = await roomModel.handelCreateRoomEvent(JSON.parse(data));
    if (room) {
      socket.join(room.id);
      io.emit('new_room', room)
      io.emit('user_joined', room)
    }
  })

  socket.on('joinRoom', async (data) => {
    console.log("🚀 ~ socket.on ~ joinRoom:", data);

    const { roomId, userId } = data; // assuming data contains roomId and userId

    // Perform any necessary checks, e.g., if the room exists, if the user is allowed to join, etc.
    const roomExists = await roomModel.findById(roomId);
    if (roomExists) {

      // Check if the user exists
      const user = await UserModel.findById(userId);
      if (!user) {
        socket.emit('error', { message: 'User not found' });
        return;
      }

      // Check if the room has available space
      if (roomExists.players.length >= roomExists.maxPlayers) {
        socket.emit('error', { message: 'Room is full' });
        return;
      }

      // Add the user to the players list if not already present
      if (!roomExists.players.includes(user._id)) {
        roomExists.players.push(user._id);
        await roomExists.save();
      }
      // Join the room
      socket.join(roomId);

      // Optionally, notify the room that a new user has joined
      io.to(roomId).emit('user_joined', { user, roomId });

      // Notify the user that they have successfully joined the room
      socket.emit('room_joined', await roomModel.checkRoomExists(roomId));
    } else {
      // Optionally, notify the user that the room does not exist
      socket.emit('error', { message: 'Room does not exist' });
    }
  });

  socket.on('leaveRoom', async (data) => {
    console.log("🚀 ~ socket.on ~ leaveRoom:", data);
    try {
        const { roomId, userId } = data;
        const room = await roomModel.handelLeaveRoomEvent(roomId, userId);
        if (room) {
            socket.leave(roomId);
            io.to(roomId).emit('user_left', { roomId, userId });
            if (room.players.length === 0) {
                await roomModel.deleteRoom(roomId);
                io.emit('room_deleted', roomId);
            } else {
                io.emit('room_updated', room);
            }
        } else {
            io.emit('room_deleted', roomId);
        }
    } catch (error) {
        socket.emit('error', { message: error.message });
    }
});


  socket.on('disconnect', () => {
    if (onlineUsers > 0)
      onlineUsers--;
    io.emit('onlineUsers', onlineUsers)
    console.log('user disconnected');
  });
})

server.listen(PORT, () => {
  console.log(`listening in port ${PORT}`);
});
