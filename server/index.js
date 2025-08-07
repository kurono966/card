const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const allCards = require('./cardData'); // cardData.jsをインポート

const app = express();
const cors = require('cors');
app.use(cors());
const server = http.createServer(app);
// 環境変数から本番環境かどうかを判定
const isProduction = process.env.NODE_ENV === 'production';

// 許可するオリジンのリスト
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://neocard-client.vercel.app',
  'https://cardclient.netlify.app',
  'https://neocard-server.onrender.com',  // Add the server's own URL
  /^https:\/\/neocard-client-.*\.vercel\.app$/,
  /^https:\/\/[^\s]+\.netlify\.app$/
];

// 本番環境ではセキュアな設定、開発環境では緩和した設定
const corsOptions = isProduction 
  ? {
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.some(allowed => 
          typeof allowed === 'string' 
            ? origin === allowed 
            : allowed.test(origin)
        )) {
          callback(null, true);
        } else {
          console.log('Blocked by CORS:', origin);
          callback(new Error('Not allowed by CORS'));
        }
      },
      methods: ['GET', 'POST'],
      credentials: true
    }
  : {
      origin: true, // 開発環境ではすべてのオリジンを許可
      methods: ['GET', 'POST'],
      credentials: true
    };

const io = socketIo(server, {
  cors: {
    origin: corsOptions.origin,
    methods: ['GET', 'POST'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization']
  },
  allowEIO3: true, // 互換性のため
  // Enable WebSocket transport with fallback to polling
  transports: ['websocket', 'polling'],
  // Add path if your client is using a specific path
  path: '/socket.io/',
  // Connection settings
  pingTimeout: 60000,
  pingInterval: 25000,
  upgradeTimeout: 10000,
  maxHttpBufferSize: 1e8,
  allowUpgrades: true,
  // Security settings
  cookie: false,
  // Enable HTTP long-polling as fallback
  serveClient: false,
  // Enable compatibility with older Socket.IO clients
  allowEIO3: true
});

// CORS configuration for regular HTTP requests
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    // Check if origin is allowed
    if (allowedOrigins.some(allowed => 
      typeof allowed === 'string' 
        ? origin === allowed 
        : allowed.test(origin)
    )) {
      return callback(null, true);
    }
    
    console.log('CORS blocked for origin:', origin);
    return callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Handle preflight requests
app.options('*', cors());

const PORT = process.env.PORT || 3000;

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

// ゲームオーバーチェック
function checkGameOver(loserId, winnerSocketId) {
  if (players[loserId].life <= 0) {
    io.emit('game_over', { winner: winnerSocketId, loser: loserId });
    gameActive = false;
    return true;
  }
  return false;
}

// 戦闘ダメージを解決する
function resolveCombatDamage() {
  const attackerPlayer = players[playerOrder[currentPlayerIndex]];
  const opponentId = playerOrder.find(id => id !== playerOrder[currentPlayerIndex]);
  const opponentPlayer = players[opponentId];

  // グレイブヤードを初期化（存在しない場合）
  if (!attackerPlayer.graveyard) attackerPlayer.graveyard = [];
  if (!opponentPlayer.graveyard) opponentPlayer.graveyard = [];
  
  // ファーストストライクフェイズ
  const firstStrikeAttackers = attackingCreatures.filter(attackInfo => {
    const card = attackerPlayer.played.find(c => c.id === attackInfo.attackerId);
    return card && card.abilities && card.abilities.includes('firstStrike');
  });

  // 通常の攻撃クリーチャー（ファーストストライクを持たないもの）
  const normalAttackers = attackingCreatures.filter(attackInfo => 
    !firstStrikeAttackers.includes(attackInfo)
  );

  // ダメージを解決するヘルパー関数
  const resolveDamage = (attackers) => {
    attackers.forEach(attackInfo => {
      const attackerCard = attackerPlayer.played.find(c => c.id === attackInfo.attackerId);
      if (!attackerCard) return; // クリーチャーがすでに破壊されている場合

      const blockers = blockingAssignments[attackInfo.attackerId] || [];
      const hasFlying = attackerCard.abilities && attackerCard.abilities.includes('flying');
      const hasTrample = attackerCard.abilities && attackerCard.abilities.includes('trample');
      const hasFirstStrike = attackerCard.abilities && attackerCard.abilities.includes('firstStrike');
      const hasDeathtouch = attackerCard.abilities && attackerCard.abilities.includes('deathtouch');
    
      // 飛行持ちで、ブロッカーがいないか、飛行/到達を持たない場合、プレイヤーに直接ダメージ
      if (hasFlying && blockers.length === 0) {
        // ブロックされていない飛行クリーチャーはプレイヤーに直接ダメージ
        opponentPlayer.life -= attackerCard.attack;
        console.log(`[Server] Flying creature ${attackerCard.id} deals ${attackerCard.attack} damage to player ${opponentId}. Life: ${opponentPlayer.life}`);
        checkGameOver(opponentId, attackerPlayer.socketId);
        return;
      }

      if (blockers.length > 0) {
        let remainingDamage = attackerCard.attack;
        let totalBlockingToughness = blockers.reduce((sum, blockerId) => {
          const blocker = opponentPlayer.played.find(c => c.id === blockerId);
          return sum + (blocker ? blocker.defense : 0);
        }, 0);

        // 各ブロッカーにダメージを割り振る
        for (let i = 0; i < blockers.length && remainingDamage > 0; i++) {
          const blockerId = blockers[i];
          const blockerCard = opponentPlayer.played.find(c => c.id === blockerId);
          if (!blockerCard) continue;

          // ブロッカーにダメージを与える
          const damageToBlocker = hasDeathtouch ? blockerCard.defense : Math.min(remainingDamage, blockerCard.defense);
          blockerCard.defense -= damageToBlocker;
          remainingDamage -= damageToBlocker;
          console.log(`[Server] Attacker ${attackerCard.id} deals ${damageToBlocker} damage to blocker ${blockerId}`);

          // ブロッカーから攻撃者へのダメージ（反撃）
          if (blockerCard.defense > 0 || (blockerCard.abilities && blockerCard.abilities.includes('deathtouch'))) {
            if (attackerCard.defense > 0) {
              const damageToAttacker = blockerCard.attack;
              attackerCard.defense -= damageToAttacker;
              console.log(`[Server] Blocker ${blockerId} deals ${damageToAttacker} damage to attacker ${attackerCard.id}`);
            }
          }
        }

        // トランプル処理（残りダメージをプレイヤーに与える）
        if (hasTrample && remainingDamage > 0) {
          opponentPlayer.life -= remainingDamage;
          console.log(`[Server] Trample deals ${remainingDamage} damage to player ${opponentId}. Life: ${opponentPlayer.life}`);
          checkGameOver(opponentId, attackerPlayer.socketId);
        }
      } else {
        // ブロックされていない場合、プレイヤーに直接ダメージ
        opponentPlayer.life -= attackerCard.attack;
        console.log(`[Server] Player ${opponentId} took ${attackerCard.attack} damage. Life: ${opponentPlayer.life}`);
        checkGameOver(opponentId, attackerPlayer.socketId);
      }

      // ダメージマーカーをリセット（ターン終了時にクリアされる）
      if (attackerCard) {
        attackerCard.damageThisTurn = (attackerCard.damageThisTurn || 0) + attackerCard.attack;
      }
    });

    // 破壊されたクリーチャーを墓地に送る
    [attackerPlayer, opponentPlayer].forEach(player => {
      const destroyed = player.played.filter(card => card.defense <= 0);
      player.played = player.played.filter(card => card.defense > 0);
      player.graveyard = [...(player.graveyard || []), ...destroyed];
      
      // 破壊トリガーを処理
      destroyed.forEach(card => {
        console.log(`[Server] Card ${card.id} was destroyed and sent to graveyard`);
        // ここで死亡時効果を処理
      });
    });
  };

  // ファーストストライクフェイズの処理
  if (firstStrikeAttackers.length > 0) {
    console.log('[Server] Resolving first strike damage phase');
    resolveDamage(firstStrikeAttackers);
    
    // 生存している攻撃クリーチャーとブロッカーのみを残して通常ダメージフェイズに進む
    const remainingAttackers = normalAttackers.filter(attackInfo => {
      const card = attackerPlayer.played.find(c => c.id === attackInfo.attackerId);
      return card && card.defense > 0;
    });
    
    // 通常ダメージフェイズ
    if (remainingAttackers.length > 0) {
      console.log('[Server] Resolving normal damage phase');
      resolveDamage(remainingAttackers);
    }
  } else {
    // ファーストストライクがいない場合は通常通り1回だけダメージ解決
    resolveDamage(attackingCreatures);
  }

  // 戦闘終了後、攻撃クリーチャーとブロッククリーチャーのリストをクリア
  attackingCreatures = [];
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
    // 攻撃宣言は現在のターンプレイヤーのみ可能
    if (!players[socket.id] || !players[socket.id].isTurn || !gameActive || currentPhase !== GAME_PHASES.DECLARE_ATTACKERS) {
      console.log(`[Server] Player ${socket.id} tried to declare attackers, but it's not their turn or not in correct phase.`);
      return;
    }

    // 攻撃クリーチャーをリセット
    attackingCreatures = [];
    
    // 攻撃可能なクリーチャーのみをフィルタリング
    const validAttackers = attackers.filter(attackerId => {
      const attackerCard = players[socket.id].played.find(c => c.id === attackerId);
      return attackerCard && !attackerCard.isTapped && !attackerCard.summoningSickness;
    });

    // 有効な攻撃クリーチャーのみを追加
    validAttackers.forEach(attackerId => {
      const attackerCard = players[socket.id].played.find(c => c.id === attackerId);
      if (attackerCard) {
        // 攻撃中フラグを設定（タップはブロックフェイズで行う）
        attackerCard.attacking = true;
        attackingCreatures.push({ 
          attackerId: attackerId, 
          targetId: 'player', // デフォルトでプレイヤーを攻撃対象
          controllerId: socket.id // 攻撃コントローラーを記録
        });
      }
    });
    
    console.log(`[Server] Declared attackers:`, attackingCreatures);
    
    // 攻撃者がいない場合は即座に戦闘ダメージフェイズへ
    if (attackingCreatures.length === 0) {
      currentPhase = GAME_PHASES.COMBAT_DAMAGE;
      console.log(`[Server] No attackers, moving to ${currentPhase}`);
    } else {
      // ブロックフェイズに移行
      currentPhase = GAME_PHASES.DECLARE_BLOCKERS;
      console.log(`[Server] Moving to ${currentPhase}`);
      
      // 攻撃クリーチャーをタップ（ブロックフェイズに移行するタイミングでタップ）
      attackingCreatures.forEach(attacker => {
        const attackerCard = players[attacker.controllerId].played.find(c => c.id === attacker.attackerId);
        if (attackerCard) {
          attackerCard.isTapped = true;
        }
      });
    }
    
    emitFullGameState();
  });

  // ブロッククリーチャー宣言イベント
  socket.on('declare_blockers', (assignments) => {
    // ブロック宣言は現在のターンプレイヤーでない方のみ可能
    const currentPlayerId = playerOrder[currentPlayerIndex];
    if (!players[socket.id] || socket.id === currentPlayerId || !gameActive || currentPhase !== GAME_PHASES.DECLARE_BLOCKERS) {
      console.log(`[Server] Player ${socket.id} tried to declare blockers, but it's not their turn or not in correct phase.`);
      return;
    }

    blockingAssignments = {};
    
    // 有効なブロッカーのみをフィルタリング
    for (const attackerId in assignments) {
      const blockers = assignments[attackerId];
      
      // 攻撃者が存在するか確認
      const attackerInfo = attackingCreatures.find(a => a.attackerId === attackerId);
      if (!attackerInfo) {
        console.log(`[Server] Invalid attacker ID in block assignment: ${attackerId}`);
        continue;
      }
      
      // ブロッカーを検証
      const validBlockers = blockers.filter(blockerId => {
        const blockerCard = players[socket.id].played.find(c => c.id === blockerId);
        return blockerCard && !blockerCard.isTapped;
      });
      
      if (validBlockers.length > 0) {
        blockingAssignments[attackerId] = validBlockers;
        
        // ブロックしたクリーチャーをタップ（MTGルールに従い、ブロック時にはタップしない）
        // 注意: 通常、ブロッカーはタップしませんが、ゲームの仕様に応じて調整してください
        validBlockers.forEach(blockerId => {
          const blockerCard = players[socket.id].played.find(c => c.id === blockerId);
          if (blockerCard) blockerCard.blocking = true; // ブロック中フラグを設定
        });
      }
    }
    
    console.log(`[Server] Declared blockers:`, blockingAssignments);
    
    // 戦闘ダメージフェイズに移行
    currentPhase = GAME_PHASES.COMBAT_DAMAGE;
    console.log(`[Server] Moving to ${currentPhase}`);
    
    // 戦闘ダメージを解決
    resolveCombatDamage();
    
    // メインフェイズ2に移行
    currentPhase = GAME_PHASES.MAIN_PHASE_2;
    console.log(`[Server] Moving to ${currentPhase}`);
    
    // 攻撃・ブロック状態をリセット
    attackingCreatures = [];
    blockingAssignments = {};
    
    // 攻撃中・ブロック中フラグをリセット
    Object.values(players).forEach(player => {
      player.played.forEach(card => {
        card.attacking = false;
        card.blocking = false;
      });
    });
  });

  // Other socket event handlers...
  
}); // End of Socket.IO connection handler

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`)
});