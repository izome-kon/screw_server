const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const flatted = require("flatted");
const roomModel = require("./models/room.model");
const badWords = JSON.parse(
  fs.readFileSync("./json/bad-words-ar.json")
).badWords;
Array.prototype.insert = function (index, ...items) {
  this.splice(index, 0, ...items);
};
function filterMessage(message) {
  let filteredMessage = message;
  for (let word of badWords) {
    const regex = new RegExp(word, "gi");
    filteredMessage = filteredMessage.replace(regex, "*".repeat(word.length));
  }
  return filteredMessage;
}

async function startGame(io, room) {
  try {
    room.gameState = initializeGameState(room.players);
    await room.save();
    startPlayerTurnTimer(io, room, false);
    return room;
  } catch (error) {
    console.error("Error starting game:", error);
    return room;
  }
}

let timeouts = {};

async function startPlayerTurnTimer(io, room, isJustReset) {
  const currentPlayerId = room.gameState.currentPlayer;

  if (timeouts[room.id]) {
    clearTimeout(timeouts[room.id]);
    delete timeouts[room.id];
  }

  if (!isGameOver(room)) {
    if (!isJustReset) {
      room.gameState.currentPlayer = getNextPlayer(room, currentPlayerId);
    }
    io.to(room.id).emit("player_turn", room.gameState.currentPlayer);

    timeouts[room.id] = setTimeout(async () => {
      await startPlayerTurnTimer(io, room, false);
    }, room.gameSettings.timeLimit * 1000);

    try {
      if (!room.saving) {
        room.saving = true;
        await room.save();
        room.saving = false;
      }
    } catch (error) {
      console.error("Error saving room state:", error);
      room.saving = false;
    }
  } else {
    io.to(room.id).emit("game_over", room);
    console.log("🚀 ~ setTimeout ~ game_over:");
  }
}

