import React, { useEffect, useState } from 'react';
import io from 'socket.io-client';
import Card from './components/Card';
import Deck from './components/Deck';
import Hand from './components/Hand';

const socket = io('https://neocard-server.onrender.com'); // RenderのサーバーURLに更新

const App = () => {
  const [message, setMessage] = useState('Connecting...');
  const [yourHand, setYourHand] = useState([]);
  const [yourDeckSize, setYourDeckSize] = useState(0);
  const [yourPlayedCards, setYourPlayedCards] = useState([]);
  const [opponentPlayedCards, setOpponentPlayedCards] = useState([]);
  const [opponentDeckSize, setOpponentDeckSize] = useState(0);
  const [isYourTurn, setIsYourTurn] = useState(false);

  useEffect(() => {
    socket.on('connect', () => {
      setMessage('Connected to server!');
      socket.emit('request_game_state'); // 接続時にゲーム状態を要求
    });

    socket.on('disconnect', () => {
      setMessage('Disconnected from server.');
    });

    socket.on('game_state', (state) => {
      setYourHand(state.yourHand);
      setYourDeckSize(state.yourDeckSize);
      setYourPlayedCards(state.yourPlayedCards);
      setOpponentPlayedCards(state.opponentPlayedCards);
      setOpponentDeckSize(state.opponentDeckSize);
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
    if (isYourTurn) {
      socket.emit('play_card', cardId);
    } else {
      alert("It's not your turn!");
    }
  };

  const handleEndTurn = () => {
    if (isYourTurn) {
      socket.emit('end_turn');
    } else {
      alert("It's not your turn!");
    }
  };

  return (
    <div style={{ textAlign: 'center', marginTop: '20px' }}>
      <h1>{message}</h1>
      <h2>{isYourTurn ? 'Your Turn' : 'Opponent\'s Turn'}</h2>

      <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'flex-start', width: '90%', margin: '20px auto', border: '2px solid #ccc', padding: '20px', borderRadius: '10px' }}>
        {/* 相手のエリア */}
        <div style={{ border: '1px solid red', padding: '10px', minHeight: '250px', width: '45%', borderRadius: '8px', backgroundColor: '#ffe0e0' }}>
          <h3>Opponent's Area</h3>
          <p>Opponent's Deck Size: {opponentDeckSize}</p>
          <h4>Opponent's Played Cards:</h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', minHeight: '130px', border: '1px dashed #f00', padding: '5px' }}>
            {opponentPlayedCards.length === 0 ? (
              <p>No cards played by opponent.</p>
            ) : (
              opponentPlayedCards.map(card => (
                <Card key={card.id} value={card.value} />
              ))
            )}
          </div>
        </div>

        {/* 自分のエリア */}
        <div style={{ border: '1px solid green', padding: '10px', minHeight: '250px', width: '45%', borderRadius: '8px', backgroundColor: '#e0ffe0' }}>
          <h3>Your Area</h3>
          <Deck onDrawCard={handleDrawCard} />
          <p>Your Deck Size: {yourDeckSize}</p>
          <h3>Your Hand:</h3>
          <Hand cards={yourHand} onPlayCard={handlePlayCard} />
          <button onClick={handleEndTurn} style={{ padding: '10px 20px', marginTop: '10px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
            End Turn
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;
