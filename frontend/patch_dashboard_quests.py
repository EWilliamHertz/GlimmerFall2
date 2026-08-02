import re

with open('/home/ewilliamhe/GlimmerFall2/frontend/src/pages/Dashboard.jsx', 'r') as f:
    content = f.read()

# 1. Add "quests" to the admin tabs UI
old_nav = """        <button 
          onClick={() => setAdminTab("polls")}
          className={`px-4 py-2 rounded-xl font-head font-bold transition-all ${adminTab === "polls" ? "bg-[#FF5252] text-black" : "text-white/50 hover:text-white"}`}
        >
          Community Polls
        </button>
      </div>"""

new_nav = """        <button 
          onClick={() => setAdminTab("polls")}
          className={`px-4 py-2 rounded-xl font-head font-bold transition-all ${adminTab === "polls" ? "bg-[#FF5252] text-black" : "text-white/50 hover:text-white"}`}
        >
          Community Polls
        </button>
        <button 
          onClick={() => setAdminTab("quests")}
          className={`px-4 py-2 rounded-xl font-head font-bold transition-all ${adminTab === "quests" ? "bg-[#C77DFF] text-black" : "text-white/50 hover:text-white"}`}
        >
          Daily Quests
        </button>
      </div>"""

if "setAdminTab(\"quests\")" not in content:
    content = content.replace(old_nav, new_nav)

# 2. Add Quests section rendering logic
quests_code = """
      {adminTab === "quests" && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display font-bold text-2xl">Daily Quests Manager</h3>
              <p className="text-white/50 font-head text-sm">Generate and approve global daily quests.</p>
            </div>
            <button onClick={() => {
              const days = parseInt(prompt("How many days of quests to generate? (e.g. 7)", "7"));
              if (days) {
                api.post("/admin/quests/generate", { days }).then(() => {
                  toast.success(`Generated ${days} quests!`);
                  api.get("/admin/quests").then(r => setQuests(r.data));
                });
              }
            }} className="px-4 py-2 bg-[#C77DFF] text-black font-bold font-head rounded-xl hover:bg-[#9B30FF]">
              Generate Quests
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(quests || []).map(q => (
              <div key={q.id} className="glass p-4 rounded-2xl border border-white/5 flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <span className="font-head text-sm text-[#C77DFF] font-bold">{new Date(q.quest_date).toLocaleDateString()}</span>
                  {q.is_approved ? (
                    <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded font-bold uppercase tracking-wider">Approved</span>
                  ) : (
                    <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded font-bold uppercase tracking-wider">Pending</span>
                  )}
                </div>
                <div>
                  <div className="font-display font-bold text-lg">{q.description}</div>
                  <div className="font-head text-white/50 text-sm">Reward: {q.reward}</div>
                </div>
                <div className="flex gap-2 mt-2">
                  {!q.is_approved && (
                    <button onClick={() => {
                      api.post(`/admin/quests/${q.id}/approve`).then(() => {
                        toast.success("Quest approved!");
                        api.get("/admin/quests").then(r => setQuests(r.data));
                      });
                    }} className="flex-1 py-2 bg-green-500/20 text-green-400 rounded-xl font-bold font-head hover:bg-green-500/30">Approve</button>
                  )}
                  <button onClick={() => {
                    api.delete(`/admin/quests/${q.id}`).then(() => {
                      toast.success("Quest deleted.");
                      api.get("/admin/quests").then(r => setQuests(r.data));
                    });
                  }} className="flex-1 py-2 bg-red-500/20 text-red-500 rounded-xl font-bold font-head hover:bg-red-500/30">Dismiss</button>
                </div>
              </div>
            ))}
            {quests && quests.length === 0 && (
              <div className="col-span-full text-center text-white/40 py-10">No upcoming quests scheduled.</div>
            )}
          </div>
        </div>
      )}
"""

if "Daily Quests Manager" not in content:
    # insert before the final </div> of AdminPanel
    idx = content.rfind("</div>\n    </div>\n  );\n}\n")
    if idx != -1:
        content = content[:idx] + quests_code + content[idx:]

# 3. Add quests state and fetch logic
if "const [quests, setQuests] = useState(null);" not in content:
    content = content.replace('const [polls, setPolls] = useState(null);', 'const [polls, setPolls] = useState(null);\n  const [quests, setQuests] = useState(null);')
    
    fetch_old = """      } else if (adminTab === "polls") {
        const pRes = await api.get("/admin/polls");
        setPolls(pRes.data);
      }"""
    fetch_new = """      } else if (adminTab === "polls") {
        const pRes = await api.get("/admin/polls");
        setPolls(pRes.data);
      } else if (adminTab === "quests") {
        const qRes = await api.get("/admin/quests");
        setQuests(qRes.data);
      }"""
    content = content.replace(fetch_old, fetch_new)

with open('/home/ewilliamhe/GlimmerFall2/frontend/src/pages/Dashboard.jsx', 'w') as f:
    f.write(content)

