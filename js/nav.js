// NAV — 星系环按钮 + 中心按钮
const Nav = {
  render() {
    const ui = document.getElementById("galaxy-ui");
    if (!ui) return;
    const loggedIn = !!App.currentUser;
    const isAdmin = App.currentProfile?.is_admin;
    ui.innerHTML = "";

    // 中心按钮
    const cb = document.createElement("button");
    cb.className = "galaxy-center-btn";
    cb.style.cssText = "position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);z-index:20;";
    if (loggedIn) {
      const ini = (App.currentProfile?.username || "U")[0].toUpperCase();
      cb.innerHTML = '<span class="gcb-avatar">' + ini + '</span><span class="gcb-label">' + (App.currentProfile?.username || "用户") + '</span>';
      cb.title = "个人主页";
      cb.onclick = () => Router.go("profile");
    } else {
      cb.innerHTML = '<span class="gcb-icon">🚀</span><span class="gcb-label">进入平台</span>';
      cb.title = "登录 / 注册";
      cb.onclick = () => Router.go("login");
    }
    ui.appendChild(cb);
    if (!loggedIn) return;

    // 环上4个功能按钮
    const btns = [
      { id: "feed", label: "资源广场", icon: "🏠" },
      { id: "upload", label: "上传资源", icon: "📤" },
      { id: "friends", label: "好友", icon: "👥" },
      { id: "chat", label: "聊天", icon: "💬" },
    ];
    if (isAdmin) btns.push({ id: "admin", label: "管理", icon: "⚙️" });

    const count = btns.length, rx = 30, ry = 28;
    btns.forEach((btn, i) => {
      const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
      const el = document.createElement("button");
      el.className = "galaxy-ring-btn";
      el.style.cssText = "position:absolute;top:" + (50 + Math.sin(angle) * ry) + "vh;left:" + (50 + Math.cos(angle) * rx) + "vw;transform:translate(-50%,-50%);";
      el.innerHTML = '<span class="grb-icon">' + btn.icon + '</span><span class="grb-label">' + btn.label + '</span>';
      el.title = btn.label;
      el.onclick = () => Router.go(btn.id);
      ui.appendChild(el);
    });

    // 退出按钮
    const lo = document.createElement("button");
    lo.className = "galaxy-ring-btn galaxy-logout";
    lo.innerHTML = '<span class="grb-icon">🚪</span>';
    lo.title = "退出登录";
    lo.style.cssText = "position:absolute;top:" + (50 + Math.sin(-Math.PI/2-0.5) * 36) + "vh;left:" + (50 + Math.cos(-Math.PI/2-0.5) * 38) + "vw;transform:translate(-50%,-50%);";
    lo.onclick = () => Auth.handleLogout();
    ui.appendChild(lo);
  }
};
