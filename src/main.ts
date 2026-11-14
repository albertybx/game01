import Phaser from 'phaser';
import { ShopScene } from './rendering/ShopScene';

// 直式手機畫面為主（GDD §7）；實際尺寸 TODO: UX
new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#1b1530',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 390,
    height: 844,
  },
  scene: [ShopScene],
});
