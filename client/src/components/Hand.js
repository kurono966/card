import React from 'react';
import Card from './Card';

const Hand = ({ cards }) => {
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
        cards.map((card) => (
          <Card key={card.id} id={card.id} value={card.value} manaCost={card.manaCost} imageUrl={card.imageUrl} /> // imageUrl を追加
        ))
      )}
    </div>
  );
};

export default Hand;