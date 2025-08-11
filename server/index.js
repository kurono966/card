const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const allCards = require('./cardData');

console.log('Starting server...');

const app = express();
const cors = require('cors');

// --- CORS Configuration ---
const allowedOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://neocard-client.vercel.app",
  "https://neocard-client-dnt9w7wat-kuronos-projects.vercel.app", // Added current client URL
];

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // Check if the origin is in the allowed list or matches the Vercel preview URL pattern
    if (allowedOrigins.includes(origin) || /https:\/\/neocard-client-.*\.vercel\.app/.test(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
  },
  methods: ["GET", "POST", "OPTIONS"],
  credentials: true,
};

// Use the same CORS options for both Express and Socket.IO
app.use(cors(corsOptions));

const server = http.createServer(app);

const io = socketIo(server, {
  cors: corsOptions, // Reuse the same options
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
  player1State.maxMana = 0; // Changed: Start with 0 mana
  player1State.currentMana = 0; // Changed: Start with 0 mana

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
  if (!game || !game.gameActive) {
    return;
  }

  game.playerOrder.forEach(pId => {
    if (pId === AI_PLAYER_ID) return;

    const socket = io.sockets.sockets.get(pId);
    if (!socket) return; // Skip if socket not connected

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

    const creatureCopies = {};
    [...attackerPlayer.played, ...defenderPlayer.played].forEach(c => {
        creatureCopies[c.id] = { ...c };
    });

    game.attackingCreatures.forEach(attackInfo => {
        const attackerCard = attackerPlayer.played.find(c => c.id === attackInfo.attackerId);
        if (!attackerCard) return;

        const blockers = game.blockingAssignments[attackInfo.attackerId] || [];

        if (blockers.length > 0) {
            let totalBlockerAttack = 0;
            blockers.forEach(blockerId => {
                const blockerCard = defenderPlayer.played.find(c => c.id === blockerId);
                if (blockerCard) {
                    totalBlockerAttack += creatureCopies[blockerId].attack;
                }
            });
            attackerCard.defense -= totalBlockerAttack;
            // Emit damage effect for attacker
            io.to(attackerPlayerId).emit('damage_effect', { targetId: attackerCard.id, amount: totalBlockerAttack, type: 'creature_damage' });

            const firstBlocker = defenderPlayer.played.find(c => c.id === blockers[0]);
            if (firstBlocker) {
                firstBlocker.defense -= creatureCopies[attackerCard.id].attack;
                // Emit damage effect for blocker
                io.to(defenderPlayerId).emit('damage_effect', { targetId: firstBlocker.id, amount: creatureCopies[attackerCard.id].attack, type: 'creature_damage' });
            }
        } else {
            defenderPlayer.life -= creatureCopies[attackerCard.id].attack;
            console.log(`[Game ${gameId}] Player ${defenderPlayerId} life: ${defenderPlayer.life}`);
            // Emit damage effect for player
            io.to(defenderPlayerId).emit('damage_effect', { targetId: defenderPlayerId, amount: creatureCopies[attackerCard.id].attack, type: 'player_damage' });
        }
    });

    const attackerGraveyard = [];
    attackerPlayer.played = attackerPlayer.played.filter(c => {
        if (c.defense <= 0) {
            attackerGraveyard.push(creatureCopies[c.id]);
            // Emit creature destroyed effect
            io.to(attackerPlayerId).emit('damage_effect', { targetId: c.id, amount: 0, type: 'creature_destroyed' });
            return false;
        }
        return true;
    });
    attackerPlayer.graveyard.push(...attackerGraveyard);

    const defenderGraveyard = [];
    defenderPlayer.played = defenderPlayer.played.filter(c => {
        if (c.defense <= 0) {
            defenderGraveyard.push(creatureCopies[c.id]);
            // Emit creature destroyed effect
            io.to(defenderPlayerId).emit('damage_effect', { targetId: c.id, amount: 0, type: 'creature_destroyed' });
            return false;
        }
        return true;
    });
    defenderPlayer.graveyard.push(...defenderGraveyard);

    if (defenderPlayer.life <= 0) {
        io.to(attackerPlayerId).emit('game_over', { result: 'You Win!' });
        if (defenderPlayerId !== AI_PLAYER_ID) {
            io.to(defenderPlayerId).emit('game_over', { result: 'You Lose!' });
        }
        game.gameActive = false;
    }

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

    // Play a card as mana if not already done
    if (!ai.manaPlayedThisTurn && ai.hand.length > 0) {
        const cardToPlayAsMana = ai.hand[0];
        ai.hand.shift();
        ai.manaZone.push(cardToPlayAsMana);
        ai.maxMana++;
        ai.currentMana++;
        ai.manaPlayedThisTurn = true;
        emitFullGameState(gameId);
        await delay(1000);
    }

    // Play any playable cards (creatures, spells, etc.)
    let playedCard;
    do {
        playedCard = false;
        // Find any card with a mana cost that AI can afford
        const playableCards = ai.hand.filter(c => c.manaCost !== undefined && c.manaCost <= ai.currentMana);
        
        if (playableCards.length > 0) {
            const cardToPlay = playableCards[0];
            
            console.log(`[AI] [Game ${gameId}] AI is playing card: ${cardToPlay.name}`);

            ai.hand = ai.hand.filter(c => c.id !== cardToPlay.id);
            ai.currentMana -= cardToPlay.manaCost;

            cardToPlay.canAttack = false; 
            ai.played.push(cardToPlay);
            
            if (cardToPlay.effect) {
                if (cardToPlay.effect === "Draw 1 card") {
                    if (ai.deck.length > 0) {
                        ai.hand.push(ai.deck.shift());
                        console.log(`[AI] [Game ${gameId}] AI drew a card from ${cardToPlay.name}'s effect.`);
                    }
                }
            }

            playedCard = true;
            emitFullGameState(gameId);
            await delay(1000);
        }
    } while (playedCard);

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
        console.log(`[AI] [Game ${gameId}] AI declares attack with ${attackers.length} creatures.`);
        game.currentPhase = GAME_PHASES.DECLARE_BLOCKERS;
    } else {
        game.currentPhase = GAME_PHASES.MAIN_PHASE_2;
    }
    emitFullGameState(gameId);

    if (game.attackingCreatures.length === 0) {
        await delay(1000);
        game.currentPhase = GAME_PHASES.END_PHASE;
        emitFullGameState(gameId);
        await delay(500);
        endCurrentTurnAndStartNext(gameId);
    }
}

function aiBlockLogic(gameId) {
    const game = games[gameId];
    if (!game || !game.gameActive) return;

    const humanPlayerId = game.playerOrder.find(id => id !== AI_PLAYER_ID);
    const aiPlayer = game.players[AI_PLAYER_ID];

    if (game.players[humanPlayerId].isTurn === false || game.attackingCreatures.length === 0) {
        return;
    }
    
    console.log(`[AI] [Game ${gameId}] AI is deciding blockers.`);

    const availableBlockers = aiPlayer.played.filter(c => !c.isTapped);
    game.blockingAssignments = {};

    for (const attackInfo of game.attackingCreatures) {
        if (availableBlockers.length > 0) {
            const blocker = availableBlockers.shift();
            game.blockingAssignments[attackInfo.attackerId] = [blocker.id];
            console.log(`[AI] [Game ${gameId}] AI assigns ${blocker.name} to block attacker.`);
        } else {
            break;
        }
    }
    
    console.log(`[AI] [Game ${gameId}] AI finished blocking. Moving to combat resolution.`);
    emitFullGameState(gameId);

    setTimeout(() => {
        resolveCombat(gameId);
        game.currentPhase = GAME_PHASES.MAIN_PHASE_2;
        emitFullGameState(gameId);
    }, 1000);
}

// --- Turn Management ---
function endCurrentTurnAndStartNext(gameId) {
  const game = games[gameId];
  if (!game || !game.gameActive) return;

  const currentPlayerId = game.playerOrder[game.currentPlayerIndex];
  const currentPlayer = game.players[currentPlayerId];
  if (currentPlayer) {
    currentPlayer.isTurn = false;
    // Reset defense values safely
    currentPlayer.played.forEach(c => {
        const originalCardId = c.id.split('_').slice(0, 2).join('_'); // Fix: Correctly get original card ID
        const originalCard = allCards.find(card => card.id === originalCardId);
        if (originalCard) {
            c.defense = originalCard.defense;
        } else {
            console.error(`[Error] Original card not found for ID: ${originalCardId} (from ${c.id})`);
        }
    });
  }

  game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.playerOrder.length;
  const nextPlayerId = game.playerOrder[game.currentPlayerIndex];
  const nextPlayer = game.players[nextPlayerId];

  if (nextPlayer) {
    nextPlayer.isTurn = true;
    nextPlayer.currentMana = nextPlayer.maxMana; // Refill mana to the max
    nextPlayer.manaPlayedThisTurn = false;
    
    // Untap cards, allow them to attack, and reset defense safely
    nextPlayer.played.forEach(card => {
        card.isTapped = false;
        card.canAttack = true;
        const originalCardId = card.id.split('_').slice(0, 2).join('_'); // Fix: Correctly get original card ID
        const originalCard = allCards.find(c => c.id === originalCardId);
        if (originalCard) {
            card.defense = originalCard.defense;
        } else {
            console.error(`[Error] Original card not found for ID: ${originalCardId} (from ${card.id})`);
        }
    });

    if (nextPlayer.deck.length > 0) {
      nextPlayer.hand.push(nextPlayer.deck.shift());
    } 
    
    game.currentPhase = GAME_PHASES.MAIN_PHASE_1;
    game.attackingCreatures = [];
    game.blockingAssignments = {};

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

  socket.on('request_game_state', () => {
    const gameId = socket.gameId;
    if (gameId && games[gameId]) {
        emitFullGameState(gameId);
    }
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
            player.hand.push(card); // Return card if mana already played
        } else {
            player.manaZone.push(card);
            player.maxMana++;
            player.currentMana++;
            player.manaPlayedThisTurn = true;
        }
    } else if (playType === 'field') {
        if (player.currentMana >= card.manaCost) {
            player.currentMana -= card.manaCost;
            card.canAttack = false;
            player.played.push(card);

            // Handle card effects
            if (card.effect) {
                console.log(`[Game ${gameId}] Card effect triggered for ${player.id}: ${card.effect}`);
                if (card.effect === "Draw 1 card") {
                    if (player.deck.length > 0) {
                        const drawnCard = player.deck.shift();
                        player.hand.push(drawnCard);
                        io.to(player.id).emit('effect_triggered', `You drew a card (${drawnCard.name}) from ${card.name}'s effect!`);
                        console.log(`[Game ${gameId}] Player ${player.id} drew ${drawnCard.name} due to effect.`);
                    } else {
                        io.to(player.id).emit('effect_triggered', `You tried to draw a card from ${card.name}'s effect, but your deck is empty!`);
                        console.log(`[Game ${gameId}] Player ${player.id} tried to draw, but deck is empty for effect.`);
                    }
                } else if (card.effect === "Deal 2 damage to opponent creature") {
                    io.to(player.id).emit('request_target_for_effect', {
                        type: 'deal_damage',
                        amount: 2,
                        sourceCardId: card.id,
                        message: `Select an opponent's creature to deal 2 damage to.`
                    });
                    console.log(`[Game ${gameId}] Player ${player.id} played ${card.name}, requesting target for 2 damage.`);
                }
            }
        } else {
            player.hand.push(card); // Return card if not enough mana
        }
    }
    emitFullGameState(gameId);
  });

  socket.on('resolve_effect_target', ({ sourceCardId, targetCardId }) => {
    const gameId = socket.gameId;
    const game = games[gameId];
    if (!game || !game.gameActive) return;
    const player = game.players[socket.id];
    const opponentId = game.playerOrder.find(id => id !== player.id);
    const opponent = game.players[opponentId];

    console.log(`[Server] resolve_effect_target received. sourceCardId: ${sourceCardId}, targetCardId: ${targetCardId}`);
    console.log(`[Server] Opponent played cards:`, opponent.played.map(c => c.id)); // Debug log

    const sourceCard = player.played.find(c => c.id === sourceCardId);
    if (!sourceCard || !sourceCard.effect) {
        console.log(`[Server] Source card not found or has no effect.`); // Debug log
        return;
    }

    if (sourceCard.effect === "Deal 2 damage to opponent creature") {
        const targetCard = opponent.played.find(c => c.id === targetCardId);
        if (targetCard) {
            console.log(`[Server] Target card found: ${targetCard.name} (ID: ${targetCard.id}), current defense: ${targetCard.defense}`); // Debug log
            targetCard.defense -= 2;
            console.log(`[Server] Target card defense after damage: ${targetCard.defense}`); // Debug log
            // Emit damage effect for creature
            io.to(player.id).emit('damage_effect', { targetId: targetCard.id, amount: 2, type: 'creature_damage' });
            if (targetCard.defense <= 0) {
                opponent.played = opponent.played.filter(c => c.id !== targetCardId);
                opponent.graveyard.push(targetCard);
                console.log(`[Game ${gameId}] Card ${targetCard.name} was destroyed.`);
                // Emit creature destroyed effect
                io.to(player.id).emit('damage_effect', { targetId: targetCard.id, amount: 0, type: 'creature_destroyed' });
            }
            emitFullGameState(gameId);
        } else {
            console.log(`[Server] Target card with ID ${targetCardId} not found in opponent.played.`); // Debug log
        }
    }
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
                const defenderPlayerId = game.playerOrder.find(id => id !== player.id);
                if (defenderPlayerId === AI_PLAYER_ID) {
                    setTimeout(() => aiBlockLogic(gameId), 1000);
                }
            }
            break;
        case GAME_PHASES.DECLARE_BLOCKERS:
            resolveCombat(gameId);
            game.currentPhase = GAME_PHASES.MAIN_PHASE_2;

            const currentPlayerId = game.playerOrder[game.currentPlayerIndex];
            if (currentPlayerId === AI_PLAYER_ID) {
                console.log(`[AI] [Game ${gameId}] Combat resolved, moving to end phase.`);
                game.currentPhase = GAME_PHASES.END_PHASE;
                emitFullGameState(gameId);
                
                setTimeout(() => {
                    endCurrentTurnAndStartNext(gameId);
                }, 1000);
                return;
            }
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
    emitFullGameState(gameId);
  });
  
  socket.on('disconnect', () => {
    console.log(`[Server] Client disconnected: ${socket.id}`);
    if (waitingPlayer && waitingPlayer.id === socket.id) {
      waitingPlayer = null;
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
    }
  });
});

server.listen(PORT, () => {
  console.log(`[Server] Server is running on port ${PORT}`);
});