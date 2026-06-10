// ROUTER — 路由 + 转场
const Router = {
  currentPage: null,     // null=星系主页, 其他=功能页
  transitioning: false,
  inSubPage: false,      // 是否在功能子页面

  go(page, data = null) {
    if (this.transitioning) return;
    this.transitioning = true;
    this.currentPage = page;
    this.inSubPage = (page !== null && page !== "galaxy");
    if (page !== "chat") Chat.cleanup();

    const overlay = document.getElementById("app-overlay");
    const container = document.getElementById("app-container");
    const scenePages = ["feed", "upload", "edit-resource", "friends", "chat", "admin", "search", "profile"];

    const render = () => {
      if (page === null) {
        // 返回星系主页：隐藏覆盖层、重置相机
        if (overlay) overlay.style.display = "none";
        if (window.starfield) window.starfield.resetToGalaxy();
        Nav.render();
        this.transitioning = false;
        return;
      }
      container.innerHTML = ""; container.className = "page-" + page;
      switch (page) {
        case "login": Auth.renderLogin(); break;
        case "register": Auth.renderRegister(); break;
        case "feed": Resources.renderFeed(); break;
        case "upload": Resources.renderUpload(); break;
        case "edit-resource": Resources.renderUpload(data); break;
        case "resource-detail": Resources.renderDetail(data); break;
        case "profile": Profile.render(data); break;
        case "friends": Friends.render(); break;
        case "chat": Chat.render(data); break;
        case "admin": Admin.render(); break;
        case "search": Resources.renderSearch(data); break;
      }
      Nav.render();
      if (overlay) overlay.style.display = "flex";
      this.transitioning = false;
    };

    if (overlay) overlay.style.display = "none";

    if (scenePages.includes(page) && window.starfield) {
      window.starfield.transitionTo(page, () => render());
    } else {
      setTimeout(() => render(), 200);
    }
  },

  // 返回星系主页
  goHome() { this.go(null); }
};

const App = {
  currentUser: null, currentProfile: null,

  async init() {
    initSupabase();
    const canvas = document.getElementById("starfield-canvas");
    if (canvas) window.starfield = new StarfieldEngine(canvas);

    const overlay = document.getElementById("app-overlay");
    if (overlay) overlay.style.display = "none";

    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      this.currentUser = session.user;
      await this.loadProfile();
      Nav.render();
      // 已登录也不自动跳转，保持星系主页
    } else {
      // 未登录：仅显示星系+中心按钮，不跳转登录页
      Nav.render();
    }

    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session) {
        this.currentUser = session.user;
        await this.loadProfile();
        Nav.render();
      } else if (event === "SIGNED_OUT") {
        this.currentUser = null;
        this.currentProfile = null;
        // 退出后返回星系主页
        if (Router.inSubPage) Router.goHome();
        else Nav.render();
      }
    });

    document.addEventListener("keydown", e => {
      if (e.key === "Escape") document.querySelectorAll(".modal-overlay").forEach(m => m.remove());
    });
  },

  async loadProfile() {
    if (!this.currentUser) return;
    const { data } = await supabase.from("profiles").select("*").eq("id", this.currentUser.id).single();
    this.currentProfile = data;
  }
};

document.addEventListener("DOMContentLoaded", () => App.init());

