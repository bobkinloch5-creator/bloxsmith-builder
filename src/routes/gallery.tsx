import { createFileRoute } from "@tanstack/react-router";
import { RequireAuth } from "@/components/RequireAuth";
import { Header, Footer } from "@/components/layout";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useServerFn } from "@tanstack/react-start";
import { moderateChatMessage } from "@/lib/chat-moderation.functions";
import { toast } from "sonner";
import { Heart, ImagePlus, Loader2, Flag, ImageIcon, Sparkles } from "lucide-react";
import { UserProfilePopover } from "@/components/chat/UserProfilePopover";

export const Route = createFileRoute("/gallery")({
  component: () => (
    <RequireAuth>
      <GalleryPage />
    </RequireAuth>
  ),
  head: () => ({
    meta: [
      { title: "Gallery — Share Your Roblox Game Screenshots | BloxSmith" },
      { name: "description", content: "Share screenshots of your Roblox games, like creations from other builders, and follow your favorite creators on BloxSmith." },
      { property: "og:title", content: "BloxSmith Gallery — Roblox Game Screenshots" },
      { property: "og:description", content: "Share, like and follow. A friendly, clean place for Roblox builders." },
    ],
    links: [{ rel: "canonical", href: "https://bloxsmith.pro/gallery" }],
  }),
});

type Post = {
  id: string;
  user_id: string;
  image_url: string;
  caption: string | null;
  created_at: string;
};
type Author = {
  id: string;
  display_name: string | null;
  chat_nickname: string | null;
  avatar_url: string | null;
};

