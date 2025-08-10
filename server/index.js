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
  COMBAT_DAMAGE: 'combat_damage', // This phase is conceptual, resolved in DECLARE_BLOCKERS
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
    // Create a deep copy of the card and give it a unique ID
    const cardTemplate = allCards[randomIndex];
    const card = { ...cardTemplate, id: `${cardTemplate.id}_${socketId}_${i}`, isTapped: false, canAttack: false };
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
  player1State.maxMana = 1;
  player1State.currentMana = 1;

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

  const player1Socket = io.sockets.sockets.get(player1Id);
  if (player1Socket) {
    player1Socket.gameId = gameId;
  }
  if (player2Id !== AI_PLAYER_ID) {
    const player2Socket = io.sockets.sockets.get(player2Id);
    if (player2Socket) {
      player2Socket.gameId = gameId;
    }
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

  game.playerOrder.forEach(pId => {
    if (pId === AI_PLAYER_ID) return;

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
  });
}

// --- Combat Logic ---
function resolveCombat(gameId) {
    const game = games[gameId];
    if (!game) return;

    const attackerPlayerId = game.playerOrder[game.currentPlayerIndex];
    const attackerPlayer = game.players[attackerPlayerId];
    const defenderPlayerId = game.playerOrder.find(id => id !== attackerPlayerId);
    const defenderPlayer = game.players[defenderPlayerId];

    console.log(`[Game ${gameId}] Resolving combat...`);

    // Create copies of creatures to store original stats
    const creatureCopies = {};
    [...attackerPlayer.played, ...defenderPlayer.played].forEach(c => {
        creatureCopies[c.id] = { ...c };
    });

    // 1. Damage Calculation
    game.attackingCreatures.forEach(attackInfo => {
        const attackerCard = attackerPlayer.played.find(c => c.id === attackInfo.attackerId);
        if (!attackerCard) return;

        const blockers = game.blockingAssignments[attackInfo.attackerId] || [];

        if (blockers.length > 0) {
            // --- Blocked --- 
            let totalBlockerAttack = 0;
            blockers.forEach(blockerId => {
                const blockerCard = defenderPlayer.played.find(c => c.id === blockerId);
                if (blockerCard) {
                    totalBlockerAttack += creatureCopies[blockerId].attack;
                }
            });

            attackerCard.defense -= totalBlockerAttack;

            // Attacker deals damage to blockers (simple: first blocker takes all)
            const firstBlocker = defenderPlayer.played.find(c => c.id === blockers[0]);
            if (firstBlocker) {
                firstBlocker.defense -= creatureCopies[attackerCard.id].attack;
            }
            console.log(`[Game ${gameId}] ${creatureCopies[attackerCard.id].name} was blocked.`);

        } else {
            // --- Unblocked --- 
            defenderPlayer.life -= creatureCopies[attackerCard.id].attack;
            console.log(`[Game ${gameId}] ${creatureCopies[attackerCard.id].name} dealt ${creatureCopies[attackerCard.id].attack} damage to player ${defenderPlayerId}. Life: ${defenderPlayer.life}`);
        }
    });

    // 2. Cleanup Destroyed Creatures
    const attackerGraveyard = [];
    attackerPlayer.played = attackerPlayer.played.filter(c => {
        if (c.defense <= 0) {
            attackerGraveyard.push(creatureCopies[c.id]);
            console.log(`[Game ${gameId}] Attacker ${creatureCopies[c.id].name} was destroyed.`);
            return false;
        }
        return true;
    });
    attackerPlayer.graveyard.push(...attackerGraveyard);

    const defenderGraveyard = [];
    defenderPlayer.played = defenderPlayer.played.filter(c => {
        if (c.defense <= 0) {
            defenderGraveyard.push(creatureCopies[c.id]);
            console.log(`[Game ${gameId}] Defender ${creatureCopies[c.id].name} was destroyed.`);
            return false;
        }
        return true;
    });
    defenderPlayer.graveyard.push(...defenderGraveyard);

    // 3. Check for Game Over
    if (defenderPlayer.life <= 0) {
        console.log(`[Game ${gameId}] Player ${defenderPlayerId} defeated.`);
        io.to(attackerPlayerId).emit('game_over', { result: 'You Win!' });
        if (defenderPlayerId !== AI_PLAYER_ID) {
            io.to(defenderPlayerId).emit('game_over', { result: 'You Lose!' });
        }
        game.gameActive = false;
    }

    // 4. Clear combat state
    game.attackingCreatures = [];
    game.blockingAssignments = {};
}

