// よけるゲーム 3D版
// 遊び方は2D版（2d/game.js）と同じ。絵を描く部分を Three.js（3Dライブラリ）に置きかえている
//
// 【3Dの世界の決まり】
// - 長さの単位は「ピクセル」ではなく、Three.js の「1単位」（1マスくらいの感覚）
// - x は左右（右がプラス）、y は上下（上がプラス）、z は手前と奥（手前がプラス）
//   ※ 2D版と違って、y は「上に行くほど大きく」なる
// - 地面は y = 0。ゲームは z = 0 の面の上で進む（奥行き方向には動かない）


// ===== 準備：画面と3Dの世界を作る =====

// ゲーム画面の入れ物と、スコアなどの文字を HTML から探してくる
const gameArea = document.getElementById("game-area");
const scoreText = document.getElementById("score");
const gameOverScreen = document.getElementById("game-over");
const finalScoreText = document.getElementById("final-score");
const retryMessage = document.getElementById("retry-message");

// ゲーム画面の大きさ（2D版と同じ 400 × 600 の比率）
const VIEW_WIDTH = 400;
const VIEW_HEIGHT = 600;

// 遊べる範囲（左端と右端の x）
const FIELD_LEFT = -4.5;
const FIELD_RIGHT = 4.5;

// レンダラー：3Dの世界を、画面に表示できる2Dの絵に変換してくれる道具
// antialias: true でギザギザを目立たなくする
const renderer = new THREE.WebGLRenderer({ antialias: true });
// 高画質な画面（Retina など）でもくっきり表示する。重くなりすぎないよう最大2倍まで
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
// 第3引数の false は「見た目の大きさは CSS にまかせる」という意味
renderer.setSize(VIEW_WIDTH, VIEW_HEIGHT, false);
// 影を描けるようにする
renderer.shadowMap.enabled = true;
// できあがった絵（canvas）を、ゲーム画面の入れ物のいちばん下に入れる
gameArea.prepend(renderer.domElement);

// シーン：3Dの世界そのもの。ここに物やライトを置いていく
const scene = new THREE.Scene();
scene.background = new THREE.Color("#bfe3ff");          // 空の色（水色）
scene.fog = new THREE.Fog("#bfe3ff", 18, 40);            // 遠くをかすませて奥行きを出す

// カメラ：3Dの世界をどこから、どの向きで見るか
// PerspectiveCamera(視野の広さ[度], 横と縦の比率, これより近いものは描かない, これより遠いものは描かない)
const camera = new THREE.PerspectiveCamera(50, VIEW_WIDTH / VIEW_HEIGHT, 0.1, 100);
camera.position.set(0, 9, 15);   // 少し上の手前に置いて
camera.lookAt(0, 5, 0);          // 少し見下ろすように向ける


// ===== 準備：ライト（光） =====
// 3Dでは光がないと真っ暗になる

// 全体をうっすら照らす光（影ができない）
const ambientLight = new THREE.HemisphereLight("#ffffff", "#7a8a6a", 0.7);
scene.add(ambientLight);

// 太陽のように、一方向から照らす光（影ができる）
const sunLight = new THREE.DirectionalLight("#ffffff", 0.9);
// ほぼ真上から照らすので、影が障害物の真下にでき、「落ちてくる場所」の目印になる
sunLight.position.set(0, 20, 2);
sunLight.castShadow = true;       // この光で影を作る
// 影を計算する範囲（遊べる範囲が入るように広げておく）
sunLight.shadow.camera.left = -8;
sunLight.shadow.camera.right = 8;
sunLight.shadow.camera.top = 8;
sunLight.shadow.camera.bottom = -8;
sunLight.shadow.mapSize.set(1024, 1024); // 影のきめ細かさ
scene.add(sunLight);


// ===== 準備：地面 =====

// Mesh（メッシュ）＝「形（Geometry）」と「材質（Material）」を組み合わせた、見える物
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(40, 40),                       // 40 × 40 の平らな板
  new THREE.MeshLambertMaterial({ color: "#5f9e3a" })    // 草のような緑
);
ground.rotation.x = -Math.PI / 2; // 板はもともと立っているので、90度倒して地面にする
ground.receiveShadow = true;      // 影が落ちるようにする
scene.add(ground);

