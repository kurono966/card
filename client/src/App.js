import React, { useEffect, useState, useRef } from 'react';
import io from 'socket.io-client';
import { DndProvider, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

import Card from './components/Card';
import Deck from './components/Deck';
import CardDetail from './components/CardDetail';

import styles from './App.module.css';

// Determine the server URL based on the current environment
const isLocalDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const serverUrl = isLocalDevelopment 
  ? 'http://localhost:3001' 
  : 'https://neocard-server.onrender.com';

console.log(`Connecting to ${isLocalDevelopment ? 'local' : 'remote'} server:`, serverUrl);

// Initialize socket with autoConnect set to false
const socket = io(serverUrl, {
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 10000,
  timeout: 20000,
  withCredentials: true,
  // Try both transports
  transports: ['polling', 'websocket'],
  // Don't connect automatically - we'll connect manually after setting up handlers
  autoConnect: false,
  // Add query parameters for debugging
  query: {
    clientType: 'web',
    version: '1.0.0'
  }
});

// Add detailed logging for all events
const events = [
  'connect',
  'connect_error',
  'connect_timeout',
  'reconnect',
  'reconnect_attempt',
  'reconnecting',
  'reconnect_error',
  'reconnect_failed',
  'disconnect',
  'error'
];

events.forEach(event => {
  socket.on(event, (data) => {
    console.log(`[Socket.io] ${event}`, data || '');
  });
});

// Handle connection established
socket.on('connect', () => {
  console.log('✅ Connected to server with ID:', socket.id);
  console.log('Transport:', socket.io.engine.transport.name); // in most cases, prints "polling" or "websocket"
});

// Handle connection errors
socket.on('connect_error', (error) => {
  console.error('❌ Connection failed:', error.message);
  console.log('Socket details:', {
    connected: socket.connected,
    disconnected: socket.disconnected,
    id: socket.id
  });
});

// Start the connection manually
console.log('Initiating connection to server...');
socket.connect();

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
  const [tempSelectedBlocker, setTempSelectedBlocker] = useState(null); // 新しいステート

  const [isTargetingEffect, setIsTargetingEffect] = useState(false);
  const isTargetingEffectRef = useRef(isTargetingEffect);
  const [effectSourceCardId, setEffectSourceCardId] = useState(null);
  const [effectMessageForTarget, setEffectMessageForTarget] = useState(null); // To display message like "Select a target"
  const [effectTypeForTarget, setEffectTypeForTarget] = useState(null);
  const [effectAmountForTarget, setEffectAmountForTarget] = useState(null);

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

    // New listener for effect targeting
    socket.on('request_target_for_effect', ({ type, amount, sourceCardId, message }) => {
      console.log('[App.js] Received request_target_for_effect:', { type, amount, sourceCardId, message });
      setIsTargetingEffect(true);
      isTargetingEffectRef.current = true; // Update ref immediately
      setEffectSourceCardId(sourceCardId);
      setEffectMessageForTarget(message);
      setEffectTypeForTarget(type);
      setEffectAmountForTarget(amount);
      console.log('[App.js] isTargetingEffect set to true.', isTargetingEffectRef.current);
      // Optionally, highlight potential targets here if needed
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('connect_error');
      socket.off('game_state');
      socket.off('effect_triggered');
      socket.off('request_target_for_effect'); // Clean up new listener
    };
  }, []); // Add empty dependency array and closing bracket

  const handleNextPhase = () => {
    // 自分のターンかどうかで処理を分岐
    if (isYourTurnRef.current) {
      // アタック宣言フェイズでは、攻撃者を宣言してからフェーズを進める
      if (currentPhase === 'declare_attackers') {
        const attackerIds = Array.from(selectedAttackers.keys());
        socket.emit('declare_attackers', attackerIds);
        socket.emit('next_phase'); // サーバーにフェーズ進行を要求
      } else if (currentPhase !== 'declare_blockers') {
        // ブロック宣言フェイズ以外なら、単純にフェーズを進める
        socket.emit('next_phase');
      }
    } else {
      // 相手のターンで、ブロック宣言フェイズの場合のみ、ブロック情報を送ってからフェーズを進める
      if (currentPhase === 'declare_blockers') {
        socket.emit('declare_blockers', blockingAssignments);
        socket.emit('next_phase');
      }
    }
  };

  const handleCardAction = (card, actionType) => {
    if (actionType === 'hover') {
      setSelectedCardDetail(card);
    } else if (actionType === 'leave') {
      setSelectedCardDetail(null);
    } else if (actionType === 'click') {
      // --- Effect Targeting Logic ---
      if (isTargetingEffectRef.current) {
        console.log('[App.js] Targeting effect active. Card clicked:', card);
        // Only allow targeting opponent's played creatures
        const targetCreature = opponentPlayedCards.find(c => c.id === card.id);
        if (targetCreature) {
          console.log('[App.js] Valid target selected:', targetCreature);
          console.log('[App.js] Emitting resolve_effect_target with:', {
            sourceCardId: effectSourceCardId,
            targetCardId: card.id,
            effectType: effectTypeForTarget,
            amount: effectAmountForTarget,
          });
          socket.emit('resolve_effect_target', {
            sourceCardId: effectSourceCardId,
            targetCardId: card.id,
            effectType: effectTypeForTarget,
            amount: effectAmountForTarget,
          });
          setIsTargetingEffect(false);
          isTargetingEffectRef.current = false; // Update ref immediately
          setEffectSourceCardId(null);
          setEffectMessageForTarget(null);
        } else {
          console.log('Invalid target for effect: Not an opponent creature.', card);
        }
        return; // Prevent other click actions while targeting
      }

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
          setTempSelectedBlocker(null); // 攻撃対象を選択したら仮ブロッカー選択をリセット
        } else if (myBlocker) {
          // 既に攻撃対象が選択されている場合のみ、ブロッカーを仮選択
          if (selectedTarget) {
            setTempSelectedBlocker(card.id);
          }
        }

        // 攻撃対象と仮選択されたブロッカーの両方が存在する場合にブロックを確定
        if (selectedTarget && tempSelectedBlocker) {
          const newAssignments = { ...blockingAssignments };
          if (!newAssignments[selectedTarget]) {
            newAssignments[selectedTarget] = [];
          }
          if (!newAssignments[selectedTarget].includes(tempSelectedBlocker)) {
            newAssignments[selectedTarget].push(tempSelectedBlocker);
          }
          setBlockingAssignments(newAssignments);
          socket.emit('declare_blockers', newAssignments); // Send updates immediately
          setSelectedTarget(null);
          setTempSelectedBlocker(null); // ブロック割り当て後、仮選択をリセット
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
            <p>Opponent's Life: {opponentLife}</p>
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
                    isTargetableForEffect={isTargetingEffect && opponentPlayedCards.some(c => c.id === card.id)}
                  />
                ))}
              </div>
              <div className={styles.opponentManaZoneContainer}>
                <h4>Opponent's Mana Zone:</h4>
                <div className={styles.manaZone}>
                  {opponentManaZone.length > 0 ? (
                    opponentManaZone.map(card => <Card key={card.id} {...card} onCardAction={handleCardAction} isPlayed={false} isTapped={false} isAttacking={false} isSelectedAttacker={false} isSelectedBlocker={false} isSelectedTarget={false} />)
                  ) : (
                    <p className={styles.emptyZoneText}>Empty</p>
                  )}
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
                  isSelectedBlocker={blockingAssignments[selectedTarget] && blockingAssignments[selectedTarget].includes(card.id)} // 確定したブロッカー
                  isTempSelectedBlocker={tempSelectedBlocker === card.id} // 仮選択中のブロッカー
                  isSelectedTarget={selectedTarget === card.id}
                />
              ))}
            </div>

            <div className={styles.manaHandContainer}>
              <div className={styles.manaZoneContainer}>
                <p>Your Mana: {yourCurrentMana} / {yourMaxMana}</p>
                <h4>Your Mana Zone:</h4>
                <div ref={dropYourMana} className={`${styles.manaZone} ${isOverYourMana ? styles.manaZoneOver : ''}`}>
                  {yourManaZone.length > 0 ? (
                    yourManaZone.map(card => <Card key={card.id} {...card} onCardAction={handleCardAction} isPlayed={false} isTapped={false} isAttacking={false} isSelectedAttacker={false} isSelectedBlocker={false} isSelectedTarget={false} />)
                  ) : (
                    <p className={styles.emptyZoneText}>Empty</p>
                  )}
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
              <button 
                onClick={handleNextPhase} 
                className={styles.endTurnButton}
                disabled={!isYourTurn && currentPhase !== 'declare_blockers' || isYourTurn && currentPhase === 'declare_blockers'}>
                {currentPhase === 'declare_attackers' ? 'Declare Attack' : 
                 (currentPhase === 'declare_blockers' && !isYourTurn) ? 'Confirm Blocks' : 'Next Phase'}
              </button>
            </div>
          </div>
        </div>
      </div>
      {selectedCardDetail && (
        <div style={{
          position: 'fixed',
          top: '20px', // 画面上部から20px
          left: '20px', // 画面左部から20px
          zIndex: 1000, // 他の要素より手前に表示
          // その他のスタイルはCardDetailコンポーネント内で定義されているはず
        }}>
          <CardDetail card={selectedCardDetail} onClose={() => setSelectedCardDetail(null)} />
        </div>
      )}
      {effectMessage && (
        <div style={{ position: 'fixed', top: '20px', left: '20px', backgroundColor: 'rgba(0, 0, 0, 0.8)', color: 'white', padding: '20px', borderRadius: '10px', zIndex: 1001, fontSize: '1.5rem', fontWeight: 'bold' }}>
          {effectMessage}
        </div>
      )}
      {isTargetingEffect && effectMessageForTarget && (
        <div style={{ position: 'fixed', top: '80px', left: '20px', backgroundColor: 'rgba(0, 0, 0, 0.8)', color: 'yellow', padding: '20px', borderRadius: '10px', zIndex: 1001, fontSize: '1.5rem', fontWeight: 'bold' }}>
          {effectMessageForTarget}
        </div>
      )}
    </DndProvider>
  );
};

export default App;