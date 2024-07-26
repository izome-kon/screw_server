const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const flatted = require("flatted");
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
  room.gameState = initializeGameState(room.players);
  startPlayerTurnTimer(io, room);
  return room;
}

async function startPlayerTurnTimer(io, room) {
  const currentPlayerId = room.gameState.currentPlayer;
  console.log("🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀");
  setTimeout(async () => {
    room.gameState.currentPlayer = getNextPlayer(room, currentPlayerId);

    if (!isGameOver(room)) {
      io.to(room.id).emit("player_turn", room.gameState.currentPlayer);
      console.log(
        "🚀 ~ setTimeout ~ player_turn:",
        room.gameState.currentPlayer
      );

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

      await startPlayerTurnTimer(io, room);
    } else {
      io.to(room.id).emit("game_over", room);
      console.log("🚀 ~ setTimeout ~ game_over:");
    }
  }, room.gameSettings.timeLimit * 1000);
}

function initializeGameState(players) {
  const deck = shuffle(createDeck());
  const playerCards = {};
  players.forEach((player) => {
    playerCards[player.user._id] = drawInitialCards(deck);
  });
  let discard = deck.pop();
  return {
    discardPile: [discard],
    deck,
    playerCards,
    curruntDrawCard: null,
    currentPlayer: "-1",
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
  for (let i = 1; i <= 10; i++) {
    for (let j = 0; j < 4; j++) {
      deck.push({ id: uuidv4(), value: i });
    }
  }
  for (let j = 0; j < 4; j++) {
    deck.push({ id: uuidv4(), value: 20, type: "command", command: "+20" });
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
  deck.push({ id: uuidv4(), value: -1, type: "command", command: "-1" });
  for (let j = 0; j < 5; j++) {
    deck.push({
      id: uuidv4(),
      value: 0,
      type: "command",
      command: "سكرو درايفر",
    });
  }
  for (let j = 0; j < 2; j++) {
    deck.push({ id: uuidv4(), value: 25, type: "command", command: "سكرو" });
  }
  for (let j = 0; j < 2; j++) {
    deck.push({ id: uuidv4(), value: 10, type: "command", command: "بصرة" });
  }

  return deck;
}

function drawInitialCards(deck) {
  return deck.splice(0, 4);
}

async function handlePlayerMove(io, room, userId, move) {
  console.log("🚀 ~ handlePlayerMove ~ handlePlayerMove:", handlePlayerMove);

  const { type, cardIndex, targetPlayerId } = move;
  let playerCards = room.gameState.playerCards[userId];

  switch (type) {
    case "dropToTable":
      // console.log("🚀 ~ handlePlayerMove ~ type:", type);

      if (room.gameState.deck.length > 0) {
        const drawnCard = room.gameState.deck.pop();
        room.gameState.discardPile.push(drawnCard);
        io.to(room.id).emit("player_move", {
          move,
          userId,
        });
      }
      break;

    case "swapCardWithDeck":
      const discardedCard = playerCards.splice(cardIndex, 1)[0];
      const tmp = room.gameState.deck.pop();
      console.log("🚀 ~ handlePlayerMove ~ tmp:", tmp);

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

  room.gameState.playerCards[userId] = playerCards;
  console.log(
    "room.gameState.playerCards[userId]",
    room.gameState.playerCards[userId]
  );
  room.gameState.currentPlayer = getNextPlayer(room, userId);

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
  const players = room.players.map((player) => player.user.id.toString("hex")); // تحويل Buffer إلى string إذا لزم الأمر
  console.log("🚀 ~ getNextPlayer ~ players:", players); // التحقق من اللاعبين بعد التحويل
  const currentIndex = players.indexOf(currentPlayerId);
  console.log("🚀 ~ getNextPlayer ~ currentPlayerId:", currentPlayerId); // التحقق من المعرف الحالي
  console.log("🚀 ~ getNextPlayer ~ currentIndex:", currentIndex); // التحقق من الفهرس الحالي
  const nextPlayerId = players[(currentIndex + 1) % players.length];
  console.log("🚀 ~ getNextPlayer ~ nextPlayerId:", nextPlayerId); // التحقق من المعرف التالي
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

  const timerInterval = setInterval(() => {
    if (countdown > 0) {
      io.to(roomId).emit("timer_update", { countdown });
      countdown--;
    } else {
      clearInterval(timerInterval);
      io.to(roomId).emit("timer_end");
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
