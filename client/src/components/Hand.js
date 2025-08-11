import React from 'react';
import Card from './Card';

const Hand = ({ cards, onCardAction }) => {
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
          <Card 
            key={card.id} 
            id={card.id} 
            name={card.name} 
             
            manaCost={card.manaCost} 
            imageUrl={card.imageUrl} 
            effect={card.effect} 
            description={card.description} 
            attack={card.attack} 
            defense={card.defense} 
            onCardAction={onCardAction}
            isPlayed={false}
            isYourTurn={true}
            hasAttackedThisTurn={false}
            isAttacking={false}
            isTapped={false}
            onTargetClick={() => {}}
          />
        ))
      )}
    </div>
  );
};

export default Hand;
