import React from 'react';

const Deck = ({ onDrawCard }) => {
  return (
    <div
      style={{
        width: '100px',
        height: '150px',
        border: '2px dashed gray',
        borderRadius: '8px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <button onClick={onDrawCard} style={{ padding: '10px 20px' }}>
        Draw Card
      </button>
    </div>
  );
};

export default Deck;
