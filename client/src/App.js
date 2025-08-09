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

  // Handle end of turn in solo mode
  const endTurn = () => {
    if (gameMode === 'solo') {
      if (isYourTurn) {
        // End player's turn, start AI's turn
        setIsYourTurn(false);
        setMessage('相手のターンです...');
        setCurrentPhase('main_phase_1');
        
        // AI takes its turn after a short delay
        setTimeout(aiTurn, 1000);
      } else {
        // End AI's turn, start player's turn
        setIsYourTurn(true);
        setMessage('あなたのターンです');
        setCurrentPhase('main_phase_1');
        
        // Draw a card at the start of player's turn
        if (playerDeckSize > 0) {
          setPlayerDeckSize(prev => prev - 1);
          setPlayerHand(prev => [...prev, getRandomCard()]);
        }
        
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

  // AI turn logic for solo mode
  const aiTurn = () => {
    if (isYourTurn) return; // Don't execute if it's not AI's turn
    
    // AI draws a card at the start of its turn
    if (opponentDeckSize > 0) {
      setOpponentDeckSize(prev => prev - 1);
      setOpponentHand(prev => [...prev, getRandomCard()]);
    }
    
    // Increment max mana (up to 10)
    setOpponentMaxMana(prev => Math.min(prev + 1, 10));
    setOpponentCurrentMana(prev => Math.min(prev + 1, 10));
    
    // AI plays cards if it can
    const playableCards = opponentHand.filter(card => 
      card.manaCost <= opponentCurrentMana
    );
    
    // Sort cards by cost (cheapest first)
    playableCards.sort((a, b) => a.manaCost - b.manaCost);
    
    // Play cards until out of mana or no more playable cards
    let remainingMana = opponentCurrentMana;
    const cardsToPlay = [];
    
    for (const card of playableCards) {
      if (card.manaCost <= remainingMana) {
        cardsToPlay.push(card);
        remainingMana -= card.manaCost;
      }
    }
    
    // Update game state after a short delay for each card played
    if (cardsToPlay.length > 0) {
      let delay = 1000;
      
      cardsToPlay.forEach((card, index) => {
        setTimeout(() => {
          // Remove card from AI's hand
          setOpponentHand(prev => prev.filter(c => c.id !== card.id));
          
          // Add to played cards if it's a creature
          if (card.attack > 0 && card.defense > 0) {
            const cardWithSummoningSickness = {
              ...card,
              canAttack: false, // Summoning sickness
              isTapped: false
            };
            setOpponentPlayedCards(prev => [...prev, cardWithSummoningSickness]);
            setMessage(`相手が${card.name}を召喚しました！`);
            
            // Handle card effects on summon
            if (card.effect === "Deal 2 damage to opponent creature") {
              // Simple AI: target a random player creature if any exist
              if (yourPlayedCards.length > 0) {
                const targetIndex = Math.floor(Math.random() * yourPlayedCards.length);
                const target = yourPlayedCards[targetIndex];
                
                setTimeout(() => {
                  setYourPlayedCards(prev => 
                    prev.map(c => 
                      c.id === target.id 
                        ? { ...c, defense: c.defense - 2 } 
                        : c
                    ).filter(c => c.defense > 0)
                  );
                  setMessage(`相手の${card.name}が${target.name}に2ダメージ与えました！`);
                }, 500);
              }
            }
          } else if (card.effect) {
            // Handle spell effects
            setMessage(`相手が${card.name}を使用しました！`);
            
            if (card.effect === "Draw 1 card") {
              // AI draws a card
              if (opponentDeckSize > 0) {
                setOpponentDeckSize(prev => prev - 1);
                setOpponentHand(prev => [...prev, getRandomCard()]);
              }
            }
          }
          
          // Update AI's mana
          setOpponentCurrentMana(prev => prev - card.manaCost);
          
          // If this is the last card, end AI's turn after a delay
          if (index === cardsToPlay.length - 1) {
            setTimeout(() => {
              // AI attacks with all untapped creatures
              let totalAttack = 0;
              const updatedOpponentPlayedCards = opponentPlayedCards.map(card => {
                if (!card.isTapped) {
                  totalAttack += card.attack;
                  return { ...card, isTapped: true };
                }
                return card;
              });
              
              if (totalAttack > 0) {
                setYourLife(prev => Math.max(0, prev - totalAttack));
                setMessage(`相手が${totalAttack}のダメージを与えました！`);
                setOpponentPlayedCards(updatedOpponentPlayedCards);
              }
              
              // End AI's turn after attacking
              setTimeout(() => endTurn(), 1500);
            }, 1000);
          }
        }, delay);
        
        delay += 1000; // Add delay between card plays
      });
    } else {
      // No cards played, end turn after a delay
      setTimeout(() => {
        // AI still attacks with untapped creatures if possible
        let totalAttack = 0;
        const updatedOpponentPlayedCards = opponentPlayedCards.map(card => {
          if (!card.isTapped) {
            totalAttack += card.attack;
            return { ...card, isTapped: true };
          }
          return card;
        });
        
        if (totalAttack > 0) {
          setYourLife(prev => Math.max(0, prev - totalAttack));
          setMessage(`相手が${totalAttack}のダメージを与えました！`);
          setOpponentPlayedCards(updatedOpponentPlayedCards);
          
          setTimeout(() => endTurn(), 1500);
        } else {
          setMessage('相手は何もせずにターンを終了しました');
          setTimeout(() => endTurn(), 1000);
        }
      }, 1000);
    }
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
  }, []); // Add empty dependency array and closing bracket

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
    } else if (actionType === 'play') {
      // In solo mode, handle card play locally
      if (gameMode === 'solo') {
        if (yourCurrentMana >= card.manaCost) {
          setYourCurrentMana(prev => prev - card.manaCost);
          setPlayerHand(prev => prev.filter(c => c.id !== card.id));
          
          // If it's a creature, add to played cards with summoning sickness
          if (card.attack > 0 && card.defense > 0) {
            setYourPlayedCards(prev => [...prev, { ...card, canAttack: false, isTapped: false }]);
            setMessage(`${card.name}を召喚しました`);
          } else {
            // For non-creature cards, handle their effects immediately
            handleCardEffect(card);
          }
        }
      } else {
        // Online mode: Emit socket event
        socket.emit('play_card', card.id, 'field');
      }
    } else if (actionType === 'tap') {
      // Handle tapping/untapping a card
      if (yourPlayedCards.some(c => c.id === card.id)) {
        setYourPlayedCards(prev => 
          prev.map(c => 
            c.id === card.id 
              ? { ...c, isTapped: !c.isTapped } 
              : c
          )
        );
      }
    } else if (actionType === 'attack') {
      // In solo mode, handle attack locally
      if (gameMode === 'solo') {
        if (isYourTurn && (currentPhase === 'declare_attackers' || currentPhase === 'combat')) {
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
      } else {
        // Online mode: Handle attack declaration
        if (isYourTurn && currentPhase === 'declare_attackers') {
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
      }
    } else if (actionType === 'block') {
      // In solo mode, handle block locally
      if (gameMode === 'solo') {
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
              // Tap the blocking creature
              setYourPlayedCards(prev => 
                prev.map(c => 
                  c.id === card.id ? { ...c, isTapped: true } : c
                )
              );
            }
            setBlockingAssignments(newAssignments);
          }
        }
      } else {
        // Online mode: Handle blocking
        if (!isYourTurn && currentPhase === 'declare_blockers') {
          const opponentAttacker = opponentPlayedCards.find(c => c.id === card.id && attackingCreatures.some(a => a.attackerId === c.id));
          const myBlocker = yourPlayedCards.find(c => c.id === card.id && !c.isTapped);

          if (opponentAttacker) {
            setSelectedTarget(card.id);
            setTempSelectedBlocker(null);
          } else if (myBlocker && selectedTarget) {
            setTempSelectedBlocker(card.id);
          }
        }
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