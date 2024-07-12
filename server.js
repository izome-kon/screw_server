const app = require("./app");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const http = require('http');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const badWords = JSON.parse(fs.readFileSync('./json/bad-words-ar.json')).badWords;

const roomModel = require("./models/room.model");
const UserModel = require("./models/user.model");
dotenv.config({ path: "./config.env" });

const DB = process.env.MONGODB_URI;
const PORT = 5000;
let onlineUsers = 0;

mongoose.set("strictQuery", true);
mongoose.connect(DB).then(() => console.log("DB connect successfully"));

var server = http.createServer(app);
var io = require("socket.io")(server);

io.on('connection', (socket) => {
  console.log('a user connected');
  onlineUsers++;

  io.emit('onlineUsers', onlineUsers);

  //create a new room
  socket.on('createRoom', async (data) => {
    const room = await roomModel.handelCreateRoomEvent(JSON.parse(data));
    if (room) {
      socket.join(room.id);
      io.emit('new_room', room);
      io.to(room.id).emit('user_joined', room);
    }
  });

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
        username: user.name,
        avatar: user.avatar,
        message: filterMessage(message),
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
        console.log("🚀 ~ socket.on ~ room:", room)
        // await room.save();
        // await startGame(room); // Start the game when all players are ready
        const data = startGame(room);
        console.log("🚀 ~ socket.on ~ room:", data)
        await room.save();
        io.to(roomId).emit('start_game', data);
      }
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });

  socket.on('playerMove', async (data) => {
    const { roomId, userId, move } = data;
    try {
      const room = await roomModel.findById(roomId);
      if (!room) {
        throw new Error('Room not found');
      }

      // Handle player move logic here
      const updatedRoom = await handlePlayerMove(room, userId, move);

      io.to(roomId).emit('player_moved', updatedRoom);

      // Check if round or game is over
      if (isRoundOver(updatedRoom)) {
        io.to(roomId).emit('round_over', updatedRoom);
      }

      if (isGameOver(updatedRoom)) {
        io.to(roomId).emit('game_over', updatedRoom);
      }
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });

  socket.on('disconnect', () => {
    if (onlineUsers > 0)
      onlineUsers--;
    io.emit('onlineUsers', onlineUsers);
    console.log('user disconnected');
  });
});

function filterMessage(message) {
  let filteredMessage = message;
  for (let word of badWords) {
    const regex = new RegExp(word, 'gi');
    filteredMessage = filteredMessage.replace(regex, '*'.repeat(word.length));
  }
  return filteredMessage;
}


function  startGame  (room) {
  // Initialize game state, shuffle and deal cards
  room.gameState = initializeGameState(room.players);
  console.log("🚀 ~ RoomSchema.methods.startGame= ~ this.gameState:", room.gameState)
  return {room, gameState: room.gameState};
}

function initializeGameState(players) {
  console.log("🚀 ~ initializeGameState ~ players:", players)
  const deck = shuffle(createDeck());
  const playerCards = {};
  players.forEach(player => {
      // Shuffle and deal initial cards to each player
      playerCards[player.user._id] = drawInitialCards(deck);
  });

  return {
      deck,
      playerCards,
      discardPile: [],
      currentPlayer: players[0].user._id,
      status: 'playing',
      // Additional game state properties
  };
}

function shuffle(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function createDeck() {
  const deck = [];
  let id = 1;
  // 10 numbered cards
  for (let i = 1; i <= 10; i++) {

    for (let j = 0; j < 4; j++) {
      deck.push({ id: uuidv4(), value: i });
    }
  }

  // Command cards
  for (let j = 0; j < 4; j++) {
    deck.push({ id: uuidv4(), value: 20, type: 'command', command: '+20' });
  }
  for (let j = 0; j < 2; j++) {
    deck.push({ id: uuidv4(), value: 10, type: 'command', command: 'كعب داير' });
  }
  for (let j = 0; j < 4; j++) {
    deck.push({ id: uuidv4(), value: 10, type: 'command', command: 'خد وهات' });
  }
  deck.push({ id: uuidv4(), value: -1, type: 'command', command: '-1' });
  for (let j = 0; j < 5; j++) {
    deck.push({ id: uuidv4(), value: 0, type: 'command', command: 'سكرو درايفر' });
  }
  for (let j = 0; j < 2; j++) {
    deck.push({ id: uuidv4(), value: 25, type: 'command', command: 'سكرو' });
  }
  for (let j = 0; j < 2; j++) {
    deck.push({ id: uuidv4(), value: 10, type: 'command', command: 'بصرة' });
  }

  return deck;
}


function drawInitialCards(deck) {
  return deck.splice(0, 4);
}


async function handlePlayerMove(room, userId, move) {
  const { type, cardIndex, targetPlayerId } = move;
  const playerCards = room.gameState.playerCards[userId];

  switch (type) {
      case 'drawCard':
          if (room.gameState.deck.length > 0) {
              const drawnCard = room.gameState.deck.pop();
              playerCards.push(drawnCard);
              handleCommandCard(room, userId, drawnCard);
          }
          break;

      case 'discardCard':
          const discardedCard = playerCards.splice(cardIndex, 1)[0];
          room.gameState.discardPile.push(discardedCard);
          break;

      case 'swapCard':
          const cardToSwap = playerCards.splice(cardIndex, 1)[0];
          playerCards.push(room.gameState.discardPile.pop());
          room.gameState.discardPile.push(cardToSwap);
          break;

      case 'playCommandCard':
          const commandCard = playerCards[cardIndex];
          handleCommandCard(room, userId, commandCard, targetPlayerId);
          playerCards.splice(cardIndex, 1);
          break;

      default:
          throw new Error('Invalid move type');
  }

  room.gameState.playerCards[userId] = playerCards;
  room.gameState.currentPlayer = getNextPlayer(room, userId);
  await room.save();

  return room;
}

function handleCommandCard(room, userId, card, targetPlayerId) {
  if (card.type !== 'command') return;

  switch (card.command) {
      case '+20':
          // handle +20 command
          break;

      case 'كعب داير':
          // handle كعب داير command
          break;

      case 'خد وهات':
          // handle خد وهات command
          break;

      case '-1':
          // handle -1 command
          break;

      case 'سكرو درايفر':
          // handle سكرو درايفر command
          break;

      case 'سكرو':
          // handle سكرو command
          break;

      case 'بصرة':
          // handle بصرة command
          break;

      default:
          throw new Error('Invalid command card');
  }
}

function getNextPlayer(room, currentPlayerId) {
  const players = room.players.map(player => player.user.toString());
  const currentIndex = players.indexOf(currentPlayerId);
  return players[(currentIndex + 1) % players.length];
}

function isRoundOver(room) {
  // Implement round over check
  return false;
}

function isGameOver(room) {
  // Implement game over check
  return false;
}
server.listen(PORT, () => {
  console.log(`listening on port ${PORT}`);
});
