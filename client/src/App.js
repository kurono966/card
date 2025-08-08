import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import './App.css';
import './App.module.css';
import Card from './components/Card';
import Hand from './components/Hand';
import Deck from './components/Deck';
import CardDetail from './components/CardDetail';

const socket = io('http://localhost:3000'); // Replace with your server URL

function App() {
  const [gameState, setGameState] = useState(null);
  const [selectedCard, setSelectedCard] = useState(null);
  const [message, setMessage] = useState('');
  const [requestTargetForEffect, setRequestTargetForEffect] = useState(null); // New state for target selection

  useEffect(() => {
    socket.on('game_state', (state) => {
      setGameState(state);
      console.log('Game State:', state);
    });

    socket.on('effect_triggered', (msg) => {
      setMessage(msg);
      setTimeout(() => setMessage(''), 3000);
    });

    socket.on('game_over', (msg) => {
      setMessage(msg);
      // Optionally, reset game state or show a game over screen
    });

    // New listener for target selection request
    socket.on('request_target_for_effect', (data) => {
      setRequestTargetForEffect(data);
      setMessage(data.message); // Display message to user
    });

    return () => {
      socket.off('game_state');
      socket.off('effect_triggered');
      socket.off('game_over');
      socket.off('request_target_for_effect'); // Cleanup
    };
  }, []);

  const handleDrawCard = () => {
    socket.emit('draw_card');
    setSelectedCard(null);
  };

  const handlePlayCard = (cardId, playType) => {
    socket.emit('play_card', cardId, playType);
    setSelectedCard(null);
  };

  const handleNextPhase = () => {
    socket.emit('next_phase');
    setSelectedCard(null);
  };

  const handleDeclareAttackers = (attackers) => {
    socket.emit('declare_attackers', attackers);
  };

  const handleDeclareBlockers = (assignments) => {
    socket.emit('declare_blockers', assignments);
  };

  // New function to handle target selection
  const handleSelectTarget = (targetId) => {
    if (requestTargetForEffect) {
      socket.emit('select_target_for_effect', {
        targetId: targetId,
        sourceCardId: requestTargetForEffect.sourceCardId,
        effectType: requestTargetForEffect.type,
        amount: requestTargetForEffect.amount,
      });
      setRequestTargetForEffect(null); // Reset target selection state
      setMessage(''); // Clear message
    }
  };

  if (!gameState) {
    return <div className="App">Loading game...</div>;
  };

  const {
    yourHand,
    yourDeckSize,
    yourPlayedCards,
    yourManaZone,
    yourMaxMana,
    yourCurrentMana,
    isYourTurn,
    yourLife,
    opponentPlayedCards,
    opponentManaZone,
    opponentDeckSize,
    opponentMaxMana,
    opponentCurrentMana,
    opponentLife,
    currentPhase,
    attackingCreatures,
    blockingAssignments,
  } = gameState;

  return (
    <div className="App">
      {message && <div className="message-overlay">{message}</div>}

      {/* Target Selection Overlay */}
      {requestTargetForEffect && (
        <div className="target-selection-overlay">
          <h2>{requestTargetForEffect.message}</h2>
          <div className="opponent-field-for-targeting">
            {opponentPlayedCards.map((card) => (
              <div
                key={card.id}
                className="targetable-card"
                onClick={() => handleSelectTarget(card.id)}
              >
                <Card card={card} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="opponent-area">
        <div className="opponent-info">
          <p>Opponent Life: {opponentLife}</p>
          <p>Opponent Mana: {opponentCurrentMana}/{opponentMaxMana}</p>
          <Deck deckSize={opponentDeckSize} isOpponent={true} />
        </div>
        <div className="opponent-field">
          {opponentPlayedCards.map((card) => (
            <Card key={card.id} card={card} />
          ))}
        </div>
        <div className="opponent-mana-zone">
          {opponentManaZone.map((card) => (
            <Card key={card.id} card={card} />
          ))}
        </div>
      </div>

      <div className="game-info">
        <p>Current Phase: {currentPhase}</p>
        <p>Your Turn: {isYourTurn ? 'Yes' : 'No'}</p>
        <p>Your Life: {yourLife}</p>
        <p>Your Mana: {yourCurrentMana}/{yourMaxMana}</p>
        <button onClick={handleNextPhase} disabled={!isYourTurn}>Next Phase</button>
        {isYourTurn && currentPhase === 'main_phase_1' && (
          <button onClick={handleDrawCard}>Draw Card</button>
        )}
      </div>

      <div className="player-area">
        <div className="player-mana-zone">
          {yourManaZone.map((card) => (
            <Card key={card.id} card={card} />
          ))}
        </div>
        <div className="player-field">
          {yourPlayedCards.map((card) => (
            <Card key={card.id} card={card} />
          ))}
        </div>
        <Hand
          cards={yourHand}
          onCardClick={setSelectedCard}
          onPlayCard={handlePlayCard}
          currentMana={yourCurrentMana}
          manaPlayedThisTurn={gameState.manaPlayedThisTurn}
        />
        <Deck deckSize={yourDeckSize} />
      </div>

      {selectedCard && (
        <CardDetail
          card={selectedCard}
          onClose={() => setSelectedCard(null)}
          onPlay={(playType) => handlePlayCard(selectedCard.id, playType)}
          currentMana={yourCurrentMana}
          isYourTurn={isYourTurn}
          manaPlayedThisTurn={gameState.manaPlayedThisTurn}
        />
      )}
    </div>
  );
}

export default App;