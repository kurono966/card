import React from 'react';

const Card = ({ value, onClick }) => {
  return (
    <div
      style={{
        width: '80px',
        height: '120px',
        border: '1px solid black',
        borderRadius: '5px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        margin: '5px',
        backgroundColor: '#f0f0f0',
        cursor: onClick ? 'pointer' : 'default',
      }}
      onClick={onClick}
    >
      {value}
    </div>
  );
};

export default Card;
