// よけるゲーム 3D版
// 遊び方は2D版（2d/game.js）と同じ。絵を描く部分を Three.js（3Dライブラリ）に置きかえている
//
// 【3Dの世界の決まり】
// - 長さの単位は「ピクセル」ではなく、Three.js の「1単位」（1マスくらいの感覚）
// - x は左右（右がプラス）、y は上下（上がプラス）、z は手前と奥（手前がプラス）
//   ※ 2D版と違って、y は「上に行くほど大きく」なる
// - 地面は y = 0。プレイヤーは地面の上を、左右（x）と奥行き（z）に動く


// ===== 準備：画面と3Dの世界を作る =====

// ゲーム画面の入れ物と、スコアなどの文字を HTML から探してくる
const gameArea = document.getElementById("game-area");
const scoreText = document.getElementById("score");
const gameOverScreen = document.getElementById("game-over");
const finalScoreText = document.getElementById("final-score");
const retryMessage = document.getElementById("retry-message");
const stick = document.getElementById("stick");
const stickKnob = document.getElementById("stick-knob");

// ゲーム画面の大きさ（2D版と同じ 400 × 600 の比率）
const VIEW_WIDTH = 400;
const VIEW_HEIGHT = 600;

// 遊べる範囲（左右の端の x と、奥・手前の端の z）
const FIELD_LEFT = -4.5;
const FIELD_RIGHT = 4.5;
const FIELD_BACK = -3;   // 奥の端（z はマイナスほど奥）
const FIELD_FRONT = 3;   // 手前の端

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
scene.fog = new THREE.Fog("#bfe3ff", 26, 50);            // 遠くをかすませて奥行きを出す

// カメラ：3Dの世界をどこから、どの向きで見るか
// PerspectiveCamera(視野の広さ[度], 横と縦の比率, これより近いものは描かない, これより遠いものは描かない)
const camera = new THREE.PerspectiveCamera(50, VIEW_WIDTH / VIEW_HEIGHT, 0.1, 100);
// カメラの置き場所は「ゲームループ」の updateCamera() で毎フレーム決める（ぐるぐる回る）


// ===== 準備：ライト（光） =====
// 3Dでは光がないと真っ暗になる

// 全体をうっすら照らす光（影ができない）
const ambientLight = new THREE.HemisphereLight("#ffffff", "#7a8a6a", 0.7);
scene.add(ambientLight);

// 太陽のように、一方向から照らす光（影ができる）
const sunLight = new THREE.DirectionalLight("#ffffff", 0.9);
// 真上から照らすので、影が障害物の真下にでき、「落ちてくる場所」の目印になる
// 奥行きがあると高さが分かりにくいので、この影がとても大事
sunLight.position.set(0, 20, 0);
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

// 遊べる範囲だけ、少し明るい色の地面を重ねて分かりやすくする
const fieldWidth = FIELD_RIGHT - FIELD_LEFT;
const fieldDepth = FIELD_FRONT - FIELD_BACK;
const field = new THREE.Mesh(
  new THREE.PlaneGeometry(fieldWidth, fieldDepth),
  new THREE.MeshLambertMaterial({ color: "#7cc04a" })
);
field.rotation.x = -Math.PI / 2;
// 地面とまったく同じ高さだとチラつくので、ほんの少しだけ上に置く
field.position.set((FIELD_LEFT + FIELD_RIGHT) / 2, 0.01, (FIELD_BACK + FIELD_FRONT) / 2);
field.receiveShadow = true;
scene.add(field);

// ===== 準備：牧場の柵 =====
// 遊べる範囲の左右と奥に、木の柵を立てる（ここから先には行けない目印）
// 柵は「杭（くい）」を等間隔に立てて、その間に横木（よこぎ）を2本渡したもの
// 手前は、柵があるとプレイヤーが見えにくくなるので置かない

const fenceMaterial = new THREE.MeshLambertMaterial({ color: "#a47148" }); // 木の色
const FENCE_HEIGHT = 1.0;     // 杭の高さ
const POST_SIZE = 0.16;       // 杭の太さ
const POST_SPACING = 1.5;     // 杭と杭のだいたいの間隔
const RAIL_HEIGHTS = [0.4, 0.8]; // 横木を渡す高さ（2本）
const FENCE_GAP = 0.25;       // 遊べる範囲の端から、柵までのすき間

