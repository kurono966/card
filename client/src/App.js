import React, { useEffect, useState, useRef } from 'react';
import io from 'socket.io-client';
import { DndProvider, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

import Card from './components/Card';
import Deck from './components/Deck';
import CardDetail from './components/CardDetail';
import Graveyard from './components/Graveyard';
import Menu from './components/Menu'; // Menuコンポーネントをインポート
import { allCards, getRandomCard } from './utils/cardData';

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



const ItemTypes = {
  CARD: 'card',
};

const App = () => {
  const [gameStarted, setGameStarted] = useState(false);
  const [gameMode, setGameMode] = useState(null); // 'online' or 'solo'
  const [message, setMessage] = useState('Neocardにようこそ！');
  const [socketConnected, setSocketConnected] = useState(false);

  useEffect(() => {
    // Only connect if in online mode
    if (gameMode === 'online' && !socketConnected) {
      console.log('Connecting to server...');
      socket.connect();
    } else if (gameMode === 'solo') {
      // Make sure socket is disconnected in solo mode
      if (socket.connected) {
        console.log('Disconnecting socket for solo mode...');
        socket.disconnect();
      }
      setSocketConnected(false);
    }

    // Set up event listeners
    const handleConnect = () => {
      console.log('✅ Connected to server with ID:', socket.id);
      setSocketConnected(true);
      setMessage('サーバーに接続しました。ゲームを開始します...');
    };

    const handleConnectError = (error) => {
      console.error('❌ Connection failed:', error.message);
      console.log('Socket details:', {
        connected: socket.connected,
        disconnected: socket.disconnected,
        id: socket.id
      });
      setMessage('接続に失敗しました。後でもう一度お試しください。');
    };

    // Add event listeners
    socket.on('connect', handleConnect);
    socket.on('connect_error', handleConnectError);

    // Clean up event listeners on component unmount
    return () => {
      socket.off('connect', handleConnect);
      socket.off('connect_error', handleConnectError);
    };
  }, [gameMode, socketConnected]);
  
  // Start game functions
  const startOnlineGame = () => {
    console.log('Starting online game...');
    setGameMode('online');
    setMessage('サーバーに接続中...');
    
    // Set up socket connection
    socket.connect();
    
    // Set a timeout to handle connection issues
    const connectionTimeout = setTimeout(() => {
      if (!socket.connected) {
        setMessage('サーバーに接続できませんでした。後でもう一度お試しください。');
        setGameMode(null);
      }
    }, 10000); // 10 second timeout

    // Clear timeout on successful connection
    socket.once('connect', () => {
      clearTimeout(connectionTimeout);
      setSocketConnected(true);
      setGameStarted(true);
    });
  };

  const endTurn = () => {
    if (gameMode === 'solo') {
      if (isYourTurn) {
        // End player's turn, start AI's turn
        setIsYourTurn(false);
        setCurrentPhase('main_phase_1');
        
        // AI takes its turn after a short delay
        setTimeout(aiTurn, 1000);
      } else {
        // End AI's turn, start player's turn
        setIsYourTurn(true);
        setMessage('あなたのターンです');
        setCurrentPhase('main_phase_1');
        
        // Refill mana to max mana
        setYourCurrentMana(yourMaxMana);

        // Draw a card at the start of player's turn, using a safer functional update
        setPlayerDeckSize(prevDeckSize => {
          if (prevDeckSize > 0) {
            setPlayerHand(prevHand => [...prevHand, getRandomCard()]);
            return prevDeckSize - 1;
          }
          return prevDeckSize;
        });
        
        // Untap all player's cards at the start of turn
        setYourPlayedCards(prev => 
          prev.map(card => ({
            ...card,
            isTapped: false,
            canAttack: true // Remove summoning sickness
          }))
        );
      }
    } else if (gameMode === 'online') {
      // Existing online turn logic
      socket.emit('end_turn');
    }
  };

  // AI turn logic for solo mode (Simplified for debugging)
  const aiTurn = () => {
    console.log("AI turn started (Debug Mode)");
    setMessage("相手は考えています...");

    // AI does nothing but wait, then ends its turn.
    // This is to test if the turn-passing itself is causing a loop.
    setTimeout(() => {
        console.log("AI is passing the turn back.");
        endTurn();
    }, 2000);
  };

  const startSoloGame = () => {
    console.log('Starting solo game...');
    
    // Disconnect socket if connected (in case switching from online mode)
    if (socket.connected) {
      console.log('Disconnecting from server for solo mode...');
      socket.disconnect();
      setSocketConnected(false);
    }
    
    // Reset all game state first
    setGameMode('solo');
    setMessage('ソロモードを準備中...');
    
    // Initialize player's hand with random cards (ensuring unique IDs)
    const initialPlayerHand = Array(5).fill().map(() => {
      const card = getRandomCard();
      return {
        ...card,
        id: `player-card-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        canAttack: false,
        isTapped: false
      };
    });
    
    // Initialize AI's hand with random cards (ensuring unique IDs)
    const initialAIHand = Array(5).fill().map(() => {
      const card = getRandomCard();
      return {
        ...card,
        id: `ai-card-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        canAttack: false,
        isTapped: false
      };
    });
    
    // Set initial game state
    setPlayerHand(initialPlayerHand);
    setPlayerDeckSize(20);
    setPlayerGraveyard([]);
    setYourPlayedCards([]);
    setYourManaZone([]);
    setYourMaxMana(1); // Start with 1 mana
    setYourCurrentMana(1);
    setYourLife(20);
    
    // Set up AI opponent
    setOpponentHand(initialAIHand);
    setOpponentPlayedCards([]);
    setOpponentManaZone([]);
    setOpponentGraveyard([]);
    setOpponentDeckSize(20);
    setOpponentMaxMana(1);
    setOpponentCurrentMana(1);
    setOpponentLife(20);
    
    // Reset other game state
    setSelectedAttackers(new Map());
    setBlockingAssignments({});
    setSelectedTarget(null);
    setTempSelectedBlocker(null);
    setAttackingCreatures([]);
    setCurrentPhase('main_phase_1');
    setIsYourTurn(true);
    
    // Start the game
    setGameStarted(true);
    console.log('Solo game started with state:', {
      playerHand: initialPlayerHand,
      aiHand: initialAIHand,
      playerMana: 1,
      playerLife: 20,
      aiLife: 20
    });
    setMessage('ソロモードを開始します。あなたのターンです。');
  };
  const [playerHand, setPlayerHand] = useState([]); // Handles your hand of cards // Handles your hand of cards
  const [opponentHand, setOpponentHand] = useState([]);
  const [playerGraveyard, setPlayerGraveyard] = useState([]);
  const [opponentGraveyard, setOpponentGraveyard] = useState([]);
  const [yourPlayedCards, setYourPlayedCards] = useState([]);
  const [yourManaZone, setYourManaZone] = useState([]);
  const [yourMaxMana, setYourMaxMana] = useState(0);
  const [yourCurrentMana, setYourCurrentMana] = useState(0);
  const [yourLife, setYourLife] = useState(20);
  const [playerDeckSize, setPlayerDeckSize] = useState(0);

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
      setPlayerHand(state.yourHand || []);
      setPlayerDeckSize(state.yourDeckSize);
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

      // Update graveyards if they exist in the state
      if (state.yourGraveyard) {
        setPlayerGraveyard(state.yourGraveyard);
      }
      if (state.opponentGraveyard) {
        setOpponentGraveyard(state.opponentGraveyard);
      }

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
  }, [currentPhase]);

  const handleNextPhase = () => {
    if (gameMode === 'solo') {
      // Solo mode: Handle phase changes locally
      if (isYourTurn) {
        if (currentPhase === 'declare_attackers') {
          // Resolve combat damage
          const totalDamage = Array.from(selectedAttackers.values()).reduce(
            (total, attacker) => total + attacker.attack, 0
          );
          
          if (totalDamage > 0) {
            setOpponentLife(prev => Math.max(0, prev - totalDamage));
            setMessage(`相手に${totalDamage}のダメージを与えました！`);
          }
          
          // Tap all attacking creatures
          setYourPlayedCards(prev => 
            prev.map(card => 
              selectedAttackers.has(card.id) 
                ? { ...card, isTapped: true, canAttack: false }
                : card
            )
          );
          
          // Move to next phase
          setCurrentPhase('end_phase');
          setTimeout(() => endTurn(), 1500);
        } else if (currentPhase === 'main_phase_1') {
          // Move to combat phase
          setCurrentPhase('declare_attackers');
          setMessage('攻撃するクリーチャーを選択してください');
        } else if (currentPhase === 'end_phase') {
          // End turn
          endTurn();
        }
      } else {
        // AI's turn - handled by AI logic
        if (currentPhase === 'declare_blockers') {
          // Resolve combat damage
          const updatedOpponentPlayedCards = [...opponentPlayedCards];
          const updatedYourPlayedCards = [...yourPlayedCards];
          
          // Apply damage to blockers and attackers
          Object.entries(blockingAssignments).forEach(([attackerId, blockerIds]) => {
            const attacker = updatedOpponentPlayedCards.find(c => c.id === attackerId);
            const blockers = updatedYourPlayedCards.filter(c => blockerIds.includes(c.id));
            
            if (attacker) {
              // Apply damage to blockers
              blockers.forEach(blocker => {
                blocker.defense -= attacker.attack / blockers.length;
              });
              
              // Apply damage to attacker
              const totalBlockingPower = blockers.reduce((total, b) => total + b.attack, 0);
              attacker.defense -= totalBlockingPower;
            }
          });
          
          // Remove destroyed creatures
          setOpponentPlayedCards(updatedOpponentPlayedCards.filter(c => c.defense > 0));
          setYourPlayedCards(updatedYourPlayedCards.filter(c => c.defense > 0));
          
          // Move to next phase
          setCurrentPhase('end_phase');
          setBlockingAssignments({});
          setSelectedTarget(null);
          setTempSelectedBlocker(null);
          
          setTimeout(() => endTurn(), 1500);
        }
      }
    } else {
      // Online mode: Handle phase changes through server
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
    }
  };

  // Handle card effects when played
  const handleCardEffect = (card) => {
    console.log(`Resolving effect for card: ${card.name}`);
    
    // Handle different card effects
    if (card.effect) {
      if (card.effect.type === 'damage') {
        // Deal damage to opponent
        setOpponentLife(prev => Math.max(0, prev - card.effect.amount));
        setMessage(`${card.name}の効果で相手に${card.effect.amount}ダメージ！`);
      } else if (card.effect.type === 'heal') {
        // Heal player
        setYourLife(prev => Math.min(20, prev + card.effect.amount));
        setMessage(`${card.name}の効果で${card.effect.amount}回復しました！`);
      } else if (card.effect.type === 'draw') {
        // Draw cards
        const cardsToDraw = Math.min(card.effect.amount, playerDeckSize);
        if (cardsToDraw > 0) {
          const drawnCards = Array(cardsToDraw).fill().map(() => getRandomCard());
          setPlayerHand(prev => [...prev, ...drawnCards]);
          setPlayerDeckSize(prev => prev - cardsToDraw);
          setMessage(`${card.name}の効果で${cardsToDraw}枚ドロー！`);
        }
      }
    } else {
      // Default effect for cards without specific effects
      setMessage(`${card.name}をプレイしました`);
    }
  };

  const handleCardAction = (card, actionType) => {
    if (actionType === 'hover') {
      setSelectedCardDetail(card);
      return;
    }
    if (actionType === 'leave') {
      setSelectedCardDetail(null);
      return;
    }

    // Centralized logic for solo vs online
    if (gameMode === 'online') {
      switch (actionType) {
        case 'play':
          socket.emit('play_card', card.id, 'field');
          break;
        case 'playToMana':
          socket.emit('play_card', card.id, 'mana');
          break;
        // Future online actions can be handled here
        default:
          break;
      }
      return;
    }

    // --- Solo Mode Actions ---
    // Most actions are only allowed on your turn
    if (!isYourTurn && actionType !== 'block') {
      return;
    }

    switch (actionType) {
      case 'playToMana': {
        const cardInHand = playerHand.find(c => c.id === card.id);
        if (cardInHand) {
          setPlayerHand(prev => prev.filter(c => c.id !== card.id));
          setYourManaZone(prev => [...prev, card]);
          setYourMaxMana(prev => prev + 1);
          setMessage(`${card.name}をマナに置きました`);
        }
        break;
      }
      case 'play': {
        const cardInHand = playerHand.find(c => c.id === card.id);
        if (!cardInHand) break;

        if (yourCurrentMana >= card.manaCost) {
          setYourCurrentMana(prev => prev - card.manaCost);
          setPlayerHand(prev => prev.filter(c => c.id !== card.id));

          if (card.attack > 0 && card.defense > 0) {
            setYourPlayedCards(prev => [...prev, { ...card, canAttack: false, isTapped: false }]);
            setMessage(`${card.name}を召喚しました`);
          } else {
            handleCardEffect(card);
          }
        }
        break;
      }
      case 'attack': {
        if (currentPhase === 'declare_attackers' || currentPhase === 'combat') {
          const myCard = yourPlayedCards.find(c => c.id === card.id);
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
        break;
      }
      case 'block': {
        // Block logic is an exception, happens on opponent's turn
        if (!isYourTurn && currentPhase === 'declare_blockers') {
          const opponentAttacker = opponentPlayedCards.find(c => c.id === card.id && attackingCreatures.some(a => a.attackerId === c.id));
          const myBlocker = yourPlayedCards.find(c => c.id === card.id && !c.isTapped);

          if (opponentAttacker) {
            setSelectedTarget(card.id);
            setTempSelectedBlocker(null);
          } else if (myBlocker && selectedTarget) {
            const newAssignments = { ...blockingAssignments };
            if (!newAssignments[selectedTarget]) {
              newAssignments[selectedTarget] = [];
            }
            if (!newAssignments[selectedTarget].includes(card.id)) {
              newAssignments[selectedTarget].push(card.id);
              setYourPlayedCards(prev => 
                prev.map(c => 
                  c.id === card.id ? { ...c, isTapped: true } : c
                )
              );
            }
            setBlockingAssignments(newAssignments);
          }
        }
        break;
      }
      default:
        break;
    }
  };

  const [{ isOverYourMana }, dropYourMana] = useDrop(() => ({
    accept: ItemTypes.CARD,
    drop: (item) => handleCardAction(item, 'playToMana'),
    collect: (monitor) => ({ isOverYourMana: !!monitor.isOver() }),
  }));

  const [{ isOverYourField }, dropYourField] = useDrop(() => ({
    accept: ItemTypes.CARD,
    drop: (item) => handleCardAction(item, 'play'),
    collect: (monitor) => ({ isOverYourField: !!monitor.isOver() }),
  }));

  // Render menu if game hasn't started
  if (!gameStarted) {
    return (
      <Menu 
        onStartOnlineGame={startOnlineGame} 
        onStartSoloGame={startSoloGame} 
      />
    );
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <div className={styles.appContainer}>
        {gameMode === 'online' && (
          <div className={styles.connectionStatus}>
            {socket.connected ? 'オンライン接続中' : '接続中...'}
          </div>
        )}
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
                <div className={styles.graveyardContainer}>
                  <Graveyard
                    cards={opponentGraveyard}
                    onCardAction={handleCardAction}
                    isOpponent={true}
                  />
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

              <div className={styles.graveyardContainer}>
                <Graveyard
                  cards={playerGraveyard}
                  onCardAction={handleCardAction}
                  isOpponent={false}
                />
              </div>

              <div className={styles.handContainer}>
                <h3>Your Hand:</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                  {playerHand.map(card =>
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <Deck />
              </div>
              <p>Your Deck Size: {playerDeckSize}</p>
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
