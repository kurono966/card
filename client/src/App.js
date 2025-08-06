import React, { useEffect, useState, useRef } from 'react';
import io from 'socket.io-client';
import { DndProvider, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

import Card from './components/Card';
import Deck from './components/Deck';
import Hand from './components/Hand';

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
      <div style={{ 
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        height: '100vh', // 画面の高さに合わせる
        overflow: 'hidden', // スクロールを禁止
        fontSize: '0.9rem', // 全体のフォントサイズを少し小さく
      }}>
        <h1 style={{ margin: '0.2rem 0', fontSize: '1.2rem' }}>{message}</h1>
        <h2 style={{ margin: '0.1rem 0', fontSize: '1rem' }}>{isYourTurn ? 'Your Turn' : 'Opponent\'s Turn'}</h2>

        <div style={{ 
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'stretch', // 高さを揃える
          flexGrow: 1, // 残りのスペースを埋める
          width: '98vw', // 画面幅の98%を使用
          margin: '0 auto',
          border: '2px solid #ccc',
          padding: '0.5rem',
          borderRadius: '10px',
          boxSizing: 'border-box',
        }}>
          {/* 相手のエリア */}
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
              style={{ 
                display: 'flex', flexWrap: 'wrap', justifyContent: 'center', minHeight: '4rem', border: isOverMana ? '2px dashed blue' : '1px dashed #f00', padding: '0.2rem', marginBottom: '0.5rem',
                backgroundColor: isOverMana ? '#e0e0ff' : 'transparent',
                flexShrink: 0, // 縮小しない
              }}
            >
              {opponentManaZone.length === 0 ? (
                <p style={{ fontSize: '0.8rem' }}>Empty</p>
              ) : (
                opponentManaZone.map(card => (
                  <Card key={card.id} value={card.value} manaCost={card.manaCost} />
                ))
              )}
            </div>
            <h4>Opponent's Played Cards:</h4>
            <div
              ref={dropField} // ドロップターゲットとして設定
              style={{ 
                display: 'flex', flexWrap: 'wrap', justifyContent: 'center', minHeight: '8rem', border: isOverField ? '2px dashed blue' : '1px dashed #f00', padding: '0.2rem',
                backgroundColor: isOverField ? '#e0e0ff' : 'transparent',
                flexGrow: 1, // 残りのスペースを埋める
                overflowY: 'auto', // 必要に応じてスクロール
              }}
            >
              {opponentPlayedCards.length === 0 ? (
                <p style={{ fontSize: '0.8rem' }}>No cards played by opponent.</p>
              ) : (
                opponentPlayedCards.map(card => (
                  <Card key={card.id} value={card.value} manaCost={card.manaCost} />
                ))
              )}
            </div>
          </div>

          {/* 自分のエリア */}
          <div style={{ 
            border: '1px solid green',
            padding: '0.5rem',
            display: 'flex',
            flexDirection: 'column',
            width: '48%',
            borderRadius: '8px',
            backgroundColor: '#e0ffe0',
            boxSizing: 'border-box',
          }}>
            <h3>Your Area</h3>
            <Deck onDrawCard={handleDrawCard} />
            <p>Your Deck Size: {yourDeckSize}</p>
            <p>Your Mana: {yourCurrentMana} / {yourMaxMana}</p>
            <h4>Your Mana Zone:</h4>
            <div
              ref={dropMana} // ドロップターゲットとして設定
              style={{ 
                display: 'flex', flexWrap: 'wrap', justifyContent: 'center', minHeight: '4rem', border: isOverMana ? '2px dashed blue' : '1px dashed #0f0', padding: '0.2rem', marginBottom: '0.5rem',
                backgroundColor: isOverMana ? '#e0e0e0' : 'transparent',
                flexShrink: 0, // 縮小しない
              }}
            >
              {yourManaZone.length === 0 ? (
                <p>Empty</p>
              ) : (
                yourManaZone.map(card => (
                  <Card key={card.id} value={card.value} manaCost={card.manaCost} />
                ))
              )}
            </div>
            <h3>Your Hand:</h3>
            <Hand cards={yourHand} onPlayCard={handlePlayCard} />
            <h4>Your Played Cards:</h4>
            <div
              ref={dropField} // ドロップターゲットとして設定
              style={{ 
                display: 'flex', flexWrap: 'wrap', justifyContent: 'center', minHeight: '8rem', border: isOverField ? '2px dashed blue' : '1px dashed #0f0', padding: '0.2rem',
                backgroundColor: isOverField ? '#e0ffe0' : 'transparent',
                flexGrow: 1, // 残りのスペースを埋める
                overflowY: 'auto', // 必要に応じてスクロール
              }}
            >
              {yourPlayedCards.length === 0 ? (
                <p>No cards played by you.</p>
              ) : (
                yourPlayedCards.map(card => (
                  <Card key={card.id} value={card.value} manaCost={card.manaCost} />
                ))
              )}
            </div>
            <button onClick={handleEndTurn} style={{ padding: '0.5rem 1rem', marginTop: '0.5rem', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '0.9rem' }}>
              End Turn
            </button>
          </div>
        </div>
      </div>
    </DndProvider>
  );
};

export default App;
