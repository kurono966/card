import React from 'react';
import { useDrag } from 'react-dnd';

const ItemTypes = {
  CARD: 'card',
};

const Card = ({ 
  id, name, value, manaCost, imageUrl, effect, description, attack, defense, 
  onCardAction, isPlayed, isTapped, isAttacking, 
  isSelectedAttacker, isSelectedBlocker, isSelectedTarget, isTempSelectedBlocker 
}) => {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: ItemTypes.CARD,
    item: { id, name, value, manaCost, imageUrl, effect, description, attack, defense },
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
  }));

  const handleMouseEnter = () => {
    if (onCardAction) onCardAction({ id, name, value, manaCost, imageUrl, effect, description, attack, defense }, 'hover');
  };

  const handleMouseLeave = () => {
    if (onCardAction) onCardAction(null, 'leave');
  };

  const handleClick = () => {
    if (onCardAction) onCardAction({ id, name, value, manaCost, imageUrl, effect, description, attack, defense }, 'click');
  };

  const borderColor = isSelectedTarget ? '#ff5555' :      // ブロック対象の攻撃クリーチャー
                      isTempSelectedBlocker ? '#ffff00' : // 仮選択中のブロッカー (黄色など)
                      isSelectedAttacker ? '#f1fa8c' :  // 攻撃選択中の自分のクリーチャー
                      isSelectedBlocker ? '#50fa7b' :   // ブロック選択中の自分のクリーチャー
                      isAttacking ? '#ffb86c' :         // 攻撃中のクリーチャー
                      '#f8f8f2';

  return (
    <div
      ref={isPlayed ? null : drag} // フィールドのカードはドラッグ不可
      style={{
        opacity: isDragging ? 0.5 : 1,
        width: isTapped ? '7.5vw' : '5vw',
        height: isTapped ? '5vw' : '7.5vw',
        minWidth: isTapped ? '60px' : '40px',
        minHeight: isTapped ? '40px' : '60px',
        border: `3px solid ${borderColor}`,
        borderRadius: '5px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        alignItems: 'center',
        margin: '0.2vw',
        backgroundColor: imageUrl ? 'transparent' : '#6272a4',
        cursor: isPlayed ? 'pointer' : 'grab',
        padding: '2px',
        boxSizing: 'border-box',
        fontSize: '0.7vw',
        backgroundImage: imageUrl ? `url(${imageUrl})` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        color: '#f8f8f2',
        textShadow: '1px 1px 2px rgba(0,0,0,0.9)',
        boxShadow: `3px 3px 8px rgba(0,0,0,0.6), 0 0 10px ${borderColor}`,
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