# CS教学平台 - 前端接口规范文档

---

## 项目概况
CS教学平台 = **纯原生 HTML/CSS/JS 单页应用 (SPA)** + **Supabase BaaS 后端**
部署于 Netlify（根目录发布），所有后端逻辑由 Supabase（Postgres + Auth + Storage + Realtime）提供，前端无需任何自建 API。

---

## 目录结构
```
E:\cs网页端+客户端\
├── index.html                   # 入口 SPA
├── css/                         # 样式（可整体重构）
│   ├── style.css                # 全局 + 登录注册
│   ├── cards.css                # 资源卡片
│   ├── detail.css               # 资源详情
│   ├── upload.css               # 上传/编辑
│   ├── social.css               # 好友/聊天/个人页
│   └── admin.css                # 管理后台
├── js/
│   ├── config.js                # Supabase 初始化（**不要改**）
│   ├── router.js                # 路由 + App 入口
│   ├── auth.js                  # 登录/注册/登出/注销
│   ├── resources.js             # 资源 CRUD + 搜索 + 点赞/评论
│   ├── profile.js               # 个人主页
│   ├── friends.js               # 好友系统
│   ├── chat.js                  # 实时聊天（Realtime）
│   ├── admin.js                 # 管理后台
│   ├── nav.js                   # 顶部导航 + 底部圆形导航
│   ├── three-bg.js              # Three.js 3D 星空背景
│   └── utils.js                 # escapeHtml / timeAgo / getErrorMessage
└── supabase/schema.sql          # 数据库 schema
```

---

## 一、Supabase 配置（不可修改）

`js/config.js` 初始化 Supabase 客户端：
- `initSupabase()` 返回全局 `supabase` 对象
- 自动启用 `autoRefreshToken`、`persistSession`、`detectSessionInUrl`
- Realtime 参数：`eventsPerSecond: 10`

## 二、全局入口 & 路由

**全局变量：**
- `Router.currentPage` - 当前页面名
- `Router.go(page, data?)` - 切换页面，触发 3D 转场动画
- `App.currentUser` - 当前 Supabase auth user 对象
- `App.currentProfile` - 当前用户在 `profiles` 表中的行

**入口逻辑（`router.js`）：**
1. `DOMContentLoaded` → `App.init()`
2. 检查 Supabase session → 有则 `Router.go("feed")`，无则 `Router.go("login")`
3. 监听 `onAuthStateChange` → `SIGNED_IN` 跳 feed，`SIGNED_OUT` 跳 login

**页面路由表：**

| 页面名 | 说明 | data 参数 | 对应渲染函数 |
|--------|------|-----------|-------------|
| `login` | 登录页 | 无 | `Auth.renderLogin()` |
| `register` | 注册页 | 无 | `Auth.renderRegister()` |
| `feed` | 资源首页（分类 tab） | 无 | `Resources.renderFeed()` |
| `upload` | 上传资源 | 无 | `Resources.renderUpload()` |
| `edit-resource` | 编辑资源 | resource_id | `Resources.renderUpload(data)` |
| `resource-detail` | 资源详情 | resource_id | `Resources.renderDetail(data)` |
| `profile` | 个人/他人主页 | target_user_id(可选) | `Profile.render(data)` |
| `friends` | 好友列表 | 无 | `Friends.render()` |
| `chat` | 聊天页 | friendId | `Chat.render(data)` |
| `admin` | 管理后台 | 无 | `Admin.render()` |
| `search` | 搜索结果 | 搜索关键词 | `Resources.renderSearch(data)` |

> Chat 页面切换前会执行 `Chat.cleanup()` 清理 Realtime 频道

---

## 三、数据库表结构

