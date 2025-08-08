import React from 'react';
import Card from './Card';

const Hand = ({ cards, onCardAction }) => {
  return (
    <div
      className="border border-blue-500 p-1 flex flex-wrap items-center justify-center mt-2 flex-grow overflow-y-auto min-h-[6rem]"
    >
      {cards.length === 0 ? (
        <p>Your hand is empty.</p>
      ) : (
        cards.map((card) => (
          <Card 
            key={card.id} 
            id={card.id} 
            name={card.name} 
            value={card.value} 
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
