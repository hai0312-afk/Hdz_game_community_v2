import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
  increment,
  serverTimestamp,
  arrayUnion,
  arrayRemove
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAJLxturm8eshan8ocMb_N16xfmK0Fz9Dg",
  authDomain: "hdz-game-community.firebaseapp.com",
  projectId: "hdz-game-community",
  storageBucket: "hdz-game-community.firebasestorage.app",
  messagingSenderId: "927370791664",
  appId: "1:927370791664:web:8edce7cac0bdccdca6d035"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const state = {
  user: null,
  userProfile: null,
  games: [],
  legacyGames: [],
  search: "",
  currentTab: "home",
  loading: true,
  likedGames: new Set()
};

const $ = selector => document.querySelector(selector);

const $$ = selector => [
  ...document.querySelectorAll(selector)
];

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function currentUser() {
  return auth.currentUser;
}

function showToast(message) {
  let toast = $(".toast");

  if (!toast) {
    toast = document.createElement("div");
    toast.className = "toast";
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(toast.timer);

  toast.timer = setTimeout(() => {
    toast.classList.remove("show");
  }, 3200);
}

function requireLogin(message) {
  if (currentUser()) {
    return true;
  }

  openAuthModal("login");

  showToast(
    `Bạn cần đăng nhập để ${message}.`
  );

  return false;
}

function formatDate(value) {
  if (!value) {
    return "";
  }

  let date;

  if (typeof value.toDate === "function") {
    date = value.toDate();
  } else {
    date = new Date(value);
  }

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleDateString(
    "vi-VN",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }
  );
}

function stripeFor(name) {
  const palettes = [
    ["#ff6b5b", "#ffc857"],
    ["#5ad1c9", "#7c6bff"],
    ["#ffc857", "#ff6b5b"],
    ["#7c6bff", "#5ad1c9"]
  ];

  let hash = 0;

  for (const ch of String(name || "")) {
    hash =
      (hash * 31 + ch.charCodeAt(0)) %
      997;
  }

  return palettes[
    hash % palettes.length
  ];
}

async function loadLegacyGames() {
  try {
    const response =
      await fetch(
        "data/games.json",
        {
          cache: "no-store"
        }
      );

    if (!response.ok) {
      state.legacyGames = [];
      return;
    }

    const data =
      await response.json();

    state.legacyGames =
      Array.isArray(data)
        ? data
        : [];

  } catch (error) {
    console.warn(
      "Không tải được game cũ:",
      error
    );

    state.legacyGames = [];
  }
}

async function loadFirebaseGames() {
  try {
    const gamesRef =
      collection(
        db,
        "games"
      );

    const gamesQuery =
      query(
        gamesRef,
        orderBy(
          "createdAt",
          "desc"
        ),
        limit(100)
      );

    const snapshot =
      await getDocs(
        gamesQuery
      );

    state.games =
      snapshot.docs.map(
        item => ({
          id: item.id,
          ...item.data(),
          firebase: true
        })
      );

  } catch (error) {
    console.warn(
      "Không thể dùng truy vấn sắp xếp Firebase:",
      error
    );

    try {
      const snapshot =
        await getDocs(
          collection(
            db,
            "games"
          )
        );

      state.games =
        snapshot.docs.map(
          item => ({
            id: item.id,
            ...item.data(),
            firebase: true
          })
        );

      state.games.sort(
        (a, b) =>
          getTimestamp(
            b.createdAt
          ) -
          getTimestamp(
            a.createdAt
          )
      );

    } catch (secondError) {
      console.error(
        "Không tải được games:",
        secondError
      );

      state.games = [];
    }
  }
}

function getTimestamp(value) {
  if (!value) {
    return 0;
  }

  if (typeof value.toMillis === "function") {
    return value.toMillis();
  }

  if (typeof value.toDate === "function") {
    return value.toDate().getTime();
  }

  const date =
    new Date(value);

  return Number.isNaN(
    date.getTime()
  )
    ? 0
    : date.getTime();
}

function getAllGames() {
  const firebaseGames =
    state.games.map(
      game => ({
        ...game,
        firebase: true
      })
    );

  const legacyGames =
    state.legacyGames.map(
      game => ({
        ...game,
        legacy: true,
        firebase: false,
        id:
          game.id ||
          game.file ||
          game.name
      })
    );

  return [
    ...firebaseGames,
    ...legacyGames
  ];
}

async function updateAccountUI() {
  const accountArea =
    $("#account-area");

  const userArea =
    $("#user-area");

  const userName =
    $("#user-name");

  if (!accountArea || !userArea) {
    return;
  }

  if (!state.user) {
    accountArea.hidden = false;
    userArea.hidden = true;
    return;
  }

  accountArea.hidden = true;
  userArea.hidden = false;

  if (userName) {
    userName.textContent =
      state.userProfile?.username ||
      state.user.email ||
      "Người dùng";
  }
}