// 物を作って世界に置き、影を落とす・受ける設定もする
function addBox(width, height, depth, material, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

// 点 (x1, z1) から点 (x2, z2) まで、まっすぐな柵を1本作る
function addFence(x1, z1, x2, z2) {
  const length = Math.hypot(x2 - x1, z2 - z1);
  // 杭の数：長さを間隔で割って、端数は切り上げ（Math.ceil）。両端にも立てるので +1
  const sections = Math.ceil(length / POST_SPACING);
  for (let i = 0; i <= sections; i++) {
    const t = i / sections; // 0（始まり）〜 1（終わり）
    const x = x1 + (x2 - x1) * t;
    const z = z1 + (z2 - z1) * t;
    addBox(POST_SIZE, FENCE_HEIGHT, POST_SIZE, fenceMaterial, x, FENCE_HEIGHT / 2, z);
  }

  // 横木：柵の向きに合わせて、長い板を置く
  const alongX = Math.abs(x2 - x1) > Math.abs(z2 - z1); // 横向き（左右に伸びる）柵かどうか
  for (const y of RAIL_HEIGHTS) {
    addBox(
      alongX ? length : 0.06,  // 横向きなら x 方向に長く
      0.1,
      alongX ? 0.06 : length,  // 縦向きなら z 方向に長く
      fenceMaterial,
      (x1 + x2) / 2, y, (z1 + z2) / 2
    );
  }
}

const fenceLeft = FIELD_LEFT - FENCE_GAP;
const fenceRight = FIELD_RIGHT + FENCE_GAP;
const fenceBack = FIELD_BACK - FENCE_GAP;
addFence(fenceLeft, fenceBack, fenceRight, fenceBack);    // 奥
addFence(fenceLeft, fenceBack, fenceLeft, FIELD_FRONT);   // 左
addFence(fenceRight, fenceBack, fenceRight, FIELD_FRONT); // 右


// ===== 準備：牛 =====
// 柵の後ろに、白黒の牛（ホルスタイン）を置く。ゲームには関係しない飾り
// 牛は箱を組み合わせて作る。Group（グループ）は、いくつかの物をまとめて1つとして動かせる入れ物

const cowWhite = new THREE.MeshLambertMaterial({ color: "#f5f5f0" });
const cowBlack = new THREE.MeshLambertMaterial({ color: "#2b2b2b" });
const cowPink = new THREE.MeshLambertMaterial({ color: "#f2a7a7" });
const cowHorn = new THREE.MeshLambertMaterial({ color: "#e8dcc0" });

// 箱を1つ作って、グループの中の (x, y, z) に置く
function addPart(group, width, height, depth, material, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  group.add(mesh);
  return mesh;
}

// 牛を1頭作る。頭は +x の向きについている
function makeCow() {
  const cow = new THREE.Group();

  // 胴体と、黒いぶち模様（胴体から少しだけはみ出させて、表面に見えるようにする）
  addPart(cow, 1.6, 0.8, 0.8, cowWhite, 0, 1.0, 0);
  addPart(cow, 0.5, 0.5, 0.82, cowBlack, -0.3, 1.1, 0);    // 両側面のぶち
  addPart(cow, 0.35, 0.3, 0.82, cowBlack, 0.45, 0.85, 0);
  addPart(cow, 0.4, 0.82, 0.35, cowBlack, 0.05, 1.0, 0.1); // 背中のぶち
  addPart(cow, 0.3, 0.3, 0.3, cowPink, -0.2, 0.55, 0);     // おっぱい

  // 足（4本）。付け根を中心に回せるよう、それぞれグループにする
  const legs = [];
  for (const [x, z] of [[0.6, 0.25], [0.6, -0.25], [-0.6, 0.25], [-0.6, -0.25]]) {
    const leg = new THREE.Group();
    leg.position.set(x, 0.7, z);              // 付け根の位置
    addPart(leg, 0.2, 0.7, 0.2, cowWhite, 0, -0.35, 0);
    addPart(leg, 0.22, 0.12, 0.22, cowBlack, 0, -0.66, 0); // ひづめ
    cow.add(leg);
    legs.push(leg);
  }

  // しっぽ
  addPart(cow, 0.08, 0.6, 0.08, cowWhite, -0.82, 0.95, 0);
  addPart(cow, 0.12, 0.15, 0.12, cowBlack, -0.82, 0.62, 0);

  // 頭。首の付け根を中心に、うなずくように回せるようグループにする
  const head = new THREE.Group();
  head.position.set(0.8, 1.2, 0);             // 首の付け根の位置
  addPart(head, 0.5, 0.5, 0.5, cowWhite, 0.3, 0.05, 0);
  addPart(head, 0.2, 0.3, 0.52, cowBlack, 0.2, 0.15, 0);  // 顔のぶち
  addPart(head, 0.2, 0.25, 0.4, cowPink, 0.6, -0.1, 0);   // 鼻先
  addPart(head, 0.08, 0.2, 0.08, cowHorn, 0.25, 0.38, 0.18);  // 角
  addPart(head, 0.08, 0.2, 0.08, cowHorn, 0.25, 0.38, -0.18);
  addPart(head, 0.1, 0.12, 0.25, cowBlack, 0.2, 0.2, 0.35);   // 耳
  addPart(head, 0.1, 0.12, 0.25, cowBlack, 0.2, 0.2, -0.35);
  cow.add(head);

  scene.add(cow);
  // 動かすときに使うものを、まとめて返す
  return { group: cow, head: head, legs: legs, phase: Math.random() * 10 };
}

// 柵の後ろに3頭置く
// walking: true の牛は、柵に沿って左右に歩く。ほかの牛は草を食べている
const cows = [];
const COW_Z = fenceBack - 2.8;  // 柵から少し離れた奥（柵と牛の間を、ランニングする人が通る）
function placeCow(x, z, angle, walking) {
  const cow = makeCow();
  cow.group.position.set(x, 0, z);
  cow.group.rotation.y = angle;    // 向き（ラジアン。Math.PI で半回転）
  cow.walking = walking;
  cow.direction = 1;               // 歩く向き（1＝右、-1＝左）
  cow.away = false;                // おじゃましに出かけている間は true（このときは下の動きをしない）
  cows.push(cow);
}
placeCow(-3.6, COW_Z, 0.4, false);
placeCow(0, COW_Z - 0.6, 0, true);
placeCow(3.9, COW_Z + 0.2, Math.PI - 0.5, false);

// 牛を少しずつ動かす。time は「ゲームが始まってからの秒数」、dt は「前のフレームからの秒数」
function updateCows(time, dt) {
  for (const cow of cows) {
    if (cow.away) continue;  // おじゃま中の牛は「おじゃま牛」のところで動かす
    const t = time + cow.phase;

    if (cow.walking) {
      // 柵に沿って左右に歩き、端まで来たら向きを変える
      const pos = cow.group.position;
      pos.x += cow.direction * 0.6 * dt;
      // ほかの牛にぶつからないよう、x が -1.3〜1.3 の間だけを歩く
      if (pos.x > 1.3) cow.direction = -1;
      if (pos.x < -1.3) cow.direction = 1;
      // 頭が進む向きを向くようにする（右向き＝0、左向き＝半回転）
      cow.group.rotation.y = cow.direction === 1 ? 0 : Math.PI;
      // 足を前後にふる。Math.sin は -1〜1 をなめらかに行ったり来たりする
      const swing = Math.sin(t * 6) * 0.4;
      cow.legs[0].rotation.z = swing;
      cow.legs[3].rotation.z = swing;
      cow.legs[1].rotation.z = -swing;
      cow.legs[2].rotation.z = -swing;
      cow.head.rotation.z = Math.sin(t * 3) * 0.05;
    } else {
      // 草を食べる：ゆっくり頭を下げたり上げたりする
      // 0〜1 の間で行ったり来たりする値を作り、それに合わせて頭を下げる
      const graze = (Math.sin(t * 0.8) + 1) / 2;
      cow.head.rotation.z = -graze * 0.9;
    }
  }
}


// ===== 準備：ランニングする人 =====
// 柵のまわりを、2人がぐるぐる走っている。ゲームには関係しない飾り（当たり判定なし）
// 人も牛と同じように箱を組み合わせて作る。顔は +x の向き

const skinMaterial = new THREE.MeshLambertMaterial({ color: "#f1c27d" });
const shoeMaterial = new THREE.MeshLambertMaterial({ color: "#333333" });

// 人を1人作る（シャツの色, ズボンの色, 髪の色）
function makeRunner(shirtColor, pantsColor, hairColor) {
  const shirt = new THREE.MeshLambertMaterial({ color: shirtColor });
  const pants = new THREE.MeshLambertMaterial({ color: pantsColor });
  const hair = new THREE.MeshLambertMaterial({ color: hairColor });

  const runner = new THREE.Group();
  // 体全体を上下にはずませるため、もう1つ内側にグループを作る
  const body = new THREE.Group();
  runner.add(body);

  addPart(body, 0.3, 0.6, 0.5, shirt, 0, 1.15, 0);        // 胴体
  addPart(body, 0.32, 0.32, 0.32, skinMaterial, 0, 1.65, 0); // 頭
  addPart(body, 0.34, 0.1, 0.34, hair, -0.01, 1.84, 0);    // 髪（頭の上）
  addPart(body, 0.1, 0.25, 0.34, hair, -0.13, 1.7, 0);     // 髪（後ろ）

  // 足（2本）。付け根（腰）を中心に前後にふる
  const legs = [];
  for (const z of [0.12, -0.12]) {
    const leg = new THREE.Group();
    leg.position.set(0, 0.85, z);
    addPart(leg, 0.18, 0.75, 0.18, pants, 0, -0.38, 0);
    addPart(leg, 0.28, 0.1, 0.2, shoeMaterial, 0.04, -0.8, 0); // くつ
    body.add(leg);
    legs.push(leg);
  }

  // 腕（2本）。付け根（肩）を中心に、足と逆向きにふる
  const arms = [];
  for (const z of [0.32, -0.32]) {
    const arm = new THREE.Group();
    arm.position.set(0, 1.4, z);
    addPart(arm, 0.14, 0.45, 0.14, shirt, 0, -0.22, 0);
    addPart(arm, 0.14, 0.12, 0.14, skinMaterial, 0, -0.5, 0); // 手
    body.add(arm);
    arms.push(arm);
  }

  scene.add(runner);
  return { group: runner, body: body, legs: legs, arms: arms };
}

// 走るコース：柵の外側を、柵から lane だけ離れた長方形
// distance（スタートから走った距離）から、今いる場所と向きを計算する
function runnerPlace(lane, distance) {
  const xMin = fenceLeft - lane;
  const xMax = fenceRight + lane;
  const zMin = fenceBack - lane;
  const zMax = FIELD_FRONT + lane;
  const w = xMax - xMin;
  const d = zMax - zMin;
  // 1周の長さで割った余り（%）を使うと、何周しても同じコースをくり返す
  let s = distance % (2 * (w + d));

  // 奥 → 右 → 手前 → 左 の順に、4つの辺を走る
  if (s < w) return { x: xMin + s, z: zMin, angle: 0 };                       // 奥の辺：右へ
  s -= w;
  if (s < d) return { x: xMax, z: zMin + s, angle: -Math.PI / 2 };            // 右の辺：手前へ
  s -= d;
  if (s < w) return { x: xMax - s, z: zMax, angle: Math.PI };                 // 手前の辺：左へ
  s -= w;
  return { x: xMin, z: zMax - s, angle: Math.PI / 2 };                        // 左の辺：奥へ
}

// 2人の設定：コース（柵からの距離）、速さ（1秒に走る距離）、スタート位置
const runners = [
  { ...makeRunner("#e53935", "#263238", "#3e2723"), lane: 1.0, speed: 2.4, distance: 0 },
  { ...makeRunner("#fdd835", "#1565c0", "#212121"), lane: 1.5, speed: 2.0, distance: 18 },
];
// ※ { ...A, ... } は「A の中身をコピーして、さらに項目を足したもの」を作る書き方

function updateRunners(time, dt) {
  for (const runner of runners) {
    runner.distance += runner.speed * dt;
    const place = runnerPlace(runner.lane, runner.distance);
    runner.group.position.set(place.x, 0, place.z);
    runner.group.rotation.y = place.angle;

    // 手足を前後にふって、体を上下にはずませる
    const step = time * runner.speed * 4;
    const swing = Math.sin(step) * 0.7;
    runner.legs[0].rotation.z = swing;
    runner.legs[1].rotation.z = -swing;
    runner.arms[0].rotation.z = -swing;
    runner.arms[1].rotation.z = swing;
    runner.body.position.y = Math.abs(Math.sin(step)) * 0.08;
  }
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

// 何秒ごとに新しい障害物を出すか
// 奥行きの分だけ当たりにくくなったので、2D版（約0.67秒ごと）より多めに出す
const SPAWN_INTERVAL = 0.25;

// 前回出してから何秒たったか
let spawnTimer = 0;

// 障害物が出てくる高さ
const SPAWN_HEIGHT = 13;

// 新しい障害物を1つ作って、世界と配列に追加する
function spawnObstacle() {
  const mesh = new THREE.Mesh(obstacleGeometry, obstacleMaterial);
  mesh.castShadow = true;

  // 左右（x）と奥行き（z）の位置は、遊べる範囲の中でランダム
  const half = OBSTACLE_SIZE / 2;
  const x = FIELD_LEFT + half + Math.random() * (fieldWidth - OBSTACLE_SIZE);
  const z = FIELD_BACK + half + Math.random() * (fieldDepth - OBSTACLE_SIZE);
  mesh.position.set(x, SPAWN_HEIGHT, z);

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

// 中心の位置と大きさから、2つの立方体が重なっているかを調べる（AABB判定）
// 「左右の中心どうしの距離」が「2つの幅の半分を足したもの」より小さく、
// 上下と奥行きも同じように近ければ、重なっている
// 障害物は回転しているので、少し小さめ（0.9倍）に見て、見た目より厳しくなりすぎないようにしている
function isColliding(playerMesh, obstacleMesh) {
  const reach = (player.size + OBSTACLE_SIZE * 0.9) / 2;
  const dx = Math.abs(playerMesh.position.x - obstacleMesh.position.x); // Math.abs は「マイナスを取った値」
  const dy = Math.abs(playerMesh.position.y - obstacleMesh.position.y);
  const dz = Math.abs(playerMesh.position.z - obstacleMesh.position.z);
  return dx < reach && dy < reach && dz < reach;
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
  // カメラの注目点もすぐ真ん中に戻す（ゆっくり戻ると、やり直した直後に画面が流れて見にくいため）
  cameraFocus.set(0, 0, 0);
  // おじゃま中の牛がいたら、すぐ元の場所に帰す
  resetIntruder();

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
  clearInput();

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

// 今どのキーが押されているかを覚えておく入れ物（true＝押されている）
const keys = {
  left: false,
  right: false,
  up: false,     // ↑：奥へ
  down: false,   // ↓：手前へ
};

// スマホのスティックの状態
const touch = {
  active: false, // 指が触れているか
  startX: 0,     // 指を置いた場所（ゲーム画面の左上からの位置）
  startY: 0,
  x: 0,          // スティックをどれだけ倒しているか（-1〜1）
  y: 0,
};

// スティックを最大まで倒したときの、指の移動距離（ピクセル）
const STICK_RADIUS = 40;

// 入力をすべて「押していない」状態に戻す
function clearInput() {
  keys.left = keys.right = keys.up = keys.down = false;
  touch.active = false;
  touch.x = touch.y = 0;
  stick.hidden = true;
}

// 今どちらへ動きたいかを、画面から見た向きで { x, z } で返す（それぞれ -1〜1）
// x：マイナスが画面の左、プラスが画面の右　z：マイナスが画面の奥、プラスが画面の手前
// カメラが回っているので、実際に3Dの世界でどちらへ動くかは update() で計算する
function getMoveDirection() {
  if (touch.active) {
    // 画面の上方向（指を上にすべらせる）＝ 奥 なので、そのまま z に使える
    return { x: touch.x, z: touch.y };
  }

  let x = 0;
  let z = 0;
  if (keys.left) x -= 1;
  if (keys.right) x += 1;
  if (keys.up) z -= 1;
  if (keys.down) z += 1;

  // ななめ移動のときに速くなりすぎないよう、長さを1にそろえる
  // Math.hypot(x, z) は「(0,0) から (x,z) までの距離」を計算する
  const length = Math.hypot(x, z);
  if (length > 1) {
    x /= length;
    z /= length;
  }
  return { x: x, z: z };
}

// --- キーボード（パソコン用） ---

document.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft") keys.left = true;
  if (event.key === "ArrowRight") keys.right = true;
  if (event.key === "ArrowUp") keys.up = true;
  if (event.key === "ArrowDown") keys.down = true;

  // 矢印キーやスペースキーで、ページがスクロールしないようにする
  if (event.key.startsWith("Arrow") || event.key === " ") {
    event.preventDefault();
  }

  // スペースキーかエンターキーでリトライ
  if (event.key === " " || event.key === "Enter") {
    tryRetry();
  }
});

document.addEventListener("keyup", (event) => {
  if (event.key === "ArrowLeft") keys.left = false;
  if (event.key === "ArrowRight") keys.right = false;
  if (event.key === "ArrowUp") keys.up = false;
  if (event.key === "ArrowDown") keys.down = false;
});

// --- タッチ（スマホ用）：バーチャルスティック ---
// 指を置いた場所にスティックが出て、そこから指をすべらせた方向へ動く
// すべらせる距離が大きいほど速く動く（STICK_RADIUS で最大）

// 指の位置を、ゲーム画面の左上からの位置に直す
function pointerPosition(event) {
  const rect = gameArea.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

gameArea.addEventListener("pointerdown", (event) => {
  gameArea.setPointerCapture(event.pointerId);

  // ゲームオーバー中なら、タップ（クリック）でリトライ
  if (state === "gameover") {
    tryRetry();
    return;
  }

  const pos = pointerPosition(event);
  touch.active = true;
  touch.startX = pos.x;
  touch.startY = pos.y;
  touch.x = 0;
  touch.y = 0;

  // 指を置いた場所にスティックを出す
  stick.style.left = pos.x + "px";
  stick.style.top = pos.y + "px";
  stickKnob.style.transform = "translate(0px, 0px)";
  stick.hidden = false;
});

gameArea.addEventListener("pointermove", (event) => {
  if (!touch.active) return;  // ! は「〜でない」。指が触れていなければ何もしない

  const pos = pointerPosition(event);
  let dx = pos.x - touch.startX;
  let dy = pos.y - touch.startY;

  // 最大の距離より遠くまですべらせても、そこで止める
  const length = Math.hypot(dx, dy);
  if (length > STICK_RADIUS) {
    dx = (dx / length) * STICK_RADIUS;
    dy = (dy / length) * STICK_RADIUS;
  }

  // -1〜1 の値にして覚えておく
  touch.x = dx / STICK_RADIUS;
  touch.y = dy / STICK_RADIUS;

  // 内側の丸を、指の方向にずらして表示する
  stickKnob.style.transform = "translate(" + dx + "px, " + dy + "px)";
});

function releasePointer() {
  touch.active = false;
  touch.x = 0;
  touch.y = 0;
  stick.hidden = true;
}
gameArea.addEventListener("pointerup", releasePointer);
gameArea.addEventListener("pointercancel", releasePointer);


// ===== ゲームループ =====

// 時計：前のフレームから何秒たったかを測る
const clock = new THREE.Clock();


// ===== カメラ：プレイヤーを追いかけながら、ぐるぐる回る =====
// カメラは「注目点」を見下ろしながら、そのまわりを円をえがくようにゆっくり回る
// 注目点はプレイヤーを少し遅れて追いかけるので、カメラもプレイヤーについていく
// 酔いにくいように、回る速さは一定（1周に60秒）、追いかけ方もなめらかにしている

const CAMERA_HEIGHT = 16;   // カメラの高さ（障害物が出てくる高さ 13 より上にする）
const CAMERA_RADIUS = 8;    // 注目点から、カメラまでの横の距離（円の半径）
const CAMERA_TURN_SPEED = (Math.PI * 2) / 60; // 1秒に回る角度（Math.PI * 2 が1周 ＝ 360度）
const CAMERA_FOLLOW = 3;    // 追いかける強さ。大きいほどすばやく追いつく

let cameraAngle = 0;        // 今の角度。0 のときは真正面（手前）から見ている
let cameraTurning = true;   // 回すかどうか（ボタンや C キーで切りかえる）

// カメラが見ている点（注目点）。Vector3 は (x, y, z) の3つの数をまとめたもの
const cameraFocus = new THREE.Vector3(0, 0, 0);

function updateCamera(dt) {
  if (cameraTurning) {
    cameraAngle += CAMERA_TURN_SPEED * dt;
  }

  // 注目点を、プレイヤーの足もとに少しずつ近づける
  // lerp は「今の位置から目標の位置へ、決めた割合だけ近づける」命令
  // 割合を 1 - Math.exp(-強さ × 秒数) にすると、端末の速さにかかわらず同じように追いかける
  const target = new THREE.Vector3(player.mesh.position.x, 0, player.mesh.position.z);
  cameraFocus.lerp(target, 1 - Math.exp(-CAMERA_FOLLOW * dt));

  // 円の上の位置は、角度の sin と cos で計算できる。それを注目点の分だけずらす
  camera.position.set(
    cameraFocus.x + Math.sin(cameraAngle) * CAMERA_RADIUS,
    CAMERA_HEIGHT,
    cameraFocus.z + Math.cos(cameraAngle) * CAMERA_RADIUS
  );

  // 牛が着地した直後は、カメラを少しだけ揺らす（だんだん小さくなる）
  if (shakeTimer > 0) {
    shakeTimer -= dt;
    const size = SHAKE_SIZE * Math.max(shakeTimer, 0) / SHAKE_TIME;
    camera.position.x += (Math.random() - 0.5) * 2 * size;
    camera.position.y += (Math.random() - 0.5) * 2 * size;
  }

  camera.lookAt(cameraFocus); // いつも注目点（プレイヤーのあたり）を見る
}

// 回転のオン・オフを切りかえる
const cameraButton = document.getElementById("camera-toggle");
function toggleCamera() {
  cameraTurning = !cameraTurning; // ! で true と false を入れかえる
  cameraButton.textContent = cameraTurning ? "カメラの回転を止める" : "カメラを回す";
}
cameraButton.addEventListener("click", (event) => {
  toggleCamera();
  // マウスや指で押したときは、ボタンの選択を外す
  // （選択されたままだと、リトライのつもりでスペースキーを押したときにボタンも押されてしまう）
  if (event.detail > 0) cameraButton.blur();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "c" || event.key === "C") toggleCamera();
});

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

  // プレイヤーを動かす（左右と奥行き）
  // 入力は「画面から見た向き」なので、カメラが回っている角度の分だけ向きを回してから使う
  // こうすると、カメラがどこにいても「上にすべらせる＝画面の奥へ進む」になる
  const p = player.mesh.position;
  const move = getMoveDirection();
  const cos = Math.cos(cameraAngle);
  const sin = Math.sin(cameraAngle);
  const worldX = move.x * cos + move.z * sin;
  const worldZ = -move.x * sin + move.z * cos;
  p.x += worldX * player.speed * dt;
  p.z += worldZ * player.speed * dt;

  // おじゃま牛がいたら、牛の中に入れないように押し返す
  pushPlayerOutOfCow();

  // 遊べる範囲の外に出ないように止める
  const half = player.size / 2;
  if (p.x < FIELD_LEFT + half) p.x = FIELD_LEFT + half;
  if (p.x > FIELD_RIGHT - half) p.x = FIELD_RIGHT - half;
  if (p.z < FIELD_BACK + half) p.z = FIELD_BACK + half;
  if (p.z > FIELD_FRONT - half) p.z = FIELD_FRONT - half;

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

// ===== おじゃま牛 =====
// ときどき牛が柵を飛び越えて、プレイヤーの近くに居座る
// 驚かせすぎないように、飛ぶ1秒前に「モ〜？」と予告し、着地の揺れも小さくしている
// 牛にぶつかってもゲームオーバーにはならない。通れなくなるだけ

const WARN_TIME = 1;       // 予告してから飛ぶまでの秒数
const JUMP_TIME = 1;       // ジャンプにかかる秒数
const STAY_TIME = 4;       // 居座る秒数
const JUMP_HEIGHT = 3.5;   // ジャンプの高さ（柵の高さは 1）
const COW_BLOCK_RADIUS = 1.0; // 牛の「通れない範囲」の半径
const SHAKE_TIME = 0.3;    // 着地のときにカメラが揺れる秒数
// 揺れの大きさ。「動きを減らす」設定にしている人には揺らさない
const SHAKE_SIZE = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 0.12;

let shakeTimer = 0;
const cowBubble = document.getElementById("cow-bubble");

const intruder = {
  cow: null,        // 今おじゃましている牛（いなければ null）
  mode: "none",     // "none" 来ていない / "warn" 予告中 / "jumpIn" 飛びこみ中 / "stay" 居座り中 / "jumpOut" 帰り中
  timer: 0,         // 今の mode になってからの秒数
  nextIn: 8,        // 次の牛が来るまでの秒数
  from: new THREE.Vector3(), // ジャンプの出発点
  to: new THREE.Vector3(),   // ジャンプの着地点
  home: new THREE.Vector3(), // 牛が元いた場所
  homeAngle: 0,              // 牛が元いたときの向き
};

// 牛の向きを、(x, z) の点の方へ向ける（牛の頭は +x の向きについている）
// Math.atan2(縦, 横) は「その方向が何度か」を計算する
function faceCowTo(cow, x, z) {
  const pos = cow.group.position;
  cow.group.rotation.y = Math.atan2(-(z - pos.z), x - pos.x);
}

// 着地する場所を決める：プレイヤーから 2〜3.5 離れた、遊べる範囲の中
function chooseLanding() {
  const p = player.mesh.position;
  const margin = 0.8;
  for (let i = 0; i < 30; i++) {  // 範囲に入る場所が見つかるまで、何回か試す
    const angle = Math.random() * Math.PI * 2;
    const distance = 2 + Math.random() * 1.5;
    const x = p.x + Math.cos(angle) * distance;
    const z = p.z + Math.sin(angle) * distance;
    if (x > FIELD_LEFT + margin && x < FIELD_RIGHT - margin &&
        z > FIELD_BACK + margin && z < FIELD_FRONT - margin) {
      return new THREE.Vector3(x, 0, z);
    }
  }
  // 見つからなかったら、プレイヤーの反対側に降りる
  return new THREE.Vector3(p.x > 0 ? -3 : 3, 0, 0);
}

// 吹き出しを出す（文字, ポンと飛び出す動きをつけるか）
function showBubble(text, pop) {
  cowBubble.textContent = text;
  cowBubble.hidden = false;
  cowBubble.classList.remove("pop");
  if (pop) {
    void cowBubble.offsetWidth; // 動きを最初からやり直すためのおまじない
    cowBubble.classList.add("pop");
  }
}

// 吹き出しを牛の頭の上に合わせる（3Dの位置を、画面の上の位置に変換する）
function placeBubble() {
  if (cowBubble.hidden || !intruder.cow) return;
  const headPos = new THREE.Vector3();
  intruder.cow.head.getWorldPosition(headPos);
  headPos.y += 0.9;
  headPos.project(camera); // 画面の左端が -1、右端が 1、下が -1、上が 1 になる
  cowBubble.style.left = ((headPos.x + 1) / 2) * gameArea.clientWidth + "px";
  cowBubble.style.top = ((1 - headPos.y) / 2) * gameArea.clientHeight + "px";
}

// ジャンプ中の位置：出発点から着地点へまっすぐ進みながら、山なりに上がって下がる
function moveAlongJump(cow, progress) {
  cow.group.position.lerpVectors(intruder.from, intruder.to, progress);
  // 4 × 高さ × t × (1 - t) は、t が 0 と 1 のとき 0、真ん中で「高さ」になる山の形
  cow.group.position.y = 4 * JUMP_HEIGHT * progress * (1 - progress);
  // 足をたたんで飛んでいるように見せる
  cow.legs[0].rotation.z = cow.legs[1].rotation.z = 0.6;
  cow.legs[2].rotation.z = cow.legs[3].rotation.z = -0.6;
}

function setIntruderMode(mode) {
  intruder.mode = mode;
  intruder.timer = 0;
}

function updateIntruder(dt) {
  intruder.timer += dt;
  const cow = intruder.cow;

  if (intruder.mode === "none") {
    // プレイ中だけ、次の牛が来るまでの時間を数える
    if (state !== "playing") return;
    intruder.nextIn -= dt;
    if (intruder.nextIn > 0) return;

    // 3頭の中からランダムに1頭選ぶ。Math.floor は小数を切り捨てる
    intruder.cow = cows[Math.floor(Math.random() * cows.length)];
    intruder.cow.away = true;
    intruder.home.copy(intruder.cow.group.position);
    intruder.homeAngle = intruder.cow.group.rotation.y;
    faceCowTo(intruder.cow, player.mesh.position.x, player.mesh.position.z);
    showBubble("モ〜？", false);
    setIntruderMode("warn");

  } else if (intruder.mode === "warn") {
    // 予告中：頭をすばやく上下にふる
    cow.head.rotation.z = Math.sin(intruder.timer * 18) * 0.25;
    if (intruder.timer >= WARN_TIME) {
      intruder.from.copy(cow.group.position);
      intruder.to.copy(chooseLanding());
      faceCowTo(cow, intruder.to.x, intruder.to.z);
      cow.head.rotation.z = 0;
      cowBubble.hidden = true;
      setIntruderMode("jumpIn");
    }

  } else if (intruder.mode === "jumpIn") {
    const progress = Math.min(intruder.timer / JUMP_TIME, 1);
    moveAlongJump(cow, progress);
    if (progress >= 1) {
      // 着地！
      for (const leg of cow.legs) leg.rotation.z = 0;
      shakeTimer = SHAKE_TIME;
      showBubble("モ〜！", true);
      setIntruderMode("stay");
    }

  } else if (intruder.mode === "stay") {
    // 居座り中：プレイヤーの方を向いて、ゆっくり頭をふる
    faceCowTo(cow, player.mesh.position.x, player.mesh.position.z);
    cow.head.rotation.z = Math.sin(intruder.timer * 4) * 0.15;
    if (intruder.timer >= 1.5) cowBubble.hidden = true;
    if (intruder.timer >= STAY_TIME) {
      intruder.from.copy(cow.group.position);
      intruder.to.copy(intruder.home);
      faceCowTo(cow, intruder.to.x, intruder.to.z);
      cow.head.rotation.z = 0;
      cowBubble.hidden = true;
      setIntruderMode("jumpOut");
    }

  } else if (intruder.mode === "jumpOut") {
    const progress = Math.min(intruder.timer / JUMP_TIME, 1);
    moveAlongJump(cow, progress);
    if (progress >= 1) {
      finishIntruder();
    }
  }

  placeBubble();
}

// 牛を元の場所と向きに戻して、次の牛が来るまでの時間を決める
function finishIntruder() {
  const cow = intruder.cow;
  if (cow) {
    cow.group.position.copy(intruder.home);
    cow.group.rotation.y = intruder.homeAngle;
    cow.head.rotation.z = 0;
    for (const leg of cow.legs) leg.rotation.z = 0;
    cow.away = false;
  }
  intruder.cow = null;
  cowBubble.hidden = true;
  setIntruderMode("none");
  intruder.nextIn = 10 + Math.random() * 6; // 10〜16秒後
}

// リトライしたとき：おじゃま中の牛をすぐ帰して、最初の牛は8秒後に来るようにする
function resetIntruder() {
  finishIntruder();
  intruder.nextIn = 8;
  shakeTimer = 0;
}

// 居座っている牛の中に、プレイヤーが入れないように押し返す
function pushPlayerOutOfCow() {
  if (intruder.mode !== "stay") return;
  const p = player.mesh.position;
  const c = intruder.cow.group.position;
  let dx = p.x - c.x;
  let dz = p.z - c.z;
  let distance = Math.hypot(dx, dz);
  const minDistance = COW_BLOCK_RADIUS + player.size / 2;
  if (distance >= minDistance) return;
  if (distance < 0.001) {  // ちょうど同じ場所なら、とりあえず右へ押し出す
    dx = 1;
    dz = 0;
    distance = 1;
  }
  // 牛の中心からプレイヤーへ向かう方向に、ちょうど「通れない範囲」の外まで動かす
  p.x = c.x + (dx / distance) * minDistance;
  p.z = c.z + (dz / distance) * minDistance;
}

function gameLoop() {
  // 前のフレームからの時間。タブを切りかえて戻ったときなどに一気に進まないよう、最大0.05秒にする
  const dt = Math.min(clock.getDelta(), 0.05);
  update(dt);
  // 牛はゲームオーバー中も動かす（clock.elapsedTime は時計を動かしてからの合計秒数）
  updateCows(clock.elapsedTime, dt);
  updateRunners(clock.elapsedTime, dt);
  updateIntruder(dt);
  updateCamera(dt);
  // カメラから見た3Dの世界を描く
  renderer.render(scene, camera);
  requestAnimationFrame(gameLoop);
}

// ゲームを初期状態にしてから、ゲームループを開始する
resetGame();
gameLoop();
