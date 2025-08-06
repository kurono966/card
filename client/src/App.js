import React, { useEffect, useState } from 'react';
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
    if (isYourTurn) {
      socket.emit('draw_card');
    } else {
      alert("It's not your turn!");
    }
  };

  const handlePlayCard = (cardId) => {
    // ドラッグ＆ドロップで処理するため、この関数は直接は使われない
    // 必要であれば、カードクリックで何かアクションを起こすために残しておく
    console.log('Card clicked:', cardId);
  };

  const handleEndTurn = () => {
    if (isYourTurn) {
      socket.emit('end_turn');
    } else {
      alert("It's not your turn!");
    }
  };

  // マナゾーンへのドロップターゲット
  const [{ isOverMana }, dropMana] = useDrop(() => ({
    accept: ItemTypes.CARD,
    drop: (item, monitor) => {
      if (isYourTurn) {
        socket.emit('play_card', item.id, 'mana');
      } else {
        alert("It's not your turn!");
      }
    },
    collect: (monitor) => ({
      isOverMana: !!monitor.isOver(),
    }),
  }));

  // フィールドへのドロップターゲット
  const [{ isOverField }, dropField] = useDrop(() => ({
    accept: ItemTypes.CARD,
    drop: (item, monitor) => {
      if (isYourTurn) {
        socket.emit('play_card', item.id, 'field');
      } else {
        alert("It's not your turn!");
      }
    },
    collect: (monitor) => ({
      isOverField: !!monitor.isOver(),
    }),
  }));

  return (
    <DndProvider backend={HTML5Backend}>
      <div style={{ textAlign: 'center', marginTop: '20px' }}>
        <h1>{message}</h1>
        <h2>{isYourTurn ? 'Your Turn' : 'Opponent\'s Turn'}</h2>

        <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'flex-start', width: '90%', margin: '20px auto', border: '2px solid #ccc', padding: '20px', borderRadius: '10px' }}>
          {/* 相手のエリア */}
          <div style={{ border: '1px solid red', padding: '10px', minHeight: '250px', width: '45%', borderRadius: '8px', backgroundColor: '#ffe0e0' }}>
            <h3>Opponent's Area</h3>
            <p>Opponent's Deck Size: {opponentDeckSize}</p>
            <p>Opponent's Mana: {opponentCurrentMana} / {opponentMaxMana}</p>
            <h4>Opponent's Mana Zone:</h4>
            <div
              ref={dropMana} // ドロップターゲットとして設定
              style={{
                display: 'flex', flexWrap: 'wrap', justifyContent: 'center', minHeight: '60px', border: isOverMana ? '2px dashed blue' : '1px dashed #f00', padding: '5px', marginBottom: '10px',
                backgroundColor: isOverMana ? '#e0e0ff' : 'transparent',
              }}
            >
              {opponentManaZone.length === 0 ? (
                <p>Empty</p>
              ) : (
                opponentManaZone.map(card => (
                  <Card key={card.id} value={card.value} manaCost={card.manaCost} />
                ))
              )}
            </div>
            <h4>Opponent\'s Played Cards:</h4>
            <div
              ref={dropField} // ドロップターゲットとして設定
              style={{
                display: 'flex', flexWrap: 'wrap', justifyContent: 'center', minHeight: '130px', border: isOverField ? '2px dashed blue' : '1px dashed #f00', padding: '5px',
                backgroundColor: isOverField ? '#e0e0ff' : 'transparent',
              }}
            >
              {opponentPlayedCards.length === 0 ? (
                <p>No cards played by opponent.</p>
              ) : (
                opponentPlayedCards.map(card => (
                  <Card key={card.id} value={card.value} manaCost={card.manaCost} />
                ))
              )}
            </div>
          </div>

          {/* 自分のエリア */}
          <div style={{ border: '1px solid green', padding: '10px', minHeight: '250px', width: '45%', borderRadius: '8px', backgroundColor: '#e0ffe0' }}>
            <h3>Your Area</h3>
            <Deck onDrawCard={handleDrawCard} />
            <p>Your Deck Size: {yourDeckSize}</p>
            <p>Your Mana: {yourCurrentMana} / {yourMaxMana}</p>
            <h4>Your Mana Zone:</h4>
            <div
              ref={dropMana} // ドロップターゲットとして設定
              style={{
                display: 'flex', flexWrap: 'wrap', justifyContent: 'center', minHeight: '60px', border: isOverMana ? '2px dashed blue' : '1px dashed #0f0', padding: '5px', marginBottom: '10px',
                backgroundColor: isOverMana ? '#e0ffe0' : 'transparent',
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
                display: 'flex', flexWrap: 'wrap', justifyContent: 'center', minHeight: '130px', border: isOverField ? '2px dashed blue' : '1px dashed #0f0', padding: '5px',
                backgroundColor: isOverField ? '#e0ffe0' : 'transparent',
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
            <button onClick={handleEndTurn} style={{ padding: '10px 20px', marginTop: '10px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
              End Turn
            </button>
          </div>
        </div>
      </div>
    </DndProvider>
  );
};

export default App;