async function loadUserProfile(user) {
  if (!user) {
    state.userProfile = null;
    state.likedGames.clear();
    await updateAccountUI();
    return;
  }

  try {
    const userRef =
      doc(
        db,
        "users",
        user.uid
      );

    const snapshot =
      await getDoc(
        userRef
      );

    if (snapshot.exists()) {
      state.userProfile =
        snapshot.data();
    } else {
      state.userProfile = {
        username:
          user.email?.split("@")[0] ||
          "Người dùng",
        email:
          user.email || "",
        followersCount: 0,
        followingCount: 0,
        gamesCount: 0,
        following: []
      };

      await setDoc(
        userRef,
        {
          ...state.userProfile,
          createdAt:
            new Date().toISOString()
        },
        {
          merge: true
        }
      );
    }
  } catch (error) {
    console.error(
      "Không tải được profile:",
      error
    );

    state.userProfile = {
      username:
        user.email?.split("@")[0] ||
        "Người dùng",
      email:
        user.email || "",
      followersCount: 0,
      followingCount: 0,
      gamesCount: 0,
      following: []
    };
  }

  await updateAccountUI();
}

function openAuthModal(mode = "login") {
  const modalRoot =
    $("#modal-root");

  if (!modalRoot) {
    return;
  }

  const register =
    mode === "register";

  modalRoot.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal">

        <button
          class="modal-x"
          id="auth-close"
          type="button"
        >
          ×
        </button>

        <div class="eyebrow">
          HDZ ACCOUNT
        </div>

        <h2>
          ${
            register
              ? "Tạo tài khoản"
              : "Đăng nhập"
          }
        </h2>

        <p class="modal-description">
          ${
            register
              ? "Tạo tài khoản để đăng game và xây dựng profile creator."
              : "Đăng nhập để tiếp tục sử dụng HDZ Game Community."
          }
        </p>

        <form id="auth-form">

          ${
            register
              ? `
                <div class="field">
                  <label>Tên tài khoản</label>

                  <input
                    id="auth-username"
                    type="text"
                    minlength="2"
                    maxlength="30"
                    placeholder="Tên hiển thị"
                    required
                  >
                </div>
              `
              : ""
          }

          <div class="field">
            <label>Email</label>

            <input
              id="auth-email"
              type="email"
              placeholder="email@example.com"
              required
            >
          </div>

          <div class="field">
            <label>Mật khẩu</label>

            <input
              id="auth-password"
              type="password"
              minlength="6"
              placeholder="Ít nhất 6 ký tự"
              required
            >
          </div>

          <button
            class="btn primary wide"
            id="auth-submit"
            type="submit"
          >
            ${
              register
                ? "Tạo tài khoản"
                : "Đăng nhập"
            }
          </button>

        </form>

        <div class="auth-switch">

          ${
            register
              ? `
                Đã có tài khoản?
                <button id="switch-login" type="button">
                  Đăng nhập
                </button>
              `
              : `
                Chưa có tài khoản?
                <button id="switch-register" type="button">
                  Tạo tài khoản
                </button>
              `
          }

        </div>

      </div>
    </div>
  `;

  $("#auth-close")
    ?.addEventListener(
      "click",
      closeModal
    );

  $("#switch-login")
    ?.addEventListener(
      "click",
      () =>
        openAuthModal(
          "login"
        )
    );

  $("#switch-register")
    ?.addEventListener(
      "click",
      () =>
        openAuthModal(
          "register"
        )
    );

  $("#auth-form")
    ?.addEventListener(
      "submit",
      async event => {
        event.preventDefault();

        const email =
          $("#auth-email")
            ?.value
            .trim();

        const password =
          $("#auth-password")
            ?.value;

        const username =
          $("#auth-username")
            ?.value
            .trim();

        const button =
          $("#auth-submit");

        if (button) {
          button.disabled = true;
          button.textContent =
            register
              ? "Đang tạo..."
              : "Đang đăng nhập...";
        }

        try {
          if (register) {
            const result =
              await createUserWithEmailAndPassword(
                auth,
                email,
                password
              );

            await setDoc(
              doc(
                db,
                "users",
                result.user.uid
              ),
              {
                username:
                  username ||
                  email.split("@")[0],
                email,
                followersCount: 0,
                followingCount: 0,
                gamesCount: 0,
                following: [],
                createdAt:
                  new Date().toISOString()
              }
            );

            showToast(
              "🎉 Tạo tài khoản thành công!"
            );
          } else {
            await signInWithEmailAndPassword(
              auth,
              email,
              password
            );

            showToast(
              "👋 Đăng nhập thành công!"
            );
          }

          closeModal();

        } catch (error) {
          let message =
            "Có lỗi xảy ra.";

          if (
            error.code ===
            "auth/email-already-in-use"
          ) {
            message =
              "Email này đã được sử dụng.";
          } else if (
            error.code ===
            "auth/invalid-credential"
          ) {
            message =
              "Email hoặc mật khẩu không đúng.";
          } else if (
            error.code ===
            "auth/weak-password"
          ) {
            message =
              "Mật khẩu phải có ít nhất 6 ký tự.";
          } else if (
            error.code ===
            "auth/invalid-email"
          ) {
            message =
              "Email không hợp lệ.";
          }

          showToast(message);

        } finally {
          if (button) {
            button.disabled = false;
            button.textContent =
              register
                ? "Tạo tài khoản"
                : "Đăng nhập";
          }
        }
      }
    );
}

function openProfileModal(
  userId = null
) {
  if (
    !userId &&
    !currentUser()
  ) {
    openAuthModal("login");
    return;
  }

  const targetId =
    userId ||
    currentUser().uid;

  loadProfileAndShow(
    targetId
  );
}

async function loadProfileAndShow(
  userId
) {
  const modalRoot =
    $("#modal-root");

  if (!modalRoot) {
    return;
  }

  modalRoot.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal">

        <button
          class="modal-x"
          id="profile-close"
          type="button"
        >
          ×
        </button>

        <div class="loading-state">
          <div class="loading-spinner"></div>
          <strong>Đang tải profile...</strong>
        </div>

      </div>
    </div>
  `;

  try {
    const snapshot =
      await getDoc(
        doc(
          db,
          "users",
          userId
        )
      );

    if (!snapshot.exists()) {
      showToast(
        "Không tìm thấy profile."
      );

      closeModal();
      return;
    }

    const profile =
      snapshot.data();

    const following =
      Array.isArray(
        state.userProfile?.following
      )
        ? state.userProfile.following
        : [];

    const isFollowing =
      following.includes(
        userId
      );

    const ownProfile =
      currentUser()?.uid ===
      userId;

    modalRoot.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal">

          <button
            class="modal-x"
            id="profile-close"
            type="button"
          >
            ×
          </button>

          <div class="profile-avatar">
            👤
          </div>

          <h2 class="profile-name">
            ${escapeHTML(
              profile.username ||
              "HDZ Creator"
            )}
          </h2>

          <div class="profile-email">
            ${escapeHTML(
              profile.email ||
              ""
            )}
          </div>

          <div class="profile-stats">

            <div>
              <strong>
                ${Number(
                  profile.gamesCount ||
                  0
                )}
              </strong>
              <span>Games</span>
            </div>

            <div>
              <strong>
                ${Number(
                  profile.followersCount ||
                  0
                )}
              </strong>
              <span>Followers</span>
            </div>

            <div>
              <strong>
                ${Number(
                  profile.followingCount ||
                  0
                )}
              </strong>
              <span>Following</span>
            </div>

          </div>

          ${
            ownProfile
              ? `
                <button
                  class="btn ghost wide"
                  id="profile-close-button"
                  type="button"
                >
                  Đóng profile
                </button>
              `
              : currentUser()
                ? `
                  <button
                    class="btn ${
                      isFollowing
                        ? "ghost"
                        : "primary"
                    } wide"
                    id="follow-user-btn"
                    type="button"
                  >
                    ${
                      isFollowing
                        ? "✓ Đang follow"
                        : "+ Follow"
                    }
                  </button>
                `
                : ""
          }

        </div>
      </div>
    `;

    $("#profile-close")
      ?.addEventListener(
        "click",
        closeModal
      );

    $("#profile-close-button")
      ?.addEventListener(
        "click",
        closeModal
      );

    $("#follow-user-btn")
      ?.addEventListener(
        "click",
        () =>
          toggleFollow(
            userId,
            isFollowing
          )
      );

  } catch (error) {
    console.error(error);

    showToast(
      "Không thể tải profile."
    );

    closeModal();
  }
}

async function toggleFollow(
  targetId,
  currentlyFollowing
) {
  const user =
    currentUser();

  if (!user) {
    openAuthModal("login");
    return;
  }

  if (user.uid === targetId) {
    return;
  }

  try {
    const myRef =
      doc(
        db,
        "users",
        user.uid
      );

    const targetRef =
      doc(
        db,
        "users",
        targetId
      );

    if (currentlyFollowing) {
      await updateDoc(
        myRef,
        {
          following:
            arrayRemove(
              targetId
            ),
          followingCount:
            increment(-1)
        }
      );

      await updateDoc(
        targetRef,
        {
          followersCount:
            increment(-1)
        }
      );

      showToast(
        "Đã bỏ follow."
      );
    } else {
      await updateDoc(
        myRef,
        {
          following:
            arrayUnion(
              targetId
            ),
          followingCount:
            increment(1)
        }
      );

      await updateDoc(
        targetRef,
        {
          followersCount:
            increment(1)
        }
      );

      showToast(
        "❤️ Đã follow creator."
      );
    }

    await loadUserProfile(
      user
    );

    await loadProfileAndShow(
      targetId
    );

  } catch (error) {
    console.error(error);

    showToast(
      "Không thể cập nhật follow."
    );
  }
}

function getFilteredGames() {
  let games =
    getAllGames();

  const search =
    state.search
      .trim()
      .toLowerCase();

  if (search) {
    games =
      games.filter(
        game => {
          const title =
            String(
              game.title ||
              game.name ||
              ""
            ).toLowerCase();

          const author =
            String(
              game.authorName ||
              game.author ||
              ""
            ).toLowerCase();

          const description =
            String(
              game.description ||
              ""
            ).toLowerCase();

          return (
            title.includes(search) ||
            author.includes(search) ||
            description.includes(search)
          );
        }
      );
  }

  if (
    state.currentTab ===
    "my-games"
  ) {
    const uid =
      currentUser()?.uid;

    games =
      games.filter(
        game =>
          game.authorId === uid
      );
  }

  if (
    state.currentTab ===
    "following"
  ) {
    const following =
      state.userProfile?.following ||
      [];

    games =
      games.filter(
        game =>
          following.includes(
            game.authorId
          )
      );
  }

  games.sort(
    (a, b) =>
      getTimestamp(
        b.createdAt ||
        b.date
      ) -
      getTimestamp(
        a.createdAt ||
        a.date
      )
  );

  return games;
}

function renderHome() {
  const grid =
    $("#grid");

  if (!grid) {
    return;
  }

  const games =
    getFilteredGames();

  const countPill =
    $("#count-pill");

  if (countPill) {
    countPill.textContent =
      `${games.length} game`;
  }

  const title =
    $("#section-title");

  const subtitle =
    $("#section-subtitle");

  if (
    state.currentTab ===
    "my-games"
  ) {
    if (title) {
      title.textContent =
        "Game của tôi";
    }

    if (subtitle) {
      subtitle.textContent =
        "Những game bạn đã đăng lên HDZ";
    }

  } else if (
    state.currentTab ===
    "following"
  ) {
    if (title) {
      title.textContent =
        "Đang follow";
    }

    if (subtitle) {
      subtitle.textContent =
        "Game từ những creator bạn đang theo dõi";
    }

  } else {
    if (title) {
      title.textContent =
        "Thư viện game — mới nhất trước";
    }

    if (subtitle) {
      subtitle.textContent =
        "Game từ cộng đồng HDZ";
    }
  }

  if (!games.length) {
    grid.innerHTML = `
      <div class="empty-state">

        <div class="empty-icon">
          🎮
        </div>

        <strong>
          Chưa có game
        </strong>

        <p>
          ${
            state.currentTab ===
            "following"
              ? "Hãy follow một creator để xem game của họ."
              : state.currentTab ===
                "my-games"
                ? "Bạn chưa đăng game nào."
                : state.search
                  ? "Không tìm thấy game phù hợp."
                  : "Hãy là người đầu tiên đăng game!"
          }
        </p>

      </div>
    `;

    return;
  }

  grid.innerHTML =
    games
      .map(
        game =>
          cardHTML(game)
      )
      .join("");

  attachGameEvents();
}

function cardHTML(game) {
  const title =
    game.title ||
    game.name ||
    "Game không tên";

  const description =
    game.description ||
    "Game được tạo bởi cộng đồng HDZ.";

  const author =
    game.authorName ||
    game.author ||
    "HDZ Creator";

  const views =
    Number(
      game.views || 0
    );

  const likes =
    Number(
      game.likes || 0
    );

  const shares =
    Number(
      game.shares || 0
    );

  const downloads =
    Number(
      game.downloads || 0
    );

  const cover =
    game.coverUrl ||
    game.image ||
    game.cover ||
    "";

  const id =
    game.id || "";

  const [stripeA, stripeB] =
    stripeFor(title);

  const liked =
    state.likedGames.has(
      id
    );

  return `
    <article class="card">

      <div
        class="label-stripe"
        style="
          --stripe-a:${stripeA};
          --stripe-b:${stripeB};
        "
      >
        <div class="notch"></div>

        ${
          cover
            ? `
              <img
                class="game-cover-image"
                src="${escapeHTML(
                  cover
                )}"
                alt="${escapeHTML(
                  title
                )}"
                loading="lazy"
                onerror="this.remove()"
              >
            `
            : ""
        }

      </div>

      <div class="body">

        <div class="name">
          ${escapeHTML(
            title
          )}
        </div>

        <div class="description">
          ${escapeHTML(
            description
          )}
        </div>

        <button
          class="author"
          data-author-id="${
            escapeHTML(
              game.authorId ||
              ""
            )
          }"
          type="button"
        >
          <span class="author-avatar">
            👤
          </span>

          <span>
            ${escapeHTML(
              author
            )}
          </span>
        </button>

        <div class="meta">
          🗓
          ${formatDate(
            game.createdAt ||
            game.date
          )}
        </div>

        <div class="stats">

          <span>
            👁 ${views}
          </span>

          <span>
            ❤️ ${likes}
          </span>

          <span>
            👥 ${shares}
          </span>

          <span>
            📥 ${downloads}
          </span>

        </div>

        <div class="actions">

          <button
            class="card-action play"
            data-game-id="${escapeHTML(id)}"
            type="button"
          >
            ▶ Chơi
          </button>

          ${
            game.firebase
              ? `
                <button
                  class="card-action like ${
                    liked
                      ? "active"
                      : ""
                  }"
                  data-game-id="${escapeHTML(id)}"
                  type="button"
                  title="Thích"
                >
                  ❤️
                </button>

                <button
                  class="card-action download"
                  data-game-id="${escapeHTML(id)}"
                  type="button"
                  title="Tải game"
                >
                  📥
                </button>
              `
              : `
                <button
                  class="card-action legacy-play"
                  data-game-id="${escapeHTML(id)}"
                  type="button"
                >
                  ↗
                </button>
              `
          }

        </div>

      </div>

    </article>
  `;
}

function attachGameEvents() {
  $$(".play")
    .forEach(
      button =>
        button.addEventListener(
          "click",
          () =>
            openGame(
              button.dataset.gameId
            )
        )
    );

  $$(".like")
    .forEach(
      button =>
        button.addEventListener(
          "click",
          event => {
            event.preventDefault();

            likeGame(
              button.dataset.gameId
            );
          }
        )
    );

  $$(".download")
    .forEach(
      button =>
        button.addEventListener(
          "click",
          () =>
            downloadGame(
              button.dataset.gameId
            )
        )
    );

  $$(".legacy-play")
    .forEach(
      button =>
        button.addEventListener(
          "click",
          () =>
            openGame(
              button.dataset.gameId
            )
        )
    );

  $$(".author")
    .forEach(
      button =>
        button.addEventListener(
          "click",
          () => {
            const id =
              button.dataset.authorId;

            if (id) {
              openProfileModal(
                id
              );
            }
          }
        )
    );
}

function findGame(id) {
  return getAllGames()
    .find(
      game =>
        String(game.id) ===
        String(id)
    );
}

function buildPlayableHTML(game) {
  const html =
    game.html || "";

  const css =
    game.css || "";

  const js =
    game.js || "";

  const source =
    html.trim();

  const fullDocument =
    /<!doctype\s+html/i.test(
      source
    ) ||
    /<html[\s>]/i.test(
      source
    );

  if (
    fullDocument &&
    !css.trim() &&
    !js.trim()
  ) {
    return source;
  }

  return `
<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
${css}
</style>
</head>
<body>
${html}
<script>
${js.replace(
  /<\/script/gi,
  "<\\/script"
)}
<\/script>
</body>
</html>
`;
}

function openGame(id) {
  const game =
    findGame(id);

  if (!game) {
    showToast(
      "Không tìm thấy game."
    );
    return;
  }

  if (game.legacy) {
    if (game.file) {
      window.open(
        game.file,
        "_blank",
        "noopener"
      );
    } else {
      showToast(
        "Game cũ không có đường dẫn."
      );
    }

    return;
  }

  window.open(
    `player.html?game=${encodeURIComponent(id)}`,
    "_blank",
    "noopener"
  );

  registerGameView(
    id
  );
}

async function registerGameView(id) {
  try {
    const game =
      findGame(id);

    if (!game?.firebase) {
      return;
    }

    await updateDoc(
      doc(
        db,
        "games",
        id
      ),
      {
        views:
          increment(1)
      }
    );

    game.views =
      Number(
        game.views || 0
      ) + 1;

    renderHome();

  } catch (error) {
    console.warn(
      "Không cập nhật lượt xem:",
      error
    );
  }
}

async function likeGame(id) {
  if (
    !requireLogin(
      "thích game"
    )
  ) {
    return;
  }

  const user =
    currentUser();

  const game =
    findGame(id);

  if (!game?.firebase) {
    return;
  }

  try {
    const likeRef =
      doc(
        db,
        "games",
        id,
        "likes",
        user.uid
      );

    const gameRef =
      doc(
        db,
        "games",
        id
      );

    const existing =
      await getDoc(
        likeRef
      );

    if (existing.exists()) {
      await deleteDoc(
        likeRef
      );

      await updateDoc(
        gameRef,
        {
          likes:
            increment(-1)
        }
      );

      state.likedGames.delete(
        id
      );

      showToast(
        "Đã bỏ thích."
      );

    } else {
      await setDoc(
        likeRef,
        {
          userId:
            user.uid,
          createdAt:
            serverTimestamp()
        }
      );

      await updateDoc(
        gameRef,
        {
          likes:
            increment(1)
        }
      );

      state.likedGames.add(
        id
      );

      showToast(
        "❤️ Đã thích game!"
      );
    }

    await loadFirebaseGames();
    renderHome();

  } catch (error) {
    console.error(error);

    showToast(
      "Không thể cập nhật lượt thích."
    );
  }
}

async function loadUserLikes() {
  state.likedGames.clear();

  const user =
    currentUser();

  if (!user) {
    return;
  }

  for (
    const game of state.games
  ) {
    try {
      const likeRef =
        doc(
          db,
          "games",
          game.id,
          "likes",
          user.uid
        );

      const snapshot =
        await getDoc(
          likeRef
        );

      if (snapshot.exists()) {
        state.likedGames.add(
          game.id
        );
      }
    } catch {
    }
  }
}

async function downloadGame(id) {
  if (
    !requireLogin(
      "tải game"
    )
  ) {
    return;
  }

  const game =
    findGame(id);

  if (!game?.firebase) {
    return;
  }

  const title =
    game.title ||
    "HDZ Game";

  try {
    const html =
      buildPlayableHTML(
        game
      );

    const blob =
      new Blob(
        [html],
        {
          type:
            "text/html;charset=utf-8"
        }
      );

    const url =
      URL.createObjectURL(
        blob
      );

    const link =
      document.createElement(
        "a"
      );

    link.href = url;

    link.download =
      `${sanitizeFilename(
        title
      )}.html`;

    document.body.appendChild(
      link
    );

    link.click();

    link.remove();

    setTimeout(
      () =>
        URL.revokeObjectURL(
          url
        ),
      1000
    );

    await updateDoc(
      doc(
        db,
        "games",
        id
      ),
      {
        downloads:
          increment(1)
      }
    );

    game.downloads =
      Number(
        game.downloads || 0
      ) + 1;

    renderHome();

    showToast(
      "📥 Đã tải game xuống!"
    );

  } catch (error) {
    console.error(error);

    showToast(
      "Không thể tải game."
    );
  }
}

function sanitizeFilename(name) {
  return String(name)
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
    .trim()
    .slice(0, 80) ||
    "hdz-game";
}

function openGameEditor() {
  if (
    !requireLogin(
      "đăng game"
    )
  ) {
    return;
  }

  const modalRoot =
    $("#modal-root");

  modalRoot.innerHTML = `
    <div class="modal-backdrop">

      <div class="modal modal-wide">

        <button
          class="modal-x"
          id="game-editor-close"
          type="button"
        >
          ×
        </button>

        <div class="eyebrow">
          GAME BUILDER
        </div>

        <h2>
          Tạo game mới
        </h2>

        <p class="builder-description">
          HTML là phần bắt buộc.
          CSS và JavaScript có thể để trống.
          Bạn cũng có thể tải từng file lên.
        </p>

        <div class="builder">

          <div class="builder-form">

            <div class="field">
              <label>
                Tên game
              </label>

              <input
                id="new-game-title"
                maxlength="80"
                placeholder="Ví dụ: HDZ Snake"
              >
            </div>

            <div class="field">
              <label>
                Mô tả
              </label>

              <textarea
                id="new-game-description"
                maxlength="500"
                placeholder="Giới thiệu game của bạn..."
              ></textarea>
            </div>

            <div class="field">
              <label>
                Ảnh bìa
              </label>

              <input
                id="new-game-cover"
                type="url"
                placeholder="https://..."
              >

              <small>
                Có thể để trống.
              </small>
            </div>

            <div class="builder-upload-grid">

              <div class="upload-box">

                <div class="upload-box-title">
                  HTML
                </div>

                <div class="upload-box-description">
                  BẮT BUỘC
                </div>

                <label
                  class="file-upload-button"
                  for="html-file-upload"
                >
                  📄 Tải file HTML
                </label>

                <input
                  id="html-file-upload"
                  type="file"
                  accept=".html,.htm,text/html"
                  hidden
                >

                <span
                  class="file-name"
                  id="html-file-name"
                >
                  Chưa chọn file
                </span>

              </div>

              <div class="upload-box">

                <div class="upload-box-title">
                  CSS
                </div>

                <div class="upload-box-description">
                  KHÔNG BẮT BUỘC
                </div>

                <label
                  class="file-upload-button"
                  for="css-file-upload"
                >
                  🎨 Tải file CSS
                </label>

                <input
                  id="css-file-upload"
                  type="file"
                  accept=".css,text/css"
                  hidden
                >

                <span
                  class="file-name"
                  id="css-file-name"
                >
                  Chưa chọn file
                </span>

              </div>

              <div class="upload-box">

                <div class="upload-box-title">
                  JavaScript
                </div>

                <div class="upload-box-description">
                  KHÔNG BẮT BUỘC
                </div>

                <label
                  class="file-upload-button"
                  for="js-file-upload"
                >
                  ⚡ Tải file JS
                </label>

                <input
                  id="js-file-upload"
                  type="file"
                  accept=".js,text/javascript"
                  hidden
                >

                <span
                  class="file-name"
                  id="js-file-name"
                >
                  Chưa chọn file
                </span>

              </div>

            </div>

            <div class="field">

              <div class="code-header">
                <label>HTML</label>
                <span>Bắt buộc</span>
              </div>

              <textarea
                id="new-game-html"
                class="code-input"
                spellcheck="false"
                placeholder="Viết HTML hoặc tải file index.html..."
              ></textarea>

            </div>

            <div class="field">

              <div class="code-header">
                <label>CSS</label>
                <span>Không bắt buộc</span>
              </div>

              <textarea
                id="new-game-css"
                class="code-input"
                spellcheck="false"
                placeholder="Có thể để trống..."
              ></textarea>

            </div>

            <div class="field">

              <div class="code-header">
                <label>JavaScript</label>
                <span>Không bắt buộc</span>
              </div>

              <textarea
                id="new-game-js"
                class="code-input"
                spellcheck="false"
                placeholder="Có thể để trống..."
              ></textarea>

            </div>

            <button
              class="btn primary wide"
              id="publish-game"
              type="button"
            >
              🚀 Đăng game
            </button>

          </div>

          <div class="preview">

            <div class="preview-header">

              <div>
                <strong>
                  LIVE PREVIEW
                </strong>

                <span>
                  Game chạy thử trực tiếp
                </span>
              </div>

              <button
                class="btn ghost"
                id="refresh-preview"
                type="button"
              >
                ↻
              </button>

            </div>

            <iframe
              id="game-preview"
              sandbox="allow-scripts"
              title="Game preview"
            ></iframe>

          </div>

        </div>

      </div>

    </div>
  `;

  $("#game-editor-close")
    ?.addEventListener(
      "click",
      closeModal
    );

  $("#refresh-preview")
    ?.addEventListener(
      "click",
      updateGamePreview
    );

  [
    "#new-game-html",
    "#new-game-css",
    "#new-game-js"
  ].forEach(
    selector =>
      $(selector)
        ?.addEventListener(
          "input",
          updateGamePreview
        )
  );

  $("#html-file-upload")
    ?.addEventListener(
      "change",
      event =>
        readUploadedFile(
          event,
          "#new-game-html",
          "#html-file-name"
        )
    );

  $("#css-file-upload")
    ?.addEventListener(
      "change",
      event =>
        readUploadedFile(
          event,
          "#new-game-css",
          "#css-file-name"
        )
    );

  $("#js-file-upload")
    ?.addEventListener(
      "change",
      event =>
        readUploadedFile(
          event,
          "#new-game-js",
          "#js-file-name"
        )
    );

  $("#publish-game")
    ?.addEventListener(
      "click",
      publishGame
    );

  updateGamePreview();
}

async function readUploadedFile(
  event,
  targetSelector,
  nameSelector
) {
  const file =
    event.target.files?.[0];

  if (!file) {
    return;
  }

  try {
    const content =
      await file.text();

    const input =
      $(targetSelector);

    if (input) {
      input.value =
        content;
    }

    const name =
      $(nameSelector);

    if (name) {
      name.textContent =
        file.name;
    }

    updateGamePreview();

  } catch (error) {
    console.error(error);

    showToast(
      "Không thể đọc file."
    );
  }
}

function buildGameHTML() {
  const html =
    $("#new-game-html")
      ?.value || "";

  const css =
    $("#new-game-css")
      ?.value || "";

  const js =
    $("#new-game-js")
      ?.value || "";

  const source =
    html.trim();

  const fullDocument =
    /<!doctype\s+html/i.test(
      source
    ) ||
    /<html[\s>]/i.test(
      source
    );

  if (
    fullDocument &&
    !css.trim() &&
    !js.trim()
  ) {
    return source;
  }

  return `
<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
${css}
</style>
</head>
<body>
${html}
<script>
${js.replace(
  /<\/script/gi,
  "<\\/script"
)}
<\/script>
</body>
</html>
`;
}

function updateGamePreview() {
  const frame =
    $("#game-preview");

  if (!frame) {
    return;
  }

  frame.srcdoc =
    buildGameHTML();
}

async function publishGame() {
  if (
    !requireLogin(
      "đăng game"
    )
  ) {
    return;
  }

  const title =
    $("#new-game-title")
      ?.value
      .trim();

  const description =
    $("#new-game-description")
      ?.value
      .trim() || "";

  const coverUrl =
    $("#new-game-cover")
      ?.value
      .trim() || "";

  const html =
    $("#new-game-html")
      ?.value || "";

  const css =
    $("#new-game-css")
      ?.value || "";

  const js =
    $("#new-game-js")
      ?.value || "";

  if (!title) {
    showToast(
      "Hãy nhập tên game."
    );
    return;
  }

  if (!html.trim()) {
    showToast(
      "Hãy viết hoặc tải file HTML."
    );
    return;
  }

  const button =
    $("#publish-game");

  if (button) {
    button.disabled = true;
    button.textContent =
      "Đang đăng...";
  }

  try {
    const user =
      currentUser();

    const profile =
      state.userProfile;

    await addDoc(
      collection(
        db,
        "games"
      ),
      {
        title,
        description,
        coverUrl,
        html,
        css,
        js,
        authorId:
          user.uid,
        authorName:
          profile?.username ||
          user.email ||
          "HDZ Creator",
        views: 0,
        likes: 0,
        shares: 0,
        downloads: 0,
        createdAt:
          serverTimestamp()
      }
    );

    try {
      await updateDoc(
        doc(
          db,
          "users",
          user.uid
        ),
        {
          gamesCount:
            increment(1)
        }
      );
    } catch {
      await setDoc(
        doc(
          db,
          "users",
          user.uid
        ),
        {
          gamesCount: 1
        },
        {
          merge: true
        }
      );
    }

    await loadFirebaseGames();

    closeModal();

    renderHome();

    showToast(
      "🚀 Game đã được đăng thành công!"
    );

  } catch (error) {
    console.error(error);

    showToast(
      "Không thể đăng game: " +
      error.message
    );

  } finally {
    if (button) {
      button.disabled = false;
      button.textContent =
        "🚀 Đăng game";
    }
  }
}

function closeModal() {
  const root =
    $("#modal-root");

  if (root) {
    root.innerHTML = "";
  }
}

function setActiveTab(tab) {
  if (
    tab === "following" &&
    !currentUser()
  ) {
    openAuthModal("login");
    showToast(
      "Bạn cần đăng nhập để xem game đang follow."
    );
    return;
  }

  if (
    tab === "my-games" &&
    !currentUser()
  ) {
    openAuthModal("login");
    showToast(
      "Bạn cần đăng nhập để xem game của mình."
    );
    return;
  }

  state.currentTab =
    tab;

  $$(".tab")
    .forEach(
      button =>
        button.classList.remove(
          "active"
        )
    );

  if (tab === "home") {
    $("#home-tab")
      ?.classList.add(
        "active"
      );
  }

  if (tab === "following") {
    $("#following-btn")
      ?.classList.add(
        "active"
      );
  }

  if (tab === "my-games") {
    $("#my-games-btn")
      ?.classList.add(
        "active"
      );
  }

  renderHome();
}

function setupSearch() {
  $("#search")
    ?.addEventListener(
      "input",
      event => {
        state.search =
          event.target.value;

        renderHome();
      }
    );
}

function setupNavigation() {
  $("#home-tab")
    ?.addEventListener(
      "click",
      () =>
        setActiveTab(
          "home"
        )
    );

  $("#following-btn")
    ?.addEventListener(
      "click",
      () =>
        setActiveTab(
          "following"
        )
    );

  $("#my-games-btn")
    ?.addEventListener(
      "click",
      () =>
        setActiveTab(
          "my-games"
        )
    );

  $("#upload-game-btn")
    ?.addEventListener(
      "click",
      openGameEditor
    );

  $("#login-btn")
    ?.addEventListener(
      "click",
      () =>
        openAuthModal(
          "login"
        )
    );

  $("#register-btn")
    ?.addEventListener(
      "click",
      () =>
        openAuthModal(
          "register"
        )
    );

  $("#profile-btn")
    ?.addEventListener(
      "click",
      () =>
        openProfileModal()
    );

  $("#logout-btn")
    ?.addEventListener(
      "click",
      async () => {
        try {
          await signOut(
            auth
          );

          showToast(
            "Đã đăng xuất."
          );

        } catch (error) {
          console.error(error);

          showToast(
            "Không thể đăng xuất."
          );
        }
      }
    );
}

async function initialize() {
  setupSearch();
  setupNavigation();

  await Promise.all([
    loadLegacyGames(),
    loadFirebaseGames()
  ]);

  state.loading =
    false;

  renderHome();

  onAuthStateChanged(
    auth,
    async user => {
      state.user =
        user;

      await loadUserProfile(
        user
      );

      await loadUserLikes();

      if (
        !user &&
        (
          state.currentTab ===
          "following" ||
          state.currentTab ===
          "my-games"
        )
      ) {
        state.currentTab =
          "home";
      }

      renderHome();
    }
  );
}

initialize();