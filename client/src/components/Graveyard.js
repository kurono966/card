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

  const graveyardStyle = {
    width: '100px',
    height: '150px',
    border: '2px dashed #666',
    borderRadius: '10px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: isOver ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.3)',
    color: 'white',
    position: 'relative',
    overflow: 'hidden',
    margin: '0 10px',
    transition: 'all 0.3s ease',
  };

  const countStyle = {
    position: 'absolute',
    top: '5px',
    right: '5px',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: '50%',
    width: '24px',
    height: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    fontWeight: 'bold',
  };

  const topCard = cards.length > 0 ? cards[cards.length - 1] : null;

  return (
    <div ref={drop} style={graveyardStyle}>
      {cards.length > 0 && (
        <div style={{ position: 'absolute', width: '100%', height: '100%' }}>
          <Card
            key={topCard.id}
            id={topCard.id}
            name={topCard.name}
            value={topCard.value}
            manaCost={topCard.manaCost}
            imageUrl={topCard.imageUrl}
            effect={topCard.effect}
            description={topCard.description}
            attack={topCard.attack}
            defense={topCard.defense}
            isPlayed={true}
            style={{
              transform: 'rotate(90deg) scale(0.6)',
              position: 'absolute',
              top: '-25%',
              left: '-25%',
              opacity: 0.8,
            }}
          />
        </div>
      )}
      <div style={countStyle}>
        {cards.length}
      </div>
      <div style={{ 
        position: 'absolute', 
        bottom: '5px', 
        fontSize: '12px',
        backgroundColor: 'rgba(0, 0, 0, 0.7)', 
        padding: '2px 5px',
        borderRadius: '3px'
      }}>
        {isOpponent ? '相手の墓地' : '墓地'}
      </div>
    </div>
  );
};

export default Graveyard;