function initializeGameState(players) {
  const deck = shuffle(createDeck());
  const playerCards = {};
  players.forEach((player) => {
    playerCards[player.user._id] = drawInitialCards(deck);
  });
  let discard = deck.pop();
  console.log("🚀 ~ initializeGameState ~ deckAfterStart:", deck.length);

  return {
    discardPile: [discard],
    deck,
    playerCards,
    curruntDrawCard: null,
    currentPlayer: players[0].id,
    status: "playing",
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
  for (let i = 1; i <= 6; i++) {
    for (let j = 0; j < 4; j++) {
      deck.push({ id: uuidv4(), value: i });
    }
  }
  for (let j = 0; j < 4; j++) {
    deck.push({ id: uuidv4(), value: 20, type: "command", command: "+20" });
  }
  for (let j = 0; j < 4; j++) {
    deck.push({
      id: uuidv4(),
      value: 7,
      type: "command",
      command: "بص في ورقتك",
    });
    deck.push({
      id: uuidv4(),
      value: 8,
      type: "command",
      command: "بص في ورقتك",
    });
  }
  for (let j = 0; j < 4; j++) {
    deck.push({
      id: uuidv4(),
      value: 9,
      type: "command",
      command: "بص في ورقة غيرك",
    });
    deck.push({
      id: uuidv4(),
      value: 10,
      type: "command",
      command: "بص في ورقة غيرك",
    });
  }
  for (let j = 0; j < 2; j++) {
    deck.push({
      id: uuidv4(),
      value: 10,
      type: "command",
      command: "كعب داير",
    });
  }
  for (let j = 0; j < 4; j++) {
    deck.push({ id: uuidv4(), value: 10, type: "command", command: "خد وهات" });
  }
  deck.push({ id: uuidv4(), value: -1, type: "normal", command: "-1" });
  for (let j = 0; j < 2; j++) {
    deck.push({
      id: uuidv4(),
      value: 0,
      type: "normal",
      command: "سكرو درايفر",
    });
  }
  for (let j = 0; j < 2; j++) {
    deck.push({ id: uuidv4(), value: 25, type: "normal", command: "سكرو" });
  }
  for (let j = 0; j < 2; j++) {
    deck.push({ id: uuidv4(), value: 10, type: "command", command: "بصرة" });
  }
  deck.push({ id: uuidv4(), value: 10, type: "normal", command: "الحرامي" });
  deck.push({ id: uuidv4(), value: 10, type: "command", command: "خد بس" });
  deck.push({ id: uuidv4(), value: 10, type: "command", command: "بص وبدل" });
  console.log("🚀 ~ createDeck ~ deck:", deck.length);

  return deck;
}

function drawInitialCards(deck) {
  return deck.splice(0, 4);
}

async function handlePlayerMove(io, room, userId, move) {
  const { type, cardIndex, targetPlayerId } = move;
  let playerCards = room.gameState.playerCards[userId];
  let isCommand = false;
  switch (type) {
    case "dropToTable":
      // console.log("🚀 ~ handlePlayerMove ~ type:", type);

      if (room.gameState.deck.length > 0) {
        console.log(
          "🚀 ~ handlePlayerMove ~ room.gameState.deck:",
          room.gameState.deck.length
        );
        const drawnCard = room.gameState.deck.pop();
        console.log("🚀 ~ handlePlayerMove ~ drawnCard:", drawnCard);
        isCommand = drawnCard.type === "command";
        room.gameState.discardPile.push(drawnCard);
        io.to(room.id).emit("player_move", {
          move,
          userId,
        });
        await room.save();
      }
      break;

    case "swapCardWithDeck":
      const discardedCard = playerCards.splice(cardIndex, 1)[0];
      const tmp = room.gameState.deck.pop();
      playerCards.insert(cardIndex, tmp);
      room.gameState.discardPile.push(discardedCard);
      move["deckCardId"] = tmp.id;
      move["playerCardId"] = discardedCard.id;
      io.to(room.id).emit("player_move", {
        move,
        userId,
      });
      console.log("🚀 ~ handlePlayerMove ~ emit data:", {
        move,
        userId,
      });
      break;

    case "swapCard":
      const cardToSwap = playerCards.splice(cardIndex, 1)[0];
      playerCards.push(room.gameState.discardPile.pop());
      room.gameState.discardPile.push(cardToSwap);
      break;

    case "playCommandCard":
      const commandCard = playerCards[cardIndex];
      handleCommandCard(io, room, userId, commandCard, targetPlayerId);
      playerCards.splice(cardIndex, 1);
      break;

    default:
      throw new Error("Invalid move type");
  }
  // room.gameState.curruntPlayer = getNextPlayer(room, room.gameState.curruntPlayer)
  room.gameState.playerCards[userId] = playerCards;
  room.gameState.currentPlayer = userId;

  try {
    if (!room.saving) {
      room.saving = true;
      await room.save();
      room.saving = false;
    }
  } catch (error) {
    console.error("Error saving room state:", error);
    room.saving = false;
  }
  console.log("🚀 ~ playerMove.deck:8", room.gameState.deck.length);
  safeEmit(io.to(room.id), "player_moved", room);
  // بدء مؤقت جديد
  startPlayerTurnTimer(io, room, isCommand);
  return room;
}

function handleCommandCard(io, room, userId, card, targetPlayerId) {
  if (card.type !== "command") return;

  switch (card.command) {
    case "كعب داير":
      // handle كعب داير command
      break;

    case "خد وهات":
      // handle خد وهات command
      break;

    case "بصرة":
      // handle بصرة command
      break;

    default:
      throw new Error("Invalid command card");
  }
}

function getNextPlayer(room, currentPlayerId) {
  const players = room.players.map((player) => player.user.id.toString("hex"));
  const currentIndex = players.indexOf(currentPlayerId);
  const nextPlayerId = players[(currentIndex + 1) % players.length];
  return nextPlayerId;
}

function isRoundOver(room) {
  return false;
}

function isGameOver(room) {
  return false;
}

function startTimer(io, roomId, countdownValue) {
  let countdown = countdownValue - 1;

  const timerInterval = setInterval(async () => {
    if (countdown > 0) {
      io.to(roomId).emit("timer_update", { countdown });
      countdown--;
    } else {
      clearInterval(timerInterval);
      io.to(roomId).emit("timer_end");
      const room = await roomModel.findById(roomId);
      // بدء مؤقت جديد
      startPlayerTurnTimer(io, room, false);
    }
  }, 1000);
}

function safeEmit(ioInstance, event, data) {
  try {
    const jsonData = flatted.stringify(data);
    ioInstance.emit(event, jsonData);
  } catch (error) {
    console.error("Failed to emit data:", error);
  }
}
module.exports = {
  filterMessage,
  startGame,
  startPlayerTurnTimer,
  initializeGameState,
  handlePlayerMove,
  startTimer,
  safeEmit,
  isRoundOver,
  isGameOver,
};
