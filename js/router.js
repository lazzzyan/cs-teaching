// ROUTER v4 - 纯页面路由，无相机转场
const Router = {
  currentPage: "login",
  transitioning: false,

  go(page, data = null) {
    if (this.transitioning) return;
    this.transitioning = true;
    this.currentPage = page;
    if (page !== "chat") Chat.cleanup();

    const overlay = document.getElementById("app-overlay");
    const container = document.getElementById("app-container");

    // 渲染页面
    container.innerHTML = "";
    container.className = "page-" + page;

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

    setTimeout(() => { this.transitioning = false; }, 200);
  }
};

const App = {
  currentUser: null,
  currentProfile: null,

  async init() {
    initSupabase();
    const canvas = document.getElementById("starfield-canvas");
    if (canvas) { window.starfield = new StarfieldEngine(canvas); }

    const overlay = document.getElementById("app-overlay");
    if (overlay) overlay.style.display = "none";

    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      this.currentUser = session.user;
      await this.loadProfile();
      Nav.render();
      Router.go("feed");
    } else {
      Nav.render();
      Router.go("login");
    }

    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session) {
        this.currentUser = session.user;
        await this.loadProfile();
        Nav.render();
        Router.go("feed");
      } else if (event === "SIGNED_OUT") {
        this.currentUser = null;
        this.currentProfile = null;
        Nav.render();
        Router.go("login");
      }
    });

    document.addEventListener("keydown", (e) => {
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
