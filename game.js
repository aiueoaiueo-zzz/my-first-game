// ===== ステップ1：キャンバスを準備する =====

// HTML の中から id="game" のキャンバスを探してくる
const canvas = document.getElementById("game");

// 「2D の絵を描くための道具（筆）」を取り出す。絵はすべてこの ctx で描く
const ctx = canvas.getContext("2d");


// ===== ステップ2：プレイヤーを用意する =====

// プレイヤーの情報をひとまとめにしたもの（オブジェクト）
const player = {
  width: 40,   // 横幅（ピクセル）
  height: 40,  // 高さ（ピクセル）
  x: 0,        // 左上の角の横位置（下で計算して入れる）
  y: 0,        // 左上の角の縦位置（下で計算して入れる）
  speed: 5,    // 1フレームで動く距離（ピクセル）
  color: "#3a7bd5", // 色（青）
};

// 横は画面の真ん中に置く：(画面の幅 - プレイヤーの幅) ÷ 2
player.x = (canvas.width - player.width) / 2;

// 縦は画面の下から少し上（20ピクセル空ける）に置く
// y は下に行くほど大きくなるので、「画面の高さ - プレイヤーの高さ - 20」
player.y = canvas.height - player.height - 20;


// ===== ステップ4：操作を受け付ける =====

// 今「左」「右」が押されているかを覚えておく入れ物
// true＝押されている、false＝押されていない
const input = {
  left: false,
  right: false,
};

// --- キーボード（パソコン用） ---

// キーが押されたとき
document.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft") input.left = true;
  if (event.key === "ArrowRight") input.right = true;
});

// キーが離されたとき
document.addEventListener("keyup", (event) => {
  if (event.key === "ArrowLeft") input.left = false;
  if (event.key === "ArrowRight") input.right = false;
});

// --- タッチ（スマホ用） ---
// 画面の左半分を押している間は左へ、右半分を押している間は右へ動く
// pointer（ポインター）は、指・マウス・ペンをまとめて扱える仕組み

function handlePointer(event) {
  // キャンバスが画面のどこにあるか、どの大きさで表示されているかを調べる
  const rect = canvas.getBoundingClientRect();
  // 押した位置が、キャンバスの左端からどれだけ右か
  const touchX = event.clientX - rect.left;

  if (touchX < rect.width / 2) {
    input.left = true;
    input.right = false;
  } else {
    input.left = false;
    input.right = true;
  }
}

function releasePointer() {
  input.left = false;
  input.right = false;
}

canvas.addEventListener("pointerdown", (event) => {
  // 指を少し動かしても、指を離すまでこのキャンバスの操作として扱う
  canvas.setPointerCapture(event.pointerId);
  handlePointer(event);
});
canvas.addEventListener("pointermove", (event) => {
  // 押したまま指をすべらせたとき（指が触れている間だけ反応する）
  if (event.buttons > 0) handlePointer(event);
});
canvas.addEventListener("pointerup", releasePointer);
canvas.addEventListener("pointercancel", releasePointer);


// ===== ステップ3：ゲームループ =====

// 動きを計算する（更新）
function update() {
  if (input.left) player.x -= player.speed;   // 左へ（x を減らす）
  if (input.right) player.x += player.speed;  // 右へ（x を増やす）

  // 画面の外に出ないように止める
  if (player.x < 0) player.x = 0;
  if (player.x > canvas.width - player.width) {
    player.x = canvas.width - player.width;
  }
}

// 画面を描く（描画）
function draw() {
  // まず画面全体を消す。消さないと前の絵が残って線のようになってしまう
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // プレイヤーを描く。fillRect(左上のx, 左上のy, 幅, 高さ)
  ctx.fillStyle = player.color;
  ctx.fillRect(player.x, player.y, player.width, player.height);
}

// 「更新 → 描画」を1回やって、次の回を予約する
function gameLoop() {
  update();
  draw();
  // ブラウザに「次に画面を描くタイミングで、もう一度 gameLoop を呼んで」と頼む
  // これで約1秒に60回、くり返し実行される
  requestAnimationFrame(gameLoop);
}

// ゲームループを開始する
gameLoop();
