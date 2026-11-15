import Phaser from 'phaser';

// TASK-001 第 1 步：只確認專案能啟動。店面與按鈕在後面步驟加入。
export class ShopScene extends Phaser.Scene {
  constructor() {
    super('ShopScene');
  }

  create(): void {
    const { width, height } = this.scale;
    this.add
      .text(width / 2, height / 2, '晚安商店\nDream Mart', {
        fontSize: '32px',
        color: '#ffe9a8',
        align: 'center',
      })
      .setOrigin(0.5);
  }
}
