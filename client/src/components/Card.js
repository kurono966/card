import React from 'react';
import { useDrag } from 'react-dnd';

const ItemTypes = {
  CARD: 'card',
};

const Card = ({
  id, name, value, manaCost, imageUrl, effect, description, attack, defense,
  onCardAction, isPlayed, isTapped, isAttacking,
  isSelectedAttacker, isSelectedBlocker, isSelectedTarget, isTempSelectedBlocker,
  isTargetableForEffect // 新しいプロパティ
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

  // Determine border color based on state
  let borderColorClass = 'border-gray-300'; // Default border color
  if (isTargetableForEffect) {
    borderColorClass = 'border-green-500'; // Targetable cards are green
  } else if (isSelectedTarget) {
    borderColorClass = 'border-red-500';      // Attacker being targeted is red
  } else if (isTempSelectedBlocker && isSelectedTarget) {
    borderColorClass = 'border-green-400'; // Temporarily selected blocker is light green
  } else if (isSelectedAttacker) {
    borderColorClass = 'border-yellow-300';  // Selected attacker is yellow
  } else if (isSelectedBlocker) {
    borderColorClass = 'border-green-400';   // Selected blocker is light green
  } else if (isAttacking) {
    borderColorClass = 'border-orange-400';         // Attacking creature is orange
  }

  // Dynamic width/height based on isTapped
  const sizeClasses = isTapped
    ? 'w-[7.5vw] h-[5vw] min-w-[60px] min-h-[40px]'
    : 'w-[5vw] h-[7.5vw] min-w-[40px] min-h-[60px]';

  // Background color/image
  const backgroundClasses = imageUrl
    ? `bg-cover bg-center bg-[url('${imageUrl}')]`
    : 'bg-[#6272a4]'; // Custom background color

  // Cursor style
  const cursorClass = isPlayed ? 'cursor-pointer' : 'cursor-grab';

  // Opacity
  const opacityClass = isDragging ? 'opacity-50' : 'opacity-100';

  return (
    <div
      ref={isPlayed ? null : drag} // フィールドのカードはドラッグ不可
      className={`
        ${opacityClass}
        ${sizeClasses}
        border-3 ${borderColorClass}
        rounded-md
        flex flex-col justify-between items-center
        m-[0.2vw]
        ${backgroundClasses}
        ${cursorClass}
        p-0.5
        box-border
        text-[0.7vw]
        text-[#f8f8f2]
        shadow-[3px_3px_8px_rgba(0,0,0,0.6)]
        ${isTargetableForEffect || isSelectedTarget || isTempSelectedBlocker || isSelectedAttacker || isSelectedBlocker || isAttacking ? `shadow-[0_0_10px_${borderColorClass.replace('border-', '#').replace('-500', '555').replace('-400', '444').replace('-300', '333')}]` : ''}
      `}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      <div className="text-[0.8em] self-start">Cost: {manaCost}</div>
      <div className="text-[1.2em] font-bold">{name}</div>
      <div className="flex justify-between w-full px-1 box-border">
        <span className="text-[1.2em] font-bold">⚔️{attack}</span>
        <span className="text-[1.2em] font-bold">🛡️{defense}</span>
      </div>
    </div>
  );
};

export default Card;