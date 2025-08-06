import React from 'react';
import Card from './Card';

const Hand = ({ cards, onPlayCard }) => {
  return (
    <div
      style={{
        border: '1px solid blue',
        padding: '10px',
        display: 'flex',
        minHeight: '150px',
        alignItems: 'center',
        justifyContent: 'center',
        flexWrap: 'wrap',
        marginTop: '20px',
      }}
    >
      {cards.length === 0 ? (
        <p>Your hand is empty.</p>
      ) : (
        cards.map((card, index) => (
          <Card key={index} value={card.value} onClick={() => onPlayCard(card.id)} />
        ))
      )}
    </div>
  );
};

export default Hand;
