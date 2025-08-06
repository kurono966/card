import React from 'react';

const Card = ({ value, manaCost, onClick }) => {
  return (
    <div
      style={{
        width: '80px',
        height: '120px',
        border: '1px solid black',
        borderRadius: '5px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        alignItems: 'center',
        margin: '5px',
        backgroundColor: '#f0f0f0',
        cursor: onClick ? 'pointer' : 'default',
        padding: '5px',
        boxSizing: 'border-box',
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