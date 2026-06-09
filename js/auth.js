// AUTH - 认证系统
const Auth = {
  renderLogin() {
    const c = document.getElementById("app-container");
    c.innerHTML = `<div class="auth-page"><div class="auth-card">
      <div class="auth-logo"><div class="logo-icon">CS</div><h1>教学平台</h1><p class="auth-subtitle">分享技巧 · 共同进步</p></div>
      <form id="login-form" class="auth-form">
        <div class="input-group"><input type="email" id="login-email" placeholder="邮箱地址" required autocomplete="email"></div>
        <div class="input-group"><input type="password" id="login-password" placeholder="密码" required autocomplete="current-password"></div>
        <button type="submit" class="btn-primary btn-block" id="login-btn"><span class="btn-text">登 录</span></button>
      </form>
      <div class="auth-footer"><p>还没有账号？<a href="#" class="link" onclick="Router.go('register')">立即注册</a></p></div>
      <div class="auth-error" id="login-error" style="display:none"></div>
    </div></div>`;
    document.getElementById("login-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      await this.handleLogin(document.getElementById("login-email").value.trim(), document.getElementById("login-password").value);
    });
  },

  renderRegister() {
    const c = document.getElementById("app-container");
    c.innerHTML = `<div class="auth-page"><div class="auth-card">
      <div class="auth-logo"><div class="logo-icon">CS</div><h1>创建账号</h1><p class="auth-subtitle">加入CS教学社区</p></div>
      <form id="register-form" class="auth-form">
        <div class="input-group"><input type="text" id="reg-username" placeholder="用户名" required minlength="2" maxlength="20"></div>
        <div class="input-group"><input type="email" id="reg-email" placeholder="邮箱地址" required autocomplete="email"></div>
        <div class="input-group"><input type="password" id="reg-password" placeholder="密码（至少6位）" required minlength="6" autocomplete="new-password"></div>
        <div class="input-group"><input type="password" id="reg-confirm" placeholder="确认密码" required autocomplete="new-password"></div>
        <button type="submit" class="btn-primary btn-block" id="reg-btn"><span class="btn-text">注 册</span></button>
      </form>
      <div class="auth-footer"><p>已有账号？<a href="#" class="link" onclick="Router.go('login')">返回登录</a></p></div>
      <div class="auth-error" id="reg-error" style="display:none"></div>
    </div></div>`;
    document.getElementById("register-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      await this.handleRegister();
    });
  },

  async handleLogin(email, password) {
    const btn = document.getElementById("login-btn");
    const err = document.getElementById("login-error");
    btn.classList.add("loading"); err.style.display = "none";
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { err.textContent = getErrorMessage(error.message); err.style.display = "block"; btn.classList.remove("loading"); }
  },

  async handleRegister() {
    const username = document.getElementById("reg-username").value.trim();
    const email = document.getElementById("reg-email").value.trim();
    const password = document.getElementById("reg-password").value;
    const confirm = document.getElementById("reg-confirm").value;
    const btn = document.getElementById("reg-btn");
    const err = document.getElementById("reg-error");
    if (password !== confirm) { err.textContent = "两次密码不一致"; err.style.display = "block"; return; }
    btn.classList.add("loading"); err.style.display = "none";
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { username } } });
    if (error) { err.textContent = getErrorMessage(error.message); err.style.display = "block"; btn.classList.remove("loading"); }
    else if (data.user) { await supabase.from("profiles").update({ username }).eq("id", data.user.id); }
  },

  async handleLogout() { await supabase.auth.signOut(); },

  async handleDeleteAccount() {
    if (!confirm("确定要注销账号吗？此操作不可撤销，所有数据将被永久删除！")) return;
    const { error } = await supabase.rpc("delete_user");
    if (!error) await supabase.auth.signOut();
    else alert("注销失败：" + error.message);
  }
};
