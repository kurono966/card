import { allCards } from './cardData';

const shuffleArray = (array) => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

const GAME_PHASES = {
  MAIN_PHASE_1: 'main_phase_1',
  DECLARE_ATTACKERS: 'declare_attackers',
  DECLARE_BLOCKERS: 'declare_blockers',
  COMBAT_DAMAGE: 'combat_damage',
  MAIN_PHASE_2: 'main_phase_2',
  END_PHASE: 'end_phase',
};

class Game {
  constructor() {
    this.state = {
      player: null,
      opponent: null,
      isPlayerTurn: true,
      currentPhase: GAME_PHASES.MAIN_PHASE_1,
      attackingCreatures: [],
      blockingAssignments: {},
      gameActive: false,
    };
    this.initializeGame();
  }

  initializeGame() {
    this.state.player = this.initializePlayerState('player');
    this.state.opponent = this.initializePlayerState('opponent');

    for (let i = 0; i < 5; i++) {
      this.drawCard('player');
      this.drawCard('opponent');
    }

    this.state.isPlayerTurn = true;
    this.state.gameActive = true;
    this.updateGameState();
  }

  initializePlayerState(playerType) {
    let deck = [];
    const deckSize = 40;

    for (let i = 0; i < deckSize; i++) {
      const randomIndex = Math.floor(Math.random() * allCards.length);
      const card = { ...allCards[randomIndex], id: `${allCards[randomIndex].id}_${playerType}_${i}`, isTapped: false };
      deck.push(card);
    }

    deck = shuffleArray(deck);

    return {
      deck: deck,
      hand: [],
      played: [],
      manaZone: [],
      graveyard: [],
      maxMana: 1,
      currentMana: 1,
      isTurn: false,
      manaPlayedThisTurn: false,
      drawnThisTurn: false,
      life: 20,
    };
  }

  drawCard(playerType) {
    const player = this.state[playerType];
    if (player.deck.length > 0) {
      const card = player.deck.shift();
      player.hand.push(card);
    }
  }

  playCard(playerType, cardId, playType) {
    const player = this.state[playerType];
    const cardIndex = player.hand.findIndex(c => c.id === cardId);
    if (cardIndex === -1) return;

    const [card] = player.hand.splice(cardIndex, 1);

    if (playType === 'mana') {
      if (player.manaPlayedThisTurn) {
        player.hand.push(card);
        return;
      }
      player.manaZone.push(card);
      player.maxMana++;
      player.currentMana++;
      player.manaPlayedThisTurn = true;
    } else if (playType === 'field') {
      if (player.currentMana >= card.manaCost) {
        player.currentMana -= card.manaCost;
        card.canAttack = false; // Summoning sickness
        player.played.push(card);
      } else {
        player.hand.push(card);
      }
    }
    this.updateGameState();
  }

  nextPhase() {
    if (!this.state.gameActive) return;

    switch (this.state.currentPhase) {
      case GAME_PHASES.MAIN_PHASE_1:
        this.state.currentPhase = GAME_PHASES.DECLARE_ATTACKERS;
        break;
      case GAME_PHASES.DECLARE_ATTACKERS:
        if (this.state.attackingCreatures.length === 0) {
          this.state.currentPhase = GAME_PHASES.MAIN_PHASE_2;
        } else {
          this.state.currentPhase = GAME_PHASES.DECLARE_BLOCKERS;
        }
        break;
      case GAME_PHASES.DECLARE_BLOCKERS:
        this.resolveCombatDamage();
        this.state.currentPhase = GAME_PHASES.MAIN_PHASE_2;
        break;
      case GAME_PHASES.MAIN_PHASE_2:
        this.state.currentPhase = GAME_PHASES.END_PHASE;
        break;
      case GAME_PHASES.END_PHASE:
        this.endCurrentTurnAndStartNext();
        break;
      default:
        break;
    }
    this.updateGameState();
  }

  declareAttackers(attackers) {
    if (!this.state.isPlayerTurn || this.state.currentPhase !== GAME_PHASES.DECLARE_ATTACKERS) return;

    this.state.attackingCreatures = [];
    attackers.forEach(attackerId => {
      const attackerCard = this.state.player.played.find(c => c.id === attackerId);
      if (attackerCard && !attackerCard.isTapped && attackerCard.canAttack) {
        attackerCard.isTapped = true;
        this.state.attackingCreatures.push({ attackerId: attackerId, targetId: 'player' });
      }
    });
    this.updateGameState();
  }

  declareBlockers(assignments) {
    if (this.state.isPlayerTurn || this.state.currentPhase !== GAME_PHASES.DECLARE_BLOCKERS) return;
    this.state.blockingAssignments = assignments;
    this.updateGameState();
  }

  resolveCombatDamage() {
    const attackerPlayer = this.state.isPlayerTurn ? this.state.player : this.state.opponent;
    const opponentPlayer = this.state.isPlayerTurn ? this.state.opponent : this.state.player;

    let creatureStates = {};
    [...attackerPlayer.played, ...opponentPlayer.played].forEach(c => {
      creatureStates[c.id] = { defense: c.defense };
    });

    this.calculateDamageStep(true, attackerPlayer, opponentPlayer, creatureStates);
    this.cleanupDestroyedCreatures(attackerPlayer, opponentPlayer, creatureStates);

    this.calculateDamageStep(false, attackerPlayer, opponentPlayer, creatureStates);
    this.cleanupDestroyedCreatures(attackerPlayer, opponentPlayer, creatureStates);

    this.state.attackingCreatures.forEach(attackInfo => {
      const attackerCard = attackerPlayer.played.find(c => c.id === attackInfo.attackerId);
      if (attackerCard && (!this.state.blockingAssignments[attackInfo.attackerId] || this.state.blockingAssignments[attackInfo.attackerId].length === 0)) {
        opponentPlayer.life -= attackerCard.attack;
        if (opponentPlayer.life <= 0) {
          this.state.gameActive = false;
        }
      }
    });

    this.state.attackingCreatures = [];
    this.state.blockingAssignments = {};
  }

