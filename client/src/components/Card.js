import React from 'react';
import { useDrag } from 'react-dnd';

const ItemTypes = {
  CARD: 'card',
};

const Card = ({ id, name, value, manaCost, imageUrl, effect, description, attack, defense, onCardAction }) => { // effect, description, attack, defense を追加
  console.log(`[Card.js] Card ID: ${id}, Name: ${name}, Attack: ${attack}, Defense: ${defense}, Image URL: ${imageUrl}`); // デバッグログを追加
  const [{ isDragging }, drag] = useDrag(() => ({
    type: ItemTypes.CARD,
    item: { id, name, value, manaCost, imageUrl, effect, description, attack, defense }, // effect, description, attack, defense もドラッグアイテムに含める
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
  }));

  const handleMouseEnter = () => {
    if (isDragging) return; // ドラッグ中はポップアップを表示しない
    if (onCardAction) {
      onCardAction({ id, name, value, manaCost, imageUrl, effect, description, attack, defense }, 'hover'); // effect, description, attack, defense を渡す
    }
  };

  const handleMouseLeave = () => {
    if (isDragging) return; // ドラッグ中はポップアップを非表示にしない（ドラッグ終了時に自動で消える）
    if (onCardAction) {
      onCardAction(null, 'leave');
    }
  };

  const handleClick = () => {
    if (isDragging) return; // ドラッグ中はポップアップを表示しない
    if (onCardAction) {
      onCardAction({ id, name, value, manaCost, imageUrl, effect, description, attack, defense }, 'click'); // effect, description, attack, defense を渡す
    }
  };

  return (
    <div
      ref={drag}
      style={{
        opacity: isDragging ? 0.5 : 1,
        width: '5vw', // カードの幅をビューポート幅の5%に
        height: '7.5vw', // カードの高さをビューポート幅の7.5%に (アスペクト比1:1.5)
        minWidth: '40px', // 最小幅
        minHeight: '60px', // 最小高さ
        border: '1px solid #f8f8f2', // ボーダー色を白系に
        borderRadius: '5px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        alignItems: 'center',
        margin: '0.2vw', // マージンをビューポート幅の0.2%に
        backgroundColor: imageUrl ? 'transparent' : '#6272a4', // 画像がある場合は透明、ない場合はゾーンの色に
        cursor: 'grab', // ドラッグ可能であることを示すカーソル
        padding: '2px',
        boxSizing: 'border-box',
        fontSize: '0.7vw', // フォントサイズをビューポート幅の0.7%に
        backgroundImage: imageUrl ? `url(${imageUrl})` : 'none', // 背景画像を追加
        backgroundSize: 'cover', // 画像をカード全体にフィットさせる
        backgroundPosition: 'center', // 画像を中央に配置
        color: '#f8f8f2', // 文字色を白系に統一
        textShadow: '1px 1px 2px rgba(0,0,0,0.9)', // 読みやすくするために影を濃く
        boxShadow: '3px 3px 8px rgba(0,0,0,0.6)', // カードに影を追加
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      <div style={{ fontSize: '0.8em', alignSelf: 'flex-start' }}>Cost: {manaCost}</div>
      <div style={{ fontSize: '1.2em', fontWeight: 'bold' }}>{name}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', padding: '0 5px', boxSizing: 'border-box' }}>
        <span style={{ fontSize: '1.2em', fontWeight: 'bold' }}>⚔️{attack}</span>
        <span style={{ fontSize: '1.2em', fontWeight: 'bold' }}>🛡️{defense}</span>
      </div>
    </div>
  );
};

export default Card;
