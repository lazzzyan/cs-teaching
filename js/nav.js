// NAV v3 - 星系环导航按钮系统（JS定位版）
const Nav = {
  render() {
    const ui = document.getElementById("galaxy-ui");
    if (!ui) return;
    const loggedIn = !!App.currentUser;
    const isAdmin = App.currentProfile?.is_admin;

    ui.innerHTML = "";

    // ===== 中心按钮 =====
    const centerBtn = document.createElement("button");
    centerBtn.className = "galaxy-center-btn";
    centerBtn.style.cssText = "position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);z-index:20;";
    if (loggedIn) {
      const initial = (App.currentProfile?.username || "U")[0].toUpperCase();
      const name = App.currentProfile?.username || "用户";
      centerBtn.innerHTML = '<span class="gcb-avatar">' + initial + '</span><span class="gcb-label">' + name + '</span>';
      centerBtn.title = "个人主页";
      centerBtn.onclick = () => Router.go("profile");
    } else {
      centerBtn.innerHTML = '<span class="gcb-icon">🚀</span><span class="gcb-label">进入平台</span>';
      centerBtn.title = "登录 / 注册";
      centerBtn.onclick = () => Router.go("login");
    }
    ui.appendChild(centerBtn);

    if (!loggedIn) return;

    // ===== 环上功能按钮 =====
    const ringBtns = [
      { id: "feed", label: "资源广场", icon: "🏠" },
      { id: "upload", label: "上传资源", icon: "📤" },
      { id: "friends", label: "好友", icon: "👥" },
      { id: "chat", label: "聊天", icon: "💬" },
    ];
    if (isAdmin) ringBtns.push({ id: "admin", label: "管理", icon: "⚙️" });

    // 用JS计算环上位置
    const count = ringBtns.length;
    const rx = 32; // vw
    const ry = 30; // vh

    ringBtns.forEach((btn, i) => {
      const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
      const left = 50 + Math.cos(angle) * rx;
      const top = 50 + Math.sin(angle) * ry;

      const el = document.createElement("button");
      el.className = "galaxy-ring-btn";
      el.style.cssText = "position:absolute;top:" + top + "vh;left:" + left + "vw;transform:translate(-50%,-50%);";
      el.innerHTML = '<span class="grb-icon">' + btn.icon + '</span><span class="grb-label">' + btn.label + '</span>';
      el.title = btn.label;
      el.onclick = () => {
        if (window.starfield) {
          window.starfield.transitionTo(btn.id, () => Router.go(btn.id));
        } else {
          Router.go(btn.id);
        }
      };
      ui.appendChild(el);
    });

    // ===== 退出按钮（环外侧） =====
    const logoutBtn = document.createElement("button");
    logoutBtn.className = "galaxy-ring-btn galaxy-logout";
    logoutBtn.innerHTML = '<span class="grb-icon">🚪</span><span class="grb-label">退出</span>';
    const la = -Math.PI / 2 - 0.45;
    logoutBtn.style.cssText = "position:absolute;top:" + (50 + Math.sin(la) * (ry + 8)) + "vh;left:" + (50 + Math.cos(la) * (rx + 8)) + "vw;transform:translate(-50%,-50%);";
    logoutBtn.title = "退出登录";
    logoutBtn.onclick = () => Auth.handleLogout();
    ui.appendChild(logoutBtn);
  },

  renderCircleNav() {}
};
