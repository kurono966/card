import React, { useEffect, useState, useRef, useCallback } from 'react';
import io from 'socket.io-client';
import { DndProvider, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

import Card from './components/Card';
import Deck from './components/Deck';
import CardDetail from './components/CardDetail';
import Graveyard from './components/Graveyard';
import Menu from './components/Menu'; // Menuコンポーネントをインポート

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

// --- Sample Card Data (Moved outside App component for reusability) ---
const sampleCards = [
  { id: 1, name: 'Fireball', manaCost: 3, type: 'spell', effect: 'Deal 3 damage to opponent.', imageUrl: 'https://via.placeholder.com/150/FF0000/FFFFFF?text=Fireball' },
  { id: 2, name: 'Forest Spirit', manaCost: 2, attack: 2, defense: 2, type: 'creature', imageUrl: 'https://via.placeholder.com/150/00FF00/FFFFFF?text=Forest+Spirit' },
  { id: 3, name: 'Stone Golem', manaCost: 4, attack: 4, defense: 4, type: 'creature', imageUrl: 'https://via.placeholder.com/150/808080/FFFFFF?text=Stone+Golem' },
  { id: 4, name: 'Healing Potion', manaCost: 1, type: 'spell', effect: 'Restore 3 life to yourself.', imageUrl: 'https://via.placeholder.com/150/0000FF/FFFFFF?text=Healing+Potion' },
  { id: 5, name: 'Swift Scout', manaCost: 1, attack: 1, defense: 1, type: 'creature', imageUrl: 'https://via.placeholder.com/150/FFFF00/000000?text=Swift+Scout' },
  { id: 6, name: 'Dragon Breath', manaCost: 5, type: 'spell', effect: 'Deal 5 damage to opponent.', imageUrl: 'https://via.placeholder.com/150/FFA500/FFFFFF?text=Dragon+Breath' },
  { id: 7, name: 'Iron Defender', manaCost: 3, attack: 2, defense: 3, type: 'creature', imageUrl: 'https://via.placeholder.com/150/A0A0A0/FFFFFF?text=Iron+Defender' },
  { id: 8, name: 'Mana Crystal', manaCost: 0, type: 'mana', effect: 'Add 1 mana to your mana zone.', imageUrl: 'https://via.placeholder.com/150/8A2BE2/FFFFFF?text=Mana+Crystal' },
  { id: 9, name: 'Shadow Assassin', manaCost: 2, attack: 3, defense: 1, type: 'creature', imageUrl: 'https://via.placeholder.com/150/000000/FFFFFF?text=Shadow+Assassin' },
  { id: 10, name: 'Divine Shield', manaCost: 2, type: 'spell', effect: 'Gain 3 defense for one turn.', imageUrl: 'https://via.placeholder.com/150/FFFFFF/000000?text=Divine+Shield' },
];

// Utility function to shuffle an array
const shuffle = (array) => {
  let currentIndex = array.length, randomIndex;
  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex], array[currentIndex]];
  }
  return array;
};

