const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const cors = require('cors');
app.use(cors());
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: ["http://localhost:3000", "http://localhost:3001", "https://neocard-client.vercel.app", "https://neocard-client-24q40927s-kuronos-projects.vercel.app", "https://neocard-client-igeqrwa2k-kuronos-projects.vercel.app"], // Allow connections from React dev server and Vercel client, and the new Vercel client URL
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// 使用する画像ファイルのリスト
const CARD_IMAGE_URLS = [
  '/IMG_1.jpg',
  '/IMG_2.jpg',
  '/IMG_3.jpg',
  '/IMG_4.jpg',
  '/IMG_5.jpg',
];

// --- ゲームの状態管理 --- //
let players = {}; // { socketId: { deck: [], hand: [], played: [], manaZone: [], maxMana: 0, currentMana: 0, isTurn: false, manaPlayedThisTurn: false, drawnThisTurn: false, life: 20 } }
let playerOrder = []; // プレイヤーの順番を保持する配列
let currentPlayerIndex = 0; // 現在のターンのプレイヤーのインデックス
let gameActive = false; // ゲームがアクティブかどうかを示すフラグ

function initializePlayerState(socketId) {
  // 仮のデッキを作成 (1から10のカードを2枚ずつ)
  let deck = [];
  for (let i = 1; i <= 10; i++) {
    const randomImageUrl = CARD_IMAGE_URLS[Math.floor(Math.random() * CARD_IMAGE_URLS.length)];
    const cardName = `Card ${i}`; // カード名称
    let cardEffect = null;
    let cardDescription = `This is a basic card with value ${i}.`; // デフォルトの説明

    // 攻撃力と耐久力をランダムな一桁の数字で設定
    const attack = Math.floor(Math.random() * 9) + 1; // 1から9
    const defense = Math.floor(Math.random() * 9) + 1; // 1から9

    if (i === 5) { // 例: 5のカードに効果を付与
      cardEffect = "Draw 1 card";
      cardDescription = "When played, draw 1 card from your deck.";
    } else if (i === 1) {
      cardDescription = "A very weak card, but it costs little mana.";
    } else if (i === 10) {
      cardDescription = "A powerful card, but requires a lot of mana.";
    }

    deck.push({ id: `card_${socketId}_${i}a`, name: cardName, value: i, manaCost: i, imageUrl: randomImageUrl, effect: cardEffect, description: cardDescription, attack: attack, defense: defense });
    deck.push({ id: `card_${socketId}_${i}b`, name: cardName, value: i, manaCost: i, imageUrl: randomImageUrl, effect: cardEffect, description: cardDescription, attack: attack, defense: defense });
  }
  // デッキをシャッフル
  deck = shuffleArray(deck);

  players[socketId] = {
    deck: deck,
    hand: [],
    played: [],
    manaZone: [], // マナゾーン
    maxMana: 0, // 最大マナを0に初期化
    currentMana: 0, // 現在のマナ
    isTurn: false,
    manaPlayedThisTurn: false, // このターンにマナを置いたか
    drawnThisTurn: false, // このターンにドローしたか
    life: 20, // ライフポイントを追加
  };
  console.log(`[Server] Player ${socketId} initialized with deck size: ${deck.length}`);
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]]; // 要素を交換
  }
  return array;
}

function emitFullGameState() {
  console.log('--- Emitting Full Game State ---');
  playerOrder.forEach(pId => {
    const selfPlayer = players[pId];
    const opponentId = playerOrder.find(id => id !== pId);
    const opponentPlayer = players[opponentId];

    let stateForSelf = {
      yourHand: selfPlayer.hand,
      yourDeckSize: selfPlayer.deck.length,
      yourPlayedCards: selfPlayer.played,
      yourManaZone: selfPlayer.manaZone,
      yourMaxMana: selfPlayer.maxMana,
      yourCurrentMana: selfPlayer.currentMana,
      isYourTurn: selfPlayer.isTurn,
      yourLife: selfPlayer.life, // 自分のライフを追加
      opponentPlayedCards: opponentPlayer ? opponentPlayer.played : [],
      opponentManaZone: opponentPlayer ? opponentPlayer.manaZone : [],
      opponentDeckSize: opponentPlayer ? opponentPlayer.deck.length : 0,
      opponentMaxMana: opponentPlayer ? opponentPlayer.maxMana : 0,
      opponentCurrentMana: opponentPlayer ? opponentPlayer.currentMana : 0,
      opponentLife: opponentPlayer ? opponentPlayer.life : 0, // 相手のライフを追加
    };
    io.to(pId).emit('game_state', stateForSelf);
    console.log(`[Server] State sent to ${pId}: isYourTurn = ${selfPlayer.isTurn}, Current Mana = ${selfPlayer.currentMana}/${selfPlayer.maxMana}, Life = ${selfPlayer.life}`);
  });
  console.log('-------------------------------');
}

