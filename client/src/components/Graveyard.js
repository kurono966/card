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
    border: '2px dashed #666',
    borderRadius: '10px',
    display: 'flex',
    flexDirection: 'row', // カードを横に並べる
    flexWrap: 'wrap', // 折り返しを許可
    alignItems: 'flex-start', // 上揃え
    justifyContent: 'flex-start', // 左揃え
    backgroundColor: isOver ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.3)',
    color: 'white',
    position: 'relative',
    overflowY: 'auto', // 縦スクロールを許可
    flexGrow: 1, // 利用可能なスペースを埋める
    minHeight: '7.5vh', // 最小高さを設定 (App.module.cssのmanaZoneに合わせる)
    maxHeight: '10vh', // 最大高さを設定 (App.module.cssのmanaZoneに合わせる)
    margin: '0 10px',
    transition: 'all 0.3s ease',
    padding: '0.2vh', // App.module.cssのmanaZoneに合わせる
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

  return (
    <div ref={drop} style={graveyardStyle}>
      {cards.length === 0 ? (
        <p style={{ fontSize: '0.9rem', color: '#f8f8f2', opacity: 0.6 }}>
          {isOpponent ? '相手の墓地' : '墓地'}
        </p>
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
            abilities={card.abilities}
            isPlayed={true} // 墓地のカードは常にプレイ済み
            onCardAction={onCardAction}
          />
        ))
      )}
      <div style={countStyle}>
        {cards.length}
      </div>
    </div>
  );
};

export default Graveyard;
