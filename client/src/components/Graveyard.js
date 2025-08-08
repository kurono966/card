import React from 'react';
import { useDrop } from 'react-dnd';
import Card from './Card';

const Graveyard = ({ cards, onCardAction, isOpponent = false }) => {
  const [{ isOver }, drop] = useDrop(() => ({
    accept: 'card',
    drop: (item) => {
      if (onCardAction) {
        onCardAction(item, 'toGraveyard');
      }
    },
    collect: (monitor) => ({
      isOver: !!monitor.isOver(),
    }),
  }));

  const graveyardClasses = `
    border-2 border-dashed border-gray-600
    rounded-lg
    flex flex-row flex-wrap items-start justify-start
    ${isOver ? 'bg-white bg-opacity-20' : 'bg-black bg-opacity-30'}
    text-white
    relative
    overflow-y-auto
    flex-grow
    min-h-[7.5vh]
    max-h-[10vh]
    mx-2
    transition-all duration-300 ease-in-out
    p-0.5
  `;

  const countClasses = `
    absolute top-1 right-1
    bg-black bg-opacity-70
    rounded-full
    w-6 h-6
    flex items-center justify-center
    text-sm font-bold
  `;

  return (
    <div ref={drop} className={graveyardClasses}>
      {cards.length === 0 ? (
        <p className="text-sm text-gray-300 opacity-60">
          {isOpponent ? '相手の墓地' : '墓地'}
        </p>
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
            isPlayed={true} // 墓地のカードはプレイ済み扱い
            onCardAction={onCardAction} // マウスオーバーイベントを渡す
          />
        ))
      )}
      <div className={countClasses}>
        {cards.length}
      </div>
    </div>
  );
};

export default Graveyard;
