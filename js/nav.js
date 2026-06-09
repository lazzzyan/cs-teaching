// NAV - 导航栏 + 圆形底部导航
const Nav = {
  render() {
    const nav = document.getElementById("main-navbar");
    if (!nav) return;
    const isAdmin = App.currentProfile?.is_admin;
    nav.innerHTML = `<div class="nav-left">
      <div class="nav-logo" onclick="Router.go('feed')"><span class="logo-text">CS教学</span></div>
      <div class="nav-search2"><input type="text" id="nav-search-input" placeholder="搜索资源..."><button id="nav-search-btn">🔍</button></div>
    </div>
    <div class="nav-center">
      <a href="#" class="nav-link" onclick="Router.go('feed')">🏠 首页</a>
      <a href="#" class="nav-link" onclick="Router.go('upload')">📤 上传</a>
      <a href="#" class="nav-link" onclick="Router.go('friends')">👥 好友</a>
      ${isAdmin?'<a href="#" class="nav-link admin-link" onclick="Router.go(\'admin\')">⚙️ 管理</a>':''}
    </div>
    <div class="nav-right">
      <div class="nav-user" onclick="Router.go('profile')"><div class="nav-avatar">${(App.currentProfile?.username||"U")[0].toUpperCase()}</div><span class="nav-username">${App.currentProfile?.username||"用户"}</span></div>
      <button class="btn-logout" onclick="Auth.handleLogout()" title="退出登录">🚪</button>
    </div>`;

    document.getElementById("nav-search-btn")?.addEventListener("click",()=>{const q=document.getElementById("nav-search-input").value.trim();if(q)Router.go("search",q);});
    document.getElementById("nav-search-input")?.addEventListener("keydown",(e)=>{if(e.key==="Enter"){const q=e.target.value.trim();if(q)Router.go("search",q);}});

    // 圆形底部导航
    this.renderCircleNav();
  },

  renderCircleNav() {
    const cn = document.getElementById("circle-nav");
    if (!cn) return;
    const isAdmin = App.currentProfile?.is_admin;
    const pages = [
      {id:"feed",icon:"🏠",label:"首页"},
      {id:"upload",icon:"📤",label:"上传"},
      {id:"friends",icon:"👥",label:"好友"},
      {id:"profile",icon:"👤",label:"我的"},
      ...(isAdmin?[{id:"admin",icon:"⚙️",label:"管理"}]:[])
    ];
    cn.innerHTML = pages.map(p=>`
      <div class="circle-nav-item${Router.currentPage===p.id?' active':''}" onclick="Router.go('${p.id}')" title="${p.label}">
        <span class="cn-icon">${p.icon}</span>
        <span class="cn-label">${p.label}</span>
      </div>
    `).join("");
  }
};
