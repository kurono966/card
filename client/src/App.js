import React, { useEffect, useReducer } from 'react';
import io from 'socket.io-client';
import { DndProvider, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

import Card from './components/Card';
import Deck from './components/Deck';
import CardDetail from './components/CardDetail';
import Graveyard from './components/Graveyard';
import Menu from './components/Menu';
import { allCards, getRandomCard } from './utils/cardData'; // Assuming this exists and works

import styles from './App.module.css';

// --- Game Logic and Reducer ---

const initialState = {
  gameStarted: false,
  gameMode: null, // 'online' | 'solo'
  message: 'Neocardにようこそ！',
  isYourTurn: false,
  currentPhase: 'main_phase_1',
  
  player: {
    hand: [],
    deckSize: 0,
    graveyard: [],
    playedCards: [],
    manaZone: [],
    maxMana: 0,
    currentMana: 0,
    life: 20,
  },
  opponent: {
    hand: [],
    deckSize: 0,
    graveyard: [],
    playedCards: [],
    manaZone: [],
    maxMana: 0,
    currentMana: 0,
    life: 20,
  },

  selectedCardDetail: null,
  selectedAttackers: new Map(),
  // ... other UI states can be added here
};

function gameReducer(state, action) {
  switch (action.type) {
    case 'SET_GAME_STATE':
      return { ...state, ...action.payload };

    case 'START_SOLO_GAME': {
      const pHand = Array(5).fill().map(getRandomCard).map((c, i) => ({ ...c, id: `p-${i}`}));
      const oHand = Array(5).fill().map(getRandomCard).map((c, i) => ({ ...c, id: `o-${i}`}));
      return {
        ...initialState,
        gameStarted: true,
        gameMode: 'solo',
        isYourTurn: true,
        message: 'ソロモード開始！ あなたのターンです。',
        player: {
          ...initialState.player,
          hand: pHand,
          deckSize: 20,
          maxMana: 1,
          currentMana: 1,
        },
        opponent: {
          ...initialState.opponent,
          hand: oHand,
          deckSize: 20,
          maxMana: 1,
          currentMana: 1,
        },
      };
    }

    case 'PLAY_CARD': {
      if (!state.isYourTurn) return state; // Not your turn

      const playerState = state.player;
      const cardToPlay = playerState.hand.find(c => c.id === action.payload.cardId);
      if (!cardToPlay) return state; // Card not in hand

      if (action.payload.target === 'mana') {
        return {
          ...state,
          player: {
            ...playerState,
            hand: playerState.hand.filter(c => c.id !== action.payload.cardId),
            manaZone: [...playerState.manaZone, cardToPlay],
            maxMana: playerState.maxMana + 1,
          }
        }
      } else if (action.payload.target === 'field') {
        if (playerState.currentMana < cardToPlay.manaCost) {
          return { ...state, message: 'マナが足りません' };
        }
        // TODO: Handle card effects
        return {
          ...state,
          message: `${cardToPlay.name}をプレイしました。`,
          player: {
            ...playerState,
            hand: playerState.hand.filter(c => c.id !== action.payload.cardId),
            playedCards: [...playerState.playedCards, { ...cardToPlay, isTapped: false, canAttack: false }],
            currentMana: playerState.currentMana - cardToPlay.manaCost,
          }
        }
      }
      return state;
    }

    // TODO: Add other actions like NEXT_PHASE, DECLARE_ATTACK, END_TURN

    default:
      return state;
  }
}

// --- Socket and App Component ---

const serverUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3001'
  : 'https://neocard-server.onrender.com';

const socket = io(serverUrl, { autoConnect: false });

const App = () => {
  const [state, dispatch] = useReducer(gameReducer, initialState);

  // Unified dispatcher
  const handleDispatch = (action) => {
    if (state.gameMode === 'online') {
      socket.emit('game_action', action);
    }
    else {
      dispatch(action);
    }
  };

  // Effect for managing socket connection and listeners
  useEffect(() => {
    if (state.gameMode === 'online') {
      socket.connect();
      socket.on('game_state', (serverState) => {
        dispatch({ type: 'SET_GAME_STATE', payload: serverState });
      });
    }
    else {
      socket.disconnect();
    }
    return () => {
      socket.off('game_state');
      socket.disconnect();
    }
  }, [state.gameMode]);

  // --- Event Handlers ---
  const handleStartSoloGame = () => dispatch({ type: 'START_SOLO_GAME' });
  const handleStartOnlineGame = () => dispatch({ type: 'SET_GAME_STATE', payload: { gameMode: 'online', message: 'サーバーに接続中...' } });

  // --- Drop Handlers ---
  const [, dropMana] = useDrop(() => ({
    accept: 'card',
    drop: (item) => handleDispatch({ type: 'PLAY_CARD', payload: { cardId: item.id, target: 'mana' } }),
  }), [state.gameMode]); // Dependency array is crucial

  const [, dropField] = useDrop(() => ({
    accept: 'card',
    drop: (item) => handleDispatch({ type: 'PLAY_CARD', payload: { cardId: item.id, target: 'field' } }),
  }), [state.gameMode]);

  // --- Render Logic ---
  if (!state.gameStarted) {
    return <Menu onStartOnlineGame={handleStartOnlineGame} onStartSoloGame={handleStartSoloGame} />;
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <div className={styles.appContainer}>
        <h1 className={styles.messageHeader}>{state.message}</h1>
        <h2 className={styles.turnHeader}>{state.isYourTurn ? 'Your Turn' : 'Opponent\'s Turn'}</h2>
        <h3 className={styles.phaseHeader}>{state.currentPhase.replace(/_/g, ' ').toUpperCase()}</h3>

        <div className={styles.gameArea}>
          {/* Opponent's Area */}
          <div className={styles.opponentArea}>
            <h3>Opponent</h3>
            <p>Life: {state.opponent.life} | Mana: {state.opponent.currentMana}/{state.opponent.maxMana}</p>
            <div className={styles.playedCardsArea}>
              {state.opponent.playedCards.map(card => <Card key={card.id} {...card} isPlayed={true} />)}
            </div>
          </div>

          {/* Player's Area */}
          <div className={styles.yourArea}>
            <h3>You</h3>
            <p>Life: {state.player.life} | Mana: {state.player.currentMana}/{state.player.maxMana}</p>
            <div ref={dropField} className={styles.playedCardsArea}>
              {state.player.playedCards.map(card => <Card key={card.id} {...card} isPlayed={true} />)}
            </div>
          </div>
        </div>

        <div className={styles.bottomArea}>
            <div ref={dropMana} className={styles.manaZoneContainer}>
                <h4>Mana Zone</h4>
                <div className={styles.manaZone}>
                    {state.player.manaZone.map(card => <Card key={card.id} {...card} isPlayed={true} />)}
                </div>
            </div>
            <div className={styles.handContainer}>
                <h3>Your Hand</h3>
                <div className={styles.hand}>
                    {state.player.hand.map(card => <Card key={card.id} {...card} />)}
                </div>
            </div>
            <div className={styles.controls}>
                <Deck deckSize={state.player.deckSize} />
                <Graveyard cards={state.player.graveyard} />
                <button className={styles.endTurnButton}>End Turn</button>
            </div>
        </div>

        {state.selectedCardDetail && <CardDetail card={state.selectedCardDetail} />}
      </div>
    </DndProvider>
  );
};

export default App;