// 遊べる範囲の左右の端に、低い壁を置く（ここから先には行けない目印）
const wallMaterial = new THREE.MeshLambertMaterial({ color: "#8d6e63" });
for (const x of [FIELD_LEFT - 0.25, FIELD_RIGHT + 0.25]) {
  const wall = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 6), wallMaterial);
  wall.position.set(x, 0.3, 0);
  wall.castShadow = true;
  wall.receiveShadow = true;
  scene.add(wall);
}


// ===== プレイヤー =====

const PLAYER_COLOR = "#3a7bd5";   // 青
const HIT_COLOR = "#f5a623";      // 当たったときのオレンジ

const player = {
  size: 1,      // 立方体の1辺の長さ
  speed: 7.5,   // 1秒で動く距離
  mesh: new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshLambertMaterial({ color: PLAYER_COLOR })
  ),
};
player.mesh.castShadow = true;
scene.add(player.mesh);


// ===== 落ちてくるもの（障害物） =====

// 障害物をまとめて入れておく配列
let obstacles = [];

// 障害物はみんな同じ形・同じ材質なので、1つずつ作らずに使い回す（軽くなる）
const OBSTACLE_SIZE = 0.75;
const obstacleGeometry = new THREE.BoxGeometry(OBSTACLE_SIZE, OBSTACLE_SIZE, OBSTACLE_SIZE);
const obstacleMaterial = new THREE.MeshLambertMaterial({ color: "#e94b3c" }); // 赤

// 何秒ごとに新しい障害物を出すか（2D版の 40フレーム ≒ 0.67秒）
const SPAWN_INTERVAL = 0.67;

// 前回出してから何秒たったか
let spawnTimer = 0;

// 障害物が出てくる高さ
const SPAWN_HEIGHT = 13;

// 新しい障害物を1つ作って、世界と配列に追加する
function spawnObstacle() {
  const mesh = new THREE.Mesh(obstacleGeometry, obstacleMaterial);
  mesh.castShadow = true;

  // 横の位置は、遊べる範囲の中でランダム
  const half = OBSTACLE_SIZE / 2;
  const x = FIELD_LEFT + half + Math.random() * (FIELD_RIGHT - FIELD_LEFT - OBSTACLE_SIZE);
  mesh.position.set(x, SPAWN_HEIGHT, 0);

  // 向きもランダムにして、くるくる回しながら落とす
  mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);

  scene.add(mesh);
  obstacles.push({
    mesh: mesh,
    speed: 4.5 + Math.random() * 4.5,        // 1秒で落ちる距離（4.5〜9）
    spin: (Math.random() - 0.5) * 6,          // 回る速さ（向きもランダム）
  });
}


// ===== 当たり判定 =====

// 中心の位置と大きさから、2つの四角が重なっているかを調べる（AABB判定）
// 「横の中心どうしの距離」が「2つの幅の半分を足したもの」より小さく、
// 縦も同じように近ければ、重なっている
// 障害物は回転しているので、少し小さめ（0.9倍）に見て、見た目より厳しくなりすぎないようにしている
function isColliding(playerMesh, obstacleMesh) {
  const reach = (player.size + OBSTACLE_SIZE * 0.9) / 2;
  const dx = Math.abs(playerMesh.position.x - obstacleMesh.position.x); // Math.abs は「マイナスを取った値」
  const dy = Math.abs(playerMesh.position.y - obstacleMesh.position.y);
  return dx < reach && dy < reach;
}


// ===== ゲームの状態とスコア =====

// "playing" ＝ プレイ中、"gameover" ＝ ゲームオーバー
let state = "playing";

// スコア：地面まで落ちきった（よけきった）障害物の数
let score = 0;

// ゲームオーバーになってから何秒たったか
let gameOverTimer = 0;

// リトライできるようになるまでの秒数
const RETRY_DELAY = 0.5;

// スコアの表示を更新する
function showScore() {
  scoreText.textContent = "スコア: " + score;
}


// ===== リトライ（最初からやり直す） =====

function resetGame() {
  // プレイヤーを真ん中に戻し、色も青に戻す
  player.mesh.position.set(0, player.size / 2, 0);
  player.mesh.material.color.set(PLAYER_COLOR);

  // 残っている障害物を世界から取り除く
  for (const obstacle of obstacles) {
    scene.remove(obstacle.mesh);
  }
  obstacles = [];

  spawnTimer = 0;
  score = 0;
  gameOverTimer = 0;
  state = "playing";

  showScore();
  gameOverScreen.hidden = true;  // ゲームオーバー画面を隠す
  retryMessage.hidden = true;
}

