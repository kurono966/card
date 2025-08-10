const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const allCards = require('./cardData');

console.log('Starting server...');

const app = express();
const cors = require('cors');

// CORS設定
app.use(cors({
  origin: ['http://localhost:3000', 'https://neocard-client.vercel.app'],
  methods: ['GET', 'POST'],
  credentials: true
}));

const server = http.createServer(app);

const io = socketIo(server, {
  cors: {
    origin: (origin, callback) => {
      const allowedOrigins = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://neocard-client.vercel.app",
      ];
      if (!origin || allowedOrigins.includes(origin) || /https:\/\/neocard-client-.*\.vercel\.app/.test(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ["GET", "POST", "OPTIONS"],
    credentials: true,
  },
  pingTimeout: 30000,
  pingInterval: 25000,
});

const PORT = process.env.PORT || 3001;

// --- Game Constants ---
const GAME_PHASES = {
  MAIN_PHASE_1: 'main_phase_1',
  DECLARE_ATTACKERS: 'declare_attackers',
  DECLARE_BLOCKERS: 'declare_blockers',
  COMBAT_DAMAGE: 'combat_damage',
  MAIN_PHASE_2: 'main_phase_2',
  END_PHASE: 'end_phase',
};
const AI_PLAYER_ID = 'ai_player';

// --- Game State ---
let games = {}; // { gameId: { players: {}, playerOrder: [], ... } }
let waitingPlayer = null; // For online matchmaking

// --- Utility Functions ---
function createGameId() {
  return `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// --- Game Initialization ---
function initializePlayerState(socketId, gameId) {
  let deck = [];
  const deckSize = 40;
  for (let i = 0; i < deckSize; i++) {
    const randomIndex = Math.floor(Math.random() * allCards.length);
    const card = { ...allCards[randomIndex], id: `${allCards[randomIndex].id}_${socketId}_${i}`, isTapped: false };
    deck.push(card);
  }
  deck = shuffleArray(deck);
  const hand = deck.splice(0, 5);

  return {
    id: socketId,
    gameId: gameId,
    deck: deck,
    hand: hand,
    played: [],
    manaZone: [],
    graveyard: [],
    maxMana: 0,
    currentMana: 0,
    isTurn: false,
    manaPlayedThisTurn: false,
    life: 20,
  };
}

function startGame(player1Id, player2Id) {
  const gameId = createGameId();
  console.log(`[Game] Starting new game: ${gameId} with ${player1Id} and ${player2Id}`);

  const player1State = initializePlayerState(player1Id, gameId);
  const player2State = initializePlayerState(player2Id, gameId);

  // First player's turn
  player1State.isTurn = true;

  const game = {
    id: gameId,
    players: {
      [player1Id]: player1State,
      [player2Id]: player2State,
    },
    playerOrder: [player1Id, player2Id],
    currentPlayerIndex: 0,
    currentPhase: GAME_PHASES.MAIN_PHASE_1,
    attackingCreatures: [],
    blockingAssignments: {},
    gameActive: true,
  };

  games[gameId] = game;

  // Assign gameId to sockets
  io.sockets.sockets.get(player1Id)?.gameId = gameId;
  if (player2Id !== AI_PLAYER_ID) {
    io.sockets.sockets.get(player2Id)?.gameId = gameId;
  }

  console.log(`[Game] Game ${gameId} created.`);
  emitFullGameState(gameId);
}

// --- Game State Broadcasting ---
function emitFullGameState(gameId) {
  const game = games[gameId];
  if (!game) {
    console.error(`[Server] emitFullGameState: Game not found for ID ${gameId}`);
    return;
  }
  console.log(`--- [Game ${gameId}] Emitting Full Game State ---`);

  game.playerOrder.forEach(pId => {
    if (pId === AI_PLAYER_ID) return; // Don't emit to AI

    const selfPlayer = game.players[pId];
    const opponentId = game.playerOrder.find(id => id !== pId);
    const opponentPlayer = game.players[opponentId];

    if (!selfPlayer || !opponentPlayer) {
        console.error(`[Server] Player or opponent not found in game ${gameId}`);
        return;
    }

    let stateForSelf = {
      yourHand: selfPlayer.hand,
      yourDeckSize: selfPlayer.deck.length,
      yourPlayedCards: selfPlayer.played,
      yourManaZone: selfPlayer.manaZone,
      yourGraveyard: selfPlayer.graveyard,
      yourMaxMana: selfPlayer.maxMana,
      yourCurrentMana: selfPlayer.currentMana,
      isYourTurn: selfPlayer.isTurn,
      yourLife: selfPlayer.life,
      opponentPlayedCards: opponentPlayer.played,
      opponentManaZone: opponentPlayer.manaZone,
      opponentGraveyard: opponentPlayer.graveyard,
      opponentDeckSize: opponentPlayer.deck.length,
      opponentMaxMana: opponentPlayer.maxMana,
      opponentCurrentMana: opponentPlayer.currentMana,
      opponentLife: opponentPlayer.life,
      currentPhase: game.currentPhase,
      attackingCreatures: game.attackingCreatures,
      blockingAssignments: game.blockingAssignments,
    };
    io.to(pId).emit('game_state', stateForSelf);
    console.log(`[Game ${gameId}] State sent to ${pId}. Turn: ${selfPlayer.isTurn}, Phase: ${game.currentPhase}`);
  });
  console.log(`-------------------------------------------`);
}

// --- AI Logic ---
async function aiTurnLogic(gameId) {
    const game = games[gameId];
    if (!game || !game.players[AI_PLAYER_ID].isTurn) return;
    console.log(`[AI] [Game ${gameId}] Starting AI turn.`);

    const ai = game.players[AI_PLAYER_ID];
    const humanPlayerId = game.playerOrder.find(id => id !== AI_PLAYER_ID);
    const humanPlayer = game.players[humanPlayerId];

    // Helper to add delay
    const delay = ms => new Promise(res => setTimeout(res, ms));

    await delay(1000); // Thinking time

    // 1. Play Mana
    if (!ai.manaPlayedThisTurn && ai.hand.length > 0) {
        const cardToPlayAsMana = ai.hand[0]; // Simple: play the first card
        ai.hand.shift();
        ai.manaZone.push(cardToPlayAsMana);
        ai.maxMana++;
        ai.currentMana++;
        ai.manaPlayedThisTurn = true;
        console.log(`[AI] [Game ${gameId}] Played ${cardToPlayAsMana.name} as mana.`);
        emitFullGameState(gameId);
        await delay(1000);
    }

    // 2. Play Creatures
    let playedCreature = false;
    do {
        playedCreature = false;
        const playableCreatures = ai.hand.filter(c => c.type === 'Creature' && c.manaCost <= ai.currentMana);
        if (playableCreatures.length > 0) {
            const creatureToPlay = playableCreatures[0]; // Simple: play the cheapest
            ai.hand = ai.hand.filter(c => c.id !== creatureToPlay.id);
            ai.currentMana -= creatureToPlay.manaCost;
            creatureToPlay.canAttack = false; // Summoning sickness
            ai.played.push(creatureToPlay);
            playedCreature = true;
            console.log(`[AI] [Game ${gameId}] Played creature ${creatureToPlay.name}.`);
            emitFullGameState(gameId);
            await delay(1000);
        }
    } while (playedCreature);


    // 3. Declare Attackers
    game.currentPhase = GAME_PHASES.DECLARE_ATTACKERS;
    emitFullGameState(gameId);
    await delay(1000);

    const attackers = ai.played.filter(c => c.canAttack && !c.isTapped);
    if (attackers.length > 0) {
        game.attackingCreatures = [];
        attackers.forEach(attacker => {
            attacker.isTapped = true;
            game.attackingCreatures.push({ attackerId: attacker.id, targetId: 'player' });
        });
        console.log(`[AI] [Game ${gameId}] Declared ${attackers.length} attackers.`);
    } else {
        console.log(`[AI] [Game ${gameId}] No creatures to attack with.`);
    }
    
    // Since human is blocking, we move to their phase
    game.currentPhase = game.attackingCreatures.length > 0 ? GAME_PHASES.DECLARE_BLOCKERS : GAME_PHASES.MAIN_PHASE_2;
    emitFullGameState(gameId);
    
    // If no attackers, AI proceeds to end turn
    if (game.attackingCreatures.length === 0) {
        await delay(1000);
        game.currentPhase = GAME_PHASES.END_PHASE;
        console.log(`[AI] [Game ${gameId}] Moving to end phase.`);
        emitFullGameState(gameId);
        await delay(500);
        endCurrentTurnAndStartNext(gameId);
    }
    // ... otherwise, we wait for the human to block. The human's 'next_phase' action will trigger combat resolution.
}


// --- Turn Management ---
function endCurrentTurnAndStartNext(gameId) {
  const game = games[gameId];
  if (!game || !game.gameActive) return;

  const currentPlayerId = game.playerOrder[game.currentPlayerIndex];
  const currentPlayer = game.players[currentPlayerId];
  if (currentPlayer) {
    currentPlayer.isTurn = false;
  }

  game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.playerOrder.length;
  const nextPlayerId = game.playerOrder[game.currentPlayerIndex];
  const nextPlayer = game.players[nextPlayerId];

  if (nextPlayer) {
    nextPlayer.isTurn = true;
    nextPlayer.maxMana++; // Gain 1 max mana at the start of the turn
    nextPlayer.currentMana = nextPlayer.maxMana;
    nextPlayer.manaPlayedThisTurn = false;
    
    // Untap creatures
    nextPlayer.played.forEach(card => {
        card.isTapped = false;
        card.canAttack = true;
    });

    // Draw a card
    if (nextPlayer.deck.length > 0) {
      const card = nextPlayer.deck.shift();
      nextPlayer.hand.push(card);
    } else {
      // Handle deck out
    }
    
    game.currentPhase = GAME_PHASES.MAIN_PHASE_1;
    game.attackingCreatures = [];
    game.blockingAssignments = {};

    console.log(`[Game ${gameId}] Turn ended for ${currentPlayerId}. Next turn for ${nextPlayerId}`);
    emitFullGameState(gameId);

    // If the next player is the AI, trigger its logic
    if (nextPlayerId === AI_PLAYER_ID) {
      aiTurnLogic(gameId);
    }
  } else {
    console.error(`[Game ${gameId}] Next player not found!`);
  }
}


// --- Socket.IO Event Handlers ---
io.on('connection', (socket) => {
  console.log(`[Server] Client connected: ${socket.id}`);

  socket.on('start_online_game', () => {
    console.log(`[Server] ${socket.id} wants to start an online game.`);
    if (waitingPlayer) {
      if(waitingPlayer.id !== socket.id) {
        const player2 = socket;
        const player1 = waitingPlayer;
        waitingPlayer = null;
        startGame(player1.id, player2.id);
      }
    } else {
      waitingPlayer = socket;
      socket.emit('message', 'Waiting for another player...');
      console.log(`[Server] ${socket.id} is waiting for a match.`);
    }
  });

  socket.on('start_solo_game', () => {
    console.log(`[Server] ${socket.id} wants to start a solo game.`);
    // If this player is waiting for an online game, remove them from queue
    if (waitingPlayer && waitingPlayer.id === socket.id) {
        waitingPlayer = null;
    }
    startGame(socket.id, AI_PLAYER_ID);
  });

  socket.on('play_card', (cardId, playType) => {
    const gameId = socket.gameId;
    const game = games[gameId];
    if (!game) return;
    const player = game.players[socket.id];
    if (!player || !player.isTurn) return;

    const cardIndex = player.hand.findIndex(c => c.id === cardId);
    if (cardIndex === -1) return;
    const [card] = player.hand.splice(cardIndex, 1);

    if (playType === 'mana') {
        if (player.manaPlayedThisTurn) {
            player.hand.push(card); // Return to hand
        } else {
            player.manaZone.push(card);
            player.currentMana++;
            player.manaPlayedThisTurn = true;
        }
    } else if (playType === 'field') {
        if (player.currentMana >= card.manaCost) {
            player.currentMana -= card.manaCost;
            card.canAttack = false; // Summoning sickness
            player.played.push(card);
        } else {
            player.hand.push(card); // Return to hand
        }
    }
    emitFullGameState(gameId);
  });

  socket.on('next_phase', () => {
    const gameId = socket.gameId;
    const game = games[gameId];
    if (!game) return;
    const player = game.players[socket.id];
    
    // Allow phase progression only for the current turn player, except for blocking
    if (!player.isTurn && game.currentPhase !== GAME_PHASES.DECLARE_BLOCKERS) return;

    switch (game.currentPhase) {
        case GAME_PHASES.MAIN_PHASE_1:
            game.currentPhase = GAME_PHASES.DECLARE_ATTACKERS;
            break;
        case GAME_PHASES.DECLARE_ATTACKERS:
            if (game.attackingCreatures.length === 0) {
                game.currentPhase = GAME_PHASES.MAIN_PHASE_2;
            } else {
                game.currentPhase = GAME_PHASES.DECLARE_BLOCKERS;
            }
            break;
        case GAME_PHASES.DECLARE_BLOCKERS:
            // Resolve combat, then move to next phase
            // For simplicity, we'll just move to the next phase for now.
            // A full implementation would resolve damage here.
            game.currentPhase = GAME_PHASES.MAIN_PHASE_2;
            break;
        case GAME_PHASES.MAIN_PHASE_2:
            game.currentPhase = GAME_PHASES.END_PHASE;
            break;
        case GAME_PHASES.END_PHASE:
            endCurrentTurnAndStartNext(gameId);
            return; // endCurrentTurnAndStartNext already emits state
    }
    emitFullGameState(gameId);
  });

  socket.on('declare_attackers', (attackerIds) => {
    const gameId = socket.gameId;
    const game = games[gameId];
    if (!game) return;
    const player = game.players[socket.id];
    if (!player.isTurn || game.currentPhase !== GAME_PHASES.DECLARE_ATTACKERS) return;

    game.attackingCreatures = [];
    attackerIds.forEach(attackerId => {
        const attackerCard = player.played.find(c => c.id === attackerId);
        if (attackerCard && !attackerCard.isTapped && attackerCard.canAttack) {
            attackerCard.isTapped = true;
            game.attackingCreatures.push({ attackerId: attackerId, targetId: 'player' });
        }
    });
    emitFullGameState(gameId);
  });
  
  socket.on('disconnect', () => {
    console.log(`[Server] Client disconnected: ${socket.id}`);
    if (waitingPlayer && waitingPlayer.id === socket.id) {
      waitingPlayer = null;
      console.log(`[Server] Player ${socket.id} removed from waiting queue.`);
    }
    // Handle in-game disconnect
    const gameId = socket.gameId;
    if (gameId && games[gameId]) {
        const game = games[gameId];
        const opponentId = game.playerOrder.find(id => id !== socket.id);
        if (opponentId && io.sockets.sockets.get(opponentId)) {
            io.to(opponentId).emit('message', 'Opponent disconnected. You win!');
        }
        delete games[gameId];
        console.log(`[Game ${gameId}] Game ended due to disconnect.`);
    }
  });
});

server.listen(PORT, () => {
  console.log(`[Server] Server is running on port ${PORT}`);
});