```sql
-- profiles: 用户资料（新用户注册后由触发器自动创建）
profiles (
  id UUID PK → auth.users,
  username TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  bio TEXT DEFAULT '',
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)

-- resources: 教学资源
resources (
  id UUID PK,
  user_id FK → profiles.id,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  category TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  media_url TEXT NOT NULL,
  media_type CHECK ('image'|'video') NOT NULL,
  thumbnail_url TEXT,
  likes_count INTEGER DEFAULT 0,
  dislikes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  search_vector tsvector       -- 全文搜索索引，由触发器自动维护
)

-- resource_votes: 点赞/踩 (user_id + resource_id UNIQUE)
resource_votes (
  id UUID PK,
  user_id FK → profiles.id,
  resource_id FK → resources.id,
  vote_type CHECK ('like'|'dislike') NOT NULL,
  created_at TIMESTAMPTZ
)

-- comments: 评论
comments (
  id UUID PK,
  user_id FK → profiles.id,
  resource_id FK → resources.id,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ
)

-- friendships: 好友关系 (user_id + friend_id UNIQUE)
friendships (
  id UUID PK,
  user_id FK → profiles.id,
  friend_id FK → profiles.id,
  status CHECK ('pending'|'accepted'|'blocked') DEFAULT 'pending',
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)

-- chat_messages: 聊天消息
chat_messages (
  id UUID PK,
  sender_id FK → profiles.id,
  receiver_id FK → profiles.id,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ
)
```

**重要：** 所有表已启用 RLS（行级安全），前端操作自动受权限约束，不需要在代码中做额外权限判断。
点赞/踩计数和评论计数由数据库触发器自动维护，不需要前端手动更新。

---

## 四、Supabase API 调用速查

### 4.1 Auth（js/auth.js）
```js
supabase.auth.signInWithPassword({ email, password })
supabase.auth.signUp({ email, password, options: { data: { username } } })
// 注册成功后需手动更新 profiles.username（触发器用 email 作为默认值）
supabase.from("profiles").update({ username }).eq("id", data.user.id)
supabase.auth.signOut()
supabase.rpc("delete_user")          // 调用 Postgres 函数注销账号
```

### 4.2 Resources 资源 CRUD（js/resources.js）
```js
// 分页查询（带用户信息），支持按 category 过滤和排序
supabase.from("resources").select("*, profiles(username, avatar_url)")
  .range(skip, skip+pageSize-1)
  .eq("category", cat).order("created_at", {ascending:false})

// 获取单条资源详情（带发布者）
supabase.from("resources").select("*, profiles(username, avatar_url, id)")
  .eq("id", resourceId).single()

// 模糊搜索（标题+描述）
supabase.from("resources").select("*, profiles(username, avatar_url)")
  .or(`title.ilike.%${q}%,description.ilike.%${q}%`)
  .order("created_at", {ascending:false}).limit(30)

// 搜索用户
supabase.from("profiles").select("*")
  .ilike("username", `%${q}%`).limit(10)

// 获取评论（带用户信息，时间升序）
supabase.from("comments").select("*, profiles(username, avatar_url, id)")
  .eq("resource_id", id).order("created_at", {ascending: true})

// 获取当前用户的投票状态
supabase.from("resource_votes").select("vote_type")
  .eq("user_id", App.currentUser.id).eq("resource_id", id).single()

// 投票：先删旧，再按需 insert/update
supabase.from("resource_votes").delete()
  .eq("user_id", uid).eq("resource_id", rid)
supabase.from("resource_votes").update({ vote_type })
  .eq("user_id", uid).eq("resource_id", rid)
supabase.from("resource_votes").insert({ user_id, resource_id, vote_type })
// 投完后重新查 likes_count / dislikes_count 更新 UI
supabase.from("resources").select("likes_count, dislikes_count")
  .eq("id", rid).single()

// 发表/删除评论
supabase.from("comments").insert({ user_id, resource_id, content })
supabase.from("comments").delete().eq("id", commentId)

// 上传图片/视频到 Storage
supabase.storage.from("resources").upload(fileName, file, { upsert: true })
supabase.storage.from("resources").getPublicUrl(fileName)
// → 返回 { data: { publicUrl: "https://..." } }

// 插入新资源
supabase.from("resources").insert({
  user_id, title, description, category, tags, media_url, media_type, thumbnail_url
}).select().single()

// 更新资源
supabase.from("resources").update({ title, description, category, tags, media_url, media_type, thumbnail_url })
  .eq("id", editId)

// 删除资源
supabase.from("resources").delete().eq("id", resourceId)
```

### 4.3 Profile 个人主页（js/profile.js）
```js
// 获取用户资料
supabase.from("profiles").select("*").eq("id", targetId).single()
// 用户发布的所有资源
supabase.from("resources").select("*").eq("user_id", targetId)
  .order("created_at", { ascending: false })
// 获赞总数
supabase.from("resources").select("likes_count").eq("user_id", targetId)
// 好友关系状态
supabase.from("friendships").select("*")
  .or(`and(user_id.eq.${me},friend_id.eq.${target}),and(user_id.eq.${target},friend_id.eq.${me})`)
  .maybeSingle()
```

