// CHAT - 实时聊天
const Chat = {
  activeChannel: null,

  async render(friendId) {
    Nav.render();
    const c = document.getElementById("app-container");
    const { data: friend } = await supabase.from("profiles").select("*").eq("id", friendId).single();
    c.innerHTML = `<div class="chat-page">
      <div class="chat-header"><button class="btn-back" onclick="Router.go('friends')">←</button><div class="avatar-sm">${(friend?.username||"U")[0].toUpperCase()}</div><span class="chat-username">${escapeHtml(friend?.username||"未知")}</span></div>
      <div class="chat-messages" id="chat-messages"><div class="chat-loading">加载消息中...</div></div>
      <div class="chat-input-bar"><input type="text" id="chat-input" placeholder="输入消息..." maxlength="500"><button id="chat-send-btn">发送</button></div>
    </div>`;
    const { data: messages } = await supabase.from("chat_messages").select("*").or(`and(sender_id.eq.${App.currentUser.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${App.currentUser.id})`).order("created_at",{ascending:true}).limit(50);
    const msgC = document.getElementById("chat-messages");
    msgC.innerHTML = "";
    messages?.forEach(m => this.appendMsg(m, msgC));
    msgC.scrollTop = msgC.scrollHeight;
    document.getElementById("chat-send-btn").addEventListener("click", () => this.send(friendId));
    document.getElementById("chat-input").addEventListener("keydown", (e) => { if(e.key==="Enter") this.send(friendId); });
    if(this.activeChannel) supabase.removeChannel(this.activeChannel);
    this.activeChannel = supabase.channel(`chat-${[App.currentUser.id,friendId].sort().join("-")}`).on("postgres_changes",{event:"INSERT",schema:"public",table:"chat_messages",filter:`sender_id=eq.${friendId},receiver_id=eq.${App.currentUser.id}`},(payload)=>{this.appendMsg(payload.new,msgC);msgC.scrollTop=msgC.scrollHeight;}).subscribe();
  },

  appendMsg(msg, container) {
    const isMine = msg.sender_id === App.currentUser?.id;
    const div = document.createElement("div");
    div.className = `chat-msg ${isMine?"chat-msg-mine":"chat-msg-other"}`;
    div.innerHTML = `<div class="chat-bubble">${escapeHtml(msg.content)}</div><span class="chat-time">${new Date(msg.created_at).toLocaleTimeString("zh-CN",{hour:"2-digit",minute:"2-digit"})}</span>`;
    container.appendChild(div);
  },

  async send(receiverId) {
    const input = document.getElementById("chat-input");
    const content = input.value.trim();
    if(!content) return;
    const { error } = await supabase.from("chat_messages").insert({sender_id:App.currentUser.id,receiver_id:receiverId,content});
    if(!error) input.value = "";
  },

  cleanup() { if(this.activeChannel) { supabase.removeChannel(this.activeChannel); this.activeChannel = null; } }
};
