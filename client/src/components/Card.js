import React from 'react';
import { useDrag } from 'react-dnd';

const ItemTypes = {
  CARD: 'card',
};

const Card = ({ id, value, manaCost, onClick }) => {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: ItemTypes.CARD,
    item: { id, value, manaCost },
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
  }));

  return (
    <div
      ref={drag}
      style={{
        opacity: isDragging ? 0.5 : 1,
        width: '60px', // カードの幅をさらに調整
        height: '90px', // カードの高さをさらに調整
        border: '1px solid black',
        borderRadius: '5px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        alignItems: 'center',
        margin: '2px', // マージンをさらに調整
        backgroundColor: '#f0f0f0',
        cursor: onClick ? 'pointer' : 'default',
        padding: '2px',
        boxSizing: 'border-box',
        fontSize: '0.7rem', // フォントサイズをさらに調整
      }}
      onClick={onClick}
    >
      <div style={{ fontSize: '0.8em', alignSelf: 'flex-start' }}>Cost: {manaCost}</div>
      <div style={{ fontSize: '1.5em', fontWeight: 'bold' }}>{value}</div>
      <div style={{ fontSize: '0.8em', alignSelf: 'flex-end' }}></div> {/* Placeholder for future info */}
    </div>
  );
};

export default Card;