function gameOver() {
  state = "gameover";
  player.mesh.material.color.set(HIT_COLOR);
  // 押しっぱなしの状態を消しておく（リトライ直後に勝手に動かないように）
  input.left = false;
  input.right = false;

  finalScoreText.textContent = "スコア: " + score;
  gameOverScreen.hidden = false; // ゲームオーバー画面を出す
}

// ゲームオーバー中で、少し時間がたっていればリトライする
function tryRetry() {
  if (state === "gameover" && gameOverTimer >= RETRY_DELAY) {
    resetGame();
  }
}


// ===== 操作を受け付ける =====

const input = {
  left: false,
  right: false,
};

// --- キーボード（パソコン用） ---

document.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft") input.left = true;
  if (event.key === "ArrowRight") input.right = true;

  // スペースキーかエンターキーでリトライ
  if (event.key === " " || event.key === "Enter") {
    event.preventDefault();  // スペースキーでページがスクロールしないようにする
    tryRetry();
  }
});

document.addEventListener("keyup", (event) => {
  if (event.key === "ArrowLeft") input.left = false;
  if (event.key === "ArrowRight") input.right = false;
});

// --- タッチ（スマホ用） ---
// 画面の左半分を押している間は左へ、右半分を押している間は右へ動く

function handlePointer(event) {
  const rect = gameArea.getBoundingClientRect();
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

gameArea.addEventListener("pointerdown", (event) => {
  gameArea.setPointerCapture(event.pointerId);

  // ゲームオーバー中なら、タップ（クリック）でリトライ
  if (state === "gameover") {
    tryRetry();
    return;
  }

  handlePointer(event);
});
gameArea.addEventListener("pointermove", (event) => {
  if (event.buttons > 0) handlePointer(event);
});
gameArea.addEventListener("pointerup", releasePointer);
gameArea.addEventListener("pointercancel", releasePointer);


// ===== ゲームループ =====

// 時計：前のフレームから何秒たったかを測る
const clock = new THREE.Clock();

// 動きを計算する（更新）
// dt は「前のフレームから何秒たったか」
// 「速さ × dt」だけ動かすと、画面の書き換えが速い端末でも遅い端末でも、同じ速さで動く
function update(dt) {
  if (state === "gameover") {
    gameOverTimer += dt;
    // リトライできるようになったら案内を出す
    if (gameOverTimer >= RETRY_DELAY) retryMessage.hidden = false;
    return;
  }

  // プレイヤーを動かす
  const p = player.mesh.position;
  if (input.left) p.x -= player.speed * dt;
  if (input.right) p.x += player.speed * dt;

  // 遊べる範囲の外に出ないように止める
  const half = player.size / 2;
  if (p.x < FIELD_LEFT + half) p.x = FIELD_LEFT + half;
  if (p.x > FIELD_RIGHT - half) p.x = FIELD_RIGHT - half;

  // 一定の間隔で、新しい障害物を出す
  spawnTimer += dt;
  if (spawnTimer >= SPAWN_INTERVAL) {
    spawnObstacle();
    spawnTimer = 0;
  }

  // 障害物を落としながら回す
  for (const obstacle of obstacles) {
    obstacle.mesh.position.y -= obstacle.speed * dt;
    obstacle.mesh.rotation.x += obstacle.spin * dt;
    obstacle.mesh.rotation.z += obstacle.spin * dt;
  }

  // どれか1つでもプレイヤーに当たっていたらゲームオーバー
  if (obstacles.some((obstacle) => isColliding(player.mesh, obstacle.mesh))) {
    gameOver();
    return;
  }

  // 地面まで落ちた障害物は、世界と配列から取り除き、その分スコアを増やす
  const landed = obstacles.filter((obstacle) => obstacle.mesh.position.y <= OBSTACLE_SIZE / 2);
  for (const obstacle of landed) {
    scene.remove(obstacle.mesh);
  }
  obstacles = obstacles.filter((obstacle) => obstacle.mesh.position.y > OBSTACLE_SIZE / 2);

  if (landed.length > 0) {
    score += landed.length;
    showScore();
  }
}

function gameLoop() {
  // 前のフレームからの時間。タブを切りかえて戻ったときなどに一気に進まないよう、最大0.05秒にする
  const dt = Math.min(clock.getDelta(), 0.05);
  update(dt);
  // カメラから見た3Dの世界を描く
  renderer.render(scene, camera);
  requestAnimationFrame(gameLoop);
}

// ゲームを初期状態にしてから、ゲームループを開始する
resetGame();
gameLoop();
