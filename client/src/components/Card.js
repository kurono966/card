import React from 'react';
import { useDrag } from 'react-dnd';

const ItemTypes = {
  CARD: 'card',
};

const Card = ({ id, value, manaCost, imageUrl, onClick }) => {
  console.log(`[Card.js] Card ID: ${id}, Image URL: ${imageUrl}`); // デバッグログを追加
  const [{ isDragging }, drag] = useDrag(() => ({
    type: ItemTypes.CARD,
    item: { id, value, manaCost, imageUrl }, // imageUrl もドラッグアイテムに含める
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
        backgroundImage: imageUrl ? `url(${imageUrl})` : 'none', // 背景画像を追加
        backgroundSize: 'cover', // 画像をカード全体にフィットさせる
        backgroundPosition: 'center', // 画像を中央に配置
        color: imageUrl ? 'white' : 'black', // 画像がある場合は文字色を白に
        textShadow: imageUrl ? '1px 1px 2px black' : 'none', // 読みやすくするために影を追加
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
