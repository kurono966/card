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
        border: '1px solid #f8f8f2', // ボーダー色を白系に
        borderRadius: '5px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        alignItems: 'center',
        margin: '2px', // マージンをさらに調整
        backgroundColor: imageUrl ? 'transparent' : '#6272a4', // 画像がある場合は透明、ない場合はゾーンの色に
        cursor: onClick ? 'pointer' : 'grab', // ドラッグ可能であることを示すカーソル
        padding: '2px',
        boxSizing: 'border-box',
        fontSize: '0.7rem', // フォントサイズをさらに調整
        backgroundImage: imageUrl ? `url(${imageUrl})` : 'none', // 背景画像を追加
        backgroundSize: 'cover', // 画像をカード全体にフィットさせる
        backgroundPosition: 'center', // 画像を中央に配置
        color: '#f8f8f2', // 文字色を白系に統一
        textShadow: '1px 1px 2px rgba(0,0,0,0.9)', // 読みやすくするために影を濃く
        boxShadow: '3px 3px 8px rgba(0,0,0,0.6)', // カードに影を追加
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
