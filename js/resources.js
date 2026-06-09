// RESOURCES - 资源管理
const Resources = {
  page: 0,
  pageSize: 12,

  async renderFeed() {
    const c = document.getElementById("app-container");
    c.innerHTML = `<div class="feed-page">
      <div class="feed-header"><h2>📚 最新教学资源</h2>
        <div class="feed-filters">
          <select id="feed-category" class="filter-select">
            <option value="">全部分类</option><option value="枪法技巧">🔫 枪法技巧</option><option value="地图攻略">🗺️ 地图攻略</option><option value="道具投掷">💣 道具投掷</option><option value="意识战术">🧠 意识战术</option><option value="身法技巧">🏃 身法技巧</option><option value="比赛复盘">📺 比赛复盘</option><option value="新手入门">📖 新手入门</option><option value="其他">📌 其他</option>
          </select>
          <select id="feed-sort" class="filter-select"><option value="newest">最新发布</option><option value="popular">最多点赞</option></select>
        </div>
      </div>
      <div class="feed-grid" id="feed-grid"><div class="loading-spinner">加载中...</div></div>
      <div class="feed-load-more" id="feed-load-more" style="display:none"><button class="btn-secondary" onclick="Resources.loadMore()">加载更多</button></div>
    </div>`;
    document.getElementById("feed-category").addEventListener("change", () => this.load(true));
    document.getElementById("feed-sort").addEventListener("change", () => this.load(true));
    this.page = 0;
    await this.load(true);
  },

  async load(reset) {
    if (reset) this.page = 0;
    const category = document.getElementById("feed-category")?.value || "";
    const sort = document.getElementById("feed-sort")?.value || "newest";
    const grid = document.getElementById("feed-grid");
    if (reset) grid.innerHTML = '<div class="loading-spinner">加载中...</div>';

    let q = supabase.from("resources").select("*, profiles(username, avatar_url)").range(this.page * this.pageSize, (this.page + 1) * this.pageSize - 1);
    if (category) q = q.eq("category", category);
    if (sort === "popular") q = q.order("likes_count", { ascending: false });
    else q = q.order("created_at", { ascending: false });
    const { data } = await q;
    if (reset) grid.innerHTML = "";
    if (!data || data.length === 0) {
      if (reset) grid.innerHTML = '<div class="empty-state">暂无资源，来做第一个分享者吧！</div>';
      document.getElementById("feed-load-more").style.display = "none";
      return;
    }
    data.forEach(r => grid.appendChild(this.createCard(r)));
    this.page++;
    document.getElementById("feed-load-more").style.display = data.length < this.pageSize ? "none" : "";
  },

  async loadMore() { await this.load(false); },

  createCard(resource) {
    const card = document.createElement("div");
    card.className = "resource-card";
    card.onclick = () => Router.go("resource-detail", resource.id);
    const isVideo = resource.media_type === "video";
    card.innerHTML = `<div class="card-media">
      ${isVideo ? `<video src="${resource.media_url}" poster="${resource.thumbnail_url||""}" preload="metadata"></video><div class="play-icon">▶</div>` : `<img src="${resource.media_url}" alt="" loading="lazy">`}
      <span class="card-category">${resource.category}</span>
    </div>
    <div class="card-body">
      <h3 class="card-title">${escapeHtml(resource.title)}</h3>
      <p class="card-desc">${escapeHtml(resource.description||"").substring(0,80)}</p>
      <div class="card-tags">${(resource.tags||[]).slice(0,3).map(t=>'<span class="tag">#'+escapeHtml(t)+'</span>').join("")}</div>
      <div class="card-footer">
        <div class="card-author" onclick="event.stopPropagation();Router.go('profile','${resource.user_id}')">
          <div class="avatar-sm">${(resource.profiles?.username||"U")[0].toUpperCase()}</div>
          <span>${escapeHtml(resource.profiles?.username||"未知用户")}</span>
        </div>
        <div class="card-stats"><span>👍 ${resource.likes_count||0}</span><span>💬 ${resource.comments_count||0}</span><span class="time-ago">${timeAgo(resource.created_at)}</span></div>
      </div>
    </div>`;
    return card;
  },

  async renderDetail(resourceId) {
    Nav.render();
    const c = document.getElementById("app-container");
    c.innerHTML = '<div class="loading-spinner">加载中...</div>';
    const { data: r } = await supabase.from("resources").select("*, profiles(username, avatar_url, id)").eq("id", resourceId).single();
    if (!r) { c.innerHTML = '<div class="empty-state">资源不存在或已被删除</div>'; return; }
    const { data: comments } = await supabase.from("comments").select("*, profiles(username, avatar_url, id)").eq("resource_id", resourceId).order("created_at", { ascending: true });
    let userVote = null;
    if (App.currentUser) {
      const { data: v } = await supabase.from("resource_votes").select("vote_type").eq("user_id", App.currentUser.id).eq("resource_id", resourceId).single();
      userVote = v?.vote_type;
    }
    const isOwner = App.currentUser?.id === r.user_id;
    const isAdmin = App.currentProfile?.is_admin;
    c.innerHTML = `<div class="detail-page">
      <button class="btn-back" onclick="Router.go('feed')">← 返回</button>
      <div class="detail-layout">
        <div class="detail-media">${r.media_type==="video"?`<video src="${r.media_url}" controls class="detail-video"></video>`:`<img src="${r.media_url}" class="detail-image">`}</div>
        <div class="detail-info">
          <div class="detail-header"><h1>${escapeHtml(r.title)}</h1>
            <div class="detail-actions">${isOwner?`<button class="btn-icon" onclick="Router.go('edit-resource','${r.id}')" title="编辑">✏️</button>`:""}${(isOwner||isAdmin)?`<button class="btn-icon btn-danger" onclick="Resources.deleteResource('${r.id}')" title="删除">🗑️</button>`:""}</div>
          </div>
          <div class="detail-meta"><span class="detail-category">${r.category}</span>
            <div class="detail-author" onclick="Router.go('profile','${r.user_id}')"><div class="avatar-sm">${(r.profiles?.username||"U")[0].toUpperCase()}</div><span>${escapeHtml(r.profiles?.username||"未知")}</span></div>
            <span class="time-ago">${timeAgo(r.created_at)}</span>
          </div>
          <p class="detail-desc">${escapeHtml(r.description||"暂无描述")}</p>
          <div class="detail-tags">${(r.tags||[]).map(t=>'<span class="tag" onclick="Router.go(\'search\',\''+escapeHtml(t)+'\')">#'+escapeHtml(t)+'</span>').join("")}</div>
          <div class="detail-votes">
            <button class="vote-btn ${userVote==='like'?'voted':''}" id="btn-like" ${!App.currentUser?'disabled':''}>👍 <span id="likes-count">${r.likes_count||0}</span></button>
            <button class="vote-btn ${userVote==='dislike'?'voted':''}" id="btn-dislike" ${!App.currentUser?'disabled':''}>👎 <span id="dislikes-count">${r.dislikes_count||0}</span></button>
          </div>
        </div>
      </div>
      <div class="comments-section"><h3>💬 评论 (${comments?.length||0})</h3>
        ${App.currentUser?`<div class="comment-form"><textarea id="comment-input" placeholder="写下你的评论..." rows="3"></textarea><button class="btn-primary" id="btn-comment">发表评论</button></div>`:'<p class="login-hint">请登录后发表评论</p>'}
        <div class="comments-list" id="comments-list">${(comments||[]).map(c=>`<div class="comment-item">
          <div class="comment-avatar" onclick="Router.go('profile','${c.user_id}')">${(c.profiles?.username||"U")[0].toUpperCase()}</div>
          <div class="comment-body"><div class="comment-header"><span class="comment-username link" onclick="Router.go('profile','${c.user_id}')">${escapeHtml(c.profiles?.username||"未知")}</span><span class="time-ago">${timeAgo(c.created_at)}</span></div>
          <p class="comment-content">${escapeHtml(c.content)}</p>${(App.currentUser?.id===c.user_id||isAdmin)?`<button class="btn-text-sm" onclick="Resources.deleteComment('${c.id}','${resourceId}')">删除</button>`:""}</div>
        </div>`).join("")}</div>
      </div>
    </div>`;
    if (App.currentUser) {
      document.getElementById("btn-like").addEventListener("click", () => this.handleVote(resourceId, "like"));
      document.getElementById("btn-dislike").addEventListener("click", () => this.handleVote(resourceId, "dislike"));
      document.getElementById("btn-comment").addEventListener("click", () => {
        const content = document.getElementById("comment-input").value.trim();
        if (content) this.addComment(resourceId, content);
      });
    }
  },

  async handleVote(resourceId, voteType) {
    if (!App.currentUser) return;
    const existing = document.querySelector(".vote-btn.voted");
    if (existing) {
      const existingType = existing.id === "btn-like" ? "like" : "dislike";
      if (existingType === voteType) {
        await supabase.from("resource_votes").delete().eq("user_id", App.currentUser.id).eq("resource_id", resourceId);
      } else {
        await supabase.from("resource_votes").update({ vote_type: voteType }).eq("user_id", App.currentUser.id).eq("resource_id", resourceId);
      }
    } else {
      await supabase.from("resource_votes").insert({ user_id: App.currentUser.id, resource_id: resourceId, vote_type: voteType });
    }
    const { data: r } = await supabase.from("resources").select("likes_count, dislikes_count").eq("id", resourceId).single();
    if (r) { document.getElementById("likes-count").textContent = r.likes_count; document.getElementById("dislikes-count").textContent = r.dislikes_count; }
    Router.go("resource-detail", resourceId);
  },

  async addComment(resourceId, content) {
    await supabase.from("comments").insert({ user_id: App.currentUser.id, resource_id: resourceId, content });
    Router.go("resource-detail", resourceId);
  },

  async deleteComment(commentId, resourceId) {
    if (!confirm("确定删除此评论？")) return;
    await supabase.from("comments").delete().eq("id", commentId);
    Router.go("resource-detail", resourceId);
  },

  async deleteResource(resourceId) {
    if (!confirm("确定删除此资源？所有评论和点赞将一并清除！")) return;
    await supabase.from("resources").delete().eq("id", resourceId);
    Router.go("feed");
  },

  renderUpload(editId = null) {
    Nav.render();
    const c = document.getElementById("app-container");
    const isEdit = !!editId;
    c.innerHTML = `<div class="upload-page"><h2>${isEdit?"✏️ 编辑资源":"📤 上传教学资源"}</h2>
      <form id="upload-form" class="upload-form">
        <div class="form-row">
          <div class="input-group"><label>标题 *</label><input type="text" id="res-title" placeholder="输入资源标题" required maxlength="100"></div>
          <div class="input-group"><label>分类 *</label><select id="res-category" required><option value="">选择分类</option><option value="枪法技巧">🔫 枪法技巧</option><option value="地图攻略">🗺️ 地图攻略</option><option value="道具投掷">💣 道具投掷</option><option value="意识战术">🧠 意识战术</option><option value="身法技巧">🏃 身法技巧</option><option value="比赛复盘">📺 比赛复盘</option><option value="新手入门">📖 新手入门</option><option value="其他">📌 其他</option></select></div>
        </div>
        <div class="input-group"><label>描述</label><textarea id="res-desc" placeholder="详细描述这个教学资源..." rows="5"></textarea></div>
        <div class="input-group"><label>标签（逗号分隔）</label><input type="text" id="res-tags" placeholder="例如: AK47, 压枪, 进阶"></div>
        <div class="input-group"><label>上传文件（图片或视频）${isEdit?"(留空则保留原文件)":" *"}</label>
          <div class="upload-zone" id="upload-zone"><div class="upload-placeholder"><span class="upload-icon">📁</span><p>点击或拖拽文件到此处</p><p class="upload-hint">支持 JPG/PNG/GIF/MP4/WEBM, 最大100MB</p></div>
          <input type="file" id="res-file" accept="image/*,video/*" style="display:none"><div class="upload-preview" id="upload-preview" style="display:none"></div></div>
        </div>
        <div class="form-actions"><button type="button" class="btn-secondary" onclick="Router.go('feed')">取消</button><button type="submit" class="btn-primary" id="upload-btn">${isEdit?"保存修改":"上传资源"}</button></div>
      </form>
      <div class="upload-progress" id="upload-progress" style="display:none"><div class="progress-bar"><div class="progress-fill"></div></div><span class="progress-text">上传中...</span></div>
    </div>`;
    const zone = document.getElementById("upload-zone");
    const fileInput = document.getElementById("res-file");
    zone.addEventListener("click", () => fileInput.click());
    zone.addEventListener("dragover", (e) => { e.preventDefault(); zone.classList.add("dragover"); });
    zone.addEventListener("dragleave", () => zone.classList.remove("dragover"));
    zone.addEventListener("drop", (e) => { e.preventDefault(); zone.classList.remove("dragover"); if (e.dataTransfer.files.length) this.previewFile(e.dataTransfer.files[0]); });
    fileInput.addEventListener("change", (e) => { if (e.target.files.length) this.previewFile(e.target.files[0]); });
    if (isEdit) this.loadForEdit(editId);
    document.getElementById("upload-form").addEventListener("submit", async (e) => { e.preventDefault(); await this.handleUpload(editId); });
  },

  async loadForEdit(resourceId) {
    const { data } = await supabase.from("resources").select("*").eq("id", resourceId).single();
    if (!data || data.user_id !== App.currentUser?.id) { Router.go("feed"); return; }
    document.getElementById("res-title").value = data.title;
    document.getElementById("res-category").value = data.category;
    document.getElementById("res-desc").value = data.description || "";
    document.getElementById("res-tags").value = (data.tags || []).join(", ");
    const preview = document.getElementById("upload-preview");
    preview.style.display = "block";
    preview.innerHTML = data.media_type === "video" ? `<video src="${data.media_url}" controls style="max-width:100%;max-height:300px"></video>` : `<img src="${data.media_url}" style="max-width:100%;max-height:300px">`;
  },

  previewFile(file) {
    const preview = document.getElementById("upload-preview");
    preview.style.display = "block";
    preview.innerHTML = file.type.startsWith("video/") ? `<video src="${URL.createObjectURL(file)}" controls style="max-width:100%;max-height:300px"></video>` : `<img src="${URL.createObjectURL(file)}" style="max-width:100%;max-height:300px">`;
    document.querySelector(".upload-placeholder").style.display = "none";
  },

  async handleUpload(editId) {
    const title = document.getElementById("res-title").value.trim();
    const category = document.getElementById("res-category").value;
    const description = document.getElementById("res-desc").value.trim();
    const tagsStr = document.getElementById("res-tags").value.trim();
    const fileInput = document.getElementById("res-file");
    const file = fileInput.files[0];
    if (!title || !category) return alert("请填写标题和分类");
    let mediaUrl = null, mediaType = null, thumbnailUrl = null;
    const progressEl = document.getElementById("upload-progress");
    const btn = document.getElementById("upload-btn");
    if (file) {
      progressEl.style.display = "block"; btn.disabled = true;
      const fileExt = file.name.split(".").pop();
      const fileName = `${App.currentUser.id}/${Date.now()}.${fileExt}`;
      mediaType = file.type.startsWith("video/") ? "video" : "image";
      const { error: uploadError } = await supabase.storage.from("resources").upload(fileName, file, { upsert: true });
      if (uploadError) { alert("文件上传失败: " + uploadError.message); progressEl.style.display = "none"; btn.disabled = false; return; }
      const { data: urlData } = supabase.storage.from("resources").getPublicUrl(fileName);
      mediaUrl = urlData.publicUrl;
      thumbnailUrl = mediaType === "video" ? mediaUrl : null;
      progressEl.style.display = "none"; btn.disabled = false;
    }
    const resourceData = { title, category, description, tags: tagsStr ? tagsStr.split(",").map(t => t.trim()).filter(Boolean) : [] };
    if (mediaUrl) { resourceData.media_url = mediaUrl; resourceData.media_type = mediaType; if (thumbnailUrl) resourceData.thumbnail_url = thumbnailUrl; }
    if (editId) {
      const { error } = await supabase.from("resources").update(resourceData).eq("id", editId);
      if (error) alert("更新失败: " + error.message); else Router.go("resource-detail", editId);
    } else {
      if (!mediaUrl) return alert("请选择上传文件");
      resourceData.user_id = App.currentUser.id;
      const { data, error } = await supabase.from("resources").insert(resourceData).select().single();
      if (error) alert("发布失败: " + error.message); else Router.go("resource-detail", data.id);
    }
  },

  async renderSearch(query) {
    Nav.render();
    const c = document.getElementById("app-container");
    c.innerHTML = `<div class="search-page"><h2>🔍 搜索: "${escapeHtml(query)}"</h2><div class="feed-grid" id="search-results"><div class="loading-spinner">搜索中...</div></div></div>`;
    const { data: resources } = await supabase.from("resources").select("*, profiles(username, avatar_url)").or(`title.ilike.%${query}%,description.ilike.%${query}%`).order("created_at", { ascending: false }).limit(30);
    const { data: users } = await supabase.from("profiles").select("*").ilike("username", `%${query}%`).limit(10);
    const grid = document.getElementById("search-results");
    grid.innerHTML = "";
    if (users?.length) {
      const sec = document.createElement("div"); sec.className = "search-users";
      sec.innerHTML = `<h3>👤 用户</h3><div class="user-list">${users.map(u => `<div class="user-card-sm" onclick="Router.go('profile','${u.id}')"><div class="avatar-md">${u.username[0].toUpperCase()}</div><span>${escapeHtml(u.username)}</span></div>`).join("")}</div>`;
      grid.appendChild(sec);
    }
    if (resources?.length) { const sec = document.createElement("div"); sec.innerHTML = "<h3>📚 资源</h3>"; sec.className = "search-resources"; resources.forEach(r => sec.appendChild(this.createCard(r))); grid.appendChild(sec); }
    if (!users?.length && !resources?.length) grid.innerHTML = '<div class="empty-state">没有找到相关内容</div>';
  }
};
