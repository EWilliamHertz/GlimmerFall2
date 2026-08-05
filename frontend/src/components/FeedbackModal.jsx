import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from 'sonner';
import { api } from '@/lib/api';

export default function FeedbackModal({ open, onClose, user }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      return toast.error("Please fill in both fields.");
    }
    setSubmitting(true);
    try {
      await api.post("/reports", {
        username: user?.nickname || "Anonymous",
        title: title.trim(),
        description: description.trim()
      });
      toast.success("Feedback submitted!");
      setTitle("");
      setDescription("");
      onClose();
    } catch (err) {
      toast.error("Failed to submit feedback.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="glass-panel border-white/20 bg-black/95 max-w-lg p-6">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-white">Give Feedback</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div>
            <label className="block text-sm font-bold text-white/70 mb-2 font-head">Issue Summary</label>
            <input
              type="text"
              className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white font-head"
              placeholder="e.g. Card X didn't activate"
              value={title}
              onChange={e => setTitle(e.target.value)}
              maxLength={100}
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-white/70 mb-2 font-head">Details / Steps to Reproduce</label>
            <textarea
              className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white font-head min-h-[120px]"
              placeholder="What happened? What were you trying to do?"
              value={description}
              onChange={e => setDescription(e.target.value)}
              maxLength={1000}
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-white/70 hover:text-white hover:bg-white/5 font-bold transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2 rounded-xl bg-[#00BFFF] text-black font-bold hover:bg-[#38ccff] transition-all disabled:opacity-50"
            >
              {submitting ? "Submitting..." : "Submit Feedback"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