const App = () => {
  const [gameStarted, setGameStarted] = useState(false);
  const [gameMode, setGameMode] = useState(null); // 'online' or 'solo'
  const [message, setMessage] = useState('Neocardにようこそ！');
  const [socketConnected, setSocketConnected] = useState(false);
  
  // NPC AI state
  const [npcThinking, setNpcThinking] = useState(false);
  const npcTimeoutRef = useRef(null);

  const [playerHand, setPlayerHand] = useState([]);
  const [opponentHand, setOpponentHand] = useState([]);
  const [playerGraveyard, setPlayerGraveyard] = useState([]);
  const [opponentGraveyard, setOpponentGraveyard] = useState([]);
  const [yourPlayedCards, setYourPlayedCards] = useState([]);
  const [yourManaZone, setYourManaZone] = useState([]);
  const [yourMaxMana, setYourMaxMana] = useState(0);
  const [yourCurrentMana, setYourCurrentMana] = useState(0);
  const [yourLife, setYourLife] = useState(20);
  const [playerDeck, setPlayerDeck] = useState([]); // Changed from playerDeckSize

  const [opponentPlayedCards, setOpponentPlayedCards] = useState([]);
  const [opponentManaZone, setOpponentManaZone] = useState([]);
  const [opponentDeck, setOpponentDeck] = useState([]); // Changed from opponentDeckSize
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
  const [tempSelectedBlocker, setTempSelectedBlocker] = useState(null);

  const [isTargetingEffect, setIsTargetingEffect] = useState(false);
  const isTargetingEffectRef = useRef(isTargetingEffect);
  const [effectSourceCardId, setEffectSourceCardId] = useState(null);
  const [effectMessageForTarget, setEffectMessageForTarget] = useState(null);
  const [effectTypeForTarget, setEffectTypeForTarget] = useState(null);
  const [effectAmountForTarget, setEffectAmountForTarget] = useState(null);

  const isYourTurnRef = useRef(isYourTurn);

  useEffect(() => {
    isYourTurnRef.current = isYourTurn;
  }, [isYourTurn]);

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

  const makeNPCDecision = useCallback(() => {
    if (!isYourTurn || gameMode !== 'solo' || npcThinking) return;
    
    setNpcThinking(true);
    
    // Simulate thinking time (1-2 seconds)
    const thinkTime = 1000 + Math.random() * 1000;
    
    npcTimeoutRef.current = setTimeout(() => {
      // 1. マナカードのプレイ（常に優先）
      const manaCardsInHand = opponentHand.filter(card => card.type === 'mana');
      if (manaCardsInHand.length > 0 && opponentManaZone.length < opponentMaxMana + 1) {
        const manaCardToPlay = manaCardsInHand[0];
        setOpponentHand(prev => prev.filter(c => c.id !== manaCardToPlay.id));
        setOpponentManaZone(prev => [...prev, manaCardToPlay]);
        setOpponentCurrentMana(prev => prev + 1);
        setMessage(`相手が${manaCardToPlay.name}をプレイ！`);
        setNpcThinking(false);
        return;
      }

      // 2. プレイ可能なカードを戦略的に選択
      if (opponentCurrentMana > 0 && opponentHand.length > 0) {
        const playableCards = opponentHand.filter(card => card.manaCost <= opponentCurrentMana);
        
        // カードを戦略的に評価してソート（クリーチャー優先、次に呪文）
        const sortedCards = [...playableCards].sort((a, b) => {
          // クリーチャーを優先
          if (a.type === 'creature' && b.type !== 'creature') return -1;
          if (a.type !== 'creature' && b.type === 'creature') return 1;
          
          // コスト効率を考慮（攻撃力+守備力/コスト）
          const aValue = (a.attack || 0) + (a.defense || 0) / 2;
          const bValue = (b.attack || 0) + (b.defense || 0) / 2;
          return (bValue / b.manaCost) - (aValue / a.manaCost);
        });

        // 戦略的に最適なカードを選択
        const cardToPlay = sortedCards[0];
        if (cardToPlay) {
          setOpponentHand(prev => prev.filter(c => c.id !== cardToPlay.id));
          
          if (cardToPlay.type === 'creature') {
            // クリーチャーをプレイ
            setOpponentPlayedCards(prev => [...prev, { 
              ...cardToPlay, 
              isTapped: false, 
              canAttack: false, // 召喚酔いのため攻撃不可
              summoningSickness: true // 召喚酔いフラグを追加
            }]);
            setMessage(`相手が${cardToPlay.name}を召喚しました！`);
          } else if (cardToPlay.type === 'spell') {
            // 呪文をプレイ
            if (cardToPlay.effect.includes('damage')) {
              const damage = parseInt(cardToPlay.effect.match(/\d+/)[0]);
              setYourLife(prev => Math.max(0, prev - damage));
              setMessage(`相手が${cardToPlay.name}をプレイ！${damage}ダメージを受けました！`);
            } else if (cardToPlay.effect.includes('life')) {
              const life = parseInt(cardToPlay.effect.match(/\d+/)[0]);
              // ライフが低いときだけ回復する（戦略的）
              if (opponentLife <= 15) {
                setOpponentLife(prev => prev + life);
                setMessage(`相手が${cardToPlay.name}をプレイ！${life}ライフ回復しました！`);
              } else {
                // ライフが十分な場合はカードを捨てる
                setMessage(`相手は${cardToPlay.name}をプレイしましたが、効果はありませんでした`);
              }
            }
          }
          
          setOpponentCurrentMana(prev => prev - cardToPlay.manaCost);
          setNpcThinking(false);
          return;
        }
      }
      
      // 3. 攻撃フェーズの処理
      if (currentPhase === 'declare_attackers') {
        // 攻撃可能なクリーチャー（タップされておらず、召喚酔いでない）
        const attackableCreatures = opponentPlayedCards.filter(card => 
          !card.isTapped && card.canAttack && !card.summoningSickness
        );
        
        if (attackableCreatures.length > 0) {
          // 戦略的に攻撃するかどうかを決定
          // 例: 相手のライフが低い、または自分に有利な場面でのみ攻撃
          const shouldAttack = yourLife <= 10 || 
                             attackableCreatures.length > yourPlayedCards.length ||
                             attackableCreatures.some(c => c.attack > 3);
          
          if (shouldAttack) {
            // 攻撃するクリーチャーを選択（戦略的に）
            const attackers = attackableCreatures
              .sort((a, b) => (b.attack + b.defense) - (a.attack + a.defense)) // 強いクリーチャーから
              .slice(0, 3); // 最大3体まで攻撃
            
            const newAttackingCreatures = attackers.map(card => ({
              attackerId: card.id,
              target: 'player' // とりあえずプレイヤーに直接攻撃
            }));
            
            setAttackingCreatures(newAttackingCreatures);
            
            // 攻撃したクリーチャーをタップ
            setOpponentPlayedCards(prev => 
              prev.map(card => 
                attackers.some(ac => ac.id === card.id)
                  ? { ...card, isTapped: true }
                  : card
              )
            );
            
            setMessage(`相手が${attackers.length}体のクリーチャーで攻撃してきました！`);
            setNpcThinking(false);
            return;
          } else {
            setMessage('相手は攻撃を見送りました');
          }
        } else {
          setMessage('相手は攻撃できるクリーチャーがいません');
        }
      }
      
      // 4. ブロックフェーズの処理（プレイヤーが攻撃してきた場合）
      if (currentPhase === 'declare_blockers' && attackingCreatures.length > 0) {
        // ブロック可能なクリーチャー（タップされていない）
        const blockableCreatures = opponentPlayedCards.filter(card => !card.isTapped);
        
        if (blockableCreatures.length > 0) {
          const newBlockingAssignments = { ...blockingAssignments };
          let hasBlocked = false;
          
          // 各攻撃クリーチャーに対してブロッカーを割り当て
          attackingCreatures.forEach(attacker => {
            const attackerCard = yourPlayedCards.find(c => c.id === attacker.attackerId);
            if (!attackerCard) return;
            
            // 最も効率的なブロッカーを選択（攻撃力が近いもの、または倒せるもの）
            const bestBlocker = blockableCreatures
              .filter(blocker => !newBlockingAssignments[attacker.attackerId]?.includes(blocker.id))
              .sort((a, b) => {
                // 攻撃を確実にブロックできるかどうか
                const aCanKill = a.attack >= attackerCard.defense;
                const bCanKill = b.attack >= attackerCard.defense;
                if (aCanKill !== bCanKill) return aCanKill ? -1 : 1;
                
                // ダメージの与えられる量でソート
                return (b.attack - a.attack) || ((b.defense - attackerCard.attack) - (a.defense - attackerCard.attack));
              })[0];
            
            if (bestBlocker) {
              if (!newBlockingAssignments[attacker.attackerId]) {
                newBlockingAssignments[attacker.attackerId] = [];
              }
              newBlockingAssignments[attacker.attackerId].push(bestBlocker.id);
              hasBlocked = true;
              
              // ブロッカーをタップ
              setOpponentPlayedCards(prev => 
                prev.map(card => 
                  card.id === bestBlocker.id 
                    ? { ...card, isTapped: true }
                    : card
                )
              );
            }
          });
          
          if (hasBlocked) {
            setBlockingAssignments(newBlockingAssignments);
            setMessage('相手がブロックを宣言しました！');
            setNpcThinking(false);
            return;
          }
        }
      }
      
      // 5. ターン終了
      handleEndTurn();
      setNpcThinking(false);
    }, thinkTime);
  }, [isYourTurn, gameMode, npcThinking, opponentCurrentMana, opponentHand, opponentPlayedCards, currentPhase, opponentManaZone, opponentMaxMana, setAttackingCreatures, setNpcThinking, setOpponentCurrentMana, setOpponentHand, setOpponentLife, setOpponentManaZone, setOpponentPlayedCards, setYourLife, setMessage, handleEndTurn]);
  
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
  }, [isYourTurn, currentPhase, gameMode, gameStarted, makeNPCDecision]);
  
  const startSoloGame = () => {
    console.log('Starting solo game...');
    setGameMode('solo');
    setMessage('ソロモードを準備中...');

    // Initialize decks
    const playerInitialDeck = shuffle([...sampleCards, ...sampleCards, ...sampleCards]); // 3 copies of each card
    const opponentInitialDeck = shuffle([...sampleCards, ...sampleCards, ...sampleCards]);

    setPlayerDeck(playerInitialDeck);
    setOpponentDeck(opponentInitialDeck);

    // Draw initial hands (e.g., 5 cards)
    const initialPlayerHand = [];
    const initialOpponentHand = [];
    for (let i = 0; i < 5; i++) {
      if (playerInitialDeck.length > 0) initialPlayerHand.push(playerInitialDeck.pop());
      if (opponentInitialDeck.length > 0) initialOpponentHand.push(opponentInitialDeck.pop());
    }
    setPlayerHand(initialPlayerHand);
    setOpponentHand(initialOpponentHand);

    // Set initial life
    setYourLife(20);
    setOpponentLife(20);

    // Set initial mana
    setYourMaxMana(0);
    setYourCurrentMana(0);
    setOpponentMaxMana(0);
    setOpponentCurrentMana(0);

    // Clear played cards and graveyards
    setYourPlayedCards([]);
    setOpponentPlayedCards([]);
    setPlayerGraveyard([]);
    setOpponentGraveyard([]);
    setYourManaZone([]);
    setOpponentManaZone([]);

    // Reset attack/block states
    setAttackingCreatures([]);
    setBlockingAssignments({});
    setSelectedAttackers(new Map());
    setSelectedBlocker(null);
    setSelectedTarget(null);
    setTempSelectedBlocker(null);

    // Set initial turn and phase
    setIsYourTurn(true); // Player goes first
    setCurrentPhase('main_phase_1');

    setGameStarted(true);
    setMessage('ソロモードでゲームを開始します。あなたのターンです。');
  };

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
      if (nextTurn) { // Player's turn is starting
        setYourMaxMana(prev => prev + 1);
        setYourCurrentMana(yourMaxMana + 1); // Use updated max mana
        setMessage('あなたのターンです');

        // Draw a card for the player
        setPlayerDeck(prevDeck => {
          if (prevDeck.length > 0) {
            const newHand = [...playerHand, prevDeck.pop()];
            setPlayerHand(newHand);
          } else {
            // Handle deck out (loss condition)
            setMessage('デッキがなくなりました。あなたの負けです！');
            setGameStarted(false); // End game
          }
          return prevDeck;
        });

        // Untap all player's cards
        setYourPlayedCards(prev =>
          prev.map(card => ({
            ...card,
            isTapped: false,
            canAttack: true // Reset attack status
          }))
        );
      } else { // Opponent's turn is starting
        setOpponentMaxMana(prev => prev + 1);
        setOpponentCurrentMana(opponentMaxMana + 1); // Use updated max mana
        setMessage('相手のターンです');

        // Draw a card for the opponent
        setOpponentDeck(prevDeck => {
          if (prevDeck.length > 0) {
            const newHand = [...opponentHand, prevDeck.pop()];
            setOpponentHand(newHand);
          }
          return prevDeck;
        });

        // Untap all opponent's cards
        setOpponentPlayedCards(prev =>
          prev.map(card => ({
            ...card,
            isTapped: false,
            canAttack: true // Reset attack status
          }))
        );

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
    // 自分のターンかどうかで処理を分岐
    if (gameMode === 'online') {
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
      }
    } else if (gameMode === 'solo') {
      // In solo mode, handle phase changes locally
      const phases = ['main_phase_1', 'declare_attackers', 'declare_blockers', 'main_phase_2', 'end_phase'];
      const currentIndex = phases.indexOf(currentPhase);
      if (currentIndex < phases.length - 1) {
        const nextPhase = phases[currentIndex + 1];
        setCurrentPhase(nextPhase);
        
        // Combat resolution phase
        if (nextPhase === 'main_phase_2') {
          let newYourLife = yourLife;
          let newOpponentLife = opponentLife;
          let newYourPlayedCards = [...yourPlayedCards];
          let newOpponentPlayedCards = [...opponentPlayedCards];
          let newPlayerGraveyard = [...playerGraveyard];
          let newOpponentGraveyard = [...opponentGraveyard];

          attackingCreatures.forEach(attacker => {
            const attackingCard = (isYourTurn ? yourPlayedCards : opponentPlayedCards).find(c => c.id === attacker.attackerId);
            if (!attackingCard) return;

            const blockers = blockingAssignments[attacker.attackerId] || [];
            let totalBlockerDefense = 0;
            let totalBlockerAttack = 0;

            blockers.forEach(blockerId => {
              const blockingCard = (isYourTurn ? opponentPlayedCards : yourPlayedCards).find(c => c.id === blockerId);
              if (blockingCard) {
                totalBlockerDefense += blockingCard.defense || 0;
                totalBlockerAttack += blockingCard.attack || 0;
              }
            });

            // Attacker deals damage to blockers
            blockers.forEach(blockerId => {
              const blockingCardIndex = (isYourTurn ? opponentPlayedCards : yourPlayedCards).findIndex(c => c.id === blockerId);
              if (blockingCardIndex !== -1) {
                const blockingCard = (isYourTurn ? opponentPlayedCards : yourPlayedCards)[blockingCardIndex];
                const remainingDefense = (blockingCard.defense || 0) - attackingCard.attack;
                if (remainingDefense <= 0) {
                  // Blocker is defeated
                  if (isYourTurn) {
                    newOpponentGraveyard.push(blockingCard);
                    newOpponentPlayedCards.splice(blockingCardIndex, 1);
                  } else {
                    newPlayerGraveyard.push(blockingCard);
                    newYourPlayedCards.splice(blockingCardIndex, 1);
                  }
                } else {
                  if (isYourTurn) {
                    newOpponentPlayedCards[blockingCardIndex] = { ...blockingCard, defense: remainingDefense };
                  } else {
                    newYourPlayedCards[blockingCardIndex] = { ...blockingCard, defense: remainingDefense };
                  }
                }
              }
            });

            // Blockers deal damage to attacker
            const attackingCardIndex = (isYourTurn ? yourPlayedCards : opponentPlayedCards).findIndex(c => c.id === attacker.attackerId);
            if (attackingCardIndex !== -1) {
              const currentAttacker = (isYourTurn ? newYourPlayedCards : newOpponentPlayedCards)[attackingCardIndex];
              const remainingDefense = (currentAttacker.defense || 0) - totalBlockerAttack;
              if (remainingDefense <= 0) {
                // Attacker is defeated
                if (isYourTurn) {
                  newPlayerGraveyard.push(currentAttacker);
                  newYourPlayedCards.splice(attackingCardIndex, 1);
                } else {
                  newOpponentGraveyard.push(currentAttacker);
                  newOpponentPlayedCards.splice(attackingCardIndex, 1);
                }
              } else {
                if (isYourTurn) {
                  newYourPlayedCards[attackingCardIndex] = { ...currentAttacker, defense: remainingDefense };
                } else {
                  newOpponentPlayedCards[attackingCardIndex] = { ...currentAttacker, defense: remainingDefense };
                }
              }
            }

            // Unblocked damage to player/opponent life
            if (blockers.length === 0) {
              if (attacker.target === 'player') {
                newYourLife -= attackingCard.attack;
              } else if (attacker.target === 'opponent') {
                newOpponentLife -= attackingCard.attack;
              }
            }
          });

          setYourLife(newYourLife);
          setOpponentLife(newOpponentLife);
          setYourPlayedCards(newYourPlayedCards);
          setOpponentPlayedCards(newOpponentPlayedCards);
          setPlayerGraveyard(newPlayerGraveyard);
          setOpponentGraveyard(newOpponentGraveyard);

          // Check for win/loss conditions
          if (newYourLife <= 0) {
            setMessage('あなたのライフが0になりました。あなたの負けです！');
            setGameStarted(false);
          } else if (newOpponentLife <= 0) {
            setMessage('相手のライフが0になりました。あなたの勝ちです！');
            setGameStarted(false);
          }
        }
        
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

      // --- Solo Mode Card Play and Attack/Block Logic ---
      if (gameMode === 'solo' && isYourTurn) {
        // Play a card from hand
        if ((currentPhase === 'main_phase_1' || currentPhase === 'main_phase_2') && 
            playerHand.some(c => c.id === card.id)) {
          
          const cardToPlay = playerHand.find(c => c.id === card.id);

          if (cardToPlay.type === 'mana') {
            if (yourManaZone.length < yourMaxMana + 1) { // Limit mana zone size
              setPlayerHand(prev => prev.filter(c => c.id !== cardToPlay.id));
              setYourManaZone(prev => [...prev, cardToPlay]);
              setYourCurrentMana(prev => prev + 1); // Mana crystal adds 1 mana
              setMessage(`あなたが${cardToPlay.name}をプレイ！`);
            } else {
              setMessage('これ以上マナを置けません。');
            }
          } else if (cardToPlay.manaCost <= yourCurrentMana) {
            setPlayerHand(prev => prev.filter(c => c.id !== cardToPlay.id));
            setYourCurrentMana(prev => prev - cardToPlay.manaCost);

            if (cardToPlay.type === 'creature') {
              setYourPlayedCards(prev => [
                ...prev, 
                { ...cardToPlay, isTapped: false, canAttack: true }
              ]);
              setMessage(`あなたが${cardToPlay.name}をプレイ！`);
            } else if (cardToPlay.type === 'spell') {
              // Handle spell effects for player
              if (cardToPlay.effect.includes('damage')) {
                const damage = parseInt(cardToPlay.effect.match(/\d+/)[0]);
                setOpponentLife(prev => Math.max(0, prev - damage));
                setMessage(`あなたが${cardToPlay.name}をプレイ！相手に${damage}ダメージ！`);
              } else if (cardToPlay.effect.includes('life')) {
                const life = parseInt(cardToPlay.effect.match(/\d+/)[0]);
                setYourLife(prev => prev + life);
                setMessage(`あなたが${cardToPlay.name}をプレイ！${life}ライフ回復！`);
              }
              setPlayerGraveyard(prev => [...prev, cardToPlay]);
            }
          } else {
            setMessage('マナが足りません。');
          }
          return;
        }

        // Handle attacking in solo mode
        if (currentPhase === 'declare_attackers') {
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
      }

      // Handle blocking in solo mode
      if (gameMode === 'solo' && !isYourTurn && currentPhase === 'declare_blockers') {
        const opponentAttacker = attackingCreatures.find(a => a.attackerId === card.id);
        const myBlocker = yourPlayedCards.find(c => c.id === card.id && !c.isTapped);

        if (opponentAttacker) {
          setSelectedTarget(card.id);
          setTempSelectedBlocker(null);
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
          if (!newAssignments[selectedTarget].includes(myBlocker.id)) {
            newAssignments[selectedTarget].push(myBlocker.id);
          }
          setBlockingAssignments(newAssignments);
          setYourPlayedCards(prev => 
            prev.map(c => c.id === myBlocker.id ? { ...c, isTapped: true } : c)
          );
          setSelectedTarget(null);
          setTempSelectedBlocker(null);
        }
        return;
      }
    }
  };

  const [{ isOverYourMana }, dropYourMana] = useDrop(() => ({
    accept: ItemTypes.CARD,
    drop: (item) => {
      if (gameMode === 'solo' && isYourTurn) {
        handleCardAction(item, 'click'); // Simulate click action for mana drop
      } else if (gameMode === 'online') {
        socket.emit('play_card', item.id, 'mana');
      }
    },
    collect: (monitor) => ({ isOverYourMana: !!monitor.isOver() }),
  }));

  const [{ isOverYourField }, dropYourField] = useDrop(() => ({
    accept: ItemTypes.CARD,
    drop: (item) => {
      if (gameMode === 'solo' && isYourTurn) {
        handleCardAction(item, 'click'); // Simulate click action for field drop
      } else if (gameMode === 'online') {
        socket.emit('play_card', item.id, 'field');
      }
    },
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
            <p>Opponent's Deck Size: {opponentDeck.length}</p>
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
              <p>Your Deck Size: {playerDeck.length}</p>
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