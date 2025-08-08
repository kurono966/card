import React, { useState } from 'react';
import styles from '../App.module.css';

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
    <div className={styles.menuContainer}>
      <h1 className={styles.menuTitle}>Neocard</h1>
      <div className={styles.menuButtons}>
        <button
          className={styles.menuButton}
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
