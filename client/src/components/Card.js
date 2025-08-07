import React from 'react';
import { useDrag } from 'react-dnd';

const ItemTypes = {
  CARD: 'card',
};

const Card = ({ id, name, value, manaCost, imageUrl, effect, description, attack, defense, onCardAction, isPlayed, isYourTurn, hasAttackedThisTurn, isAttacking, onTargetClick, isTapped, currentPhase }) => { // effect, description, attack, defense, isPlayed, isYourTurn, hasAttackedThisTurn, isAttacking, onTargetClick, isTapped, currentPhase を追加
  const canBlock = isPlayed && !isYourTurn && currentPhase === 'declare_blockers' && !isTapped;
  console.log(`[Card.js] Card ID: ${id}, Name: ${name}, Attack: ${attack}, Defense: ${defense}, Image URL: ${imageUrl}, isPlayed: ${isPlayed}, isYourTurn: ${isYourTurn}, hasAttackedThisTurn: ${hasAttackedThisTurn}, isAttacking: ${isAttacking}, isTapped: ${isTapped}`); // デバッグログを追加
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

  const handleAttack = (e) => {
    e.stopPropagation(); // 親要素のクリックイベントが発火しないようにする
    if (onCardAction) {
      onCardAction({ id, name, value, manaCost, imageUrl, effect, description, attack, defense }, 'attack');
    }
  };

  return (
    <div
      ref={drag}
      style={{
        opacity: isDragging ? 0.5 : 1,
        width: isTapped ? '7.5vw' : '5vw', // タップ状態なら幅と高さを入れ替え
        height: isTapped ? '5vw' : '7.5vw', // タップ状態なら幅と高さを入れ替え
        minWidth: isTapped ? '60px' : '40px', // 最小幅
        minHeight: isTapped ? '40px' : '60px', // 最小高さ
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
      onClick={isAttacking ? () => onTargetClick(id) : handleClick}
    >
      <div style={{ fontSize: '0.8em', alignSelf: 'flex-start' }}>Cost: {manaCost}</div>
      <div style={{ fontSize: '1.2em', fontWeight: 'bold' }}>{name}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', padding: '0 5px', boxSizing: 'border-box' }}>
        <span style={{ fontSize: '1.2em', fontWeight: 'bold' }}>⚔️{attack}</span>
        <span style={{ fontSize: '1.2em', fontWeight: 'bold' }}>🛡️{defense}</span>
      </div>
      {isPlayed && isYourTurn && !hasAttackedThisTurn && currentPhase === 'declare_attackers' && (
        <button
          onClick={handleAttack}
          style={{
            marginTop: '5px',
            padding: '2px 5px',
            fontSize: '0.6em',
            cursor: 'pointer',
            backgroundColor: '#ff5555',
            color: 'white',
            border: 'none',
            borderRadius: '3px',
          }}
        >
          攻撃
        </button>
      )}
      {canBlock && (
        <div 
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            border: '3px solid #ff79c6',
            borderRadius: '5px',
            pointerEvents: 'none',
            boxShadow: '0 0 10px #ff79c6',
            zIndex: 10,
          }}
        >
          <div style={{
            position: 'absolute',
            bottom: '5px',
            left: 0,
            right: 0,
            textAlign: 'center',
            backgroundColor: 'rgba(0,0,0,0.7)',
            color: '#fff',
            padding: '2px 0',
            fontSize: '0.8em',
            fontWeight: 'bold',
          }}>
            ブロック可能
          </div>
        </div>
      )}
    </div>
  );
};

export default Card;