  calculateDamageStep(isFirstStrikePhase, attackerPlayer, opponentPlayer, creatureStates) {
    this.state.attackingCreatures.forEach(attackInfo => {
      const attackerCard = attackerPlayer.played.find(c => c.id === attackInfo.attackerId);
      if (!attackerCard || (isFirstStrikePhase && !attackerCard.abilities.includes('firstStrike'))) {
        return;
      }

      const blockers = this.state.blockingAssignments[attackInfo.attackerId] || [];
      if (blockers.length > 0) {
        let remainingDamage = attackerCard.attack;

        blockers.forEach(blockerId => {
          const blockerCard = opponentPlayer.played.find(c => c.id === blockerId);
          if (blockerCard && remainingDamage > 0) {
            const damageToBlocker = Math.min(remainingDamage, creatureStates[blockerId].defense);
            creatureStates[blockerId].defense -= damageToBlocker;
            remainingDamage -= damageToBlocker;
          }
        });

        blockers.forEach(blockerId => {
          const blockerCard = opponentPlayer.played.find(c => c.id === blockerId);
          if (blockerCard && (!isFirstStrikePhase || blockerCard.abilities.includes('firstStrike'))) {
            creatureStates[attackerCard.id].defense -= blockerCard.attack;
          }
        });
      }
    });
  }

  cleanupDestroyedCreatures(attackerPlayer, opponentPlayer, creatureStates) {
    const destroyedAttackerCreatures = attackerPlayer.played.filter(c => creatureStates[c.id] && creatureStates[c.id].defense <= 0);
    destroyedAttackerCreatures.forEach(card => attackerPlayer.graveyard.push(card));
    attackerPlayer.played = attackerPlayer.played.filter(c => creatureStates[c.id] && creatureStates[c.id].defense > 0);

    const destroyedOpponentCreatures = opponentPlayer.played.filter(c => creatureStates[c.id] && creatureStates[c.id].defense <= 0);
    destroyedOpponentCreatures.forEach(card => opponentPlayer.graveyard.push(card));
    opponentPlayer.played = opponentPlayer.played.filter(c => creatureStates[c.id] && creatureStates[c.id].defense > 0);
  }

  endCurrentTurnAndStartNext() {
    const currentPlayer = this.state.isPlayerTurn ? this.state.player : this.state.opponent;
    currentPlayer.isTurn = false;

    this.state.isPlayerTurn = !this.state.isPlayerTurn;
    const nextPlayer = this.state.isPlayerTurn ? this.state.player : this.state.opponent;

    nextPlayer.isTurn = true;
    nextPlayer.currentMana = nextPlayer.maxMana;
    nextPlayer.manaPlayedThisTurn = false;
    nextPlayer.drawnThisTurn = false;

    nextPlayer.played.forEach(card => {
      card.isTapped = false;
      card.canAttack = true;
    });

    this.drawCard(this.state.isPlayerTurn ? 'player' : 'opponent');

    this.state.currentPhase = GAME_PHASES.MAIN_PHASE_1;

    if (!this.state.isPlayerTurn) {
      this.runOpponentAI();
    }
    this.updateGameState();
  }

  runOpponentAI() {
    const opponent = this.state.opponent;

    // Play a card to mana
    if (opponent.hand.length > 0 && !opponent.manaPlayedThisTurn) {
      const cardToPlayAsMana = opponent.hand[0];
      this.playCard('opponent', cardToPlayAsMana.id, 'mana');
    }

    // Play a creature
    const playableCreatures = opponent.hand.filter(c => c.manaCost <= opponent.currentMana);
    if (playableCreatures.length > 0) {
      const creatureToPlay = playableCreatures[0];
      this.playCard('opponent', creatureToPlay.id, 'field');
    }

    // Attack with all available creatures
    const attackers = opponent.played.filter(c => !c.isTapped && c.canAttack).map(c => c.id);
    this.declareAttackers(attackers);

    this.nextPhase(); // Move to block phase
    this.nextPhase(); // Move to combat
    this.nextPhase(); // Move to main phase 2
    this.nextPhase(); // End turn
  }

  getGameStateForApp() {
    const { player, opponent, isPlayerTurn, currentPhase, attackingCreatures, blockingAssignments } = this.state;
    return {
      yourHand: player.hand,
      yourDeckSize: player.deck.length,
      yourPlayedCards: player.played,
      yourManaZone: player.manaZone,
      yourMaxMana: player.maxMana,
      yourCurrentMana: player.currentMana,
      yourLife: player.life,
      yourGraveyard: player.graveyard,

      opponentPlayedCards: opponent.played,
      opponentManaZone: opponent.manaZone,
      opponentDeckSize: opponent.deck.length,
      opponentMaxMana: opponent.maxMana,
      opponentCurrentMana: opponent.currentMana,
      opponentLife: opponent.life,
      opponentGraveyard: opponent.graveyard,

      isYourTurn: isPlayerTurn,
      currentPhase,
      attackingCreatures,
      blockingAssignments,
    };
  }

  updateGameState() {
    if (this.onStateChange) {
      this.onStateChange(this.getGameStateForApp());
    }
  }

  setOnStateChange(callback) {
    this.onStateChange = callback;
  }
}

export default Game;