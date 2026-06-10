// NAV — 星系导航（小按钮+文字上方+子页面仅留返回键）
const Nav = {
  render() {
    const ui = document.getElementById("galaxy-ui");
    if (!ui) return;
    const loggedIn = !!App.currentUser;
    const isAdmin = App.currentProfile?.is_admin;
    const inSub = Router.inSubPage;

    ui.innerHTML = "";

    // ===== 子页面：仅显示返回主页按钮 =====
    if (inSub) {
      const backWrap = document.createElement("div");
      backWrap.style.cssText = "position:absolute;bottom:6%;left:50%;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:5px;z-index:25;";
      const label = document.createElement("span");
      label.className = "ring-label"; label.textContent = "返回主页";
      const btn = document.createElement("button");
      btn.className = "galaxy-ring-btn galaxy-back-btn";
      btn.innerHTML = "🏠";
      btn.title = "返回主页";
      btn.onclick = () => Router.goHome();
      backWrap.appendChild(label);
      backWrap.appendChild(btn);
      ui.appendChild(backWrap);
      return;
    }

    // ===== 星系主页：中心按钮 + 环按钮 =====

    // 中心按钮
    const centerWrap = document.createElement("div");
    centerWrap.style.cssText = "position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);z-index:20;display:flex;flex-direction:column;align-items:center;gap:6px;";
    if (loggedIn) {
      const label = document.createElement("span");
      label.className = "ring-label"; label.textContent = App.currentProfile?.username || "用户";
      const btn = document.createElement("button");
      btn.className = "galaxy-center-btn";
      const ini = (App.currentProfile?.username || "U")[0].toUpperCase();
      btn.innerHTML = ini;
      btn.title = "个人主页";
      btn.onclick = () => Router.go("profile");
      centerWrap.appendChild(label);
      centerWrap.appendChild(btn);
    } else {
      const label = document.createElement("span");
      label.className = "ring-label"; label.textContent = "进入平台";
      const btn = document.createElement("button");
      btn.className = "galaxy-center-btn";
      btn.innerHTML = "🚀";
      btn.title = "登录 / 注册";
      btn.onclick = () => Router.go("login");
      centerWrap.appendChild(label);
      centerWrap.appendChild(btn);
    }
    ui.appendChild(centerWrap);
    if (!loggedIn) return;

    // 环上功能按钮（小图标+上方文字）
    const btns = [
      { id: "feed", label: "资源广场", icon: "📋" },
      { id: "upload", label: "上传", icon: "📤" },
      { id: "friends", label: "好友", icon: "👥" },
      { id: "chat", label: "聊天", icon: "💬" },
    ];
    if (isAdmin) btns.push({ id: "admin", label: "管理", icon: "⚙️" });

    const count = btns.length, rx = 28, ry = 26;
    btns.forEach((btn, i) => {
      const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
      const wrap = document.createElement("div");
      wrap.style.cssText = "position:absolute;top:" + (50 + Math.sin(angle) * ry) + "vh;left:" + (50 + Math.cos(angle) * rx) + "vw;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;gap:4px;";

      const label = document.createElement("span");
      label.className = "ring-label"; label.textContent = btn.label;

      const el = document.createElement("button");
      el.className = "galaxy-ring-btn";
      el.innerHTML = btn.icon;
      el.title = btn.label;
      el.onclick = () => Router.go(btn.id);

      wrap.appendChild(label);
      wrap.appendChild(el);
      ui.appendChild(wrap);
    });

    // 退出按钮
    const loWrap = document.createElement("div");
    const la = -Math.PI / 2 - 0.5;
    loWrap.style.cssText = "position:absolute;top:" + (50 + Math.sin(la) * 34) + "vh;left:" + (50 + Math.cos(la) * 36) + "vw;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;gap:4px;";
    const loLabel = document.createElement("span");
    loLabel.className = "ring-label"; loLabel.textContent = "退出";
    const lo = document.createElement("button");
    lo.className = "galaxy-ring-btn galaxy-logout";
    lo.innerHTML = "🚪";
    lo.title = "退出登录";
    lo.onclick = () => Auth.handleLogout();
    loWrap.appendChild(loLabel);
    loWrap.appendChild(lo);
    ui.appendChild(loWrap);
  }
};
