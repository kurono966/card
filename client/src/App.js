import React, { useEffect, useState, useRef } from 'react';
import io from 'socket.io-client';
import { DndProvider, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

import Card from './components/Card';
// import Deck from './components/Deck';
// import Hand from './components/Hand';
import CardDetail from './components/CardDetail'; // CardDetailをインポート

import styles from './App.module.css'; // CSS Modulesをインポート

const socket = io('http://localhost:3001/');

const ItemTypes = {
  CARD: 'card',
};

const App = () => { // Added comment to force re-compilation
  const [message, setMessage] = useState('Loading game...'); // 初期メッセージを変更
  const [yourHand, setYourHand] = useState([]);
  // const [yourDeckSize, setYourDeckSize] = useState(0);
  const [yourPlayedCards, setYourPlayedCards] = useState([]);
  const [yourManaZone, setYourManaZone] = useState([]);
  const [yourMaxMana, setYourMaxMana] = useState(0);
  const [yourCurrentMana, setYourCurrentMana] = useState(0);
  const [yourLife, setYourLife] = useState(20); // ライフポイントを追加

  const [opponentPlayedCards, setOpponentPlayedCards] = useState([]);
  const [opponentManaZone, setOpponentManaZone] = useState([]);
  const [opponentDeckSize, setOpponentDeckSize] = useState(0);
  const [opponentMaxMana, setOpponentMaxMana] = useState(0);
  const [opponentCurrentMana, setOpponentCurrentMana] = useState(0);
  const [opponentLife, setOpponentLife] = useState(20); // 相手のライフポイントを追加

  const [isYourTurn, setIsYourTurn] = useState(false);
  const [selectedCardDetail, setSelectedCardDetail] = useState(null); // 選択されたカードの詳細
  const [effectMessage, setEffectMessage] = useState(null); // 効果メッセージ
  const [currentPhase, setCurrentPhase] = useState('main_phase_1'); // 現在のゲームフェーズ
  const [attackingCreatures, setAttackingCreatures] = useState([]); // 攻撃クリーチャーのリスト
  const [blockingAssignments, setBlockingAssignments] = useState({}); // ブロックの割り当て
  const [selectedBlockerCardId, setSelectedBlockerCardId] = useState(null); // 選択されたブロッカーカードのID

  // isYourTurn の最新の値を useRef で保持
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

    socket.on('connect_error', (error) => { // 接続エラーハンドリングを追加
      console.error('Socket connection error:', error);
      setMessage(`Connection error: ${error.message}. Retrying...`);
    });

    socket.on('game_state', (state) => {
      console.log('[App.js] Received game state:', state); // デバッグログを追加
      setYourHand(state.yourHand || []); // デフォルト値を設定
      setYourPlayedCards(state.yourPlayedCards || []); // デフォルト値を設定
      setYourManaZone(state.yourManaZone || []); // デフォルト値を設定
      setYourMaxMana(state.yourMaxMana); // 元に戻す
      setYourCurrentMana(state.yourCurrentMana); // 元に戻す

      setOpponentPlayedCards(state.opponentPlayedCards || []); // デフォルト値を設定
      setOpponentManaZone(state.opponentManaZone || []); // デフォルト値を設定
      setOpponentDeckSize(state.opponentDeckSize);
      setOpponentMaxMana(state.opponentMaxMana);
      setOpponentCurrentMana(state.opponentCurrentMana);
      setYourLife(state.yourLife);
      setOpponentLife(state.opponentLife);

      setIsYourTurn(state.isYourTurn);
      setCurrentPhase(state.currentPhase); // 新しいフェーズ状態を追加
      setAttackingCreatures(state.attackingCreatures || []); // 攻撃クリーチャーの情報を追加
      setBlockingAssignments(state.blockingAssignments || {}); // ブロックの割り当て情報を追加
    });

    socket.on('effect_triggered', (message) => {
      setEffectMessage(message);
      setTimeout(() => setEffectMessage(null), 3000); // 3秒後にメッセージを消す
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('connect_error'); // クリーンアップを追加
      socket.off('game_state');
      socket.off('effect_triggered');
    };
  }, []);

  const handlePlayCard = (cardId) => {
    // ドラッグ＆ドロップで処理するため、この関数は直接は使われない
    console.log('Card clicked (should not happen with D&D):', cardId);
  };

  const handleNextPhase = () => {
    if (isYourTurnRef.current) { // useRef の値を使用
      socket.emit('next_phase');
    } else {
      alert("It's not your turn!");
    }
  };

  // カード詳細表示のハンドラ
  const handleCardAction = (card, actionType) => {
    if (actionType === 'hover') {
      // デスクトップでのマウスオーバー時
      if (window.innerWidth > 768) { // 例: 画面幅が768pxより大きい場合のみホバーで表示
        setSelectedCardDetail(card);
      }
    } else if (actionType === 'leave') {
      // デスクトップでのマウスが離れた時
      if (window.innerWidth > 768) {
        setSelectedCardDetail(null);
      }
    } else if (actionType === 'click') {
      // モバイルでのタップ時、またはデスクトップでのクリック時
      setSelectedCardDetail(card);
    } else if (actionType === 'attack') {
      // 攻撃ボタンが押された時
      if (isYourTurnRef.current && currentPhase === 'declare_attackers') {
        // 攻撃クリーチャーの選択
        if (!card.isTapped) {
          const newAttackingCreatures = [...attackingCreatures];
          const existingAttackerIndex = newAttackingCreatures.findIndex(a => a.attackerId === card.id);

          if (existingAttackerIndex === -1) {
            // 新しい攻撃クリーチャーを追加
            newAttackingCreatures.push({ attackerId: card.id, targetId: 'player' }); // デフォルトでプレイヤーを攻撃対象とする
            console.log(`[App.js] Attacker selected: ${card.id}`);
          } else {
            // 既存の攻撃クリーチャーを解除
            newAttackingCreatures.splice(existingAttackerIndex, 1);
            console.log(`[App.js] Attacker deselected: ${card.id}`);
          }
          
          // サーバーに攻撃宣言を送信
          const attackerIds = newAttackingCreatures.map(attacker => attacker.attackerId);
          socket.emit('declare_attackers', attackerIds);
          
          // ローカルの状態を更新
          setAttackingCreatures(newAttackingCreatures);
        } else {
          alert("Tapped creatures cannot attack!");
        }
      } else {
        alert("It's not your turn or not in the correct phase to declare attackers!");
      }
    } else if (actionType === 'block') {
      // ブロックボタンが押された時
      if (!isYourTurnRef.current && currentPhase === 'declare_blockers') {
        // ブロッカーの選択
        if (!card.isTapped) { // ブロッカーもタップ状態でないことを確認
          setSelectedBlockerCardId(card.id);
          console.log(`[App.js] Blocker selected: ${card.id}`);
        } else {
          alert("Tapped creatures cannot block!");
        }
      } else {
        alert("It's your turn or not in the correct phase to declare blockers!");
      }
    }
  };

  const handleTargetClick = (targetId) => {
    if (currentPhase === 'declare_attackers' && selectedAttackerCardId) {
      // 攻撃対象の変更（今回はプレイヤーのみなので不要だが、将来的にカードを攻撃対象にする場合）
      // socket.emit('attack_card', selectedAttackerCardId, targetId);
      // setSelectedAttackerCardId(null);
    } else if (currentPhase === 'declare_blockers' && selectedBlockerCardId) {
      // ブロックの割り当て
      const newBlockingAssignments = { ...blockingAssignments };
      
      // 既存のブロック割り当てをクリア（1つのブロッカーは1つのアタッカーしかブロックできない）
      Object.keys(newBlockingAssignments).forEach(attackerId => {
        newBlockingAssignments[attackerId] = newBlockingAssignments[attackerId].filter(
          blockerId => blockerId !== selectedBlockerCardId
        );
      });
      
      // 新しいブロック割り当てを追加
      if (!newBlockingAssignments[targetId]) {
        newBlockingAssignments[targetId] = [];
      }
      
      // 同じブロッカーが同じ攻撃クリーチャーを複数回ブロックできないようにする
      if (!newBlockingAssignments[targetId].includes(selectedBlockerCardId)) {
        newBlockingAssignments[targetId].push(selectedBlockerCardId);
        
        // ブロックの確定をサーバーに送信
        socket.emit('declare_blockers', newBlockingAssignments);
        
        setBlockingAssignments(newBlockingAssignments);
        setSelectedBlockerCardId(null);
        
        // 効果音やアニメーションを再生する場合はここで
        console.log(`[App.js] Blocker ${selectedBlockerCardId} assigned to ${targetId}`);
        
        // ブロックされたことをユーザーに通知
        const blockerCard = yourPlayedCards.find(c => c.id === selectedBlockerCardId);
        const attackerCard = opponentPlayedCards.find(c => c.id === targetId);
        
        if (blockerCard && attackerCard) {
          setEffectMessage(`${blockerCard.name} が ${attackerCard.name} をブロックしました！`);
          setTimeout(() => setEffectMessage(null), 2000);
        }
      } else {
        alert("このユニットはすでにこの攻撃をブロックしています！");
      }
    } else {
      console.log('[App.js] Not in correct phase or no card selected for action.');
    }
  };

  // 自分のマナゾーンへのドロップターゲット
  const [{ isOverYourMana }, dropYourMana] = useDrop(() => ({
    accept: ItemTypes.CARD,
    drop: (item, monitor) => {
      console.log('Card dropped on Your Mana Zone:', item.id);
      if (!isYourTurnRef.current) {
        alert("It's not your turn!");
        return;
      }
      socket.emit('play_card', item.id, 'mana');
    },
    collect: (monitor) => ({
      isOverYourMana: !!monitor.isOver(),
    }),
  }));

  // 自分のフィールドへのドロップターゲット
  const [{ isOverYourField }, dropYourField] = useDrop(() => ({
    accept: ItemTypes.CARD,
    drop: (item, monitor) => {
      console.log('Card dropped on Your Field:', item.id);
      if (!isYourTurnRef.current) {
        alert("It's not your turn!");
        return;
      }
      socket.emit('play_card', item.id, 'field');
    },
    collect: (monitor) => ({
      isOverYourField: !!monitor.isOver(),
    }),
  }));

  // 相手のマナゾーンへのドロップターゲット
  const [{ isOverOpponentMana }, dropOpponentMana] = useDrop(() => ({
    accept: ItemTypes.CARD,
    drop: (item, monitor) => {
      console.log('Card dropped on Opponent Mana Zone:', item.id);
      // 相手のゾーンにはドロップできないようにする
      alert("You cannot play cards to opponent's mana zone!");
    },
    collect: (monitor) => ({
      isOverOpponentMana: !!monitor.isOver(),
    }),
  }));

  // 相手のフィールドへのドロップターゲット
  const [{ isOverOpponentField }, dropOpponentField] = useDrop(() => ({
    accept: ItemTypes.CARD,
    drop: (item, monitor) => {
      console.log('Card dropped on Opponent Field:', item.id);
      // 相手のゾーンにはドロップできないようにする
      alert("You cannot play cards to opponent's field!");
    },
    collect: (monitor) => ({
      isOverOpponentField: !!monitor.isOver(),
    })
  }));

  // ゲームの状態を表示する関数
  function renderGameInfo() {
    // 現在のフェーズに応じたメッセージを設定
    let phaseMessage = `Current Phase: ${currentPhase}`;
    if (currentPhase === 'declare_attackers' && isYourTurn) {
      phaseMessage = '攻撃クリーチャーを選択してください';
    } else if (currentPhase === 'declare_blockers' && !isYourTurn) {
      phaseMessage = 'ブロッカーを選択してください';
    }

    return (
      <div className="game-info">
        <div>Your Life: {yourLife}</div>
        <div>Opponent's Life: {opponentLife}</div>
        <div className={`phase-message ${isYourTurn ? 'your-turn' : 'opponent-turn'}`}>
          {phaseMessage}
        </div>
        {isYourTurn && (
          <button
            onClick={handleNextPhase}
            className="next-phase-button"
            disabled={currentPhase === 'declare_blockers' && !isYourTurn}
          >
            {currentPhase === 'declare_attackers' ? '攻撃宣言を確定' : '次のフェーズへ'}
          </button>
        )}
        {effectMessage && (
          <div className="effect-message">
            {effectMessage}
          </div>
        )}
      </div>
    );
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className={styles.appContainer}>
        <style jsx global>{`
          .selectable-blocker {
            box-shadow: 0 0 10px 5px rgba(0, 255, 0, 0.5);
            transform: translateY(-5px);
            transition: all 0.2s ease;
          }
          
          .selectable-attacker {
            box-shadow: 0 0 10px 5px rgba(255, 0, 0, 0.5);
            transform: translateY(-5px);
            transition: all 0.2s ease;
          }
          
          .card-container {
            position: relative;
            transition: all 0.2s ease;
            margin: 5px;
          }
          
          .card-container:hover {
            transform: translateY(-5px);
          }
          
          .game-info {
            position: fixed;
            bottom: 20px;
            left: 20px;
            background: rgba(0, 0, 0, 0.7);
            color: white;
            padding: 10px;
            border-radius: 5px;
            z-index: 100;
          }
          
          .phase-message {
            margin: 10px 0;
            font-weight: bold;
          }
          
          .your-turn {
            color: #4caf50;
          }
          
          .opponent-turn {
            color: #f44336;
          }
          
          .next-phase-button {
            background: #4caf50;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-weight: bold;
          }
          
          .next-phase-button:disabled {
            background: #cccccc;
            cursor: not-allowed;
          }
          
          @keyframes fadeInOut {
            0% { opacity: 0; transform: translate(-50%, -20px); }
            10% { opacity: 1; transform: translate(-50%, 0); }
            90% { opacity: 1; transform: translate(-50%, 0); }
            100% { opacity: 0; transform: translate(-50%, -20px); }
          }
        `}</style>
        <h1 className={styles.messageHeader}>{message}</h1>
        <h2 className={styles.turnHeader}>
          {isYourTurn ? 'Your Turn' : "Opponent's Turn"}
        </h2>
        <h3 className={styles.phaseHeader}>
          Phase: {currentPhase.replace(/_/g, ' ').toUpperCase()}
        </h3>

        <div className={styles.gameArea}>
          {/* 相手のエリア */}
          <div className={styles.opponentArea}>
            <h3>Opponent's Area</h3>
            
            <p>Opponent's Deck Size: {opponentDeckSize}</p>
            <p>Opponent's Mana: {opponentCurrentMana} / {opponentMaxMana}</p>
            
            <div className={styles.opponentFieldManaContainer}>
              <h4>Opponent's Played Cards:</h4>
              <div
                ref={dropOpponentField}
                className={`${styles.playedCardsArea} ${isOverOpponentField ? styles.playedCardsAreaOver : ''}`}
              >
                {opponentPlayedCards.length === 0 ? (
                  <p className={styles.emptyZoneText}>No cards played by opponent.</p>
                ) : (
                  opponentPlayedCards.map(card => renderCard(card, card.id, true, true))
                )}
              </div>
              
              <div className={styles.opponentManaZoneContainer}>
                <h4>Opponent's Mana Zone:</h4>
                <div
                  ref={dropOpponentMana}
                  className={`${styles.manaZone} ${isOverOpponentMana ? styles.manaZoneOver : ''}`}
                >
                  {opponentManaZone.length === 0 ? (
                    <p className={styles.emptyZoneText}>Empty</p>
                  ) : (
                    opponentManaZone.map(card => (
                      <Card
                        key={card.id}
                        value={card.value}
                        manaCost={card.manaCost}
                        imageUrl={card.imageUrl}
                        name={card.name}
                        effect={card.effect}
                        description={card.description}
                        attack={card.attack}
                        defense={card.defense}
                        onCardAction={handleCardAction}
                      />
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 自分のエリア */}
          <div className={styles.yourArea}>
            <h3>Your Area</h3>
            <p>Your Life: {yourLife}</p>
            
            <h4>Your Played Cards:</h4>
            <div
              ref={dropYourField}
              className={`${styles.playedCardsArea} ${isOverYourField ? styles.playedCardsAreaOver : ''}`}
            >
              {yourPlayedCards.length === 0 ? (
                <p className={styles.emptyZoneText}>No cards played by you.</p>
              ) : (
                yourPlayedCards.map(card => renderCard(card, card.id, true, false))
              )}
            </div>

            {/* マナゾーンと手札を横並びにするコンテナ */}
            <div className={styles.manaHandContainer}>
              {/* 自分のマナゾーンを手札の左に配置 */}
              <div className={styles.manaZoneContainer}>
                <p>Your Mana: {yourCurrentMana} / {yourMaxMana}</p>
                <h4>Your Mana Zone:</h4>
                <div
                  ref={dropYourMana}
                  className={`${styles.manaZone} ${isOverYourMana ? styles.manaZoneOver : ''}`}
                >
                  {yourManaZone.length === 0 ? (
                    <p className={styles.emptyZoneText}>Empty</p>
                  ) : (
                    yourManaZone.map(card => (
                      <Card key={card.id} value={card.value} manaCost={card.manaCost} imageUrl={card.imageUrl} name={card.name} effect={card.effect} description={card.description} attack={card.attack} defense={card.defense} onCardAction={handleCardAction} />
                    ))
                  )}
                </div>
              </div>

              {/* 自分の手札 */}
              <div className={styles.handContainer}>
                <h3>Your Hand:</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                  {yourHand.map((card, index) => renderCard(card, index))}
                </div>
              </div>
            </div>

            {/* ゲームの状態を表示 */}
            {renderGameInfo()}
          </div>
        </div>
        <h2 className={styles.turnHeader}>
          {isYourTurn ? 'Your Turn' : "Opponent's Turn"}
        </h2>
        <h3 className={styles.phaseHeader}>
          Phase: {currentPhase.replace(/_/g, ' ').toUpperCase()}
        </h3>

        <div className={styles.gameArea}>
          {/* 相手のエリア */}
          <div className={styles.opponentArea}>
            <h3>Opponent's Area</h3>
            
            <p>Opponent's Deck Size: {opponentDeckSize}</p>
            <p>Opponent's Mana: {opponentCurrentMana} / {opponentMaxMana}</p>
            
            <div className={styles.opponentFieldManaContainer}>
              <h4>Opponent's Played Cards:</h4>
              <div
                ref={dropOpponentField}
                className={`${styles.playedCardsArea} ${isOverOpponentField ? styles.playedCardsAreaOver : ''}`}
              >
                {opponentPlayedCards.length === 0 ? (
                  <p className={styles.emptyZoneText}>No cards played by opponent.</p>
                ) : (
                  opponentPlayedCards.map(card => renderCard(card, card.id, true, true))
                )}
              </div>
              
              <div className={styles.opponentManaZoneContainer}>
                <h4>Opponent's Mana Zone:</h4>
                <div
                  ref={dropOpponentMana}
                  className={`${styles.manaZone} ${isOverOpponentMana ? styles.manaZoneOver : ''}`}
                >
                  {opponentManaZone.length === 0 ? (
                    <p className={styles.emptyZoneText}>Empty</p>
                  ) : (
                    opponentManaZone.map(card => (
                      <Card 
                        key={card.id} 
                        value={card.value} 
                        manaCost={card.manaCost} 
                        imageUrl={card.imageUrl} 
                        name={card.name} 
                        effect={card.effect} 
                        description={card.description} 
                        attack={card.attack} 
                        defense={card.defense} 
                        onCardAction={handleCardAction} 
                      />
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 自分のエリア */}
          <div className={styles.yourArea}>
            <h3>Your Area</h3>
            <p>Your Life: {yourLife}</p>
            
            <h4>Your Played Cards:</h4>
            <div
              ref={dropYourField}
              className={`${styles.playedCardsArea} ${isOverYourField ? styles.playedCardsAreaOver : ''}`}
            >
              {yourPlayedCards.length === 0 ? (
                <p className={styles.emptyZoneText}>No cards played by you.</p>
              ) : (
                yourPlayedCards.map(card => renderCard(card, card.id, true, false))
              )}
            </div>

            {/* マナゾーンと手札を横並びにするコンテナ */}
            <div className={styles.manaHandContainer}> 
              {/* 自分のマナゾーンを手札の左に配置 */}
              <div className={styles.manaZoneContainer}> 
                <p>Your Mana: {yourCurrentMana} / {yourMaxMana}</p>
                <h4>Your Mana Zone:</h4>
                <div
                  ref={dropYourMana}
                  className={`${styles.manaZone} ${isOverYourMana ? styles.manaZoneOver : ''}`}
                >
                  {yourManaZone.length === 0 ? (
                    <p className={styles.emptyZoneText}>Empty</p>
                  ) : (
                    yourManaZone.map(card => (
                      <Card 
                        key={card.id} 
                        value={card.value} 
                        manaCost={card.manaCost} 
                        imageUrl={card.imageUrl} 
                        name={card.name} 
                        effect={card.effect} 
                        description={card.description} 
                        attack={card.attack} 
                        defense={card.defense} 
                        onCardAction={handleCardAction} 
                      />
                    ))
                  )}
                </div>
              </div>

              {/* 手札 */}
              <div className={styles.handContainer}>
                <h4>Your Hand:</h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                  {yourHand.map((card, index) => renderCard(card, index, false, false))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ゲームの状態を表示 */}
        {renderGameInfo()}

        {/* カード詳細表示 */}
        {selectedCardDetail && (
          <CardDetail 
            card={selectedCardDetail} 
            onClose={() => setSelectedCardDetail(null)} 
          />
        )}

        {/* エラーメッセージ表示 */}
        {effectMessage && (
          <div style={{
            position: 'fixed',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            padding: '20px',
            borderRadius: '10px',
            zIndex: 1001,
            textAlign: 'center',
            boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
            animation: 'fadeInOut 3s ease-in-out',
            whiteSpace: 'nowrap',
            fontSize: '1.2em',
            fontWeight: 'bold'
          }}>
            {effectMessage}
          </div>
        )}
      </div>
    </DndProvider>
  );
};

export default App;