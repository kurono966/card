import React, { useEffect, useState, useRef } from 'react';
import io from 'socket.io-client';
import { DndProvider, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

import Card from './components/Card';
import Deck from './components/Deck';
import CardDetail from './components/CardDetail';
import Graveyard from './components/Graveyard';
import Menu from './components/Menu'; // Menuコンポーネントをインポート



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
  
  // NPC AI state
  const [npcThinking, setNpcThinking] = useState(false);
  const npcTimeoutRef = useRef(null);

  useEffect(() => {
    // Set up event listeners when component mounts
    const handleConnect = () => {
      console.log('✅ Connected to server with ID:', socket.id);
      console.log('Transport:', socket.io.engine.transport.name);
      setMessage('接続されました。ゲームを開始します...');
      setSocketConnected(true);
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
  }, []);
  
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

  // NPC AI logic
  const makeNPCDecision = () => {
    if (!isYourTurn || gameMode !== 'solo' || npcThinking) return;
    
    setNpcThinking(true);
    
    // Simulate thinking time (1-2 seconds)
    const thinkTime = 1000 + Math.random() * 1000;
    
    npcTimeoutRef.current = setTimeout(() => {
      // Play cards if possible
      if (opponentCurrentMana > 0 && opponentHand.length > 0) {
        const playableCards = opponentHand.filter(card => card.cost <= opponentCurrentMana);
        if (playableCards.length > 0) {
          const cardToPlay = playableCards[Math.floor(Math.random() * playableCards.length)];
          
          // For simplicity, just play the first playable card
          if (cardToPlay) {
            // Move card from hand to play area
            setOpponentHand(prev => prev.filter(c => c.id !== cardToPlay.id));
            setOpponentPlayedCards(prev => [...prev, { ...cardToPlay, isTapped: false }]);
            setOpponentCurrentMana(prev => prev - cardToPlay.cost);
          }
        }
      }
      
      // If in attack phase, attack with untapped creatures
      if (currentPhase === 'declare_attackers') {
        const attackableCreatures = opponentPlayedCards.filter(card => !card.isTapped && card.canAttack);
        if (attackableCreatures.length > 0) {
          // Attack with all available creatures (simple AI)
          const newAttackingCreatures = attackableCreatures.map(card => ({
            attackerId: card.id,
            target: 'player' // Always attack player directly in this simple AI
          }));
          
          // Update UI to show attacking creatures
          setAttackingCreatures(newAttackingCreatures);
          
          // Tap the attacking creatures
          setOpponentPlayedCards(prev => 
            prev.map(card => 
              attackableCreatures.some(ac => ac.id === card.id) 
                ? { ...card, isTapped: true } 
                : card
            )
          );
        }
      }
      
      // End turn if no more actions
      if (currentPhase !== 'declare_attackers' || opponentPlayedCards.every(card => card.isTapped || !card.canAttack)) {
        handleEndTurn();
      }
      
      setNpcThinking(false);
    }, thinkTime);
  };
  
  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (npcTimeoutRef.current) {
        clearTimeout(npcTimeoutRef.current);
      }
    };
  }, []);
  
  // Handle NPC turn
  useEffect(() => {
    if (gameMode === 'solo' && !isYourTurn && gameStarted) {
      makeNPCDecision();
    }
  }, [isYourTurn, currentPhase, gameMode, gameStarted]);
  
  const startSoloGame = () => {
    console.log('Starting solo game...');
    setGameMode('solo');
    setMessage('ソロモードを準備中...');
    
    // Initialize game state for solo mode
    setPlayerHand([
      { id: 1, name: 'クリーチャー1', power: 2, toughness: 2, cost: 1 },
      { id: 2, name: 'クリーチャー2', power: 3, toughness: 3, cost: 2 },
      { id: 3, name: 'スペル1', cost: 1, type: 'spell' },
    ]);
    
    setOpponentHand([
      { id: 101, name: 'NPCクリーチャー1', power: 2, toughness: 2, cost: 1 },
      { id: 102, name: 'NPCクリーチャー2', power: 3, toughness: 3, cost: 2 },
    ]);
    
    setPlayerDeckSize(20);
    setOpponentDeckSize(20);
    setYourLife(20);
    setOpponentLife(20);
    setYourMaxMana(1);
    setYourCurrentMana(1);
    setOpponentMaxMana(1);
    setOpponentCurrentMana(1);
    
    // Set first turn to player
    setIsYourTurn(true);
    setCurrentPhase('main_phase_1');
    
    setGameStarted(true);
    setMessage('ソロモードでゲームを開始します。あなたのターンです。');
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
  }, []); // Add empty dependency array and closing bracket

  const handleEndTurn = () => {
    if (gameMode === 'online') {
      if (isYourTurn) {
        socket.emit('end_turn');
      }
    } else if (gameMode === 'solo') {
      // In solo mode, just toggle the turn
      const nextTurn = !isYourTurn;
      setIsYourTurn(nextTurn);
      
      // Reset mana and increase max mana at the start of each turn
      if (nextTurn) {
        // Player's turn is starting
        setYourCurrentMana(yourMaxMana + 1);
        setYourMaxMana(prev => prev + 1);
        setMessage('あなたのターンです');
        
        // Untap all player's cards
        setYourPlayedCards(prev => 
          prev.map(card => ({
            ...card,
            isTapped: false,
            canAttack: true // Reset attack status
          }))
        );
      } else {
        // Opponent's turn is starting
        setOpponentCurrentMana(opponentMaxMana + 1);
        setOpponentMaxMana(prev => prev + 1);
        setMessage('相手のターンです');
        
        // Let the NPC take its turn
        makeNPCDecision();
      }
      
      // Reset phase to main phase 1
      setCurrentPhase('main_phase_1');
      setAttackingCreatures([]);
      setBlockingAssignments({});
      setSelectedAttackers(new Map());
    }
  };

  const handleNextPhase = () => {
    if (gameMode === 'online') {
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
    } else if (gameMode === 'solo') {
      // In solo mode, handle phase changes locally
      const phases = ['main_phase_1', 'declare_attackers', 'declare_blockers', 'main_phase_2', 'end_phase'];
      const currentIndex = phases.indexOf(currentPhase);
      if (currentIndex < phases.length - 1) {
        const nextPhase = phases[currentIndex + 1];
        setCurrentPhase(nextPhase);
        
        // If moving to end phase, automatically end turn
        if (nextPhase === 'end_phase') {
          // Small delay before ending turn
          setTimeout(handleEndTurn, 1000);
        }
      }
    }
  };

  const handleCardAction = (card, actionType) => {
    if (actionType === 'hover') {
      setSelectedCardDetail(card);
    } else if (actionType === 'leave') {
      setSelectedCardDetail(null);
    } else if (actionType === 'click' && gameMode === 'solo' && isYourTurn) {
      // Handle card plays in solo mode
      if ((currentPhase === 'main_phase_1' || currentPhase === 'main_phase_2') && 
          playerHand.some(c => c.id === card.id) && 
          card.cost <= yourCurrentMana) {
        // Play a card from hand
        setPlayerHand(prev => prev.filter(c => c.id !== card.id));
        
        if (card.type === 'spell') {
          // Handle spell effects here if needed
          setYourCurrentMana(prev => prev - card.cost);
          // For now, just move spell to graveyard
          setPlayerGraveyard(prev => [...prev, card]);
        } else {
          // It's a creature
          setYourPlayedCards(prev => [
            ...prev, 
            { ...card, isTapped: false, canAttack: false }
          ]);
          setYourCurrentMana(prev => prev - card.cost);
        }
        return;
      }
      
      // Handle attacking in solo mode
      if (currentPhase === 'declare_attackers' && isYourTurn) {
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
        return;
      }
      
      // Handle blocking in solo mode
      if (currentPhase === 'declare_blockers' && !isYourTurn) {
        const attacker = opponentPlayedCards.find(c => c.id === card.id);
        const blocker = yourPlayedCards.find(c => c.id === card.id && !c.isTapped);
        
        if (attacker) {
          setSelectedTarget(card.id);
          setTempSelectedBlocker(null);
        } else if (blocker && selectedTarget) {
          // Assign this blocker to the selected attacker
          const newAssignments = { ...blockingAssignments };
          if (!newAssignments[selectedTarget]) {
            newAssignments[selectedTarget] = [];
          }
          newAssignments[selectedTarget].push(card.id);
          setBlockingAssignments(newAssignments);
          setSelectedTarget(null);
          
          // Tap the blocking creature
          setYourPlayedCards(prev => 
            prev.map(c => c.id === card.id ? { ...c, isTapped: true } : c)
          );
        }
        return;
      }
    } else if (actionType === 'toGraveyard') {
      // Handle moving a card to the graveyard
      if (yourPlayedCards.some(c => c.id === card.id)) {
        // Move from your field to your graveyard
        setPlayerGraveyard(prev => [...prev, card]);
        setYourPlayedCards(prev => prev.filter(c => c.id !== card.id));
      } else if (opponentPlayedCards.some(c => c.id === card.id)) {
        // Move from opponent's field to their graveyard
        setOpponentGraveyard(prev => [...prev, card]);
        setOpponentPlayedCards(prev => prev.filter(c => c.id !== card.id));
      } else if (playerHand.some(c => c.id === card.id)) {
        // Move from your hand to your graveyard
        setPlayerGraveyard(prev => [...prev, card]);
        setPlayerHand(prev => prev.filter(c => c.id !== card.id));
      } else if (yourManaZone.some(c => c.id === card.id)) {
        // Move from your mana zone to your graveyard
        setPlayerGraveyard(prev => [...prev, card]);
        setYourManaZone(prev => prev.filter(c => c.id !== card.id));
      }
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
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-800 text-white">
        {gameMode === 'online' && (
          <div className="text-center text-lg font-bold">
            {socket.connected ? 'オンライン接続中' : '接続中...'}
          </div>
        )}
        <h1 className="text-2xl font-bold my-4">{message}</h1>
        <h2 className="text-xl font-semibold mb-2">{isYourTurn ? 'Your Turn' : 'Opponent\'s Turn'}</h2>
        <h3 className="text-lg font-medium mb-4">Phase: {currentPhase.replace(/_/g, ' ').toUpperCase()}</h3>

        <div className="flex flex-grow w-full max-w-6xl p-4">
          {/* Opponent's Area */}
          <div className="flex flex-col items-center justify-center w-1/2 p-4 bg-gray-700 rounded-lg shadow-lg">
            <h3>Opponent's Area</h3>
            <p>Opponent's Life: {opponentLife}</p>
            <p>Opponent's Deck Size: {opponentDeckSize}</p>
            <p>Opponent's Mana: {opponentCurrentMana} / {opponentMaxMana}</p>
            <div className="flex flex-col items-center justify-center w-full">
              <h4>Opponent's Played Cards:</h4>
              <div className="flex flex-wrap justify-center gap-2 p-2 bg-gray-600 rounded-md min-h-[100px]">
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
              <div className="flex flex-col items-center justify-center w-full mt-4">
                <h4>Opponent's Mana Zone:</h4>
                <div className="flex flex-wrap justify-center gap-2 p-2 bg-gray-600 rounded-md min-h-[100px]">
                  {opponentManaZone.length > 0 ? (
                    opponentManaZone.map(card => <Card key={card.id} {...card} onCardAction={handleCardAction} isPlayed={false} isTapped={false} isAttacking={false} isSelectedAttacker={false} isSelectedBlocker={false} isSelectedTarget={false} />)
                  ) : (
                    <p className="text-gray-400">Empty</p>
                  )}
                </div>
                <div className="flex flex-col items-center justify-center w-full mt-4">
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
            <div className="flex flex-wrap justify-center gap-2 p-2 bg-gray-600 rounded-md min-h-[100px]">
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

            <div className="flex flex-col items-center justify-center w-full mt-4">
              <div className="flex flex-col items-center justify-center w-full">
                <p>Your Mana: {yourCurrentMana} / {yourMaxMana}</p>
                <h4>Your Mana Zone:</h4>
                <div ref={dropYourMana} className={`${styles.manaZone} ${isOverYourMana ? styles.manaZoneOver : ''}`}>
                  {yourManaZone.length > 0 ? (
                    yourManaZone.map(card => <Card key={card.id} {...card} onCardAction={handleCardAction} isPlayed={false} isTapped={false} isAttacking={false} isSelectedAttacker={false} isSelectedBlocker={false} isSelectedTarget={false} />)
                  ) : (
                    <p className="text-gray-400">Empty</p>
                  )}
                </div>
              </div>

              <div className="flex flex-col items-center justify-center w-full mt-4">
                <Graveyard
                  cards={playerGraveyard}
                  onCardAction={handleCardAction}
                  isOpponent={false}
                />
              </div>

              <div className="flex flex-col items-center justify-center w-full mt-4">
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