### 4.4 Friends 好友系统（js/friends.js）
```js
// 已接受的好友（双向查）
supabase.from("friendships")
  .select("friend_id, profiles!friendships_friend_id_fkey(username, id)")
  .eq("user_id", uid).eq("status", "accepted")
supabase.from("friendships")
  .select("user_id, profiles!friendships_user_id_fkey(username, id)")
  .eq("friend_id", uid).eq("status", "accepted")

// 待处理的好友请求
supabase.from("friendships")
  .select("user_id, profiles!friendships_user_id_fkey(username, id)")
  .eq("friend_id", uid).eq("status", "pending")

// 发送好友请求 / 删除好友 / 接受 / 拒绝
supabase.from("friendships").insert({ user_id, friend_id, status: "pending" })
supabase.from("friendships").delete()
  .or(`and(user_id.eq.${a},friend_id.eq.${b}),and(user_id.eq.${b},friend_id.eq.${a})`)
supabase.from("friendships").update({ status: "accepted" })
  .eq("user_id", uid).eq("friend_id", me)     // 接受
supabase.from("friendships").delete()
  .eq("user_id", uid).eq("friend_id", me)      // 拒绝
```

### 4.5 Chat 实时聊天（js/chat.js）
```js
// 查询好友信息
supabase.from("profiles").select("*").eq("id", friendId).single()
// 历史消息（50条，升序）
supabase.from("chat_messages").select("*")
  .or(`and(sender_id.eq.${me},receiver_id.eq.${friend}),and(sender_id.eq.${friend},receiver_id.eq.${me})`)
  .order("created_at", { ascending: true }).limit(50)
// 发送消息
supabase.from("chat_messages").insert({ sender_id, receiver_id, content })
// Realtime 订阅新消息
supabase.channel(`chat-${[me, friendId].sort().join("-")}`)
  .on("postgres_changes", {
    event: "INSERT", schema: "public", table: "chat_messages",
    filter: `sender_id=eq.${friendId},receiver_id=eq.${me}`
  }, (payload) => { /* payload.new = 新消息行 */ })
  .subscribe()
// 离开频道
supabase.removeChannel(channel)
```

### 4.6 Admin 管理后台（js/admin.js）
```js
// 管理员可见性：App.currentProfile?.is_admin
supabase.from("resources").select("*, profiles(username)")
  .order("created_at", { ascending: false }).limit(50)
supabase.from("profiles").select("*").order("created_at", { ascending: false })
supabase.from("resources").delete().eq("id", id)
supabase.from("profiles").delete().eq("id", id)
```

### 4.7 Nav 导航（js/nav.js）
```js
Nav.render()          // 渲染顶部导航（logo、搜索框、首页/上传/好友/管理/用户头像/退出按钮）
Nav.renderCircleNav() // 渲染底部圆形导航（移动端 icon 导航）
```
管理员链接通过 `App.currentProfile?.is_admin` 控制显示。

---

## 五、工具函数（js/utils.js）

```js
escapeHtml(str)       // XSS 防注入
timeAgo(dateStr)      // 时间格式化为 "刚刚/3分钟前/2小时前/3天前/日期"
getErrorMessage(msg)  // Supabase 错误信息中文化
```

---

## 六、外部 CDN 依赖

```html
<script src="https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.39.7/dist/umd/supabase.min.js"></script>
```

---

## 七、前端重构关键约定

1. **`js/config.js` 和 `supabase/schema.sql` 不可修改**（除非后端数据库结构变更）
2. 路由名（`login`, `register`, `feed` 等11个）必须保持一致
3. 新前端只需保持同样的 API 调用签名即可无缝接入
4. CSS 可完全替换；JS 模块可自由重写，API 调用模式不变就行
5. 入口必须是 `index.html`（Netlify 发布根目录）
6. 所有数据库操作已由 RLS 策略做权限控制，前端无需额外鉴权
7. 点赞/评论计数由数据库触发器自动维护，前端只管投票 CRUD
8. 新用户注册后 profiles 行由触发器自动创建，但 username 需前端手动 update
