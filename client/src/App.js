import React, { useEffect, useState, useRef } from 'react';
import io from 'socket.io-client';
import { DndProvider, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

import Card from './components/Card';
import Deck from './components/Deck';
import Hand from './components/Hand';
import CardDetail from './components/CardDetail'; // CardDetailをインポート

import styles from './App.module.css'; // CSS Modulesをインポート

const socket = io('https://neocard-server.onrender.com');

const ItemTypes = {
  CARD: 'card',
};

const App = () => {
  const [message, setMessage] = useState('Loading game...'); // 初期メッセージを変更
  const [yourHand, setYourHand] = useState([]);
  const [yourDeckSize, setYourDeckSize] = useState(0);
  const [yourPlayedCards, setYourPlayedCards] = useState([]);
  const [yourManaZone, setYourManaZone] = useState([]);
  const [yourMaxMana, setYourMaxMana] = useState(0);
  const [yourCurrentMana, setYourCurrentMana] = useState(0);

  const [opponentPlayedCards, setOpponentPlayedCards] = useState([]);
  const [opponentManaZone, setOpponentManaZone] = useState([]);
  const [opponentDeckSize, setOpponentDeckSize] = useState(0);
  const [opponentMaxMana, setOpponentMaxMana] = useState(0);
  const [opponentCurrentMana, setOpponentCurrentMana] = useState(0);

  const [isYourTurn, setIsYourTurn] = useState(false);
  const [selectedCardDetail, setSelectedCardDetail] = useState(null); // 選択されたカードの詳細
  const [effectMessage, setEffectMessage] = useState(null); // 効果メッセージ

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
      setYourDeckSize(state.deckSize);
      setYourPlayedCards(state.yourPlayedCards || []); // デフォルト値を設定
      setYourManaZone(state.manaZone || []); // デフォルト値を設定
      setYourMaxMana(state.maxMana);
      setYourCurrentMana(state.currentMana);

      setOpponentPlayedCards(state.opponentPlayedCards || []); // デフォルト値を設定
      setOpponentManaZone(state.opponentManaZone || []); // デフォルト値を設定
      setOpponentDeckSize(state.opponentDeckSize);
      setOpponentMaxMana(state.opponentMaxMana);
      setOpponentCurrentMana(state.opponentCurrentMana);

      setIsYourTurn(state.isYourTurn);
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

  const handleDrawCard = () => {
    // 自動ドローになったため、この関数は不要
    console.log('Draw Card button clicked (should not happen).');
  };

  const handlePlayCard = (cardId) => {
    // ドラッグ＆ドロップで処理するため、この関数は直接は使われない
    console.log('Card clicked (should not happen with D&D):', cardId);
  };

  const handleEndTurn = () => {
    if (isYourTurnRef.current) { // useRef の値を使用
      socket.emit('end_turn');
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
    }
  };

  // マナゾーンへのドロップターゲット
  const [{ isOverMana }, dropMana] = useDrop(() => ({
    accept: ItemTypes.CARD,
    drop: (item, monitor) => {
      console.log('Card dropped on Mana Zone:', item.id);
      if (!isYourTurnRef.current) { // useRef の値を使用
        alert("It's not your turn!");
        return;
      }
      socket.emit('play_card', item.id, 'mana');
    },
    collect: (monitor) => ({
      isOverMana: !!monitor.isOver(),
    }),
  }));

  // フィールドへのドロップターゲット
  const [{ isOverField }, dropField] = useDrop(() => ({
    accept: ItemTypes.CARD,
    drop: (item, monitor) => {
      console.log('Card dropped on Field:', item.id);
      if (!isYourTurnRef.current) { // useRef の値を使用
        alert("It's not your turn!");
        return;
      }
      socket.emit('play_card', item.id, 'field');
    },
    collect: (monitor) => ({
      isOverField: !!monitor.isOver(),
    }),
  }));

  return (
    <DndProvider backend={HTML5Backend}>
      <div className={styles.appContainer}> {/* クラス名を使用 */}
        <h1 className={styles.messageHeader}>{message}</h1>
        <h2 className={styles.turnHeader}>{isYourTurn ? 'Your Turn' : 'Opponent\'s Turn'}</h2>

        <div className={styles.gameArea}> {/* クラス名を使用 */}
          {/* 相手のエリア */}
          <div className={styles.opponentArea}> {/* クラス名を使用 */}
            <h3>Opponent\'s Area</h3>
            <p>Opponent\'s Deck Size: {opponentDeckSize}</p>
            <p>Opponent\'s Mana: {opponentCurrentMana} / {opponentMaxMana}</p>
            
            <div className={styles.opponentFieldManaContainer}> {/* 新しいコンテナ */}
              <h4>Opponent\'s Played Cards:</h4>
              <div
                ref={dropField} // ドロップターゲットとして設定
                className={`${styles.playedCardsArea} ${isOverField ? styles.playedCardsAreaOver : ''}`} // クラス名を使用
              >
                {opponentPlayedCards.length === 0 ? (
                  <p className={styles.emptyZoneText}>No cards played by opponent.</p>
                ) : (
                  opponentPlayedCards.map(card => (
                    <Card key={card.id} value={card.value} manaCost={card.manaCost} imageUrl={card.imageUrl} name={card.name} onCardAction={handleCardAction} />
                  ))
                )}
              </div>
              
              <div className={styles.opponentManaZoneContainer}> {/* 相手のマナゾーンコンテナ */}
                <h4>Opponent\'s Mana Zone:</h4>
                <div
                  ref={dropMana} // ドロップターゲットとして設定
                  className={`${styles.manaZone} ${isOverMana ? styles.manaZoneOver : ''}`} // クラス名を使用
                >
                  {opponentManaZone.length === 0 ? (
                    <p className={styles.emptyZoneText}>Empty</p>
                  ) : (
                    opponentManaZone.map(card => (
                      <Card key={card.id} value={card.value} manaCost={card.manaCost} imageUrl={card.imageUrl} name={card.name} onCardAction={handleCardAction} />
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 自分のエリア */}
          <div className={styles.yourArea}> {/* クラス名を使用 */}
            <h3>Your Area</h3>
            {/* 自分のフィールドを上部に設置 */}
            <h4>Your Played Cards:</h4>
            <div
              ref={dropField} // ドロップターゲットとして設定
              className={`${styles.playedCardsArea} ${isOverField ? styles.playedCardsAreaOver : ''}`} // クラス名を使用
            >
              {yourPlayedCards.length === 0 ? (
                <p className={styles.emptyZoneText}>No cards played by you.</p>
              ) : (
                yourPlayedCards.map(card => (
                  <Card key={card.id} value={card.value} manaCost={card.manaCost} imageUrl={card.imageUrl} name={card.name} onCardAction={handleCardAction} />
                ))
              )}
            </div>

            {/* マナゾーンと手札を横並びにするコンテナ */}
            <div className={styles.manaHandContainer}> 
              {/* 自分のマナゾーンを手札の左に配置 */}
              <div className={styles.manaZoneContainer}> 
                <p>Your Mana: {yourCurrentMana} / {yourMaxMana}</p>
                <h4>Your Mana Zone:</h4>
                <div
                  ref={dropMana} // ドロップターゲットとして設定
                  className={`${styles.manaZone} ${isOverMana ? styles.manaZoneOver : ''}`} // クラス名を使用
                >
                  {yourManaZone.length === 0 ? (
                    <p className={styles.emptyZoneText}>Empty</p>
                  ) : (
                    yourManaZone.map(card => (
                      <Card key={card.id} value={card.value} manaCost={card.manaCost} imageUrl={card.imageUrl} name={card.name} onCardAction={handleCardAction} />
                    ))
                  )}
                </div>
              </div>

              {/* 自分の手札 */}
              <div className={styles.handContainer}> 
                <h3>Your Hand:</h3>
                <Hand cards={yourHand} onCardAction={handleCardAction} /> {/* onPlayCard を onCardAction に変更 */}
              </div>
            </div>

            {/* デッキとターン終了ボタン */}
            <div className={styles.deckEndTurnContainer}> 
              <Deck /> {/* onDrawCard を削除 */}
              <p>Your Deck Size: {yourDeckSize}</p>
              <button onClick={handleEndTurn} className={styles.endTurnButton}> {/* クラス名を使用 */}
                End Turn
              </button>
            </div>
          </div>
        </div>
      </div>
      {selectedCardDetail && <CardDetail card={selectedCardDetail} onClose={() => setSelectedCardDetail(null)} />}
      {effectMessage && (
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          color: 'white',
          padding: '20px',
          borderRadius: '10px',
          zIndex: 1001,
          fontSize: '1.5rem',
          fontWeight: 'bold',
        }}>
          {effectMessage}
        </div>
      )}
    </DndProvider>
  );
};

export default App;
