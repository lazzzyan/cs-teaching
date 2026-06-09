// PROFILE - 用户主页
const Profile = {
  async render(userId) {
    Nav.render();
    const c = document.getElementById("app-container");
    const targetId = userId || App.currentUser?.id;
    const isOwn = targetId === App.currentUser?.id;
    c.innerHTML = '<div class="loading-spinner">加载中...</div>';
    const { data: profile } = await supabase.from("profiles").select("*").eq("id", targetId).single();
    if (!profile) { c.innerHTML = '<div class="empty-state">用户不存在</div>'; return; }
    const { data: resources } = await supabase.from("resources").select("*").eq("user_id", targetId).order("created_at", { ascending: false });
    const { data: likesAgg } = await supabase.from("resources").select("likes_count").eq("user_id", targetId);
    const totalLikes = likesAgg?.reduce((sum, r) => sum + (r.likes_count || 0), 0) || 0;
    let friendStatus = null;
    if (!isOwn && App.currentUser) {
      const { data: fs } = await supabase.from("friendships").select("*").or(`and(user_id.eq.${App.currentUser.id},friend_id.eq.${targetId}),and(user_id.eq.${targetId},friend_id.eq.${App.currentUser.id})`).maybeSingle();
      friendStatus = fs?.status;
    }
    c.innerHTML = `<div class="profile-page">
      <button class="btn-back" onclick="Router.go('feed')">← 返回</button>
      <div class="profile-header">
        <div class="profile-avatar-lg">${profile.username[0].toUpperCase()}</div>
        <div class="profile-info"><h1>${escapeHtml(profile.username)}</h1>
          <p class="profile-bio">${escapeHtml(profile.bio||"这个人很懒，什么都没写...")}</p>
          <div class="profile-stats"><div class="stat"><span class="stat-value">${resources?.length||0}</span><span class="stat-label">资源</span></div><div class="stat"><span class="stat-value">${totalLikes}</span><span class="stat-label">获赞</span></div></div>
          ${!isOwn&&App.currentUser?`<div class="profile-actions">${friendStatus==="accepted"?`<button class="btn-secondary" onclick="Router.go('chat','${targetId}')">💬 发消息</button><button class="btn-text-sm btn-danger" onclick="Friends.remove('${targetId}')">删除好友</button>`:friendStatus==="pending"?`<button class="btn-secondary" disabled>⏳ 等待确认</button>`:`<button class="btn-primary" onclick="Friends.sendRequest('${targetId}')">➕ 添加好友</button>`}</div>`:""}
          ${isOwn?`<button class="btn-danger-outline" onclick="Auth.handleDeleteAccount()" style="margin-top:12px">注销账号</button>`:""}
        </div>
      </div>
      <div class="profile-resources"><h3>📚 ${isOwn?"我的":"TA的"}教学资源 (${resources?.length||0})</h3>
        <div class="feed-grid">${(resources||[]).map(r=>Resources.createCard(r).outerHTML).join("")}</div>
        ${(!resources||resources.length===0)?'<div class="empty-state">暂无资源</div>':""}
      </div>
    </div>`;
  }
};
