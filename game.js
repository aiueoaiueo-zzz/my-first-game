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

// 縦は画面の下から少し上（20ピクセル空ける）に置く
// y は下に行くほど大きくなるので、「画面の高さ - プレイヤーの高さ - 20」
player.y = canvas.height - player.height - 20;

// 横の位置は、ゲームを始めるたびに resetGame() で真ん中に戻す（ステップ10）


// ===== ステップ5・6：落ちてくるものを用意する =====

// 落ちてくるもの（障害物）をまとめて入れておく配列
// 配列は [ ] で作る「データを順番に並べて入れておく箱」。最初は空っぽ
let obstacles = [];

// 何フレームごとに新しい障害物を出すか（60で約1秒）
const spawnInterval = 40;

// 前回出してから何フレームたったかを数える
let spawnTimer = 0;

// 新しい障害物を1つ作って、配列に追加する
function spawnObstacle() {
  const size = 30;
  const obstacle = {
    width: size,
    height: size,
    // Math.random() は 0以上1未満のランダムな数を返す
    // それに「動ける幅」をかけると、0〜右端までのどこかになる
    x: Math.random() * (canvas.width - size),
    // y をマイナスにすると、画面の上の外側からスッと出てくる
    y: -size,
    // 落ちる速さも少しバラバラにする（3〜6）
    speed: 3 + Math.random() * 3,
    color: "#e94b3c",  // 色（赤）
  };
  // push で配列の最後に追加する
  obstacles.push(obstacle);
}


// ===== ステップ7：当たり判定 =====

// 2つの四角 a と b が重なっているかを調べる（AABB判定）
// 「横方向で重なっている」かつ「縦方向で重なっている」ときだけ、ぶつかっている
function isColliding(a, b) {
  return (
    a.x < b.x + b.width &&   // a の左端が、b の右端より左にある
    a.x + a.width > b.x &&   // a の右端が、b の左端より右にある
    a.y < b.y + b.height &&  // a の上端が、b の下端より上にある
    a.y + a.height > b.y     // a の下端が、b の上端より下にある
  );
}


// ===== ステップ8・9：ゲームの状態とスコア =====

// 今ゲームがどの段階にあるか（状態）
// "playing" ＝ プレイ中、"gameover" ＝ ゲームオーバー
let state = "playing";

// スコア：よけきった（画面の下まで落ちた）障害物の数
let score = 0;

// ゲームオーバーになってから何フレームたったか
// 当たった瞬間に指が画面に触れていても、すぐにリトライしてしまわないようにするため
let gameOverTimer = 0;

// リトライできるようになるまでのフレーム数（30で約0.5秒）
const retryDelay = 30;


// ===== ステップ10：リトライ（最初からやり直す） =====

// 変数をすべてゲーム開始時の値に戻す（初期化）
function resetGame() {
  // 横は画面の真ん中に置く：(画面の幅 - プレイヤーの幅) ÷ 2
  player.x = (canvas.width - player.width) / 2;
  obstacles = [];
  spawnTimer = 0;
  score = 0;
  gameOverTimer = 0;
  state = "playing";
}

// ゲームオーバー中で、少し時間がたっていればリトライする
function tryRetry() {
  if (state === "gameover" && gameOverTimer >= retryDelay) {
    resetGame();
  }
}


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

  // スペースキーかエンターキーでリトライ（ステップ10）
  if (event.key === " " || event.key === "Enter") {
    event.preventDefault();  // スペースキーでページがスクロールしないようにする
    tryRetry();
  }
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

  // ゲームオーバー中なら、タップ（クリック）でリトライ（ステップ10）
  if (state === "gameover") {
    tryRetry();
    return;  // return でここから先は実行しない
  }

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
  // ゲームオーバー中は何も動かさず、経過フレームだけ数える（ステップ8）
  if (state === "gameover") {
    gameOverTimer++;
    return;
  }

  if (input.left) player.x -= player.speed;   // 左へ（x を減らす）
  if (input.right) player.x += player.speed;  // 右へ（x を増やす）

  // 画面の外に出ないように止める
  if (player.x < 0) player.x = 0;
  if (player.x > canvas.width - player.width) {
    player.x = canvas.width - player.width;
  }

  // 一定の間隔で、新しい障害物を出す
  spawnTimer++;  // ++ は「1増やす」という意味
  if (spawnTimer >= spawnInterval) {
    spawnObstacle();
    spawnTimer = 0;  // 数え直す
  }

  // 配列の中の障害物を1つずつ取り出して、下へ動かす
  for (const obstacle of obstacles) {
    obstacle.y += obstacle.speed;
  }

  // 画面の下から出た障害物は、配列から取り除く
  // filter は「条件に合うものだけを残した新しい配列」を作る
  // ここでは「まだ画面の下まで行っていないもの」だけを残す
  const before = obstacles.length;  // 取り除く前の数
  obstacles = obstacles.filter((obstacle) => obstacle.y < canvas.height);

  // 減った数 ＝ よけきった数。その分スコアを増やす（ステップ9）
  score += before - obstacles.length;

  // どれか1つでもプレイヤーに重なっていたらゲームオーバー（ステップ7・8）
  // some は「配列の中に条件に合うものが1つでもあるか」を調べる
  if (obstacles.some((obstacle) => isColliding(player, obstacle))) {
    state = "gameover";
    // 押しっぱなしの状態を消しておく（リトライ直後に勝手に動かないように）
    input.left = false;
    input.right = false;
  }
}

// 画面を描く（描画）
function draw() {
  // まず画面全体を消す。消さないと前の絵が残って線のようになってしまう
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // プレイヤーを描く。fillRect(左上のx, 左上のy, 幅, 高さ)
  // ゲームオーバーのときはオレンジ色にする
  ctx.fillStyle = state === "gameover" ? "#f5a623" : player.color;
  ctx.fillRect(player.x, player.y, player.width, player.height);

  // 障害物を1つずつ描く
  for (const obstacle of obstacles) {
    ctx.fillStyle = obstacle.color;
    ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
  }

  // スコアを左上に表示する（ステップ9）
  ctx.fillStyle = "#333";
  ctx.font = "bold 20px sans-serif";
  ctx.textAlign = "left";  // 指定した x を文字の左端にする
  ctx.fillText("スコア: " + score, 12, 30);

  // ゲームオーバー画面（ステップ8）
  if (state === "gameover") {
    // 画面全体に半透明の黒を重ねて、少し暗くする
    // rgba の4つ目の数字は透明度（0＝透明、1＝真っ黒）
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";  // 指定した x を文字の真ん中にする

    ctx.font = "bold 44px sans-serif";
    ctx.fillText("GAME OVER", canvas.width / 2, 250);

    ctx.font = "bold 28px sans-serif";
    ctx.fillText("スコア: " + score, canvas.width / 2, 305);

    // リトライできるようになってから案内を出す（ステップ10）
    if (gameOverTimer >= retryDelay) {
      ctx.font = "18px sans-serif";
      ctx.fillText("タップ または スペースキーで", canvas.width / 2, 370);
      ctx.fillText("もう一度遊ぶ", canvas.width / 2, 398);
    }
  }
}

// 「更新 → 描画」を1回やって、次の回を予約する
function gameLoop() {
  update();
  draw();
  // ブラウザに「次に画面を描くタイミングで、もう一度 gameLoop を呼んで」と頼む
  // これで約1秒に60回、くり返し実行される
  requestAnimationFrame(gameLoop);
}

// ゲームを初期状態にしてから、ゲームループを開始する
resetGame();
gameLoop();
