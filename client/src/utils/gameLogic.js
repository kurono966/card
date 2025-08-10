
import { allCards } from './cardData';

// Helper function to shuffle an array
const shuffle = (array) => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

class Game {
  constructor() {
    this.state = {
      player: {
        deck: [],
        hand: [],
        playedCards: [],
        manaZone: [],
        graveyard: [],
        life: 20,
        maxMana: 0,
        currentMana: 0,
      },
      opponent: {
        deck: [],
        hand: [],
        playedCards: [],
        manaZone: [],
        graveyard: [],
        life: 20,
        maxMana: 0,
        currentMana: 0,
      },
      isPlayerTurn: true,
      currentPhase: 'main_phase_1', // main_phase_1, declare_attackers, declare_blockers, main_phase_2, end_phase
      attackingCreatures: [],
      blockingAssignments: {},
    };
    this.initializeDecks();
  }

  initializeDecks() {
    const createDeck = () => {
      const deck = [];
      for (let i = 0; i < 40; i++) {
        const cardTemplate = allCards[Math.floor(Math.random() * allCards.length)];
        deck.push({ ...cardTemplate, id: `card_${i}_${Date.now()}_${Math.random()}` });
      }
      return shuffle(deck);
    };

    this.state.player.deck = createDeck();
    this.state.opponent.deck = createDeck();

    // Draw initial hands
    for (let i = 0; i < 5; i++) {
      this.drawCard('player');
      this.drawCard('opponent');
    }
  }

  drawCard(playerType) {
    const player = this.state[playerType];
    if (player.deck.length > 0) {
      const card = player.deck.pop();
      player.hand.push(card);
    }
  }

  playCard(playerType, cardId, zone) {
    const player = this.state[playerType];
    const cardIndex = player.hand.findIndex(c => c.id === cardId);
    if (cardIndex === -1) return;

    const card = player.hand[cardIndex];

    if (zone === 'mana') {
      player.hand.splice(cardIndex, 1);
      player.manaZone.push(card);
      player.maxMana++;
      player.currentMana++;
    } else if (zone === 'field') {
      if (player.currentMana >= card.manaCost) {
        player.hand.splice(cardIndex, 1);
        player.playedCards.push(card);
        player.currentMana -= card.manaCost;
      }
    }
    this.updateGameState();
  }

  nextPhase() {
    // Simplified phase progression for now
    if (this.state.isPlayerTurn) {
        if (this.state.currentPhase === 'main_phase_1') {
            this.state.currentPhase = 'declare_attackers';
        } else if (this.state.currentPhase === 'declare_attackers') {
            this.state.currentPhase = 'end_phase';
        } else if (this.state.currentPhase === 'end_phase') {
            this.endTurn();
        }
    }
    this.updateGameState();
  }

  endTurn() {
    this.state.isPlayerTurn = !this.state.isPlayerTurn;
    this.state.currentPhase = 'main_phase_1';
    const currentPlayer = this.state.isPlayerTurn ? 'player' : 'opponent';
    this.drawCard(currentPlayer);
    this.state[currentPlayer].maxMana++;
    this.state[currentPlayer].currentMana = this.state[currentPlayer].maxMana;
    
    if (!this.state.isPlayerTurn) {
      this.runOpponentAI();
    }
    this.updateGameState();
  }

  runOpponentAI() {
    // Simple AI: play a card to mana, then play a creature if possible
    const opponent = this.state.opponent;

    // Play a card to mana
    if (opponent.hand.length > 0) {
      const cardToPlayAsMana = opponent.hand[0];
      this.playCard('opponent', cardToPlayAsMana.id, 'mana');
    }

    // Play a creature
    const playableCreatures = opponent.hand.filter(c => c.manaCost <= opponent.currentMana);
    if (playableCreatures.length > 0) {
      const creatureToPlay = playableCreatures[0];
      this.playCard('opponent', creatureToPlay.id, 'field');
    }

    // Simple attack logic: attack with all available creatures
    this.state.attackingCreatures = this.state.opponent.playedCards.map(c => ({ attackerId: c.id, targetId: 'player' }));


    // End turn after a delay
    setTimeout(() => this.endTurn(), 1000);
  }


  // This method will be called to get the current state for the UI
  getGameStateForApp() {
    const { player, opponent, isPlayerTurn, currentPhase, attackingCreatures, blockingAssignments } = this.state;
    return {
      yourHand: player.hand,
      yourDeckSize: player.deck.length,
      yourPlayedCards: player.playedCards,
      yourManaZone: player.manaZone,
      yourMaxMana: player.maxMana,
      yourCurrentMana: player.currentMana,
      yourLife: player.life,
      yourGraveyard: player.graveyard,

      opponentPlayedCards: opponent.playedCards,
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

  // This will be a placeholder for now
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
