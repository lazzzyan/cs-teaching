// NAV — 左侧栏导航（常驻，可上下滚动）
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

  // 导航项 → 3D场景映射
  sceneMap: {
    upload: "dna", "edit-resource": "dna", admin: "grid",
    feed: "engineering", friends: "web3", chat: "web3",
    profile: "orbit", search: "data",
  },

  render() {
    const nav = document.getElementById("sb-nav");
    const footer = document.getElementById("sb-footer");
    if (!nav || !footer) return;

    const loggedIn = !!App.currentUser;
    const isAdmin = App.currentProfile?.is_admin;
    const currentPage = Router.currentPage; // null=home

    // 导航列表
    nav.innerHTML = "";
    this.items.forEach(item => {
      if (item.admin && !isAdmin) return; // 非管理员隐藏管理
      const el = document.createElement("div");
      el.className = "sb-nav-item";
      const isActive = item.home
        ? (currentPage === null || currentPage === "galaxy")
        : (currentPage === item.id);
      if (isActive) el.classList.add("sb-nav-item-active");
      el.innerHTML = `<span class="sb-nav-icon">${item.icon}</span><span class="sb-nav-label">${item.label}</span>`;
      el.onclick = () => {
        if (item.home) Router.goHome();
        else Router.go(item.id);
      };
      nav.appendChild(el);
    });

    // 底部用户区
    footer.innerHTML = "";
    if (loggedIn) {
      const uname = App.currentProfile?.username || "用户";
      const initial = uname[0].toUpperCase();
      footer.innerHTML = `
        <div class="sb-user-avatar">${initial}</div>
        <div class="sb-user-info">
          <div class="sb-username">${uname}</div>
          <div class="sb-user-action" onclick="Auth.handleLogout()">退出登录</div>
        </div>`;
    } else {
      footer.innerHTML = `<div class="sb-login-btn" onclick="Router.go('login')">🔑 登录 / 注册</div>`;
    }
  }
};