// --- AI Logic ---
async function aiTurnLogic(gameId) {
    const game = games[gameId];
    if (!game || !game.players[AI_PLAYER_ID].isTurn) return;
    console.log(`[AI] [Game ${gameId}] Starting AI turn.`);

    const ai = game.players[AI_PLAYER_ID];
    const delay = ms => new Promise(res => setTimeout(res, ms));

    await delay(1000);

    // 1. Play Mana
    if (!ai.manaPlayedThisTurn && ai.hand.length > 0) {
        const cardToPlayAsMana = ai.hand[0];
        ai.hand.shift();
        ai.manaZone.push(cardToPlayAsMana);
        ai.currentMana++;
        ai.manaPlayedThisTurn = true;
        console.log(`[AI] [Game ${gameId}] Played a card as mana.`);
        emitFullGameState(gameId);
        await delay(1000);
    }

    // 2. Play Creatures
    let playedCreature;
    do {
        playedCreature = false;
        const playableCreatures = ai.hand.filter(c => c.type === 'Creature' && c.manaCost <= ai.currentMana);
        if (playableCreatures.length > 0) {
            const creatureToPlay = playableCreatures[0];
            ai.hand = ai.hand.filter(c => c.id !== creatureToPlay.id);
            ai.currentMana -= creatureToPlay.manaCost;
            creatureToPlay.canAttack = false;
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
        game.currentPhase = GAME_PHASES.DECLARE_BLOCKERS;
    } else {
        console.log(`[AI] [Game ${gameId}] No creatures to attack with.`);
        game.currentPhase = GAME_PHASES.MAIN_PHASE_2;
    }
    emitFullGameState(gameId);

    // If no attackers, AI proceeds to end turn. Otherwise, wait for human to block.
    if (game.attackingCreatures.length === 0) {
        await delay(1000);
        game.currentPhase = GAME_PHASES.END_PHASE;
        emitFullGameState(gameId);
        await delay(500);
        endCurrentTurnAndStartNext(gameId);
    }
}

// --- Turn Management ---
function endCurrentTurnAndStartNext(gameId) {
  const game = games[gameId];
  if (!game || !game.gameActive) return;

  const currentPlayerId = game.playerOrder[game.currentPlayerIndex];
  const currentPlayer = game.players[currentPlayerId];
  if (currentPlayer) {
    currentPlayer.isTurn = false;
    // Reset creature defense at end of turn
    currentPlayer.played.forEach(c => { c.defense = allCards.find(card => card.id === c.id.split('_')[0]).defense; });
  }

  game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.playerOrder.length;
  const nextPlayerId = game.playerOrder[game.currentPlayerIndex];
  const nextPlayer = game.players[nextPlayerId];

  if (nextPlayer) {
    nextPlayer.isTurn = true;
    nextPlayer.maxMana++;
    nextPlayer.currentMana = nextPlayer.maxMana;
    nextPlayer.manaPlayedThisTurn = false;
    
    nextPlayer.played.forEach(card => {
        card.isTapped = false;
        card.canAttack = true;
        // Reset defense at start of turn
        card.defense = allCards.find(c => c.id === card.id.split('_')[0]).defense;
    });

    if (nextPlayer.deck.length > 0) {
      nextPlayer.hand.push(nextPlayer.deck.shift());
    } 
    
    game.currentPhase = GAME_PHASES.MAIN_PHASE_1;
    game.attackingCreatures = [];
    game.blockingAssignments = {};

    console.log(`[Game ${gameId}] Turn ended for ${currentPlayerId}. Next turn for ${nextPlayerId}`);
    emitFullGameState(gameId);

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
    if (waitingPlayer && waitingPlayer.id !== socket.id) {
        const player2 = socket;
        const player1 = waitingPlayer;
        waitingPlayer = null;
        startGame(player1.id, player2.id);
    } else {
      waitingPlayer = socket;
      socket.emit('message', 'Waiting for another player...');
    }
  });

  socket.on('start_solo_game', () => {
    if (waitingPlayer && waitingPlayer.id === socket.id) {
        waitingPlayer = null;
    }
    startGame(socket.id, AI_PLAYER_ID);
  });

  socket.on('play_card', (cardId, playType) => {
    const gameId = socket.gameId;
    const game = games[gameId];
    if (!game || !game.gameActive) return;
    const player = game.players[socket.id];
    if (!player || !player.isTurn) return;

    const cardIndex = player.hand.findIndex(c => c.id === cardId);
    if (cardIndex === -1) return;
    const [card] = player.hand.splice(cardIndex, 1);

    if (playType === 'mana') {
        if (player.manaPlayedThisTurn) {
            player.hand.push(card);
        } else {
            player.manaZone.push(card);
            player.currentMana++;
            player.manaPlayedThisTurn = true;
        }
    } else if (playType === 'field') {
        if (player.currentMana >= card.manaCost) {
            player.currentMana -= card.manaCost;
            card.canAttack = false;
            player.played.push(card);
        } else {
            player.hand.push(card);
        }
    }
    emitFullGameState(gameId);
  });

  socket.on('next_phase', () => {
    const gameId = socket.gameId;
    const game = games[gameId];
    if (!game || !game.gameActive) return;
    const player = game.players[socket.id];
    
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
            resolveCombat(gameId);
            game.currentPhase = GAME_PHASES.MAIN_PHASE_2;
            break;
        case GAME_PHASES.MAIN_PHASE_2:
            game.currentPhase = GAME_PHASES.END_PHASE;
            break;
        case GAME_PHASES.END_PHASE:
            endCurrentTurnAndStartNext(gameId);
            return;
    }
    emitFullGameState(gameId);
  });

  socket.on('declare_attackers', (attackerIds) => {
    const gameId = socket.gameId;
    const game = games[gameId];
    if (!game || !game.gameActive) return;
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

  socket.on('declare_blockers', (assignments) => {
    const gameId = socket.gameId;
    const game = games[gameId];
    if (!game || !game.gameActive) return;
    const player = game.players[socket.id];
    if (player.isTurn || game.currentPhase !== GAME_PHASES.DECLARE_BLOCKERS) return;

    game.blockingAssignments = assignments;
    console.log(`[Game ${gameId}] Player ${socket.id} declared blockers:`, assignments);
    emitFullGameState(gameId);
  });
  
  socket.on('disconnect', () => {
    console.log(`[Server] Client disconnected: ${socket.id}`);
    if (waitingPlayer && waitingPlayer.id === socket.id) {
      waitingPlayer = null;
      console.log(`[Server] Player ${socket.id} removed from waiting queue.`);
    }
    const gameId = socket.gameId;
    if (gameId && games[gameId]) {
        const game = games[gameId];
        const opponentId = game.playerOrder.find(id => id !== socket.id);
        if (opponentId) {
            if (opponentId !== AI_PLAYER_ID && io.sockets.sockets.get(opponentId)) {
                 io.to(opponentId).emit('message', 'Opponent disconnected. You win!');
            }
        }
        delete games[gameId];
        console.log(`[Game ${gameId}] Game ended due to disconnect.`);
    }
  });
});

server.listen(PORT, () => {
  console.log(`[Server] Server is running on port ${PORT}`);
});