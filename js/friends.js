// FRIENDS - 好友系统
const Friends = {
  async render() {
    Nav.render();
    const c = document.getElementById("app-container");
    c.innerHTML = '<div class="loading-spinner">加载中...</div>';
    const { data: f1 } = await supabase.from("friendships").select("friend_id, profiles!friendships_friend_id_fkey(username, id)").eq("user_id", App.currentUser.id).eq("status", "accepted");
    const { data: f2 } = await supabase.from("friendships").select("user_id, profiles!friendships_user_id_fkey(username, id)").eq("friend_id", App.currentUser.id).eq("status", "accepted");
    const { data: requests } = await supabase.from("friendships").select("user_id, profiles!friendships_user_id_fkey(username, id)").eq("friend_id", App.currentUser.id).eq("status", "pending");
    c.innerHTML = `<div class="friends-page"><h2>👥 好友</h2>
      <div class="friend-search-bar"><input type="text" id="friend-search-input" placeholder="搜索用户..."><button id="friend-search-btn">🔍 搜索</button></div>
      <div id="friend-search-results"></div>
      ${requests?.length?`<div class="friend-requests"><h3>📩 好友请求 (${requests.length})</h3><div class="user-list">${requests.map(r=>`<div class="user-card-row"><div class="avatar-md" onclick="Router.go('profile','${r.user_id}')">${(r.profiles?.username||"U")[0].toUpperCase()}</div><span class="link" onclick="Router.go('profile','${r.user_id}')">${escapeHtml(r.profiles?.username||"未知")}</span><div class="request-actions"><button class="btn-accept" onclick="Friends.handleRequest('${r.user_id}','accept')">✅ 接受</button><button class="btn-reject" onclick="Friends.handleRequest('${r.user_id}','reject')">❌ 拒绝</button></div></div>`).join("")}</div></div>`:""}
      <div class="friend-list"><h3>👥 好友列表</h3><div class="user-list" id="friends-grid">${(()=>{const all=new Map();f1?.forEach(f=>all.set(f.friend_id,f.profiles));f2?.forEach(f=>all.set(f.user_id,f.profiles));if(all.size===0)return'<div class="empty-state">还没有好友，快去搜索添加吧！</div>';return Array.from(all.entries()).map(([id,p])=>`<div class="user-card-row"><div class="avatar-md" onclick="Router.go('profile','${id}')">${(p?.username||"U")[0].toUpperCase()}</div><span class="link" onclick="Router.go('profile','${id}')">${escapeHtml(p?.username||"未知")}</span><button class="btn-chat" onclick="Router.go('chat','${id}')">💬 聊天</button></div>`).join("");})()}</div></div>
    </div>`;
    document.getElementById("friend-search-btn").addEventListener("click", async () => {
      const q = document.getElementById("friend-search-input").value.trim();
      if(!q) return;
      const { data: users } = await supabase.from("profiles").select("*").ilike("username", `%${q}%`).limit(10);
      document.getElementById("friend-search-results").innerHTML = users?.length?`<div class="user-list">${users.map(u=>`<div class="user-card-row"><div class="avatar-md" onclick="Router.go('profile','${u.id}')">${u.username[0].toUpperCase()}</div><span class="link" onclick="Router.go('profile','${u.id}')">${escapeHtml(u.username)}</span><button class="btn-primary btn-sm" onclick="Friends.sendRequest('${u.id}');this.textContent='已发送';this.disabled=true">➕</button></div>`).join("")}</div>`:'<div class="empty-state">未找到用户</div>';
    });
  },

  async sendRequest(friendId) {
    const { error } = await supabase.from("friendships").insert({ user_id: App.currentUser.id, friend_id: friendId, status: "pending" });
    if(error) alert("发送失败: "+error.message); else alert("好友请求已发送！");
  },

  async remove(friendId) {
    if(!confirm("确定删除此好友？")) return;
    await supabase.from("friendships").delete().or(`and(user_id.eq.${App.currentUser.id},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${App.currentUser.id})`);
    Router.go("friends");
  },

  async handleRequest(userId, action) {
    if(action==="accept") await supabase.from("friendships").update({status:"accepted"}).eq("user_id",userId).eq("friend_id",App.currentUser.id);
    else await supabase.from("friendships").delete().eq("user_id",userId).eq("friend_id",App.currentUser.id);
    Router.go("friends");
  }
};
