import React, { useState } from 'react';


const Menu = ({ onStartOnlineGame, onStartSoloGame }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const handleOnlineGame = async () => {
    setIsLoading(true);
    setStatusMessage('接続中...');
    try {
      await onStartOnlineGame();
    } catch (error) {
      setStatusMessage('エラーが発生しました。もう一度お試しください。');
      setIsLoading(false);
    }
  };

  const handleSoloGame = () => {
    setIsLoading(true);
    setStatusMessage('準備中...');
    onStartSoloGame();
  };


  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-800 text-white">
      <h1 className="text-5xl font-bold mb-8">Neocard</h1>
      <div className="flex flex-col space-y-4">
        <button
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg text-xl transition duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={handleOnlineGame}
          disabled={isLoading}
        >
          オンラインマルチプレイ
        </button>
        <button
          className={styles.menuButton}
          onClick={handleSoloGame}
          disabled={isLoading}
        >
          ソロモード (未実装)
        </button>
      </div>
      {statusMessage && <div className={styles.menuMessage}>{statusMessage}</div>}
    </div>
  );
};

export default Menu;
