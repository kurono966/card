import React from 'react';

const Deck = () => {
  return (
    <div
      style={{
        width: '5vw', // カードの幅に合わせる
        height: '7.5vw', // カードの高さに合わせる
        minWidth: '40px', // 最小幅
        minHeight: '60px', // 最小高さ
        border: '2px dashed gray',
        borderRadius: '8px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#3a3c4a', // デッキの背景色
        color: '#f8f8f2',
        fontSize: '0.8rem',
        boxShadow: '2px 2px 5px rgba(0,0,0,0.5)',
      }}
    >
      Deck
    </div>
  );
};

export default Deck;
