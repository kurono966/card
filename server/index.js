const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: ["http://localhost:3000", "http://localhost:3001", "https://neocard-client.vercel.app"], // Allow connections from React dev server and Vercel client
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// --- ゲームの状態管理 --- //
let players = {}; // { socketId: { deck: [], hand: [], played: [], isTurn: false } }
let playerOrder = []; // プレイヤーの順番を保持する配列
let currentPlayerIndex = 0; // 現在のターンのプレイヤーのインデックス

function initializePlayerState(socketId) {
  // 仮のデッキを作成 (1から10のカードを2枚ずつ)
  let deck = [];
  for (let i = 1; i <= 10; i++) {
    deck.push({ id: `card_${socketId}_${i}a`, value: i });
    deck.push({ id: `card_${socketId}_${i}b`, value: i });
  }
  // デッキをシャッフル
  deck = shuffleArray(deck);

  players[socketId] = {
    deck: deck,
    hand: [],
    played: [],
    isTurn: false,
  };
  console.log(`Player ${socketId} initialized with deck size: ${deck.length}`);
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]]; // 要素を交換
  }
  return array;
}

function emitFullGameState() {
  playerOrder.forEach(pId => {
    const selfPlayer = players[pId];
    const opponentId = playerOrder.find(id => id !== pId);
    const opponentPlayer = players[opponentId];

    let stateForSelf = {
      yourHand: selfPlayer.hand,
      yourDeckSize: selfPlayer.deck.length,
      yourPlayedCards: selfPlayer.played,
      isYourTurn: selfPlayer.isTurn,
      opponentPlayedCards: opponentPlayer ? opponentPlayer.played : [],
      opponentDeckSize: opponentPlayer ? opponentPlayer.deck.length : 0,
    };
    io.to(pId).emit('game_state', stateForSelf);
  });
}

// --- Socket.IO イベントハンドリング --- //
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // プレイヤーが2人になったらゲーム開始（簡易的なマッチング）
  if (Object.keys(players).length < 2) {
    initializePlayerState(socket.id);
    playerOrder.push(socket.id);

    // 最初の5枚を引く
    for(let i = 0; i < 5; i++) {
      if (players[socket.id].deck.length > 0) {
        players[socket.id].hand.push(players[socket.id].deck.shift());
      }
    }

    if (playerOrder.length === 2) {
      // 2人揃ったらゲーム開始
      gameStarted = true;
      players[playerOrder[0]].isTurn = true; // 最初のプレイヤーのターン
      console.log('Game started with players:', playerOrder);
      emitFullGameState();
    } else {
      // 1人目のプレイヤー
      emitFullGameState();
    }

  } else {
    // 3人目以降は観戦者として扱うか、接続を拒否
    console.log('Game full. Rejecting connection for:', socket.id);
    socket.disconnect();
    return;
  }

  // クライアントからのゲーム状態要求
  socket.on('request_game_state', () => {
    emitFullGameState();
  });

  // カードを引くイベント
  socket.on('draw_card', () => {
    if (!players[socket.id].isTurn) {
      console.log(`Player ${socket.id} tried to draw, but it's not their turn.`);
      return;
    }

    if (players[socket.id] && players[socket.id].deck.length > 0) {
      const card = players[socket.id].deck.shift();
      players[socket.id].hand.push(card);
      console.log(`Player ${socket.id} drew card: ${card.value}. Deck size: ${players[socket.id].deck.length}`);
      emitFullGameState();
    } else {
      console.log(`Player ${socket.id} tried to draw, but deck is empty.`);
    }
  });

  // カードをプレイするイベント
  socket.on('play_card', (cardId) => {
    if (!players[socket.id].isTurn) {
      console.log(`Player ${socket.id} tried to play, but it's not their turn.`);
      return;
    }

    if (players[socket.id]) {
      const cardIndex = players[socket.id].hand.findIndex(c => c.id === cardId);
      if (cardIndex !== -1) {
        const [card] = players[socket.id].hand.splice(cardIndex, 1);
        players[socket.id].played.push(card);
        console.log(`Player ${socket.id} played card: ${card.value}`);
        emitFullGameState();
      } else {
        console.log(`Player ${socket.id} tried to play card ${cardId}, but it's not in hand.`);
      }
    }
  });

  // ターン終了イベント
  socket.on('end_turn', () => {
    if (!players[socket.id].isTurn) {
      console.log(`Player ${socket.id} tried to end turn, but it's not their turn.`);
      return;
    }

    players[socket.id].isTurn = false; // 現在のプレイヤーのターンを終了
    currentPlayerIndex = (currentPlayerIndex + 1) % playerOrder.length; // 次のプレイヤーへ
    players[playerOrder[currentPlayerIndex]].isTurn = true; // 次のプレイヤーのターンを開始
    console.log(`Turn ended for ${socket.id}. Next turn for ${playerOrder[currentPlayerIndex]}`);
    emitFullGameState();
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    const disconnectedPlayerId = socket.id;
    delete players[disconnectedPlayerId];
    playerOrder = playerOrder.filter(id => id !== disconnectedPlayerId);

    console.log('Current players:', Object.keys(players).length);
    // プレイヤーが0人になったらゲーム状態をリセット
    if (Object.keys(players).length === 0) {
      gameStarted = false;
      playerOrder = [];
      currentPlayerIndex = 0;
      console.log('All players disconnected. Game state reset.');
    } else if (gameStarted && playerOrder.length === 1) {
      // 1人になったらゲーム終了
      gameStarted = false;
      console.log('One player left. Game ended.');
      // 残ったプレイヤーにゲーム終了を通知するなど
    }
    emitFullGameState(); // 残ったプレイヤーに状態を更新
  });
});

app.get('/', (req, res) => {
  res.send('Card Game Server is running!');
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
