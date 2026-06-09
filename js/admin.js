// ADMIN - 管理员后台
const Admin = {
  async render() {
    if(!App.currentProfile?.is_admin) return Router.go("feed");
    Nav.render();
    document.getElementById("app-container").innerHTML = `<div class="admin-page"><h2>⚙️ 管理后台</h2>
      <div class="admin-tabs"><button class="admin-tab active" onclick="Admin.tab('resources')">📚 资源管理</button><button class="admin-tab" onclick="Admin.tab('users')">👤 用户管理</button></div>
      <div class="admin-content" id="admin-content"><div class="loading-spinner">加载中...</div></div></div>`;
    this.tab("resources");
  },

  tab(t) {
    document.querySelectorAll(".admin-tab").forEach(x=>x.classList.remove("active"));
    event.target.classList.add("active");
    t==="resources"?this.loadResources():this.loadUsers();
  },

  async loadResources() {
    const { data } = await supabase.from("resources").select("*, profiles(username)").order("created_at",{ascending:false}).limit(50);
    document.getElementById("admin-content").innerHTML = `<table class="admin-table"><thead><tr><th>资源</th><th>作者</th><th>分类</th><th>点赞</th><th>时间</th><th>操作</th></tr></thead><tbody>${(data||[]).map(r=>`<tr><td class="admin-res-title">${escapeHtml(r.title)}</td><td>${escapeHtml(r.profiles?.username||"未知")}</td><td>${r.category}</td><td>${r.likes_count}</td><td>${timeAgo(r.created_at)}</td><td><button class="btn-danger btn-sm" onclick="Admin.delRes('${r.id}')">删除</button></td></tr>`).join("")||'<tr><td colspan="6">暂无资源</td></tr>'}</tbody></table>`;
  },

  async loadUsers() {
    const { data } = await supabase.from("profiles").select("*").order("created_at",{ascending:false});
    document.getElementById("admin-content").innerHTML = `<table class="admin-table"><thead><tr><th>用户</th><th>ID</th><th>管理员</th><th>注册时间</th><th>操作</th></tr></thead><tbody>${(data||[]).map(u=>`<tr><td>${escapeHtml(u.username)}</td><td>${u.id.substring(0,8)}...</td><td>${u.is_admin?"✅":"❌"}</td><td>${new Date(u.created_at).toLocaleDateString("zh-CN")}</td><td>${!u.is_admin?`<button class="btn-danger btn-sm" onclick="Admin.delUser('${u.id}')">删除</button>`:"系统"}</td></tr>`).join("")||'<tr><td colspan="5">暂无用户</td></tr>'}</tbody></table>`;
  },

  async delRes(id) { if(!confirm("管理员删除此资源？")) return; await supabase.from("resources").delete().eq("id",id); this.loadResources(); },
  async delUser(id) { if(!confirm("确定删除此用户？此操作不可撤销！")) return; await supabase.from("profiles").delete().eq("id",id); this.loadUsers(); }
};
