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
    const room = await roomModel.handelCreateRoomEvent(JSON.parse(data));
    if (room) {
      socket.join(room.id);
      io.emit('new_room', room)
      io.to(room.id).emit('user_joined', room)
    }
  })

  socket.on('sendMessage', async (data) => {
    const { roomId, userId, message } = data;
    try {
      const user = await UserModel.findById(userId);
      if (!user) {
        socket.emit('error', { message: 'User not found' });
        return;
      }

      const roomExists = await roomModel.findById(roomId);
      if (!roomExists) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }

      const messageData = {
        userId: user._id,
        username: user.username,
        avatar: user.avatar,
        message: message,
        timestamp: new Date(),
      };

      io.to(roomId).emit('message_received', messageData);
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });

  socket.on('joinRoom', async (data) => {
    const { roomId, userId } = data;
    console.log(`joinRoom: roomId=${roomId}, userId=${userId}`);

    const roomExists = await roomModel.findById(roomId);
    if (roomExists) {
      const user = await UserModel.findById(userId);
      if (!user) {
        console.log('User not found');
        socket.emit('error', { message: 'User not found' });
        return;
      }

      if (roomExists.players.length >= roomExists.maxPlayers) {
        console.log('Room is full');
        socket.emit('error', { message: 'Room is full' });
        return;
      }

      if (!roomExists.players.find(player => player.user.toString() === user._id.toString())) {
        roomExists.players.push({ user: user._id });
        await roomExists.save();
      }

      socket.join(roomId);
      const currRoom = await roomModel.checkRoomExists(roomId);
      io.to(roomId).emit('user_joined', { user, roomId, room: currRoom });
      socket.emit('room_joined', currRoom);
    } else {
      console.log('Room does not exist');
      socket.emit('error', { message: 'Room does not exist' });
    }
  });

  socket.on('leaveRoom', async (data) => {
    const { roomId, userId } = data;
    try {
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

  socket.on('setPlayerReady', async (data) => {
    const { roomId, userId } = data;
    try {
      let room = await roomModel.findById(roomId);
      if (!room) {
        throw new Error('Room not found');
      }
      room = await room.setPlayerReady(userId);
      io.to(roomId).emit('player_ready', { roomId, userId });

      // Check if all players are ready
      const allPlayersReady = room.players.every(player => player.isReady);
      if (allPlayersReady) {
        room.status = 'in-game';
        await room.save();
        io.to(roomId).emit('start_game', room);
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
