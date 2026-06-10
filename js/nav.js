// NAV - sidebar navigation
const Nav = {
  items: [
    { id: "home",      label: "主页",       icon: "🏠", home: true },
    { id: "feed",      label: "资源广场",   icon: "📋" },
    { id: "upload",    label: "上传资源",   icon: "📤" },
    { id: "friends",   label: "好友",       icon: "👥" },
    { id: "chat",      label: "聊天",       icon: "💬" },
    { id: "profile",   label: "个人主页",   icon: "👤" },
    { id: "admin",     label: "管理",       icon: "⚙️", admin: true },
  ],

  render() {
    const nav = document.getElementById("sb-nav");
    const footer = document.getElementById("sb-footer");
    if (!nav || !footer) return;
    const loggedIn = !!App.currentUser;
    const isAdmin = App.currentProfile && App.currentProfile.is_admin;
    const currentPage = Router.currentPage;
    nav.innerHTML = "";
    this.items.forEach(function(item) {
      if (item.admin && !isAdmin) return;
      var el = document.createElement("div");
      el.className = "sb-nav-item";
      var isActive = item.home ? (currentPage === null) : (currentPage === item.id);
      if (isActive) el.classList.add("sb-nav-item-active");
      el.innerHTML = "<span class=\"sb-nav-icon\">" + item.icon + "</span><span class=\"sb-nav-label\">" + item.label + "</span>";
      el.onclick = function() {
        if (item.home) Router.goHome();
        else Router.go(item.id);
      };
      nav.appendChild(el);
    });
    footer.innerHTML = "";
    if (loggedIn) {
      var uname = (App.currentProfile && App.currentProfile.username) || "用户";
      footer.innerHTML =
        "<div class=\"sb-user-avatar\">" + uname[0].toUpperCase() + "</div>" +
        "<div class=\"sb-user-info\">" +
        "<div class=\"sb-username\">" + uname + "</div>" +
        "<div class=\"sb-user-action\" onclick=\"Auth.handleLogout()\">退出登录</div>" +
        "</div>";
    } else {
      footer.innerHTML = "<div class=\"sb-login-btn\" onclick=\"Router.go('login')\">🔑 登录 / 注册</div>";
    }
  }
};
