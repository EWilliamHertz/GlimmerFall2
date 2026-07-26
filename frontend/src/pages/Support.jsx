import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { MessageSquareWarning, Send, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function Support() {
  const { user } = useAuth();
  const [reports, setReports] = useState([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const { data } = await api.get("/reports");
      setReports(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      return toast.error("Please fill in both title and description.");
    }
    
    setSubmitting(true);
    try {
      await api.post("/reports", {
        username: user?.nickname || "Anonymous",
        title: title.trim(),
        description: description.trim()
      });
      toast.success("Bug report submitted successfully!");
      setTitle("");
      setDescription("");
      fetchReports();
    } catch (err) {
      toast.error("Failed to submit report.");
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusIcon = (status) => {
    if (status === "OPEN") return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
    if (status === "IN PROGRESS") return <Clock className="w-4 h-4 text-blue-400" />;
    return <CheckCircle className="w-4 h-4 text-green-500" />;
  };

  return (
    <div className="max-w-5xl mx-auto px-5 py-10" data-testid="support-page">
      <div className="flex items-center gap-4 mb-8">
        <div className="p-4 rounded-2xl bg-black/40 border border-white/10 text-white/80">
          <MessageSquareWarning className="w-10 h-10" />
        </div>
        <div>
          <h1 className="font-display text-4xl md:text-5xl font-bold">Support & Feedback</h1>
          <p className="text-white/50 font-head text-lg mt-1">Report bugs, submit feedback, or view known issues.</p>
        </div>
      </div>

      <div className="grid md:grid-cols-[1fr_400px] gap-8">
        {/* Ticket List */}
        <div className="space-y-6">
          <h2 className="font-display text-2xl font-bold text-white mb-4">Recent Tickets</h2>
          {reports.length === 0 ? (
            <div className="glass rounded-2xl p-8 text-center text-white/50 font-head">
              No reports yet. Everything is running smoothly!
            </div>
          ) : (
            <div className="space-y-4">
              {reports.map((r) => (
                <div key={r.id} className="glass rounded-xl p-5 border border-white/5 transition-colors hover:border-white/10">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-lg text-white font-head">{r.title}</h3>
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/50 text-xs font-head font-bold tracking-wide">
                      {getStatusIcon(r.status)}
                      <span className={
                        r.status === "OPEN" ? "text-yellow-500" :
                        r.status === "IN PROGRESS" ? "text-blue-400" : "text-green-500"
                      }>{r.status}</span>
                    </span>
                  </div>
                  <p className="text-white/70 font-head text-sm mb-4 whitespace-pre-wrap">{r.description}</p>
                  <div className="flex justify-between text-xs text-white/40 font-head">
                    <span>Submitted by {r.username}</span>
                    <span>{new Date(r.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Submit Form */}
        <div className="glass rounded-3xl p-6 h-fit sticky top-24">
          <h2 className="font-display text-2xl font-bold mb-6">File a Report</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-white/70 mb-2 font-head">Title / Issue Summary</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Card not rendering correctly"
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-[#F2A900]/50 transition-colors font-head"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-white/70 mb-2 font-head">Detailed Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Please describe how to reproduce the bug..."
                rows={5}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-[#F2A900]/50 transition-colors font-head resize-none"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-3.5 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed font-head tracking-wide"
            >
              <Send className="w-5 h-5" />
              {submitting ? "Submitting..." : "Submit Ticket"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
