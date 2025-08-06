import React from 'react';
import Card from './Card';

const Hand = ({ cards }) => {
  return (
    <div
      style={{
        border: '1px solid blue',
        padding: '0.2rem',
        display: 'flex',
        minHeight: '6rem', // 手札の最小高さをさらに調整
        alignItems: 'center',
        justifyContent: 'center',
        flexWrap: 'wrap',
        marginTop: '0.5rem',
        flexGrow: 1, // 残りのスペースを埋める
        overflowY: 'auto', // 必要に応じてスクロール
      }}
    >
      {cards.length === 0 ? (
        <p>Your hand is empty.</p>
      ) : (
        cards.map((card) => (
          <Card key={card.id} id={card.id} value={card.value} manaCost={card.manaCost} imageUrl={card.imageUrl} />
        ))
      )}
    </div>
  );
};

export default Hand;