// --- Socket.IO イベントハンドリング --- //
io.on('connection', (socket) => {
  console.log('[Server] A user connected:', socket.id);

  if (playerOrder.length < 2) {
    initializePlayerState(socket.id);
    playerOrder.push(socket.id);
    console.log(`[Server] Player ${socket.id} joined. Current players: ${playerOrder.length}`);

    // 最初の5枚を引く
    for(let i = 0; i < 5; i++) {
      if (players[socket.id].deck.length > 0) {
        players[socket.id].hand.push(players[socket.id].deck.shift());
      }
    }

    if (playerOrder.length === 2) {
      gameActive = true;
      // 2人揃ったらゲーム開始
      // 最初のプレイヤーのターンを設定
      players[playerOrder[0]].isTurn = true;
      // 最初のターンのプレイヤーのマナは0/0のまま

      console.log('[Server] Game started with players:', playerOrder);
      emitFullGameState();
    } else {
      // 1人目のプレイヤーが接続しただけ
      gameActive = false; // ゲームはまだアクティブではない
      console.log(`[Server] Waiting for another player. Current players: ${playerOrder.length}`);
      emitFullGameState();
    }

  } else {
    console.log('[Server] Game full. Rejecting connection for:', socket.id);
    socket.disconnect();
    return;
  }

  // クライアントからのゲーム状態要求
  socket.on('request_game_state', () => {
    console.log(`[Server] Player ${socket.id} requested game state.`);
    emitFullGameState();
  });

  // カードを引くイベント
  socket.on('draw_card', () => {
    if (!players[socket.id] || !players[socket.id].isTurn || !gameActive) {
      console.log(`[Server] Player ${socket.id} tried to draw, but it's not their turn or game not active.`);
      return;
    }
    if (players[socket.id].drawnThisTurn) {
      console.log(`[Server] Player ${socket.id} tried to draw, but already drew this turn.`);
      return;
    }

    if (players[socket.id].deck.length > 0) {
      const card = players[socket.id].deck.shift();
      players[socket.id].hand.push(card);
      players[socket.id].drawnThisTurn = true; // このターンはドローした
      console.log(`[Server] Player ${socket.id} drew card: ${card.value}. Deck size: ${players[socket.id].deck.length}`);
      emitFullGameState();
    } else {
      console.log(`[Server] Player ${socket.id} tried to draw, but deck is empty.`);
    }
  });

  // カードをプレイするイベント (playType: 'field' or 'mana')
  socket.on('play_card', (cardId, playType) => {
    if (!players[socket.id] || !players[socket.id].isTurn || !gameActive) {
      console.log(`[Server] Player ${socket.id} tried to play, but it's not their turn or game not active.`);
      return;
    }

    const cardIndex = players[socket.id].hand.findIndex(c => c.id === cardId);
    if (cardIndex === -1) {
      console.log(`[Server] Player ${socket.id} tried to play card ${cardId}, but it's not in hand.`);
      return;
    }
    const [card] = players[socket.id].hand.splice(cardIndex, 1);

    if (playType === 'mana') {
      if (players[socket.id].manaPlayedThisTurn) {
        console.log(`[Server] Player ${socket.id} tried to play card to mana zone, but already played mana this turn.`);
        players[socket.id].hand.push(card); // 手札に戻す
        emitFullGameState();
        return;
      }
      players[socket.id].manaZone.push(card);
      players[socket.id].maxMana++; // マナゾーンに置くと最大マナが増える
      players[socket.id].currentMana++; // 現在マナも1増やす
      players[socket.id].manaPlayedThisTurn = true; // このターンはマナを置いた
      console.log(`[Server] Player ${socket.id} played card ${card.value} to mana zone. Max Mana: ${players[socket.id].maxMana}, Current Mana: ${players[socket.id].currentMana}`);
    } else if (playType === 'field') {
      if (players[socket.id].currentMana >= card.manaCost) {
        players[socket.id].currentMana -= card.manaCost;
        players[socket.id].played.push(card);
        console.log(`[Server] Player ${socket.id} played card ${card.value} to field. Current Mana: ${players[socket.id].currentMana}`);

        // カード効果の処理
        if (card.effect) {
          console.log(`[Server] Card effect triggered for ${socket.id}: ${card.effect}`);
          if (card.effect === "Draw 1 card") {
            if (players[socket.id].deck.length > 0) {
              const drawnCard = players[socket.id].deck.shift();
              players[socket.id].hand.push(drawnCard);
              io.to(socket.id).emit('effect_triggered', `You drew a card (${drawnCard.name}) from ${card.name}'s effect!`);
              console.log(`[Server] Player ${socket.id} drew ${drawnCard.name} due to effect.`);
            } else {
              io.to(socket.id).emit('effect_triggered', `You tried to draw a card from ${card.name}'s effect, but your deck is empty!`);
              console.log(`[Server] Player ${socket.id} tried to draw, but deck is empty for effect.`);
            }
          }
          // 他の効果があればここに追加
        }

      } else {
        console.log(`[Server] Player ${socket.id} tried to play card ${card.value}, but not enough mana. Cost: ${card.manaCost}, Current: ${players[socket.id].currentMana}`);
        players[socket.id].hand.push(card); // 手札に戻す
      }
    } else {
      console.log(`[Server] Invalid playType: ${playType}`);
      players[socket.id].hand.push(card); // 手札に戻す
    }
    emitFullGameState();
  });

  // ターン終了イベント
  socket.on('end_turn', () => {
    if (!players[socket.id] || !players[socket.id].isTurn || !gameActive) {
      console.log(`[Server] Player ${socket.id} tried to end turn, but it's not their turn or game not active.`);
      return;
    }

    players[socket.id].isTurn = false; // 現在のプレイヤーのターンを終了
    currentPlayerIndex = (currentPlayerIndex + 1) % playerOrder.length; // 次のプレイヤーへ
    const nextPlayerId = playerOrder[currentPlayerIndex];

    // 次のプレイヤーが存在することを確認
    if (players[nextPlayerId]) {
        players[nextPlayerId].isTurn = true; // 次のプレイヤーのターンを開始
        players[nextPlayerId].currentMana = players[nextPlayerId].maxMana; // 次のプレイヤーのマナを回復
        players[nextPlayerId].manaPlayedThisTurn = false; // 次のターンのマナプレイフラグをリセット
        players[nextPlayerId].drawnThisTurn = false; // 次のターンのドローフラグをリセット

        // ターン開始時の自動ドロー
        if (players[nextPlayerId].deck.length > 0) {
          const card = players[nextPlayerId].deck.shift();
          players[nextPlayerId].hand.push(card);
          // players[nextPlayerId].drawnThisTurn = true; // 自動ドローは1回とカウントしない
          console.log(`[Server] Player ${nextPlayerId} automatically drew card: ${card.value}. Deck size: ${players[nextPlayerId].deck.length}`);
        } else {
          console.log(`[Server] Player ${nextPlayerId} could not draw, deck is empty.`);
        }

        console.log(`[Server] Turn ended for ${socket.id}. Next turn for ${nextPlayerId}`);
    } else {
        console.log(`[Server] Error: Next player ${nextPlayerId} not found after turn end. Resetting game.`);
        // 次のプレイヤーが見つからない場合はゲームをリセット
        gameActive = false;
        playerOrder = [];
        players = {};
        currentPlayerIndex = 0;
    }
    emitFullGameState();
  });

  socket.on('disconnect', () => {
    console.log('[Server] User disconnected:', socket.id);
    const disconnectedPlayerId = socket.id;
    delete players[disconnectedPlayerId];
    playerOrder = playerOrder.filter(id => id !== disconnectedPlayerId);

    console.log('[Server] Current players after disconnect:', Object.keys(players).length);
    // プレイヤーが0人になったらゲーム状態をリセット
    if (Object.keys(players).length === 0) {
      gameActive = false;
      playerOrder = [];
      currentPlayerIndex = 0;
      console.log('[Server] All players disconnected. Game state reset.');
    } else if (playerOrder.length === 1) {
      // 1人になったらゲーム終了
      gameActive = false; // ゲームはアクティブではない
      console.log('[Server] One player left. Game ended.');
      // 残ったプレイヤーのターン状態をリセット（もし待機中だった場合）
      if (players[playerOrder[0]]) {
          players[playerOrder[0]].isTurn = false; // 残ったプレイヤーのターンを強制的に終了
      }
    }
    // ターン中のプレイヤーが切断した場合、残ったプレイヤーにターンを渡す
    // ただし、ゲームがアクティブで、かつ残ったプレイヤーが1人の場合のみ
    if (gameActive && playerOrder.length === 1 && players[playerOrder[0]]) {
        players[playerOrder[0]].isTurn = true; // 残ったプレイヤーにターンを渡す
        players[playerOrder[0]].currentMana = players[playerOrder[0]].maxMana; // マナを回復
        players[playerOrder[0]].manaPlayedThisTurn = false; // マナプレイフラグをリセット
        players[playerOrder[0]].drawnThisTurn = false; // ドローフラグをリセット
        console.log(`[Server] Turn passed to remaining player: ${playerOrder[0]}`);
    }
    emitFullGameState(); // 残ったプレイヤーに状態を更新
  });
});

const path = require('path');

// Serve static files from the React app
app.use(express.static(path.join(__dirname, '../client/build')));

// All remaining requests return the React app, so it can handle routing.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});