// ROUTER — 左侧栏路由 + 3D场景转场
const Router = {
  currentPage: null,     // null=星系主页, 其他=功能页
  transitioning: false,

  // 前往页面
  go(page, data = null) {
    if (this.transitioning) return;
    this.transitioning = true;
    if (page !== "chat") Chat.cleanup();

    const overlay = document.getElementById("app-overlay");
    const container = document.getElementById("app-container");

    // 需要3D场景切换的页面列表
    const scenePages = ["feed", "upload", "edit-resource", "friends", "chat", "admin", "search", "profile"];

    // 渲染函数
    const render = () => {
      this.currentPage = page;
      container.innerHTML = "";
      container.className = "page-" + page;

      switch (page) {
        case "login":    Auth.renderLogin(); break;
        case "register": Auth.renderRegister(); break;
        case "feed":     Resources.renderFeed(); break;
        case "upload":   Resources.renderUpload(); break;
        case "edit-resource": Resources.renderUpload(data); break;
        case "resource-detail": Resources.renderDetail(data); break;
        case "profile":  Profile.render(data); break;
        case "friends":  Friends.render(); break;
        case "chat":     Chat.render(data); break;
        case "admin":    Admin.render(); break;
        case "search":   Resources.renderSearch(data); break;
      }

      if (overlay) overlay.style.display = "flex";
      Nav.render(); // 刷新侧栏高亮
      this.transitioning = false;
    };

    // 非场景页面（登录/注册等）直接渲染
    if (!scenePages.includes(page)) {
      if (overlay) overlay.style.display = "flex";
      setTimeout(() => render(), 100);
      return;
    }

    // 场景页面：先隐藏再转场
    if (overlay) overlay.style.display = "none";

    if (window.starfield) {
      window.starfield.transitionTo(page, () => render());
    } else {
      setTimeout(() => render(), 200);
    }
  },

  // 返回星系主页
  goHome() {
    if (this.transitioning) return;
    this.transitioning = true;
    this.currentPage = null;
    Chat.cleanup();

    const overlay = document.getElementById("app-overlay");
    const container = document.getElementById("app-container");
    container.innerHTML = "";

    if (overlay) overlay.style.display = "none";

    if (window.starfield) {
      window.starfield.resetToGalaxy(() => {
        Nav.render();
        this.transitioning = false;
      });
    } else {
      Nav.render();
      this.transitioning = false;
    }
  }
};

// 应用入口
const App = {
  currentUser: null,
  currentProfile: null,

  async init() {
    initSupabase();
    const canvas = document.getElementById("starfield-canvas");
    if (canvas) window.starfield = new StarfieldEngine(canvas);

    // 初始：仅显示星系 + 左侧栏
    Nav.render();

    // 检查已登录状态
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      this.currentUser = session.user;
      await this.loadProfile();
      Nav.render(); // 刷新显示用户名
    }

    // 监听认证状态变化
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session) {
        this.currentUser = session.user;
        await this.loadProfile();
        // 登录/注册后直接回到星系主页
        Router.goHome();
      } else if (event === "SIGNED_OUT") {
        this.currentUser = null;
        this.currentProfile = null;
        Router.goHome();
      }
    });

    // Esc关闭弹窗
    document.addEventListener("keydown", e => {
      if (e.key === "Escape") {
        document.querySelectorAll(".modal-overlay").forEach(m => m.remove());
      }
    });
  },

  async loadProfile() {
    if (!this.currentUser) return;
    const { data } = await supabase.from("profiles").select("*").eq("id", this.currentUser.id).single();
    this.currentProfile = data;
  }
};

document.addEventListener("DOMContentLoaded", () => App.init());