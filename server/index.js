const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');
const allCards = require('./cardData'); // cardData.jsをインポート

const app = express();
const cors = require('cors');
app.use(cors());
const server = http.createServer(app);

// In server/index.js, replace the production block with:

if (process.env.NODE_ENV === 'production') {
  const buildPath = path.join(__dirname, '../client/build');
  console.log('Build path:', buildPath);
  
  // Serve static files from the build directory
  app.use(express.static(buildPath));
  
  // Serve index.html for all other routes
  app.get('*', (req, res) => {
    res.sendFile(path.join(buildPath, 'index.html'));
  });
}

const io = socketIo(server, {
  cors: {
    origin: (origin, callback) => {
      const allowedOrigins = [
        "http://localhost:3000",
        "http://localhost:3001",
        "https://neocard-client.vercel.app",
      ];
      // VercelのプレビューデプロイメントURL（例: https://neocard-client-*.vercel.app）を許可する
      if (!origin || allowedOrigins.includes(origin) || /https:\/\/neocard-client-.*\.vercel\.app/.test(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ["GET", "POST"],
  }
});

const PORT = process.env.PORT || 3001;  // Changed from 3000 to 3001

// Define game phases
const GAME_PHASES = {
  MAIN_PHASE_1: 'main_phase_1',
  DECLARE_ATTACKERS: 'declare_attackers',
  DECLARE_BLOCKERS: 'declare_blockers',
  COMBAT_DAMAGE: 'combat_damage',
  MAIN_PHASE_2: 'main_phase_2',
  END_PHASE: 'end_phase',
};

let currentPhase = GAME_PHASES.MAIN_PHASE_1; // Initial phase
let attackingCreatures = []; // { attackerId: cardId, targetId: 'player' or cardId }
let blockingAssignments = {}; // { attackerId: [blockerId1, blockerId2] }

// --- ゲームの状態管理 --- //
let players = {}; // { socketId: { deck: [], hand: [], played: [], manaZone: [], maxMana: 0, currentMana: 0, isTurn: false, manaPlayedThisTurn: false, drawnThisTurn: false, life: 20 } }
let playerOrder = []; // プレイヤーの順番を保持する配列
let currentPlayerIndex = 0; // 現在のターンのプレイヤーのインデックス
let gameActive = false; // ゲームがアクティブかどうかを示すフラグ

function initializePlayerState(socketId) {
  // cardData.jsからデッキを構築
  let deck = [];
  const deckSize = 40; // デッキの枚数

  for (let i = 0; i < deckSize; i++) {
    // allCardsからランダムにカードを選択し、新しいIDを付与してデッキに追加
    const randomIndex = Math.floor(Math.random() * allCards.length);
    const card = { ...allCards[randomIndex], id: `${allCards[randomIndex].id}_${socketId}_${i}`, isTapped: false };
    deck.push(card);
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
      currentPhase: currentPhase, // 現在のフェーズを追加
      attackingCreatures: attackingCreatures, // 攻撃クリーチャーの情報を追加
      blockingAssignments: blockingAssignments, // ブロックの割り当て情報を追加
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

  // フェーズ進行イベント
  socket.on('next_phase', () => {
    if (!players[socket.id] || !players[socket.id].isTurn || !gameActive) {
      console.log(`[Server] Player ${socket.id} tried to advance phase, but it's not their turn or game not active.`);
      return;
    }

    const attackerPlayer = players[socket.id];
    const opponentId = playerOrder.find(id => id !== socket.id);
    const opponentPlayer = players[opponentId];

    switch (currentPhase) {
      case GAME_PHASES.MAIN_PHASE_1:
        currentPhase = GAME_PHASES.DECLARE_ATTACKERS;
        console.log(`[Server] Phase changed to ${currentPhase}`);
        break;
      case GAME_PHASES.DECLARE_ATTACKERS:
        // 攻撃クリーチャーが宣言された後、ブロックフェーズへ
        currentPhase = GAME_PHASES.DECLARE_BLOCKERS;
        console.log(`[Server] Phase changed to ${currentPhase}`);
        break;
      case GAME_PHASES.DECLARE_BLOCKERS:
        // ブロッククリーチャーが宣言された後、戦闘ダメージフェーズへ
        // ここで戦闘ダメージを解決する
        console.log(`[Server] Resolving combat damage...`);
        resolveCombatDamage();
        currentPhase = GAME_PHASES.MAIN_PHASE_2;
        console.log(`[Server] Phase changed to ${currentPhase}`);
        break;
      case GAME_PHASES.MAIN_PHASE_2:
        currentPhase = GAME_PHASES.END_PHASE;
        console.log(`[Server] Phase changed to ${currentPhase}`);
        break;
      case GAME_PHASES.END_PHASE:
        // ターン終了処理
        endCurrentTurnAndStartNext();
        console.log(`[Server] Phase changed to ${currentPhase}`);
        break;
      default:
        console.log(`[Server] Invalid phase transition from ${currentPhase}`);
        break;
    }
    emitFullGameState();
  });

  // 攻撃クリーチャー宣言イベント
  socket.on('declare_attackers', (attackers) => {
    if (!players[socket.id] || !players[socket.id].isTurn || !gameActive || currentPhase !== GAME_PHASES.DECLARE_ATTACKERS) {
      console.log(`[Server] Player ${socket.id} tried to declare attackers, but it's not their turn or not in correct phase.`);
      return;
    }

    attackingCreatures = [];
    attackers.forEach(attackerId => {
      const attackerCard = players[socket.id].played.find(c => c.id === attackerId);
      if (attackerCard && !attackerCard.isTapped) {
        attackerCard.isTapped = true; // 攻撃クリーチャーをタップ
        attackingCreatures.push({ attackerId: attackerId, targetId: 'player' }); // デフォルトでプレイヤーを攻撃対象とする
      } else {
        console.log(`[Server] Invalid attacker: ${attackerId} (not found or tapped).`);
      }
    });
    console.log(`[Server] Declared attackers:`, attackingCreatures);
    emitFullGameState();
  });

  // ブロッククリーチャー宣言イベント
  socket.on('declare_blockers', (assignments) => {
    if (!players[socket.id] || players[socket.id].isTurn || !gameActive || currentPhase !== GAME_PHASES.DECLARE_BLOCKERS) {
      console.log(`[Server] Player ${socket.id} tried to declare blockers, but it's not their turn or not in correct phase.`);
      return;
    }

    blockingAssignments = {};
    for (const attackerId in assignments) {
      const blockers = assignments[attackerId];
      blockers.forEach(blockerId => {
        const blockerCard = players[socket.id].played.find(c => c.id === blockerId);
        if (blockerCard && !blockerCard.isTapped) { // ブロッカーもタップ状態でないことを確認
          // ブロッカーはブロック時にタップしない（MTGルール）
          if (!blockingAssignments[attackerId]) {
            blockingAssignments[attackerId] = [];
          }
          blockingAssignments[attackerId].push(blockerId);
        } else {
          console.log(`[Server] Invalid blocker: ${blockerId} (not found or tapped).`);
        }
      });
    }
    console.log(`[Server] Declared blockers:`, blockingAssignments);
    emitFullGameState();
  });

  function resolveCombatDamage() {
    const attackerPlayer = players[playerOrder[currentPlayerIndex]];
    const opponentId = playerOrder.find(id => id !== playerOrder[currentPlayerIndex]);
    const opponentPlayer = players[opponentId];
    let totalDamage = 0;
    let gameEnded = false;

    // 攻撃クリーチャーごとにダメージを解決
    attackingCreatures.forEach(attackInfo => {
      const attackerCard = attackerPlayer.played.find(c => c.id === attackInfo.attackerId);
      if (!attackerCard) return; // クリーチャーがすでに破壊されている場合

      const blockers = blockingAssignments[attackInfo.attackerId] || [];

      if (blockers.length > 0) {
        // ブロックされた場合
        let totalBlockerDefense = 0;
        blockers.forEach(blockerId => {
          const blockerCard = opponentPlayer.played.find(c => c.id === blockerId);
          if (blockerCard) {
            // 攻撃クリーチャーからブロッカーへのダメージ
            blockerCard.defense -= attackerCard.attack;
            // ブロッカーから攻撃クリーチャーへのダメージ
            attackerCard.defense -= blockerCard.attack;
            totalBlockerDefense += blockerCard.defense; // ブロッカーの防御力を合計
          }
        });
      } else {
        // ブロックされていない場合、ダメージを合計
        totalDamage += attackerCard.attack;
      }
    });

    // ブロッカーの破壊処理
    opponentPlayer.played = opponentPlayer.played.filter(c => c.defense > 0);
    // 攻撃クリーチャーの破壊処理
    attackerPlayer.played = attackerPlayer.played.filter(c => c.defense > 0);

    // ブロックされていないダメージを適用
    if (totalDamage > 0) {
      opponentPlayer.life -= totalDamage;
      console.log(`[Server] Player ${opponentId} took ${totalDamage} damage. Life: ${opponentPlayer.life}`);
      
      if (opponentPlayer.life <= 0) {
        console.log(`[Server] Player ${opponentId} defeated!`);
        io.to(playerOrder[currentPlayerIndex]).emit('game_over', 'You won!');
        io.to(opponentId).emit('game_over', 'You lost!');
        gameActive = false; // ゲーム終了
        gameEnded = true;
      }
    }

    // 戦闘終了後、攻撃クリーチャーとブロッククリーチャーのリストをクリア
    if (!gameEnded) {
      attackingCreatures = [];
      blockingAssignments = {};
      emitFullGameState();
    }
  }

  function endCurrentTurnAndStartNext() {
    const currentSocketId = playerOrder[currentPlayerIndex];
    players[currentSocketId].isTurn = false; // 現在のプレイヤーのターンを終了

    // ターン終了時に自分のフィールドのカードをすべてアンタップする
    players[currentSocketId].played.forEach(card => {
      card.isTapped = false;
    });

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
          console.log(`[Server] Player ${nextPlayerId} automatically drew card: ${card.value}. Deck size: ${players[nextPlayerId].deck.length}`);
        } else {
          console.log(`[Server] Player ${nextPlayerId} could not draw, deck is empty.`);
        }

        console.log(`[Server] Turn ended for ${currentSocketId}. Next turn for ${nextPlayerId}`);
        currentPhase = GAME_PHASES.MAIN_PHASE_1; // 新しいターンの開始フェーズを設定
    } else {
        console.log(`[Server] Error: Next player ${nextPlayerId} not found after turn end. Resetting game.`);
        // 次のプレイヤーが見つからない場合はゲームをリセット
        gameActive = false;
        playerOrder = [];
        players = {};
        currentPlayerIndex = 0;
        currentPhase = GAME_PHASES.MAIN_PHASE_1; // フェーズもリセット
    }
  }
}
);

server.listen(PORT, () => {
  console.log(`[Server] Server is running on port ${PORT}`);
});