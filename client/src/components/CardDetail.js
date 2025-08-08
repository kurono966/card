import React from 'react';

const CardDetail = ({ card, onClose }) => {
  if (!card) return null;

  return (
    <div
      className="bg-[#3a3c4a] border-2 border-[#8be9fd] rounded-lg p-5 z-50 shadow-2xl flex flex-col items-center text-[#f8f8f2]"
    >
      <button
        onClick={onClose}
        className="absolute top-2 right-2 bg-none border-none text-[#f8f8f2] text-2xl cursor-pointer"
      >
        &times;
      </button>
      <div        className={`w-[150px] h-[225px] border border-[#f8f8f2] rounded-md p-1 box-border flex flex-col justify-between items-center text-base ${card.imageUrl ? 'bg-cover bg-center bg-[url(${card.imageUrl})] text-white shadow-text' : 'text-black'}`}      >
        <div className="text-base self-start">Cost: {card.manaCost}</div>
        <div className="text-2xl font-bold">{card.value}</div>
        <div className="text-base self-end"></div>
      </div>
      <h3 className="mt-4">{card.name}</h3> {/* カード名称を表示 */}
      <p>Mana Cost: {card.manaCost}</p>
      <div className="flex justify-around w-full mt-2">
        <span className="text-xl font-bold">⚔️{card.attack}</span>
        <span className="text-xl font-bold">🛡️{card.defense}</span>
      </div>
      {card.effect && <p className="font-bold text-[#50fa7b]">Effect: {card.effect}</p>} {/* 効果があれば太字で表示 */}
      {card.description && <p className="text-sm text-[#bd93f9]">{card.description}</p>} {/* 説明があれば薄めの色で表示 */}
    </div>
  );
};

export default CardDetail;