function GalleryPage() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [authors, setAuthors] = useState<Record<string, Author>>({});
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [myLikes, setMyLikes] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [caption, setCaption] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [openProfile, setOpenProfile] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const moderate = useServerFn(moderateChatMessage);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      const { data: ps } = await (supabase as any)
        .from("gallery_posts")
        .select("id,user_id,image_url,caption,created_at")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(60);
      if (cancel) return;
      const list = (ps ?? []) as Post[];
      setPosts(list);
      const userIds = [...new Set(list.map((p) => p.user_id))];
      const postIds = list.map((p) => p.id);
      const [{ data: authorRows }, { data: likeRows }, { data: mineRows }] = await Promise.all([
        userIds.length
          ? supabase.from("profiles").select("id,display_name,chat_nickname,avatar_url").in("id", userIds)
          : Promise.resolve({ data: [] }),
        postIds.length
          ? (supabase as any).from("gallery_likes").select("post_id").in("post_id", postIds)
          : Promise.resolve({ data: [] }),
        user && postIds.length
          ? (supabase as any).from("gallery_likes").select("post_id").eq("user_id", user.id).in("post_id", postIds)
          : Promise.resolve({ data: [] }),
      ]);
      if (cancel) return;
      const am: Record<string, Author> = {};
      (authorRows ?? []).forEach((a: any) => (am[a.id] = a));
      const counts: Record<string, number> = {};
      (likeRows ?? []).forEach((r: any) => (counts[r.post_id] = (counts[r.post_id] ?? 0) + 1));
      setAuthors(am);
      setLikeCounts(counts);
      setMyLikes(new Set((mineRows ?? []).map((r: any) => r.post_id)));
      setLoading(false);
    })();
    return () => {
      cancel = true;
    };
  }, [user?.id]);

  function pickFile(f: File | null) {
    if (!f) return;
    if (!f.type.startsWith("image/")) return toast.error("Only images allowed");
    if (f.size > 6 * 1024 * 1024) return toast.error("Image must be < 6 MB");
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function createPost() {
    if (!user || !file || posting) return;
    setPosting(true);
    try {
      const cap = caption.trim();
      if (cap) {
        if (/(https?:\/\/|www\.[a-z0-9-]+\.[a-z]{2,}|[a-z0-9-]+\.(com|net|org|io|gg|xyz|co|me|app|dev))/i.test(cap)) {
          toast.error("Links aren't allowed — keep captions clean");
          return;
        }
        try {
          const verdict = await moderate({ data: { content: cap } });
          if (!verdict.allow) {
            toast.error(`Caption blocked: ${verdict.reason || "violates rules"}`);
            return;
          }
        } catch {}
      }
      const ext = file.name.split(".").pop() || "png";
      const path = `gallery/${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("chat-attachments").upload(path, file, { contentType: file.type });
      if (upErr) return toast.error(upErr.message);
      const { data: pub } = supabase.storage.from("chat-attachments").getPublicUrl(path);
      const { data: row, error } = await (supabase as any)
        .from("gallery_posts")
        .insert({ user_id: user.id, image_url: pub.publicUrl, caption: cap || null })
        .select("id,user_id,image_url,caption,created_at")
        .single();
      if (error) return toast.error(error.message);
      setPosts((p) => [row as Post, ...p]);
      setLikeCounts((c) => ({ ...c, [row.id]: 0 }));
      setFile(null);
      setPreview(null);
      setCaption("");
      if (fileInput.current) fileInput.current.value = "";
      toast.success("Posted to the gallery!");
    } finally {
      setPosting(false);
    }
  }

  async function toggleLike(postId: string) {
    if (!user) return;
    const liked = myLikes.has(postId);
    setMyLikes((s) => {
      const n = new Set(s);
      liked ? n.delete(postId) : n.add(postId);
      return n;
    });
    setLikeCounts((c) => ({ ...c, [postId]: Math.max(0, (c[postId] ?? 0) + (liked ? -1 : 1)) }));
    const { error } = await (supabase as any).rpc("toggle_gallery_like", { _post: postId });
    if (error) toast.error(error.message);
  }

  async function reportPost(postId: string, userId: string) {
    const reason = prompt("Why are you reporting this post?");
    if (!reason?.trim()) return;
    const { error } = await (supabase as any).rpc("report_user", {
      _target: userId,
      _reason: reason.trim().slice(0, 200),
      _context: `gallery_post:${postId}`,
    });
    if (error) return toast.error(error.message);
    toast.success("Thanks — moderators will review");
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-6 sm:py-10">
        <header className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-pink-500" /> Game Gallery
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Share screenshots of your Roblox games. Like and follow your favorite builders. Keep it clean — no NSFW, no links, no toxicity.
          </p>
        </header>

        {/* Composer */}
        <div className="mb-8 rounded-2xl border border-border bg-surface-elevated p-4">
          <div className="flex items-start gap-3">
            {preview ? (
              <div className="relative shrink-0">
                <img src={preview} alt="" className="h-28 w-28 rounded-lg object-cover border border-border" />
                <button
                  onClick={() => { setFile(null); setPreview(null); if (fileInput.current) fileInput.current.value = ""; }}
                  className="absolute -top-2 -right-2 grid h-6 w-6 place-items-center rounded-full bg-destructive text-white text-xs"
                >×</button>
              </div>
            ) : (
              <button
                onClick={() => fileInput.current?.click()}
                className="grid h-28 w-28 shrink-0 place-items-center rounded-lg border-2 border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary transition"
              >
                <ImagePlus className="h-7 w-7" />
              </button>
            )}
            <div className="flex-1 space-y-2">
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value.slice(0, 240))}
                rows={3}
                placeholder="Add a caption (optional)… no links please"
                className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">{caption.length}/240 · Images only · Max 6 MB</span>
                <button
                  onClick={createPost}
                  disabled={!file || posting}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                  Share image
                </button>
              </div>
            </div>
          </div>
          <input ref={fileInput} type="file" accept="image/*" hidden onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />
        </div>

        {/* Feed */}
        {loading ? (
          <div className="grid place-items-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : posts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
            No posts yet. Be the first to share a screenshot!
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {posts.map((p) => {
              const a = authors[p.user_id];
              const name = a?.chat_nickname || a?.display_name || "Builder";
              const liked = myLikes.has(p.id);
              return (
                <article key={p.id} className="overflow-hidden rounded-2xl border border-border bg-surface-elevated">
                  <button
                    onClick={() => setOpenProfile(p.user_id)}
                    className="flex w-full items-center gap-2 px-3 py-2.5 hover:bg-surface transition text-left"
                  >
                    <div className="grid h-8 w-8 place-items-center rounded-full border border-border bg-surface overflow-hidden">
                      {a?.avatar_url ? <img src={a.avatar_url} alt="" className="h-full w-full object-cover" /> : <span className="text-xs font-bold">{name.slice(0,1).toUpperCase()}</span>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{name}</div>
                      <div className="text-[10px] text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</div>
                    </div>
                  </button>
                  <img src={p.image_url} alt={p.caption ?? ""} className="w-full max-h-[520px] object-cover bg-background" loading="lazy" />
                  <div className="px-3 py-2.5 space-y-2">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => toggleLike(p.id)}
                        className={`inline-flex items-center gap-1 text-sm transition ${liked ? "text-pink-500" : "text-muted-foreground hover:text-pink-500"}`}
                      >
                        <Heart className={`h-5 w-5 ${liked ? "fill-current" : ""}`} />
                        <span className="font-semibold">{likeCounts[p.id] ?? 0}</span>
                      </button>
                      <div className="flex-1" />
                      {p.user_id !== user?.id && (
                        <button
                          onClick={() => reportPost(p.id, p.user_id)}
                          title="Report"
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Flag className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    {p.caption && <p className="text-sm text-foreground/90 break-words">{p.caption}</p>}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {openProfile && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={() => setOpenProfile(null)}>
            <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-surface-elevated" onClick={(e) => e.stopPropagation()}>
              <div className="relative h-[560px]">
                <UserProfilePopover userId={openProfile} onClose={() => setOpenProfile(null)} />
              </div>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
