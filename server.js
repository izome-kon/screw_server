const app = require("./app");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const http = require('http')
const roomModel = require("./models/room.model");
dotenv.config({ path: "./config.env" });

const DB = process.env.MONGODB_URI;
const PORT = 5000;
let onlineUsers = 0;

mongoose.set("strictQuery", true);
mongoose.connect(DB).then(() => console.log("DB connect successfully"));

var server = http.createServer(app)

var io = require("socket.io")(server)

io.on('connection', (socket)=>{
  console.log('a user connected');
  onlineUsers++;

  io.emit('onlineUsers',onlineUsers)

  socket.on('createRoom', async (data)  => {
    console.log("🚀 ~ socket.on ~ createRoom:", data)
    const room = await roomModel.handelCreateRoomEvent(JSON.parse(data));
    if(room) {
      io.emit('new_room', room)
    }
  })


  socket.on('disconnect', () => {
    if(onlineUsers>0)
      onlineUsers --;
    io.emit('onlineUsers',onlineUsers)
    console.log('user disconnected');
  });
})

server.listen(PORT, () => {
  console.log(`listening in port ${PORT}`);
});
