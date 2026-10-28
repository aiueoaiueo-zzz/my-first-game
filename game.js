// ===== ステップ1：キャンバスを準備する =====

// HTML の中から id="game" のキャンバスを探してくる
const canvas = document.getElementById("game");

// 「2D の絵を描くための道具（筆）」を取り出す。絵はすべてこの ctx で描く
const ctx = canvas.getContext("2d");


// ===== ステップ2：プレイヤーを描く =====

// プレイヤーの情報をひとまとめにしたもの（オブジェクト）
const player = {
  width: 40,   // 横幅（ピクセル）
  height: 40,  // 高さ（ピクセル）
  x: 0,        // 左上の角の横位置（下で計算して入れる）
  y: 0,        // 左上の角の縦位置（下で計算して入れる）
  color: "#3a7bd5", // 色（青）
};

// 横は画面の真ん中に置く：(画面の幅 - プレイヤーの幅) ÷ 2
player.x = (canvas.width - player.width) / 2;

// 縦は画面の下から少し上（20ピクセル空ける）に置く
// y は下に行くほど大きくなるので、「画面の高さ - プレイヤーの高さ - 20」
player.y = canvas.height - player.height - 20;

// 筆の色を決めてから、四角を塗りつぶして描く
// fillRect(左上のx, 左上のy, 幅, 高さ)
ctx.fillStyle = player.color;
ctx.fillRect(player.x, player.y, player.width, player.height);
