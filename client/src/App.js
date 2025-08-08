import React, { useEffect, useState, useRef } from 'react';
import io from 'socket.io-client';
import { DndProvider, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

import Card from './components/Card';
import Deck from './components/Deck';
import CardDetail from './components/CardDetail';

import styles from './App.module.css';

const socket = io('https://neocard-server.onrender.com');

const ItemTypes = {
  CARD: 'card',
};

const App = () => {
  const [message, setMessage] = useState('Loading game...');
  const [yourHand, setYourHand] = useState([]);
  const [yourDeckSize, setYourDeckSize] = useState(0);
  const [yourPlayedCards, setYourPlayedCards] = useState([]);
  const [yourManaZone, setYourManaZone] = useState([]);
  const [yourMaxMana, setYourMaxMana] = useState(0);
  const [yourCurrentMana, setYourCurrentMana] = useState(0);
  const [yourLife, setYourLife] = useState(20);

  const [opponentPlayedCards, setOpponentPlayedCards] = useState([]);
  const [opponentManaZone, setOpponentManaZone] = useState([]);
  const [opponentDeckSize, setOpponentDeckSize] = useState(0);
  const [opponentMaxMana, setOpponentMaxMana] = useState(0);
  const [opponentCurrentMana, setOpponentCurrentMana] = useState(0);
  const [opponentLife, setOpponentLife] = useState(20);

  const [isYourTurn, setIsYourTurn] = useState(false);
  const [selectedCardDetail, setSelectedCardDetail] = useState(null);
  const [effectMessage, setEffectMessage] = useState(null);
  const [currentPhase, setCurrentPhase] = useState('main_phase_1');
  const [attackingCreatures, setAttackingCreatures] = useState([]);
  const [blockingAssignments, setBlockingAssignments] = useState({});

  // --- New states for UI interaction ---
  const [selectedAttackers, setSelectedAttackers] = useState(new Map());
  const [selectedBlocker, setSelectedBlocker] = useState(null);
  const [selectedTarget, setSelectedTarget] = useState(null);

  const isYourTurnRef = useRef(isYourTurn);
  useEffect(() => {
    isYourTurnRef.current = isYourTurn;
  }, [isYourTurn]);

  useEffect(() => {
    socket.on('connect', () => {
      setMessage('Connected to server!');
      socket.emit('request_game_state');
    });

    socket.on('disconnect', () => {
      setMessage('Disconnected from server.');
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      setMessage(`Connection error: ${error.message}. Retrying...`);
    });

    socket.on('game_state', (state) => {
      console.log('[App.js] Received game state:', state);
      setYourHand(state.yourHand || []);
      setYourDeckSize(state.yourDeckSize);
      setYourPlayedCards(state.yourPlayedCards || []);
      setYourManaZone(state.yourManaZone || []);
      setYourMaxMana(state.yourMaxMana);
      setYourCurrentMana(state.yourCurrentMana);
      setYourLife(state.yourLife);

      setOpponentPlayedCards(state.opponentPlayedCards || []);
      setOpponentManaZone(state.opponentManaZone || []);
      setOpponentDeckSize(state.opponentDeckSize);
      setOpponentMaxMana(state.opponentMaxMana);
      setOpponentCurrentMana(state.opponentCurrentMana);
      setOpponentLife(state.opponentLife);

      setIsYourTurn(state.isYourTurn);
      setCurrentPhase(state.currentPhase);
      setAttackingCreatures(state.attackingCreatures || []);
      setBlockingAssignments(state.blockingAssignments || {});

      // Reset selections on phase change
      if (state.currentPhase !== currentPhase) {
        setSelectedAttackers(new Map());
        setSelectedBlocker(null);
        setSelectedTarget(null);
      }
    });

    socket.on('effect_triggered', (message) => {
      setEffectMessage(message);
      setTimeout(() => setEffectMessage(null), 3000);
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('connect_error');
      socket.off('game_state');
      socket.off('effect_triggered');
    };
  }, [currentPhase]);

  const handleNextPhase = () => {
    if (isYourTurnRef.current) {
      if (currentPhase === 'declare_attackers') {
        const attackerIds = Array.from(selectedAttackers.keys());
        socket.emit('declare_attackers', attackerIds);
      } else if (currentPhase === 'declare_blockers') {
        socket.emit('declare_blockers', blockingAssignments);
      }
      socket.emit('next_phase');
    } else {
        // Allow non-turn player to advance only from declare_blockers
        if (currentPhase === 'declare_blockers') {
            socket.emit('declare_blockers', blockingAssignments); // ブロッカー情報を送信
            socket.emit('next_phase');
        } else {
            alert("It's not your turn!");
        }
    }
  };

  const handleCardAction = (card, actionType) => {
    if (actionType === 'hover') {
      setSelectedCardDetail(card);
    } else if (actionType === 'leave') {
      setSelectedCardDetail(null);
    } else if (actionType === 'click') {
      // --- Attack Phase Logic ---
      if (isYourTurn && currentPhase === 'declare_attackers') {
        const myCard = yourPlayedCards.find(c => c.id === card.id);
        console.log('Card clicked to attack: ', myCard);
        if (myCard && !myCard.isTapped && myCard.canAttack) {
          const newSelectedAttackers = new Map(selectedAttackers);
          if (newSelectedAttackers.has(card.id)) {
            newSelectedAttackers.delete(card.id);
          } else {
            newSelectedAttackers.set(card.id, card);
          }
          setSelectedAttackers(newSelectedAttackers);
        }
      }

      // --- Block Phase Logic ---
      if (!isYourTurn && currentPhase === 'declare_blockers') {
        const opponentAttacker = opponentPlayedCards.find(c => c.id === card.id && attackingCreatures.some(a => a.attackerId === c.id));
        const myBlocker = yourPlayedCards.find(c => c.id === card.id && !c.isTapped);

        if (opponentAttacker) {
          setSelectedTarget(card.id);
        } else if (myBlocker) {
          setSelectedBlocker(card.id);
        }

        if (selectedTarget && myBlocker) {
          const newAssignments = { ...blockingAssignments };
          if (!newAssignments[selectedTarget]) {
            newAssignments[selectedTarget] = [];
          }
          if (!newAssignments[selectedTarget].includes(myBlocker.id)) {
            newAssignments[selectedTarget].push(myBlocker.id);
          }
          setBlockingAssignments(newAssignments);
          socket.emit('declare_blockers', newAssignments); // Send updates immediately
          setSelectedTarget(null);
          setSelectedBlocker(null);
        }
      }
    }
  };

  const [{ isOverYourMana }, dropYourMana] = useDrop(() => ({
    accept: ItemTypes.CARD,
    drop: (item) => socket.emit('play_card', item.id, 'mana'),
    collect: (monitor) => ({ isOverYourMana: !!monitor.isOver() }),
  }));

  const [{ isOverYourField }, dropYourField] = useDrop(() => ({
    accept: ItemTypes.CARD,
    drop: (item) => socket.emit('play_card', item.id, 'field'),
    collect: (monitor) => ({ isOverYourField: !!monitor.isOver() }),
  }));

  return (
    <DndProvider backend={HTML5Backend}>
      <div className={styles.appContainer}>
        <h1 className={styles.messageHeader}>{message}</h1>
        <h2 className={styles.turnHeader}>{isYourTurn ? 'Your Turn' : 'Opponent\'s Turn'}</h2>
        <h3 className={styles.phaseHeader}>Phase: {currentPhase.replace(/_/g, ' ').toUpperCase()}</h3>

        <div className={styles.gameArea}>
          {/* Opponent's Area */}
          <div className={styles.opponentArea}>
            <h3>Opponent's Area</h3>
            <p>Opponent's Deck Size: {opponentDeckSize}</p>
            <p>Opponent's Mana: {opponentCurrentMana} / {opponentMaxMana}</p>
            <div className={styles.opponentFieldManaContainer}>
              <h4>Opponent's Played Cards:</h4>
              <div className={styles.playedCardsArea}>
                {opponentPlayedCards.map(card => (
                  <Card
                    key={card.id} {...card}
                    onCardAction={handleCardAction}
                    isPlayed={true}
                    isTapped={card.isTapped || false}
                    isAttacking={attackingCreatures.some(a => a.attackerId === card.id)}
                    isSelectedAttacker={false}
                    isSelectedBlocker={false}
                    isSelectedTarget={selectedTarget === card.id}
                  />
                ))}
              </div>
              <div className={styles.opponentManaZoneContainer}>
                <h4>Opponent's Mana Zone:</h4>
                <div className={styles.manaZone}>
                  {opponentManaZone.map(card => <Card key={card.id} {...card} isPlayed={false} isTapped={false} isAttacking={false} isSelectedAttacker={false} isSelectedBlocker={false} isSelectedTarget={false} />)}
                </div>
              </div>
            </div>
          </div>

          {/* Your Area */}
          <div className={styles.yourArea}>
            <h3>Your Area</h3>
            <p>Your Life: {yourLife}</p>
            <h4>Your Played Cards:</h4>
            <div ref={dropYourField} className={`${styles.playedCardsArea} ${isOverYourField ? styles.playedCardsAreaOver : ''}`}>
              {yourPlayedCards.map(card => (
                <Card
                  key={card.id} {...card}
                  onCardAction={handleCardAction}
                  isPlayed={true}
                  isTapped={card.isTapped || false}
                  isAttacking={attackingCreatures.some(a => a.attackerId === card.id)}
                  isSelectedAttacker={selectedAttackers.has(card.id)}
                  isSelectedBlocker={selectedBlocker === card.id}
                  isSelectedTarget={false}
                />
              ))}
            </div>

            <div className={styles.manaHandContainer}>
              <div className={styles.manaZoneContainer}>
                <p>Your Mana: {yourCurrentMana} / {yourMaxMana}</p>
                <h4>Your Mana Zone:</h4>
                <div ref={dropYourMana} className={`${styles.manaZone} ${isOverYourMana ? styles.manaZoneOver : ''}`}>
                  {yourManaZone.map(card => <Card key={card.id} {...card} isPlayed={false} isTapped={false} isAttacking={false} isSelectedAttacker={false} isSelectedBlocker={false} isSelectedTarget={false} />)}
                </div>
              </div>

              <div className={styles.handContainer}>
                <h3>Your Hand:</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                  {yourHand.map(card => 
                    <Card 
                      key={card.id} 
                      {...card} 
                      onCardAction={handleCardAction} 
                      isPlayed={false} 
                      isTapped={false} 
                      isAttacking={false} 
                      isSelectedAttacker={false} 
                      isSelectedBlocker={false} 
                      isSelectedTarget={false} 
                    />
                  )}
                </div>
              </div>
            </div>

            <div className={styles.deckEndTurnContainer}>
              <Deck />
              <p>Your Deck Size: {yourDeckSize}</p>
              <button onClick={handleNextPhase} className={styles.endTurnButton}>
                {currentPhase === 'declare_attackers' ? 'Declare Attack' : 
                 (currentPhase === 'declare_blockers' && !isYourTurn) ? 'Confirm Blocks' : 'Next Phase'}
              </button>
            </div>
          </div>
        </div>
      </div>
      {selectedCardDetail && <CardDetail card={selectedCardDetail} onClose={() => setSelectedCardDetail(null)} />}
      {effectMessage && (
        <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', backgroundColor: 'rgba(0, 0, 0, 0.8)', color: 'white', padding: '20px', borderRadius: '10px', zIndex: 1001, fontSize: '1.5rem', fontWeight: 'bold' }}>
          {effectMessage}
        </div>
      )}
    </DndProvider>
  );
};

export default App;