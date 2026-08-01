import re

with open('/home/ewilliamhe/GlimmerFall2/frontend/src/pages/Arena.jsx', 'r') as f:
    content = f.read()

# 1. Add handleMakeChoice function
inject_func = """  const handleAttack = async (slot) => {"""
new_func = """  const handleMakeChoice = async (payload) => {
    try {
      const r = await api.post("/action", { matchId: match.matchId, slot: session.slot, action: "MAKE_CHOICE", payload });
      refresh(r.data);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Action failed");
    }
  };

  const handleAttack = async (slot) => {"""
content = content.replace(inject_func, new_func)

# 2. Add PendingChoice Modal before </DndContext>
modal_old = """    </DndContext>
  );
}"""
modal_new = """      {/* Pending Choice Modal */}
      <Dialog open={match.state?.pendingChoice && match.state?.pendingChoice?.player === String(session.slot)} onOpenChange={() => {}}>
        <DialogContent className="glass-panel border-white/20 bg-black/95 max-w-2xl p-8" hideClose>
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-center text-[#00BFFF] mb-6">
              {match.state?.pendingChoice?.prompt}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 items-center">
            {match.state?.pendingChoice?.options?.map((opt, i) => (
              <Button 
                key={i} 
                onClick={() => handleMakeChoice(opt.payload)}
                className="w-full max-w-sm h-14 text-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/30 text-white font-bold transition-all"
              >
                {opt.text}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </DndContext>
  );
}"""
content = content.replace(modal_old, modal_new)

with open('/home/ewilliamhe/GlimmerFall2/frontend/src/pages/Arena.jsx', 'w') as f:
    f.write(content)
