import React, { useEffect, useState, useRef } from 'react';
import io from 'socket.io-client';
import { DndProvider, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

import Card from './components/Card';
import Deck from './components/Deck';
import Hand from './components/Hand';

import styles from './App.module.css'; // CSS Modulesをインポート

const socket = io('https://neocard-server.onrender.com');

const ItemTypes = {
  CARD: 'card',
};

const App = () => {
  const [message, setMessage] = useState('Connecting...');
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

    socket.on('game_state', (state) => {
      console.log('[App.js] Received game state:', state); // デバッグログを追加
      setYourHand(state.yourHand);
      setYourDeckSize(state.yourDeckSize);
      setYourPlayedCards(state.yourPlayedCards);
      setYourManaZone(state.yourManaZone);
      setYourMaxMana(state.yourMaxMana);
      setYourCurrentMana(state.yourCurrentMana);

      setOpponentPlayedCards(state.opponentPlayedCards);
      setOpponentManaZone(state.opponentManaZone);
      setOpponentDeckSize(state.opponentDeckSize);
      setOpponentMaxMana(state.opponentMaxMana);
      setOpponentCurrentMana(state.opponentCurrentMana);

      setIsYourTurn(state.isYourTurn);
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('game_state');
    };
  }, []);

  const handleDrawCard = () => {
    if (isYourTurnRef.current) { // useRef の値を使用
      socket.emit('draw_card');
    } else {
      alert("It's not your turn!");
    }
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
          {/* 自分のエリアを先に配置 */}
          <div className={styles.yourArea}> {/* クラス名を使用 */}
            <h3>Your Area</h3>
            <Deck onDrawCard={handleDrawCard} />
            <p>Your Deck Size: {yourDeckSize}</p>
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
                  <Card key={card.id} value={card.value} manaCost={card.manaCost} imageUrl={card.imageUrl} />
                ))
              )}
            </div>
            <h3>Your Hand:</h3>
            <Hand cards={yourHand} onPlayCard={handlePlayCard} />
            <h4>Your Played Cards:</h4>
            <div
              ref={dropField} // ドロップターゲットとして設定
              className={`${styles.playedCardsArea} ${isOverField ? styles.playedCardsAreaOver : ''}`} // クラス名を使用
            >
              {yourPlayedCards.length === 0 ? (
                <p className={styles.emptyZoneText}>No cards played by you.</p>
              ) : (
                yourPlayedCards.map(card => (
                  <Card key={card.id} value={card.value} manaCost={card.manaCost} imageUrl={card.imageUrl} />
                ))
              )}
            </div>
            <button onClick={handleEndTurn} className={styles.endTurnButton}> {/* クラス名を使用 */}
              End Turn
            </button>
          </div>

          {/* 相手のエリアを後に配置 */}
          <div style={{ 
            border: '1px solid red',
            padding: '0.5rem',
            display: 'flex',
            flexDirection: 'column',
            width: '48%',
            borderRadius: '8px',
            backgroundColor: '#ffe0e0',
            boxSizing: 'border-box',
          }}>
            <h3>Opponent's Area</h3>
            <p>Opponent's Deck Size: {opponentDeckSize}</p>
            <p>Opponent's Mana: {opponentCurrentMana} / {opponentMaxMana}</p>
            <h4>Opponent's Mana Zone:</h4>
            <div
              ref={dropMana} // ドロップターゲットとして設定
              className={`${styles.manaZone} ${isOverMana ? styles.manaZoneOver : ''}`} // クラス名を使用
            >
              {opponentManaZone.length === 0 ? (
                <p className={styles.emptyZoneText}>Empty</p>
              ) : (
                opponentManaZone.map(card => (
                  <Card key={card.id} value={card.value} manaCost={card.manaCost} imageUrl={card.imageUrl} />
                ))
              )}
            </div>
            <h4>Opponent's Played Cards:</h4>
            <div
              ref={dropField} // ドロップターゲットとして設定
              className={`${styles.playedCardsArea} ${isOverField ? styles.playedCardsAreaOver : ''}`} // クラス名を使用
            >
              {opponentPlayedCards.length === 0 ? (
                <p className={styles.emptyZoneText}>No cards played by opponent.</p>
              ) : (
                opponentPlayedCards.map(card => (
                  <Card key={card.id} value={card.value} manaCost={card.manaCost} imageUrl={card.imageUrl} />
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </DndProvider>
  );
};

export default App;
