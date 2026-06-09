// NAV v3 - 星系环导航按钮系统
const Nav = {
  render() {
    const ui = document.getElementById("galaxy-ui");
    if (!ui) return;
    const loggedIn = !!App.currentUser;
    const isAdmin = App.currentProfile?.is_admin;

    // 清除旧按钮
    ui.innerHTML = "";

    // 中心按钮
    const centerBtn = document.createElement("button");
    centerBtn.className = "galaxy-center-btn";
    if (loggedIn) {
      centerBtn.innerHTML = '<span class="gcb-avatar">' + (App.currentProfile?.username || "U")[0].toUpperCase() + '</span><span class="gcb-label">' + (App.currentProfile?.username || "用户") + '</span>';
      centerBtn.onclick = () => Router.go("profile");
    } else {
      centerBtn.textContent = "进入平台";
      centerBtn.onclick = () => Router.go("login");
    }
    ui.appendChild(centerBtn);

    if (!loggedIn) {
      // 未登录只显示中心按钮
      return;
    }

    // 环上功能按钮（已登录）
    const ringBtns = [
      { id: "feed", label: "资源广场", icon: "🏠", scene: "engineering" },
      { id: "upload", label: "上传资源", icon: "📤", scene: "dna" },
      { id: "friends", label: "好友", icon: "👥", scene: "web3" },
      { id: "chat", label: "聊天", icon: "💬", scene: "data" },
    ];
    if (isAdmin) {
      ringBtns.push({ id: "admin", label: "管理", icon: "⚙️", scene: "data" });
    }

    ringBtns.forEach((btn, i) => {
      const angle = (i / ringBtns.length) * Math.PI * 2 - Math.PI / 2;
      const el = document.createElement("button");
      el.className = "galaxy-ring-btn";
      el.innerHTML = '<span class="grb-icon">' + btn.icon + '</span><span class="grb-label">' + btn.label + '</span>';
      el.style.setProperty("--ring-angle", angle + "rad");
      el.dataset.scene = btn.scene;
      el.onclick = () => {
        // 触发相机转场
        if (window.starfield) window.starfield.transitionTo(btn.id, () => {
          Router.go(btn.id);
        });
      };
      ui.appendChild(el);
    });

    // 退出按钮
    const logoutBtn = document.createElement("button");
    logoutBtn.className = "galaxy-ring-btn galaxy-logout";
    logoutBtn.innerHTML = '<span class="grb-icon">🚪</span><span class="grb-label">退出</span>';
    logoutBtn.style.setProperty("--ring-angle", (-Math.PI / 2 - 0.4) + "rad");
    logoutBtn.onclick = () => Auth.handleLogout();
    ui.appendChild(logoutBtn);
  },

  renderCircleNav() {
    // 废弃圆形底部导航
  }
};
