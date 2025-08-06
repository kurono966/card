import React from 'react';

const CardDetail = ({ card, onClose }) => {
  if (!card) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        backgroundColor: '#3a3c4a',
        border: '2px solid #8be9fd',
        borderRadius: '10px',
        padding: '20px',
        zIndex: 1000,
        boxShadow: '0 0 20px rgba(0,0,0,0.8)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        color: '#f8f8f2',
      }}
    >
      <button
        onClick={onClose}
        style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          background: 'none',
          border: 'none',
          color: '#f8f8f2',
          fontSize: '1.5rem',
          cursor: 'pointer',
        }}
      >
        &times;
      </button>
      <div
        style={{
          width: '150px',
          height: '225px',
          border: '1px solid #f8f8f2',
          borderRadius: '5px',
          backgroundImage: card.imageUrl ? `url(${card.imageUrl})` : 'none',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '5px',
          boxSizing: 'border-box',
          fontSize: '1rem',
          color: card.imageUrl ? 'white' : 'black',
          textShadow: card.imageUrl ? '1px 1px 3px black' : 'none',
        }}
      >
        <div style={{ fontSize: '1em', alignSelf: 'flex-start' }}>Cost: {card.manaCost}</div>
        <div style={{ fontSize: '2em', fontWeight: 'bold' }}>{card.value}</div>
        <div style={{ fontSize: '1em', alignSelf: 'flex-end' }}></div>
      </div>
      <h3 style={{ marginTop: '15px' }}>{card.name}</h3> {/* カード名称を表示 */}
      <p>Mana Cost: {card.manaCost}</p>
      <div style={{ display: 'flex', justifyContent: 'space-around', width: '100%', marginTop: '10px' }}>
        <span style={{ fontSize: '1.5em', fontWeight: 'bold' }}>⚔️{card.attack}</span>
        <span style={{ fontSize: '1.5em', fontWeight: 'bold' }}>🛡️{card.defense}</span>
      </div>
      {card.effect && <p style={{ fontWeight: 'bold', color: '#50fa7b' }}>Effect: {card.effect}</p>} {/* 効果があれば太字で表示 */}
      {card.description && <p style={{ fontSize: '0.9em', color: '#bd93f9' }}>{card.description}</p>} {/* 説明があれば薄めの色で表示 */}
    </div>
  );
};

export default CardDetail;
