// UTILS - 工具函数
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

function timeAgo(dateStr) {
  const now = new Date();
  const date = new Date(dateStr);
  const seconds = Math.floor((now - date) / 1000);
  if (seconds < 60) return "刚刚";
  if (seconds < 3600) return Math.floor(seconds / 60) + "分钟前";
  if (seconds < 86400) return Math.floor(seconds / 3600) + "小时前";
  if (seconds < 604800) return Math.floor(seconds / 86400) + "天前";
  return date.toLocaleDateString("zh-CN");
}

function getErrorMessage(msg) {
  const map = {
    "Invalid login credentials": "邮箱或密码错误",
    "User already registered": "该邮箱已被注册",
    "Password should be at least 6 characters": "密码至少需要6位",
    "Email not confirmed": "请先验证邮箱"
  };
  return map[msg] || msg;
}
