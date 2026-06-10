// ROUTER - sidebar routing + 3D scene transitions
const Router = {
  currentPage: null,
  transitioning: false,

  go(page, data) {
    if (this.transitioning) return;
    this.transitioning = true;
    if (page !== "chat") Chat.cleanup();
    var overlay = document.getElementById("app-overlay");
    var container = document.getElementById("app-container");
    var scenePages = ["feed","upload","edit-resource","friends","chat","admin","search","profile"];
    var self = this;

    var render = function() {
      self.currentPage = page;
      container.innerHTML = "";
      container.className = "page-" + page;
      switch (page) {
        case "login": Auth.renderLogin(); break;
        case "register": Auth.renderRegister(); break;
        case "feed": if (overlay) { overlay.style.justifyContent = "flex-end"; overlay.style.paddingRight = "3vw"; overlay.style.paddingLeft = "0"; } Resources.renderFeed(); break;
        case "upload": Resources.renderUpload(); break;
        case "edit-resource": Resources.renderUpload(data); break;
        case "resource-detail": Resources.renderDetail(data); break;
        case "profile": if (overlay) { overlay.style.justifyContent = "flex-start"; overlay.style.paddingRight = "0"; overlay.style.paddingLeft = "3vw"; } Profile.render(data); break;
        case "friends": Friends.render(); break;
        case "chat": Chat.render(data); break;
        case "admin": Admin.render(); break;
        case "search": Resources.renderSearch(data); break;
      }
      if (overlay) overlay.style.display = "flex";
      Nav.render();
      self.transitioning = false;
    };

    if (scenePages.indexOf(page) === -1) {
      if (overlay) overlay.style.display = "flex";
      setTimeout(function() { render(); }, 100);
      return;
    }

    if (overlay) { overlay.style.display = "none"; overlay.style.justifyContent = "flex-end"; overlay.style.paddingRight = "3vw"; overlay.style.paddingLeft = "0"; }
    if (window.starfield) {
      window.starfield.transitionTo(page, function() { render(); });
    } else {
      setTimeout(function() { render(); }, 200);
    }
  },

  goHome() {
    if (this.transitioning) return;
    this.transitioning = true;
    this.currentPage = null;
    Chat.cleanup();
    var overlay = document.getElementById("app-overlay");
    var container = document.getElementById("app-container");
    container.innerHTML = "";
    if (overlay) { overlay.style.display = "none"; overlay.style.justifyContent = "flex-end"; overlay.style.paddingRight = "3vw"; overlay.style.paddingLeft = "0"; }
    var self = this;
    if (window.starfield) {
      window.starfield.resetToGalaxy(function() {
        Nav.render();
        self.transitioning = false;
      });
    } else {
      Nav.render();
      self.transitioning = false;
    }
  }
};

const App = {
  currentUser: null,
  currentProfile: null,

  async init() {
    initSupabase();
    var canvas = document.getElementById("starfield-canvas");
    if (canvas) window.starfield = new StarfieldEngine(canvas);
    Nav.render();

    var _a = await supabase.auth.getSession();
    var session = _a.data.session;
    if (session) {
      this.currentUser = session.user;
      await this.loadProfile();
      Nav.render();
    }

    var self = this;
    supabase.auth.onAuthStateChange(async function(event, sess) {
      if (event === "SIGNED_IN" && sess) {
        self.currentUser = sess.user;
        await self.loadProfile();
        Router.goHome();
      } else if (event === "SIGNED_OUT") {
        self.currentUser = null;
        self.currentProfile = null;
        Router.goHome();
      }
    });

    // Galaxy center download button - follows mouse
    var dlBtn = document.getElementById("download-client");
    var mouseX = 0, mouseY = 0;
    document.addEventListener("mousemove", function(e) {
      mouseX = e.clientX; mouseY = e.clientY;
      if (dlBtn && dlBtn.classList.contains("visible")) {
        dlBtn.style.left = mouseX + "px";
        dlBtn.style.top = mouseY + "px";
      }
    });
    window.addEventListener("galaxyCenterProximity", function(e) {
      if (dlBtn) {
        if (e.detail.near) {
          dlBtn.style.left = mouseX + "px";
          dlBtn.style.top = mouseY + "px";
          dlBtn.classList.add("visible");
        } else {
          dlBtn.classList.remove("visible");
        }
      }
    });

    document.addEventListener("keydown", function(e) {
      if (e.key === "Escape") {
        document.querySelectorAll(".modal-overlay").forEach(function(m) { m.remove(); });
      }
    });
  },

  async loadProfile() {
    if (!this.currentUser) return;
    var _a = await supabase.from("profiles").select("*").eq("id", this.currentUser.id).single();
    this.currentProfile = _a.data;
  }
};

document.addEventListener("DOMContentLoaded", function() { App.init(); });
